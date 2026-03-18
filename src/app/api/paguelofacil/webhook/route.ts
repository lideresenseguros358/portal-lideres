/**
 * POST /api/paguelofacil/webhook
 * ===============================
 * Receives payment confirmation webhooks from PagueloFacil.
 * PagueloFacil sends a POST with transaction details after each payment.
 *
 * This endpoint automatically processes:
 * 1. RECURRENT transactions — matches by pf_cod_oper on recurrence,
 *    updates payment status (CONFIRMADO_PF / RECHAZADO_PF) and schedule.
 * 2. AUTH_CAPTURE / SALE — matches by pf_cod_oper on payment record.
 *
 * For REJECTED recurrent charges:
 * - Marks payment as RECHAZADO_PF with rejection reason
 * - Sends portal_notifications to masters
 *
 * NOTE: Configure this URL in PagueloFacil's webhook settings:
 *   https://portal.lideresenseguros.com/api/paguelofacil/webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { type PFWebhookPayload } from '@/lib/paguelofacil/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSb() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function POST(request: NextRequest) {
  const sb = getSb();

  try {
    const payload: PFWebhookPayload = await request.json();

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
    // RECURRENT transaction — auto-confirm or reject
    // ════════════════════════════════════════════
    if (opType === 'RECURRENT' || opType === 'recurrent') {
      // The codOper in a RECURRENT webhook is the NEW transaction codOper.
      // We need to find the recurrence by its original pf_cod_oper (stored on adm_cot_recurrences)
      // or by matching the related transaction. PF's `relatedTx` may have the original codOper.
      //
      // Strategy: look for PENDIENTE_CONFIRMACION payments created by the cron
      // that have a matching recurrence whose pf_cod_oper is the original auth.
      // Since the cron stores its own pf_cod_oper on the payment row when charge succeeds,
      // and for failed charges it doesn't store one, we match differently:
      //
      // 1. If PF charge APPROVED: the cron already marked it CONFIRMADO_PF. 
      //    But if cron hasn't run yet (webhook arrived first), find the recurrence 
      //    and create/update the payment.
      //
      // 2. If PF charge DECLINED: find PENDIENTE_CONFIRMACION payments whose
      //    recurrence pf_cod_oper matches the related tx, and mark RECHAZADO_PF.

      // Try to find payment by the new codOper first (cron may have stored it)
      const { data: directMatch } = await sb
        .from('adm_cot_payments')
        .select('id, recurrence_id, status, installment_num, nro_poliza, client_name, insurer, amount')
        .eq('pf_cod_oper', codOper)
        .maybeSingle();

      if (directMatch) {
        // Direct match found — this is likely a cron-initiated charge
        if (isApproved && directMatch.status !== 'CONFIRMADO_PF') {
          await sb.from('adm_cot_payments').update({
            status: 'CONFIRMADO_PF',
            pf_confirmed_at: now,
            pf_card_type: payload.cardType || null,
            pf_card_display: payload.displayNum || null,
          }).eq('id', directMatch.id);

          // Update recurrence schedule
          if (directMatch.recurrence_id) {
            await updateRecurrenceSchedule(sb, directMatch.recurrence_id, directMatch.installment_num!, directMatch.id, true);
          }

          await logWebhookEvent(sb, 'recurrent_confirmed', directMatch.id, codOper, payload);
          console.log(`[PF WEBHOOK] ✅ Recurrent confirmed: payment=${directMatch.id}`);

        } else if (!isApproved) {
          await sb.from('adm_cot_payments').update({
            status: 'RECHAZADO_PF',
            notes: { rejection_reason: payload.messageSys || 'Pago rechazado', rejected_at: now, pf_codOper: codOper },
          }).eq('id', directMatch.id);

          await logWebhookEvent(sb, 'recurrent_rejected', directMatch.id, codOper, payload);
          await notifyRejection(sb, directMatch, payload);
          console.log(`[PF WEBHOOK] ❌ Recurrent rejected: payment=${directMatch.id}, reason=${payload.messageSys}`);
        }

        return NextResponse.json({ received: true, action: 'recurrent_processed', paymentId: directMatch.id });
      }

      // No direct match — try to find by recurrence's original codOper
      // PF sends the original codOper in the `description` or we match via recurrence
      const relatedCodOper = payload.relatedTx || '';
      if (relatedCodOper) {
        const { data: rec } = await sb
          .from('adm_cot_recurrences')
          .select('id, nro_poliza, client_name, insurer, installment_amount, schedule, pf_cod_oper')
          .eq('pf_cod_oper', relatedCodOper)
          .eq('status', 'ACTIVA')
          .maybeSingle();

        if (rec) {
          // Find the next PENDIENTE installment in schedule
          const schedule = Array.isArray(rec.schedule) ? rec.schedule : [];
          const nextPending = schedule.find((s: any) => s.status === 'PENDIENTE');

          if (nextPending) {
            // Find or create the payment record
            const { data: existingPay } = await sb
              .from('adm_cot_payments')
              .select('id')
              .eq('recurrence_id', rec.id)
              .eq('installment_num', nextPending.num)
              .maybeSingle();

            if (existingPay) {
              // Update existing
              const newStatus = isApproved ? 'CONFIRMADO_PF' : 'RECHAZADO_PF';
              const updateData: Record<string, any> = {
                status: newStatus,
                pf_cod_oper: codOper,
                pf_confirmed_at: isApproved ? now : null,
                pf_card_type: payload.cardType || null,
                pf_card_display: payload.displayNum || null,
              };
              if (!isApproved) {
                updateData.notes = { rejection_reason: payload.messageSys || 'Pago rechazado', rejected_at: now };
              }
              const { error: updateErr } = await sb.from('adm_cot_payments').update(updateData).eq('id', existingPay.id);
              if (updateErr) console.error(`[PF WEBHOOK] Update error for payment ${existingPay.id}:`, updateErr.message);

              if (isApproved) {
                await updateRecurrenceSchedule(sb, rec.id, nextPending.num, existingPay.id, true);
              }

              await logWebhookEvent(sb, isApproved ? 'recurrent_confirmed' : 'recurrent_rejected', existingPay.id, codOper, payload);
              if (!isApproved) await notifyRejection(sb, { ...rec, installment_num: nextPending.num, amount: nextPending.amount }, payload);

              return NextResponse.json({ received: true, action: 'recurrent_matched_by_relation', paymentId: existingPay.id });

            } else if (isApproved) {
              // Create new payment record (webhook arrived before cron)
              const { data: newPay } = await sb.from('adm_cot_payments').insert({
                recurrence_id: rec.id,
                nro_poliza: rec.nro_poliza,
                client_name: rec.client_name,
                insurer: rec.insurer,
                ramo: 'AUTO',
                amount: nextPending.amount || rec.installment_amount,
                installment_num: nextPending.num,
                payment_date: new Date().toISOString().slice(0, 10),
                status: 'CONFIRMADO_PF',
                is_recurring: true,
                is_refund: false,
                pf_cod_oper: codOper,
                pf_confirmed_at: now,
                pf_card_type: payload.cardType || null,
                pf_card_display: payload.displayNum || null,
                payment_source: 'PF_WEBHOOK',
              }).select('id').single();

              if (newPay) {
                await updateRecurrenceSchedule(sb, rec.id, nextPending.num, newPay.id, true);
                await logWebhookEvent(sb, 'recurrent_created_confirmed', newPay.id, codOper, payload);
              }

              return NextResponse.json({ received: true, action: 'recurrent_created', paymentId: newPay?.id });
            }
          }
        }
      }

      // Fallback: couldn't match — log for manual review
      await logWebhookEvent(sb, 'recurrent_unmatched', null, codOper, payload);
      console.warn(`[PF WEBHOOK] ⚠️ RECURRENT unmatched: codOper=${codOper}`);
      return NextResponse.json({ received: true, action: 'recurrent_unmatched' });
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
