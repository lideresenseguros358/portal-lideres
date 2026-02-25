/**
 * CRON: ADM COT — Recurrencia de Pagos
 * 
 * Runs daily to:
 * 1. Find active recurrences with next_due_date <= today
 * 2. Create pending payment for each (idempotent)
 * 3. Advance next_due_date by frequency
 * 4. Mark COMPLETADA if past end_date or all installments done
 * 5. Never exceeds 1 year from start_date
 * 
 * Protection: X-CRON-SECRET header or Vercel CRON_SECRET
 * Schedule: "0 8 * * *" (daily 3am Panama = 8am UTC)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
  let completed = 0;
  const errors: string[] = [];

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
        const freqMonths = rec.frequency === 'MENSUAL' ? 1 : 6;

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

        // Idempotency: check if payment already exists
        const { data: existing } = await sb.from('adm_cot_payments')
          .select('id')
          .eq('nro_poliza', rec.nro_poliza)
          .eq('insurer', rec.insurer)
          .eq('payment_date', paymentDate)
          .eq('installment_num', installmentNum)
          .maybeSingle();

        let paymentId = existing?.id;

        if (!paymentId) {
          // Create pending payment
          const { data: newPayment, error: insertErr } = await sb.from('adm_cot_payments').insert({
            client_name: rec.client_name,
            cedula: rec.cedula || null,
            nro_poliza: rec.nro_poliza,
            amount: rec.installment_amount,
            insurer: rec.insurer,
            ramo: 'AUTO',
            status: 'PENDIENTE',
            payment_date: paymentDate,
            is_recurring: true,
            recurrence_id: rec.id,
            installment_num: installmentNum,
            payment_source: 'CRON_RECURRENCE',
          }).select('id').single();

          if (insertErr) {
            errors.push(`Rec ${rec.id}: ${insertErr.message}`);
            continue;
          }
          paymentId = newPayment.id;
          created++;
        }

        // Update schedule: mark this installment
        const updatedSchedule = schedule.map((s: any) =>
          s.num === installmentNum ? { ...s, status: 'PENDIENTE', payment_id: paymentId } : s
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
          detail: { payment_id: paymentId, installment_num: installmentNum, payment_date: paymentDate },
        });

      } catch (recErr: any) {
        errors.push(`Rec ${rec.id}: ${recErr.message}`);
      }
    }

    console.log(`[CRON RECURRENCIA] Done: ${processed} processed, ${created} created, ${completed} completed, ${errors.length} errors`);

    return NextResponse.json({
      success: true,
      timestamp: today,
      processed,
      created,
      completed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('[CRON RECURRENCIA] Fatal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
