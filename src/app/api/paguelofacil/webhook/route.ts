/**
 * POST /api/paguelofacil/webhook
 * ===============================
 * Receives payment confirmation webhooks from PagueloFacil.
 * PagueloFacil is used ONLY for the FIRST (initial) policy payment.
 *
 * Recurring installments are paid directly by the client with the insurer.
 * RECURRENT webhooks are logged and ignored — we do NOT process them.
 *
 * This endpoint processes:
 * - AUTH_CAPTURE / SALE / CAPTURE — first payment confirmation or rejection.
 *
 * NOTE: Configure this URL in PagueloFacil's webhook settings:
 *   https://portal.lideresenseguros.com/api/paguelofacil/webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { type PFWebhookPayload } from '@/lib/paguelofacil/config';
import { sendZeptoEmail } from '@/lib/email/zepto-api';
import { rateLimit, RATE_LIMITS, getClientIp } from '@/lib/security/rate-limit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PAYMENT_BASE_URL = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://portal.lideresenseguros.com'}/cotizadores?pagar=true`;

const webhookLimiter = rateLimit(RATE_LIMITS.WEBHOOK);

function getSb() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const rl = webhookLimiter(request);
  if (!rl.ok) return rl.response;

  // PagueloFacil does NOT send a webhook secret — authentication is based on
  // payload structure validation + codOper matching against our DB records.
  // Log the source IP for audit purposes.
  const clientIp = getClientIp(request);
  console.log(`[PF WEBHOOK] Incoming from IP: ${clientIp}`);

  // Validate Content-Type
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json') && !contentType.includes('application/x-www-form-urlencoded')) {
    return NextResponse.json({ error: 'Invalid content type' }, { status: 415 });
  }

  const sb = getSb();

  try {
    const payload: PFWebhookPayload = await request.json();

    // Validate required PF webhook fields — reject malformed payloads
    if (
      typeof payload.codOper !== 'string' ||
      typeof payload.operationType !== 'string' ||
      typeof payload.status !== 'number' ||
      !payload.codOper
    ) {
      console.warn(`[PF WEBHOOK] ❌ Malformed payload from IP ${clientIp}:`, JSON.stringify(payload).substring(0, 300));
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const isApproved = payload.status === 1;
    const logPrefix = isApproved ? '✅' : '❌';
    const opType = payload.operationType || '';
    const codOper = payload.codOper || '';
    const now = new Date().toISOString();

    console.log(
      `[PF WEBHOOK] ${logPrefix} ${opType} ${codOper}:`,
      {
        status: isApproved ? 'APPROVED' : 'DECLINED',
        amount: payload.totalPay,
        cardType: payload.cardType,
        displayNum: payload.displayNum,
        messageSys: payload.messageSys,
      }
    );

    if (!codOper) {
      console.warn('[PF WEBHOOK] No codOper — ignoring');
      return NextResponse.json({ received: true, action: 'ignored_no_codoper' });
    }

    // ════════════════════════════════════════════
    // RECURRENT — ignored. Recurring charges go directly through the insurer.
    // We log the event for audit purposes only.
    // ════════════════════════════════════════════
    if (opType === 'RECURRENT' || opType === 'recurrent') {
      // Recurring charges go directly through the insurer — NOT PagueloFacil.
      // Log for audit and return 200 so PF stops retrying.
      await logWebhookEvent(sb, 'recurrent_unmatched', null, codOper, payload);
      console.log(`[PF WEBHOOK] RECURRENT ignored (insurer direct payment model): codOper=${codOper}`);
      return NextResponse.json({ received: true, action: 'recurrent_ignored_insurer_direct' });
    }

    // ════════════════════════════════════════════
    // AUTH_CAPTURE / SALE — one-time payments
    // ════════════════════════════════════════════
    if (opType === 'AUTH_CAPTURE' || opType === 'SALE' || opType === 'CAPTURE') {
      const { data: payment } = await sb
        .from('adm_cot_payments')
        .select('id, status')
        .eq('pf_cod_oper', codOper)
        .maybeSingle();

      if (payment) {
        if (isApproved && payment.status !== 'CONFIRMADO_PF') {
          await sb.from('adm_cot_payments').update({
            status: 'CONFIRMADO_PF',
            pf_confirmed_at: now,
            pf_card_type: payload.cardType || null,
            pf_card_display: payload.displayNum || null,
          }).eq('id', payment.id);
          await logWebhookEvent(sb, 'payment_confirmed', payment.id, codOper, payload);
        } else if (!isApproved) {
          await sb.from('adm_cot_payments').update({
            status: 'RECHAZADO_PF',
            notes: { rejection_reason: payload.messageSys || 'Pago rechazado', rejected_at: now },
          }).eq('id', payment.id);
          await logWebhookEvent(sb, 'payment_rejected', payment.id, codOper, payload);
        }
        return NextResponse.json({ received: true, action: 'payment_updated', paymentId: payment.id });
      }

      // No match — log and move on
      await logWebhookEvent(sb, 'payment_unmatched', null, codOper, payload);
      return NextResponse.json({ received: true, action: 'payment_unmatched' });
    }

    // ════════════════════════════════════════════
    // Other operation types — just log
    // ════════════════════════════════════════════
    await logWebhookEvent(sb, `other_${opType.toLowerCase()}`, null, codOper, payload);
    return NextResponse.json({ received: true, action: 'logged' });

  } catch (error: any) {
    console.error('[PF WEBHOOK] Error processing webhook:', error);
    // Always return 200 to prevent PagueloFacil from retrying
    return NextResponse.json({ received: true, error: 'processing_error' });
  }
}

// Allow GET for webhook health check
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'paguelofacil-webhook' });
}

// ════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════

async function updateRecurrenceSchedule(
  sb: ReturnType<typeof getSb>,
  recurrenceId: string,
  installmentNum: number,
  paymentId: string,
  markPaid: boolean,
) {
  const { data: rec } = await sb
    .from('adm_cot_recurrences')
    .select('schedule, frequency')
    .eq('id', recurrenceId)
    .single();
  if (!rec) return;

  const schedule = Array.isArray(rec.schedule) ? [...rec.schedule] : [];
  const updated = schedule.map((s: any) => {
    if (s.num === installmentNum && markPaid) {
      return { ...s, status: 'PAGADO', payment_id: paymentId };
    }
    return s;
  });

  const allPaid = updated.every((s: any) => s.status === 'PAGADO');
  const nextPending = updated.find((s: any) => s.status === 'PENDIENTE');

  await sb.from('adm_cot_recurrences').update({
    schedule: updated,
    next_due_date: nextPending?.due_date || null,
    status: allPaid ? 'COMPLETADA' : 'ACTIVA',
  }).eq('id', recurrenceId);
}

async function logWebhookEvent(
  sb: ReturnType<typeof getSb>,
  eventType: string,
  paymentId: string | null,
  codOper: string,
  payload: PFWebhookPayload,
) {
  try {
    await sb.from('adm_cot_audit_log').insert({
      event_type: `pf_webhook_${eventType}`,
      entity_type: paymentId ? 'payment' : 'webhook',
      entity_id: paymentId,
      detail: {
        codOper,
        operationType: payload.operationType,
        status: payload.status,
        amount: payload.totalPay,
        cardType: payload.cardType,
        displayNum: payload.displayNum,
        messageSys: payload.messageSys,
        date: payload.date,
      },
    });
  } catch { /* non-fatal */ }
}

