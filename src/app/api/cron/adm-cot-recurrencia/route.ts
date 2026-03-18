/**
 * CRON: ADM COT — Recurrencia de Pagos
 * 
 * Runs daily to:
 * 1. Find active recurrences with next_due_date <= today
 * 2. Charge the card via PF Recurrent (tokenized) using stored codOper
 * 3. Create payment record (CONFIRMADO_PF if PF succeeds, PENDIENTE_CONFIRMACION if not)
 * 4. Advance next_due_date by frequency
 * 5. Mark COMPLETADA if past end_date or all installments done
 * 6. Never exceeds 1 year from start_date
 * 
 * Protection: X-CRON-SECRET header or Vercel CRON_SECRET
 * Schedule: "0 8 * * *" (daily 3am Panama = 8am UTC)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// @ts-ignore — @shoopiapp/paguelofacil has no type declarations
import PagueloFacil from '@shoopiapp/paguelofacil';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  // Verify cron secret — ADM_COT_CRON_SECRET takes priority, fallback to CRON_SECRET
  const cronSecret = process.env.ADM_COT_CRON_SECRET || process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[CRON RECURRENCIA] No ADM_COT_CRON_SECRET or CRON_SECRET configured — blocking request');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  const xCronSecret = request.headers.get('x-cron-secret');
  const isValid = authHeader === `Bearer ${cronSecret}` || xCronSecret === cronSecret;
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createClient(supabaseUrl, supabaseServiceKey);
  const today = new Date().toISOString().slice(0, 10);

  let processed = 0;
  let created = 0;
  let charged = 0;
  let chargeFailed = 0;
  let completed = 0;
  const errors: string[] = [];

  // PagueloFacil SDK setup
  const pfCclw = process.env.PAGUELOFACIL_CCLW;
  const pfToken = process.env.PAGUELOFACIL_API_TOKEN;
  const pfEnv = process.env.PAGUELOFACIL_ENVIRONMENT || 'sandbox';
  const pfSdkEnv = pfEnv === 'production' ? 'production' : 'development';
  const pfConfigured = !!(pfCclw && pfToken);
  if (!pfConfigured) {
    console.warn('[CRON RECURRENCIA] PagueloFacil credentials not configured — payments will be created as PENDIENTE_CONFIRMACION without charging');
  }

  try {
    console.log(`[CRON RECURRENCIA] Running for date: ${today}`);

    // 1. Find active recurrences due today or earlier
    const { data: dueRecurrences, error: fetchErr } = await sb
      .from('adm_cot_recurrences')
      .select('*')
      .eq('status', 'ACTIVA')
      .lte('next_due_date', today);

    if (fetchErr) throw new Error(fetchErr.message);
    if (!dueRecurrences || dueRecurrences.length === 0) {
      return NextResponse.json({ success: true, timestamp: today, processed: 0, created: 0, completed: 0, message: 'No due recurrences' });
    }

    for (const rec of dueRecurrences) {
      processed++;
      try {
        const schedule: any[] = Array.isArray(rec.schedule) ? rec.schedule : [];
        const freqMonthsMap: Record<string, number> = {
          MENSUAL: 1, BIMESTRAL: 2, TRIMESTRAL: 3, CUATRIMESTRAL: 4, SEMESTRAL: 6,
        };
        const freqMonths = freqMonthsMap[rec.frequency] || 1;

        // Find the next PENDIENTE installment in schedule
        const nextInstallment = schedule.find((s: any) => s.status === 'PENDIENTE');
        if (!nextInstallment) {
          // All installments done → mark completed
          await sb.from('adm_cot_recurrences').update({ status: 'COMPLETADA' }).eq('id', rec.id);
          completed++;
          continue;
        }

        const installmentNum = nextInstallment.num;
        const paymentDate = nextInstallment.due_date || rec.next_due_date;
        // Use per-installment amount if present (last installment may differ for rounding)
        const chargeAmount = typeof nextInstallment.amount === 'number'
          ? nextInstallment.amount
          : rec.installment_amount;

        // Idempotency: check if payment already exists
        const { data: existing } = await sb.from('adm_cot_payments')
          .select('id')
          .eq('nro_poliza', rec.nro_poliza)
          .eq('insurer', rec.insurer)
          .eq('payment_date', paymentDate)
          .eq('installment_num', installmentNum)
          .maybeSingle();

        let paymentId = existing?.id;

        // ── Attempt PF charge if codOper available ──
        let pfChargeSuccess = false;
        let pfChargeCodOper: string | null = null;
        let pfChargeError: string | null = null;

        const originalCodOper = rec.pf_cod_oper;
        if (pfConfigured && originalCodOper && !existing) {
          try {
            const pf = new PagueloFacil(pfCclw, pfToken, pfSdkEnv);
            const recurrentInfo = {
              amount: Number(chargeAmount),
              taxAmount: 0.0,
              email: 'cobros@lideresenseguros.com',
              phone: '60000000',
              concept: `Cuota ${installmentNum}/${rec.total_installments} - ${rec.nro_poliza || 'Póliza'}`,
              description: `Cobro recurrente - ${rec.client_name} - ${rec.insurer}`,
              codOper: originalCodOper,
            };
            console.log(`[CRON RECURRENCIA] Charging PF Recurrent: rec=${rec.id}, amount=$${chargeAmount}, installment=${installmentNum}/${rec.total_installments}`);
            const pfRes = await pf.Recurrent(recurrentInfo);

            if (pfRes?.success && pfRes?.headerStatus?.code === 200 && pfRes?.data?.status === 1) {
              pfChargeSuccess = true;
              pfChargeCodOper = pfRes.data.codOper || null;
              charged++;
              console.log(`[CRON RECURRENCIA] ✅ PF charge OK: rec=${rec.id}, codOper=${pfChargeCodOper}`);
            } else {
              pfChargeError = pfRes?.message || pfRes?.headerStatus?.description || 'PF charge failed';
              chargeFailed++;
              console.warn(`[CRON RECURRENCIA] ⚠️ PF charge failed: rec=${rec.id}, error=${pfChargeError}`);
            }
          } catch (pfErr: any) {
            pfChargeError = pfErr.message || 'PF SDK error';
            chargeFailed++;
            console.error(`[CRON RECURRENCIA] ❌ PF charge exception: rec=${rec.id}`, pfErr);
          }
        }

        if (!paymentId) {
          const slaDueDate = nextInstallment.sla_due_date || null;
          const paymentStatus = pfChargeSuccess ? 'CONFIRMADO_PF' : 'PENDIENTE_CONFIRMACION';
          const { data: newPayment, error: insertErr } = await sb.from('adm_cot_payments').insert({
            client_name: rec.client_name,
            cedula: rec.cedula || null,
            nro_poliza: rec.nro_poliza,
            amount: chargeAmount,
            insurer: rec.insurer,
            ramo: 'AUTO',
            status: paymentStatus,
            payment_date: paymentDate,
            is_recurring: true,
            recurrence_id: rec.id,
            installment_num: installmentNum,
            payment_source: 'CRON_RECURRENCE',
            ...(slaDueDate ? { due_date: slaDueDate } : {}),
            ...(pfChargeCodOper ? { pf_cod_oper: pfChargeCodOper } : {}),
            ...(pfChargeSuccess ? { pf_confirmed_at: new Date().toISOString() } : {}),
          }).select('id').single();

          if (insertErr) {
            errors.push(`Rec ${rec.id}: ${insertErr.message}`);
            continue;
          }
          paymentId = newPayment.id;
          created++;
        }

        // Update schedule: mark this installment as PAGADO if PF succeeded, keep PENDIENTE otherwise
        const newInstallmentStatus = pfChargeSuccess ? 'PAGADO' : 'PENDIENTE';
        const updatedSchedule = schedule.map((s: any) =>
          s.num === installmentNum ? { ...s, status: newInstallmentStatus, payment_id: paymentId } : s
        );

        // Calculate next due date
        const nextDate = new Date(paymentDate);
        nextDate.setMonth(nextDate.getMonth() + freqMonths);
        const nextDueStr = nextDate.toISOString().slice(0, 10);

        // Check if next date exceeds end_date (1 year limit)
        const endDate = new Date(rec.end_date);
        const isLastOrPastEnd = nextDate > endDate || !updatedSchedule.some((s: any) => s.status === 'PENDIENTE' && s.num > installmentNum);

        if (isLastOrPastEnd) {
          await sb.from('adm_cot_recurrences').update({
            schedule: updatedSchedule,
            next_due_date: null,
            status: 'COMPLETADA',
          }).eq('id', rec.id);
          completed++;
        } else {
          await sb.from('adm_cot_recurrences').update({
            schedule: updatedSchedule,
            next_due_date: nextDueStr,
          }).eq('id', rec.id);
        }

        // Audit
        await sb.from('adm_cot_audit_log').insert({
          event_type: 'cron_payment_created',
          entity_type: 'recurrence',
          entity_id: rec.id,
          detail: {
            payment_id: paymentId,
            installment_num: installmentNum,
            payment_date: paymentDate,
            amount: chargeAmount,
            pf_charged: pfChargeSuccess,
            pf_cod_oper: pfChargeCodOper,
            pf_error: pfChargeError,
          },
        });

      } catch (recErr: any) {
        errors.push(`Rec ${rec.id}: ${recErr.message}`);
      }
    }

    console.log(`[CRON RECURRENCIA] Charges done: ${processed} processed, ${created} created, ${charged} charged, ${chargeFailed} charge failures, ${completed} completed, ${errors.length} errors`);

    // ════════════════════════════════════════════════════════════
    // RECONCILIATION — Query PF MerchantTransactions for today
    // Catch any payments the webhook may have missed
    // ════════════════════════════════════════════════════════════
    let reconciled = 0;
    let rejected = 0;

    const pfAccessToken = process.env.PAGUELOFACIL_API_TOKEN;
    const pfApiUrl = process.env.PAGUELOFACIL_API_URL
      || (pfEnv === 'production' ? 'https://api.pfserver.net' : 'https://api-sand.pfserver.net');
    const pfAdminUrl = process.env.PAGUELOFACIL_ADMIN_URL
      || (pfEnv === 'production' ? 'https://admin.paguelofacil.com' : 'https://sandbox.paguelofacil.com');

    if (pfAccessToken) {
      try {
        // Query PF for all transactions in the last 2 days (to catch late-night charges)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const startDate = yesterday.toISOString().slice(0, 10) + 'T00:00:00';
        const endDate = today + 'T23:59:59';

        const queryUrl = `${pfAdminUrl}/PFManagementServices/api/v1/MerchantTransactions?conditional=dateTms$bt${startDate}::${endDate}&limit=200`;

        console.log(`[CRON RECONCILIATION] Querying PF transactions: ${startDate} to ${endDate}`);

        const pfRes = await fetch(queryUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${pfAccessToken}`,
            'Accept': 'application/json',
          },
        });

        if (pfRes.ok) {
          const pfData = await pfRes.json();
          const transactions: any[] = pfData?.data || (Array.isArray(pfData) ? pfData : []);

          // Filter to RECURRENT transactions only
          const recurrentTxs = transactions.filter((tx: any) =>
            (tx.operationType === 'RECURRENT' || tx.operationType === 'recurrent')
          );

          console.log(`[CRON RECONCILIATION] Found ${transactions.length} total txs, ${recurrentTxs.length} RECURRENT`);

          for (const tx of recurrentTxs) {
            const txCodOper = tx.codOper;
            const txApproved = tx.status === 1;
            if (!txCodOper) continue;

            // Check if this tx's codOper already matches a confirmed payment
            const { data: existingPay } = await sb
              .from('adm_cot_payments')
              .select('id, status')
              .eq('pf_cod_oper', txCodOper)
              .maybeSingle();

            if (existingPay) {
              // Already tracked — reconcile status if needed
              if (txApproved && existingPay.status === 'PENDIENTE_CONFIRMACION') {
                await sb.from('adm_cot_payments').update({
                  status: 'CONFIRMADO_PF',
                  pf_confirmed_at: new Date().toISOString(),
                  pf_card_type: tx.cardType || tx.type || null,
                  pf_card_display: tx.displayNum || null,
                }).eq('id', existingPay.id);
                reconciled++;
                console.log(`[CRON RECONCILIATION] ✅ Reconciled: payment=${existingPay.id}, codOper=${txCodOper}`);
              } else if (!txApproved && existingPay.status === 'PENDIENTE_CONFIRMACION') {
                await sb.from('adm_cot_payments').update({
                  status: 'RECHAZADO_PF',
                  notes: { rejection_reason: tx.messageSys || 'Rechazado (reconciliación)', rejected_at: new Date().toISOString() },
                }).eq('id', existingPay.id);
                rejected++;

                // Notify masters of rejection
                try {
                  const { data: payDetail } = await sb.from('adm_cot_payments')
                    .select('client_name, nro_poliza, insurer, installment_num, amount')
                    .eq('id', existingPay.id).single();
                  if (payDetail) {
                    await sb.from('portal_notifications').insert({
                      type: 'chat_urgent',
                      title: `🔴 Pago recurrente rechazado: ${payDetail.client_name}`,
                      body: `Póliza ${payDetail.nro_poliza} cuota #${payDetail.installment_num} ($${payDetail.amount}) — ${payDetail.insurer}. Motivo: ${tx.messageSys || 'Desconocido'}`,
                      link: '/adm-cot/pagos?tab=pending&status=RECHAZADO_PF',
                      target_role: 'master',
                      target_user_id: null,
                    });
                  }
                } catch { /* non-fatal */ }

                console.log(`[CRON RECONCILIATION] ❌ Rejected: payment=${existingPay.id}, reason=${tx.messageSys}`);
              }
              continue;
            }

            // No match by codOper — try to match by relatedTx → recurrence pf_cod_oper
            const relatedTx = tx.relatedTx || '';
            if (relatedTx) {
              const { data: rec } = await sb
                .from('adm_cot_recurrences')
                .select('id, nro_poliza, client_name, insurer, installment_amount, schedule')
                .eq('pf_cod_oper', relatedTx)
                .eq('status', 'ACTIVA')
                .maybeSingle();

              if (rec) {
                const schedule = Array.isArray(rec.schedule) ? rec.schedule : [];
                const nextPending = schedule.find((s: any) => s.status === 'PENDIENTE');
                if (nextPending) {
                  // Check if payment record exists for this installment
                  const { data: instPay } = await sb
                    .from('adm_cot_payments')
                    .select('id, status')
                    .eq('recurrence_id', rec.id)
                    .eq('installment_num', nextPending.num)
                    .maybeSingle();

                  if (instPay && txApproved && instPay.status === 'PENDIENTE_CONFIRMACION') {
                    await sb.from('adm_cot_payments').update({
                      status: 'CONFIRMADO_PF',
                      pf_cod_oper: txCodOper,
                      pf_confirmed_at: new Date().toISOString(),
                      pf_card_type: tx.cardType || tx.type || null,
                      pf_card_display: tx.displayNum || null,
                    }).eq('id', instPay.id);
                    reconciled++;
                  } else if (instPay && !txApproved && instPay.status === 'PENDIENTE_CONFIRMACION') {
                    await sb.from('adm_cot_payments').update({
                      status: 'RECHAZADO_PF',
                      pf_cod_oper: txCodOper,
                      notes: { rejection_reason: tx.messageSys || 'Rechazado (reconciliación)', rejected_at: new Date().toISOString() },
                    }).eq('id', instPay.id);
                    rejected++;
                  }
                }
              }
            }
          }

          // Audit log for reconciliation run
          await sb.from('adm_cot_audit_log').insert({
            event_type: 'cron_reconciliation',
            entity_type: 'system',
            detail: {
              total_pf_transactions: transactions.length,
              recurrent_transactions: recurrentTxs.length,
              reconciled,
              rejected,
              date_range: `${startDate} to ${endDate}`,
            },
          });

        } else {
          const errText = await pfRes.text().catch(() => '');
          console.warn(`[CRON RECONCILIATION] PF API error: HTTP ${pfRes.status} — ${errText.slice(0, 200)}`);
          errors.push(`Reconciliation: PF API HTTP ${pfRes.status}`);
        }
      } catch (reconErr: any) {
        console.error('[CRON RECONCILIATION] Error:', reconErr);
        errors.push(`Reconciliation: ${reconErr.message}`);
      }
    } else {
      console.log('[CRON RECONCILIATION] Skipped — no PF access token configured');
    }

    console.log(`[CRON RECURRENCIA] Complete: charges=${charged}/${processed}, reconciled=${reconciled}, rejected=${rejected}`);

    return NextResponse.json({
      success: true,
      timestamp: today,
      processed,
      created,
      charged,
      chargeFailed,
      completed,
      reconciliation: { reconciled, rejected },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('[CRON RECURRENCIA] Fatal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
