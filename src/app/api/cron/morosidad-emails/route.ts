/**
 * CRON: Morosidad Auto-Emails
 * 
 * Runs daily to send staged notification emails for rejected recurring payments.
 * 
 * Schedule:
 *   Day 0  — Immediate: payment rejected notification
 *   Day 7  — Reminder: payment still pending
 *   Day 14 — Warning: urgent payment reminder  
 *   Day 30 — Final: coverage suspended warning
 *
 * Tracks which emails have been sent via the `notes` JSON field on adm_cot_payments:
 *   notes.morosidad_emails = { day0: "2026-03-17", day7: "2026-03-24", ... }
 *
 * Protection: X-CRON-SECRET header or Vercel CRON_SECRET
 * Schedule: "0 9 * * *" (daily 4am Panama = 9am UTC)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendZeptoEmail } from '@/lib/email/zepto-api';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PAYMENT_BASE_URL = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://portal.lideresenseguros.com'}/cotizadores?pagar=true`;

// Email stages: days since rejection → stage key
const EMAIL_STAGES = [
  { minDays: 0,  key: 'day0',  subject: 'Aviso: pago rechazado — Póliza {{poliza}}', stage: 'rejection' },
  { minDays: 7,  key: 'day7',  subject: 'Recordatorio: pago pendiente — Póliza {{poliza}}', stage: 'reminder' },
  { minDays: 14, key: 'day14', subject: '⚠️ Urgente: pago pendiente — Póliza {{poliza}}', stage: 'warning' },
  { minDays: 30, key: 'day30', subject: '🔴 Cobertura suspendida por falta de pago — Póliza {{poliza}}', stage: 'suspended' },
] as const;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.ADM_COT_CRON_SECRET || process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'No cron secret configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  const xCronSecret = request.headers.get('x-cron-secret');
  const isValid = authHeader === `Bearer ${cronSecret}` || xCronSecret === cronSecret;
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createClient(supabaseUrl, supabaseServiceKey);
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  let sent = 0;
  let skipped = 0;
  let noEmail = 0;
  const errors: string[] = [];

  try {
    console.log(`[CRON MOROSIDAD-EMAILS] Running for date: ${todayStr}`);

    // Fetch all RECHAZADO_PF recurring payments
    const { data: rejectedPayments, error: fetchErr } = await sb
      .from('adm_cot_payments')
      .select('id, client_name, cedula, nro_poliza, insurer, amount, installment_num, payment_date, notes, recurrence_id')
      .eq('status', 'RECHAZADO_PF')
      .eq('is_recurring', true)
      .order('payment_date', { ascending: true });

    if (fetchErr) throw new Error(fetchErr.message);
    if (!rejectedPayments || rejectedPayments.length === 0) {
      console.log('[CRON MOROSIDAD-EMAILS] No rejected payments found');
      return NextResponse.json({ success: true, sent: 0, message: 'No rejected payments' });
    }

    console.log(`[CRON MOROSIDAD-EMAILS] Found ${rejectedPayments.length} rejected payments`);

    // Build email map: cedula → email via clients.national_id
    const cedulas = [...new Set(rejectedPayments.map(p => p.cedula).filter(Boolean))];
    const emailMap: Record<string, string> = {};
    if (cedulas.length > 0) {
      const { data: clientRows } = await sb
        .from('clients')
        .select('national_id, email')
        .in('national_id', cedulas)
        .not('email', 'is', null);
      (clientRows ?? []).forEach((c: any) => {
        if (c.email && c.national_id) emailMap[c.national_id] = c.email;
      });
    }

    for (const payment of rejectedPayments) {
      try {
        const notes: any = payment.notes || {};
        const morosidadEmails: Record<string, string> = notes.morosidad_emails || {};
        const rejectedAt = notes.rejected_at || payment.payment_date;

        // Calculate days since rejection
        const rejectionDate = new Date(rejectedAt + (rejectedAt.includes('T') ? '' : 'T12:00:00'));
        const daysSinceRejection = Math.floor((now.getTime() - rejectionDate.getTime()) / (1000 * 60 * 60 * 24));

        // Determine which email stage to send (highest applicable not yet sent)
        let stageToSend: typeof EMAIL_STAGES[number] | null = null;
        for (const stage of EMAIL_STAGES) {
          if (daysSinceRejection >= stage.minDays && !morosidadEmails[stage.key]) {
            stageToSend = stage;
            break; // Send the earliest unsent stage first
          }
        }

        if (!stageToSend) {
          skipped++;
          continue;
        }

        // Get client email via cedula
        const cedula = payment.cedula || '';
        const clientEmail = emailMap[cedula] || null;
        if (!clientEmail) {
          noEmail++;
          continue;
        }

        const paymentUrl = `${PAYMENT_BASE_URL}&cedula=${encodeURIComponent(cedula)}`;

        // Build email
        const subject = stageToSend.subject
          .replace('{{poliza}}', payment.nro_poliza || '—');

        const htmlBody = buildEmailHtml({
          stage: stageToSend.stage,
          clientName: payment.client_name,
          nroPoliza: payment.nro_poliza || '—',
          insurer: payment.insurer,
          amount: payment.amount,
          installmentNum: payment.installment_num || 0,
          daysSinceRejection,
          paymentUrl,
          rejectionReason: notes.rejection_reason || 'Pago rechazado',
        });

        const textBody = `Estimado/a ${payment.client_name}, su pago de la cuota #${payment.installment_num} de la póliza ${payment.nro_poliza} fue rechazado. Monto: $${Number(payment.amount).toFixed(2)}. Realice su pago en: ${paymentUrl}`;

        const result = await sendZeptoEmail({
          to: clientEmail,
          subject,
          htmlBody,
          textBody,
        });

        if (result.success) {
          sent++;

          // Update notes with sent stage
          const updatedMorosidadEmails = { ...morosidadEmails, [stageToSend.key]: todayStr };
          const updatedNotes = { ...notes, morosidad_emails: updatedMorosidadEmails };
          await sb.from('adm_cot_payments').update({ notes: updatedNotes }).eq('id', payment.id);

          // Audit log
          await sb.from('adm_cot_audit_log').insert({
            event_type: 'morosidad_auto_email',
            entity_type: 'payment',
            entity_id: payment.id,
            detail: {
              stage: stageToSend.key,
              days_since_rejection: daysSinceRejection,
              client_email: clientEmail,
              zepto_message_id: result.messageId,
              nro_poliza: payment.nro_poliza,
            },
          });

          console.log(`[CRON MOROSIDAD-EMAILS] ✅ ${stageToSend.key} sent: ${payment.nro_poliza} → ${clientEmail}`);
        } else {
          errors.push(`${payment.nro_poliza} ${stageToSend.key}: ${result.error}`);
        }
      } catch (payErr: any) {
        errors.push(`${payment.nro_poliza}: ${payErr.message}`);
      }
    }

    console.log(`[CRON MOROSIDAD-EMAILS] Done: ${sent} sent, ${skipped} skipped, ${noEmail} no-email, ${errors.length} errors`);

    return NextResponse.json({
      success: true,
      timestamp: todayStr,
      sent,
      skipped,
      noEmail,
      errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
    });
  } catch (error: any) {
    console.error('[CRON MOROSIDAD-EMAILS] Fatal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ════════════════════════════════════════════
// Email HTML Builder
// ════════════════════════════════════════════

function buildEmailHtml(params: {
  stage: string;
  clientName: string;
  nroPoliza: string;
  insurer: string;
  amount: number;
  installmentNum: number;
  daysSinceRejection: number;
  paymentUrl: string;
  rejectionReason: string;
}): string {
  const { stage, clientName, nroPoliza, insurer, amount, installmentNum, daysSinceRejection, paymentUrl, rejectionReason } = params;
  const fmtAmount = `$${Number(amount).toFixed(2)}`;

  const stageConfig: Record<string, { headerBg: string; headerTitle: string; icon: string; bodyText: string; ctaText: string; urgencyBanner?: string }> = {
    rejection: {
      headerBg: '#010139',
      headerTitle: 'Aviso de Pago Rechazado',
      icon: '⚠️',
      bodyText: `Le informamos que el cobro automático de su cuota <strong>#${installmentNum}</strong> por <strong>${fmtAmount}</strong> de la póliza <strong>${nroPoliza}</strong> (${insurer}) ha sido <strong style="color:#dc2626;">rechazado</strong>.<br/><br/>Motivo: <em>${rejectionReason}</em><br/><br/>Le solicitamos realizar el pago manualmente a la mayor brevedad para mantener su cobertura activa.`,
      ctaText: 'Realizar mi pago ahora',
    },
    reminder: {
      headerBg: '#010139',
      headerTitle: 'Recordatorio de Pago Pendiente',
      icon: '📋',
      bodyText: `Le recordamos que el pago de su cuota <strong>#${installmentNum}</strong> por <strong>${fmtAmount}</strong> de la póliza <strong>${nroPoliza}</strong> (${insurer}) se encuentra pendiente desde hace <strong>${daysSinceRejection} días</strong>.<br/><br/>El cobro automático fue rechazado y aún no hemos recibido el pago correspondiente. Le agradecemos regularizar su situación.`,
      ctaText: 'Pagar ahora',
    },
    warning: {
      headerBg: '#d97706',
      headerTitle: '⚠️ Pago Urgente Requerido',
      icon: '⚠️',
      bodyText: `<strong style="color:#d97706;">AVISO IMPORTANTE:</strong> Su cuota <strong>#${installmentNum}</strong> por <strong>${fmtAmount}</strong> de la póliza <strong>${nroPoliza}</strong> (${insurer}) lleva <strong>${daysSinceRejection} días sin pago</strong>.<br/><br/>De no realizar el pago en los próximos días, su cobertura podría verse afectada. Le urgimos realizar el pago de inmediato.`,
      ctaText: 'Pagar de inmediato',
      urgencyBanner: `<div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:8px;padding:12px 16px;margin:16px 0;text-align:center;"><strong style="color:#92400e;">⚠️ ${daysSinceRejection} días de atraso — Su cobertura está en riesgo</strong></div>`,
    },
    suspended: {
      headerBg: '#dc2626',
      headerTitle: '🔴 Cobertura Suspendida por Falta de Pago',
      icon: '🛑',
      bodyText: `<strong style="color:#dc2626;">AVISO FINAL:</strong> Debido a que su cuota <strong>#${installmentNum}</strong> por <strong>${fmtAmount}</strong> de la póliza <strong>${nroPoliza}</strong> (${insurer}) no ha sido pagada después de <strong>${daysSinceRejection} días</strong>, le informamos que:<br/><br/><div style="background:#fef2f2;border:2px solid #dc2626;border-radius:8px;padding:16px;margin:12px 0;"><strong style="color:#dc2626;font-size:16px;">La cobertura de su póliza se encuentra SUSPENDIDA por falta de pago.</strong><br/><br/><span style="color:#991b1b;">Cualquier siniestro ocurrido durante este período NO tendrá cobertura.</span></div>Para reactivar su cobertura, realice el pago pendiente de forma inmediata.`,
      ctaText: 'Realizar pago y reactivar cobertura',
      urgencyBanner: `<div style="background:#fef2f2;border:2px solid #dc2626;border-radius:8px;padding:12px 16px;margin:16px 0;text-align:center;"><strong style="color:#991b1b;">🔴 COBERTURA SUSPENDIDA — ${daysSinceRejection} días sin pago</strong></div>`,
    },
  };

  const config = (stageConfig[stage] || stageConfig['rejection'])!;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;margin:0;padding:0;background:#f9fafb;">
<div style="max-width:640px;margin:0 auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
<div style="background:${config.headerBg};color:white;padding:24px;">
<h1 style="margin:0;font-size:20px;">${config.icon} ${config.headerTitle}</h1>
<p style="margin:6px 0 0;font-size:13px;opacity:0.85;">Líderes en Seguros</p>
</div>
<div style="padding:24px;font-size:14px;line-height:1.7;color:#374151;">
<p>Estimado/a <strong>${clientName}</strong>,</p>
${config.urgencyBanner || ''}
<p>${config.bodyText}</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:13px;">
<tr><td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;width:45%;">Póliza</td><td style="padding:10px 14px;border:1px solid #e5e7eb;">${nroPoliza}</td></tr>
<tr><td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Aseguradora</td><td style="padding:10px 14px;border:1px solid #e5e7eb;">${insurer}</td></tr>
<tr><td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Cuota</td><td style="padding:10px 14px;border:1px solid #e5e7eb;">#${installmentNum}</td></tr>
<tr><td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Monto pendiente</td><td style="padding:10px 14px;border:1px solid #e5e7eb;color:#dc2626;font-weight:bold;font-size:16px;">${fmtAmount}</td></tr>
<tr><td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Días de atraso</td><td style="padding:10px 14px;border:1px solid #e5e7eb;color:${daysSinceRejection >= 30 ? '#dc2626' : daysSinceRejection >= 14 ? '#d97706' : '#374151'};font-weight:bold;">${daysSinceRejection} días</td></tr>
</table>
</div>
<div style="padding:0 24px 24px;text-align:center;">
<a href="${paymentUrl}" style="display:inline-block;padding:16px 40px;background:#8AAA19;color:white;text-decoration:none;font-weight:bold;font-size:16px;border-radius:12px;letter-spacing:0.3px;box-shadow:0 4px 12px rgba(138,170,25,0.3);">${config.ctaText}</a>
<p style="margin-top:12px;font-size:12px;color:#6b7280;">Haga clic en el botón para pagar de forma rápida y segura.</p>
</div>
<div style="padding:16px 24px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;">
<p style="margin:0;">Líderes en Seguros, S.A. | portal.lideresenseguros.com</p>
<p style="margin:4px 0 0;">Regulado y Supervisado por la Superintendencia de Seguros y Reaseguros de Panamá | Licencia PJ750</p>
</div>
</div>
</body></html>`;
}