async function sendDay0RejectionEmail(
  sb: ReturnType<typeof getSb>,
  paymentId: string,
  paymentInfo: { nro_poliza?: string; client_name?: string; insurer?: string; installment_num?: number; amount?: number; cedula?: string },
  rejectionReason: string,
) {
  try {
    // Get cedula for payment link + email lookup
    let cedula = paymentInfo.cedula || '';
    if (!cedula) {
      const { data: payRow } = await sb.from('adm_cot_payments').select('cedula').eq('id', paymentId).maybeSingle();
      cedula = payRow?.cedula || '';
    }

    // Look up client email via cedula → clients.national_id
    if (!cedula) {
      console.log(`[PF WEBHOOK] No cedula for payment ${paymentId} — skipping day-0 email`);
      return;
    }
    const { data: clientRow } = await sb
      .from('clients')
      .select('email')
      .eq('national_id', cedula)
      .not('email', 'is', null)
      .maybeSingle();

    const clientEmail = clientRow?.email;
    if (!clientEmail) {
      console.log(`[PF WEBHOOK] No email found for cedula ${cedula} — skipping day-0 email`);
      return;
    }

    const paymentUrl = `${PAYMENT_BASE_URL}&cedula=${encodeURIComponent(cedula)}`;
    const fmtAmount = `$${Number(paymentInfo.amount || 0).toFixed(2)}`;
    const todayStr = new Date().toISOString().slice(0, 10);

    const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;margin:0;padding:0;background:#f9fafb;">
<div style="max-width:640px;margin:0 auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
<div style="background:#010139;color:white;padding:24px;">
<h1 style="margin:0;font-size:20px;">⚠️ Aviso de Pago Rechazado</h1>
<p style="margin:6px 0 0;font-size:13px;opacity:0.85;">Líderes en Seguros</p>
</div>
<div style="padding:24px;font-size:14px;line-height:1.7;color:#374151;">
<p>Estimado/a <strong>${paymentInfo.client_name || 'Cliente'}</strong>,</p>
<p>Le informamos que el cobro automático de su cuota <strong>#${paymentInfo.installment_num || '?'}</strong> por <strong>${fmtAmount}</strong> de la póliza <strong>${paymentInfo.nro_poliza}</strong> (${paymentInfo.insurer || ''}) ha sido <strong style="color:#dc2626;">rechazado</strong>.</p>
<p>Motivo: <em>${rejectionReason}</em></p>
<p>Le solicitamos realizar el pago manualmente a la mayor brevedad para mantener su cobertura activa.</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:13px;">
<tr><td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;width:45%;">Póliza</td><td style="padding:10px 14px;border:1px solid #e5e7eb;">${paymentInfo.nro_poliza}</td></tr>
<tr><td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Aseguradora</td><td style="padding:10px 14px;border:1px solid #e5e7eb;">${paymentInfo.insurer || ''}</td></tr>
<tr><td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Cuota</td><td style="padding:10px 14px;border:1px solid #e5e7eb;">#${paymentInfo.installment_num || '?'}</td></tr>
<tr><td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Monto pendiente</td><td style="padding:10px 14px;border:1px solid #e5e7eb;color:#dc2626;font-weight:bold;font-size:16px;">${fmtAmount}</td></tr>
</table>
</div>
<div style="padding:0 24px 24px;text-align:center;">
<a href="${paymentUrl}" style="display:inline-block;padding:16px 40px;background:#8AAA19;color:white;text-decoration:none;font-weight:bold;font-size:16px;border-radius:12px;letter-spacing:0.3px;box-shadow:0 4px 12px rgba(138,170,25,0.3);">Realizar mi pago ahora</a>
<p style="margin-top:12px;font-size:12px;color:#6b7280;">Haga clic en el botón para pagar de forma rápida y segura.</p>
</div>
<div style="padding:16px 24px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;">
<p style="margin:0;">Líderes en Seguros, S.A. | portal.lideresenseguros.com</p>
<p style="margin:4px 0 0;">Regulado y Supervisado por la Superintendencia de Seguros y Reaseguros de Panamá | Licencia PJ750</p>
</div>
</div>
</body></html>`;

    const result = await sendZeptoEmail({
      to: clientEmail,
      subject: `Aviso: pago rechazado — Póliza ${paymentInfo.nro_poliza}`,
      htmlBody,
      textBody: `Estimado/a ${paymentInfo.client_name}, su pago de la cuota #${paymentInfo.installment_num} de la póliza ${paymentInfo.nro_poliza} fue rechazado (${rejectionReason}). Monto: ${fmtAmount}. Pague en: ${paymentUrl}`,
    });

    if (result.success) {
      // Track day0 email sent in notes
      const { data: payRow } = await sb.from('adm_cot_payments').select('notes').eq('id', paymentId).single();
      const notes = payRow?.notes || {};
      const morosidadEmails = (notes as any).morosidad_emails || {};
      morosidadEmails.day0 = todayStr;
      await sb.from('adm_cot_payments').update({ notes: { ...notes as any, morosidad_emails: morosidadEmails } }).eq('id', paymentId);

      await sb.from('adm_cot_audit_log').insert({
        event_type: 'morosidad_auto_email',
        entity_type: 'payment',
        entity_id: paymentId,
        detail: { stage: 'day0', source: 'webhook', client_email: clientEmail, zepto_message_id: result.messageId, nro_poliza: paymentInfo.nro_poliza },
      });

      console.log(`[PF WEBHOOK] 📧 Day-0 rejection email sent: ${paymentInfo.nro_poliza} → ${clientEmail}`);
    } else {
      console.warn(`[PF WEBHOOK] Day-0 email failed: ${result.error}`);
    }
  } catch (emailErr: any) {
    console.error(`[PF WEBHOOK] Day-0 email error:`, emailErr.message);
  }
}

async function notifyRejection(
  sb: ReturnType<typeof getSb>,
  paymentInfo: { nro_poliza?: string; client_name?: string; insurer?: string; installment_num?: number; amount?: number },
  payload: PFWebhookPayload,
) {
  try {
    await sb.from('portal_notifications').insert({
      type: 'chat_urgent',
      title: `🔴 Pago recurrente rechazado: ${paymentInfo.client_name || 'Cliente'}`,
      body: `Póliza ${paymentInfo.nro_poliza || '—'} cuota #${paymentInfo.installment_num || '?'} ($${paymentInfo.amount || '?'}) — ${paymentInfo.insurer || ''}. Motivo: ${payload.messageSys || 'Desconocido'}`,
      link: '/adm-cot/pagos?tab=pending&status=RECHAZADO_PF',
      target_role: 'master',
      target_user_id: null,
    });
  } catch { /* non-fatal */ }
}
