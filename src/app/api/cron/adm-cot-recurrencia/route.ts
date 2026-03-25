/**
 * CRON: ADM COT — Seguimiento de Recurrencias
 *
 * Runs daily to track installment schedules for display purposes ONLY.
 * PagueloFacil is NOT used for recurring charges — clients pay directly
 * with the insurer. This cron only advances schedule state and marks
 * recurrences COMPLETADA when all installments are past their due dates.
 *
 * PagueloFacil is used ONLY for the first (initial) policy payment.
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
  let completed = 0;
  const errors: string[] = [];

  try {
    console.log(`[CRON RECURRENCIA] Running schedule tracking for date: ${today}`);

    // Find active recurrences whose next_due_date has passed
    const { data: dueRecurrences, error: fetchErr } = await sb
      .from('adm_cot_recurrences')
      .select('*')
      .eq('status', 'ACTIVA')
      .lte('next_due_date', today);

    if (fetchErr) throw new Error(fetchErr.message);
    if (!dueRecurrences || dueRecurrences.length === 0) {
      return NextResponse.json({ success: true, timestamp: today, processed: 0, completed: 0, message: 'No due recurrences' });
    }

    for (const rec of dueRecurrences) {
      processed++;
      try {
        const schedule: any[] = Array.isArray(rec.schedule) ? rec.schedule : [];
        const freqMonthsMap: Record<string, number> = {
          MENSUAL: 1, BIMESTRAL: 2, TRIMESTRAL: 3, CUATRIMESTRAL: 4, SEMESTRAL: 6,
        };
        const freqMonths = freqMonthsMap[rec.frequency] || 1;

        // Find the next PENDIENTE installment
        const nextInstallment = schedule.find((s: any) => s.status === 'PENDIENTE');
        if (!nextInstallment) {
          await sb.from('adm_cot_recurrences').update({ status: 'COMPLETADA' }).eq('id', rec.id);
          completed++;
          continue;
        }

        const installmentNum = nextInstallment.num;
        const paymentDate = nextInstallment.due_date || rec.next_due_date;

        // Advance next_due_date — do NOT charge PagueloFacil
        const nextDate = new Date(paymentDate + 'T12:00:00');
        nextDate.setMonth(nextDate.getMonth() + freqMonths);
        const nextDueStr = nextDate.toISOString().slice(0, 10);

        const endDate = rec.end_date ? new Date(rec.end_date + 'T12:00:00') : null;
        const remainingPending = schedule.filter((s: any) => s.status === 'PENDIENTE' && s.num > installmentNum);
        const isLast = !remainingPending.length || (endDate && nextDate > endDate);

        if (isLast) {
          await sb.from('adm_cot_recurrences').update({
            next_due_date: null,
            status: 'COMPLETADA',
          }).eq('id', rec.id);
          completed++;
        } else {
          await sb.from('adm_cot_recurrences').update({
            next_due_date: nextDueStr,
          }).eq('id', rec.id);
        }

        await sb.from('adm_cot_audit_log').insert({
          event_type: 'cron_payment_created',
          entity_type: 'recurrence',
          entity_id: rec.id,
          detail: {
            installment_num: installmentNum,
            payment_date: paymentDate,
            next_due_date: isLast ? null : nextDueStr,
            note: 'tracking_only_no_pf_charge',
          },
        });

      } catch (recErr: any) {
        errors.push(`Rec ${rec.id}: ${recErr.message}`);
      }
    }

    console.log(`[CRON RECURRENCIA] Done: ${processed} processed, ${completed} completed, ${errors.length} errors`);

    return NextResponse.json({
      success: true,
      timestamp: today,
      processed,
      completed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('[CRON RECURRENCIA] Fatal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
