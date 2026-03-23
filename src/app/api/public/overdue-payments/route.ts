/**
 * PUBLIC API — Payment Lookup & Processing (No auth required)
 * ============================================================
 * GET  ?cedula=XXX  → Lookup ALL recurrences + installment status by cedula
 * POST              → Confirm payment / cancel recurrence after PagueloFacil charge
 *
 * Returns three possible states:
 *   1. no_recurrences  — client has no active recurrences (no policies found)
 *   2. al_dia           — all installments are current (none overdue)
 *   3. has_overdue      — some installments are overdue
 *
 * Used by the "Realiza tu pago" modal on the cotizadores page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sanitizeCedula, isValidUUID } from '@/lib/security/sanitize';
import { rateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';

const publicLimiter = rateLimit(RATE_LIMITS.PUBLIC_API);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSb() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// ════════════════════════════════════════════
// GET — Full payment status lookup by cedula
// ════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const rl = publicLimiter(req);
  if (!rl.ok) return rl.response;

  try {
    const { searchParams } = new URL(req.url);
    const rawCedula = searchParams.get('cedula') || '';
    const cedula = sanitizeCedula(rawCedula);

    if (!cedula) {
      return NextResponse.json({ error: 'Cédula inválida' }, { status: 400 });
    }

    const sb = getSb();
    const today = new Date().toISOString().slice(0, 10);

    // 1. Find ALL active recurrences for this cedula
    const { data: recurrences, error: recErr } = await sb
      .from('adm_cot_recurrences')
      .select('*')
      .eq('cedula', cedula)
      .eq('status', 'ACTIVA')
      .order('created_at', { ascending: false });

    if (recErr) {
      console.error('[PUBLIC overdue-payments GET] DB error:', recErr.message);
      return NextResponse.json({ error: 'Error al consultar datos' }, { status: 500 });
    }

    if (!recurrences || recurrences.length === 0) {
      return NextResponse.json({
        success: true,
        status: 'no_recurrences',
        data: [],
        message: 'No se encontraron pólizas con plan de pagos asociadas a esta cédula.',
      });
    }

    // 2. For each recurrence, build enriched installment list from schedule + payments
    const policies: any[] = [];

    for (const rec of recurrences) {
      const schedule = Array.isArray(rec.schedule) ? rec.schedule : [];

      // Get all payments for this recurrence
      const { data: payments } = await sb
        .from('adm_cot_payments')
        .select('id, amount, installment_num, payment_date, status, is_refund, pf_cod_oper')
        .eq('recurrence_id', rec.id)
        .eq('is_refund', false)
        .order('installment_num', { ascending: true });

      const paymentMap = new Map<number, any>();
      for (const p of (payments || [])) {
        if (p.installment_num) paymentMap.set(p.installment_num, p);
      }

      // Build enriched installments from schedule
      const installments: any[] = [];
      let hasOverdue = false;
      let paidCount = 0;
      let pendingCount = 0;

      for (const item of schedule) {
        const num = item.num;
        const dueDate = item.due_date;
        const payment = paymentMap.get(num);
        const isPaid = item.status === 'PAGADO' ||
          (payment && ['CONFIRMADO_PF', 'PAGADO', 'AGRUPADO'].includes(payment.status));

        if (isPaid) {
          paidCount++;
          installments.push({
            num,
            due_date: dueDate,
            amount: Number(item.amount || rec.installment_amount),
            status: 'PAGADO',
            payment_id: payment?.id || item.payment_id || null,
          });
        } else {
          // Check if overdue: due_date < today
          const isOverdue = dueDate < today;
          if (isOverdue) hasOverdue = true;
          pendingCount++;

          installments.push({
            num,
            due_date: dueDate,
            amount: Number(item.amount || rec.installment_amount),
            status: isOverdue ? 'VENCIDO' : 'PENDIENTE',
            payment_id: payment?.id || null,
            // Include existing payment record ID for overdue ones that have PENDIENTE_CONFIRMACION
            existing_payment_id: payment?.id || null,
            existing_payment_status: payment?.status || null,
          });
        }
      }

      policies.push({
        nro_poliza: rec.nro_poliza || '',
        client_name: rec.client_name || '',
        insurer: rec.insurer || '',
        cedula: rec.cedula || '',
        recurrence_id: rec.id,
        total_installments: rec.total_installments,
        frequency: rec.frequency,
        installment_amount: Number(rec.installment_amount),
        pf_cod_oper: rec.pf_cod_oper || null,
        pf_rec_cod_oper: rec.pf_rec_cod_oper || null,
        installments,
        paidCount,
        pendingCount,
        hasOverdue,
      });
    }

    // Determine overall status
    const anyOverdue = policies.some(p => p.hasOverdue);
    const anyPending = policies.some(p => p.pendingCount > 0);

    return NextResponse.json({
      success: true,
      status: anyOverdue ? 'has_overdue' : (anyPending ? 'al_dia' : 'all_paid'),
      data: policies,
    });
  } catch (err: any) {
    console.error('[PUBLIC overdue-payments GET]', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ════════════════════════════════════════════
// POST — Confirm payment after PagueloFacil charge
// ════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const rl = publicLimiter(req);
  if (!rl.ok) return rl.response;

  try {
    const body = await req.json();
    const { action } = body;

    // Validate action is a known value
    if (!action || !['confirm_payment', 'update_recurrence_card'].includes(action)) {
      return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }

    const sb = getSb();

    switch (action) {
      // ── Confirm payment(s) — works for overdue AND adelanto ──
      case 'confirm_payment': {
        const {
          installments: selectedInstallments,   // [{ recurrence_id, num, amount, existing_payment_id? }]
          pf_cod_oper,
          pf_card_type,
          pf_card_display,
          total_paid,
          client_name,
          cedula,
        } = body;

        if (!selectedInstallments || !Array.isArray(selectedInstallments) || selectedInstallments.length === 0) {
          return NextResponse.json({ error: 'installments requerido' }, { status: 400 });
        }
        if (!pf_cod_oper) {
          return NextResponse.json({ error: 'pf_cod_oper requerido' }, { status: 400 });
        }

        const confirmedPaymentIds: string[] = [];
        const now = new Date().toISOString();

        // Group installments by recurrence_id for batch schedule updates
        const byRecurrence = new Map<string, typeof selectedInstallments>();
        for (const inst of selectedInstallments) {
          const key = inst.recurrence_id;
          if (!byRecurrence.has(key)) byRecurrence.set(key, []);
          byRecurrence.get(key)!.push(inst);
        }

        for (const [recurrenceId, insts] of byRecurrence.entries()) {
          // Get recurrence details
          const { data: rec } = await sb
            .from('adm_cot_recurrences')
            .select('*')
            .eq('id', recurrenceId)
            .single();

          if (!rec) continue;

          // Track which payment_id corresponds to which installment num
          const numToPaymentId = new Map<number, string>();

          for (const inst of insts) {
            let paymentId = inst.existing_payment_id;

            if (paymentId) {
              // Update existing payment record (overdue)
              await sb
                .from('adm_cot_payments')
                .update({
                  status: 'CONFIRMADO_PF',
                  pf_cod_oper,
                  pf_card_type: pf_card_type || null,
                  pf_card_display: pf_card_display || null,
                  pf_confirmed_at: now,
                  payment_source: 'CLIENT_PORTAL',
                })
                .eq('id', paymentId);
            } else {
              // Create new payment record (adelanto)
              const { data: newPay } = await sb
                .from('adm_cot_payments')
                .insert({
                  recurrence_id: recurrenceId,
                  nro_poliza: rec.nro_poliza,
                  client_name: client_name || rec.client_name || '',
                  cedula: cedula || rec.cedula || '',
                  insurer: rec.insurer,
                  ramo: rec.ramo || 'AUTO',
                  amount: inst.amount,
                  installment_num: inst.num,
                  payment_date: new Date().toISOString().slice(0, 10),
                  status: 'CONFIRMADO_PF',
                  is_recurring: true,
                  is_refund: false,
                  pf_cod_oper,
                  pf_card_type: pf_card_type || null,
                  pf_card_display: pf_card_display || null,
                  pf_confirmed_at: now,
                  payment_source: 'CLIENT_PORTAL',
                })
                .select('id')
                .single();

              paymentId = newPay?.id;
            }

            if (paymentId) {
              confirmedPaymentIds.push(paymentId);
              numToPaymentId.set(inst.num, paymentId);
            }
          }

          // Update recurrence schedule — mark paid installments with correct payment_id per cuota
          const schedule = Array.isArray(rec.schedule) ? [...rec.schedule] : [];
          const paidNums = new Set(insts.map(i => i.num));
          const updated = schedule.map((s: any) => {
            if (paidNums.has(s.num)) {
              return { ...s, status: 'PAGADO', payment_id: numToPaymentId.get(s.num) || null };
            }
            return s;
          });

          // Check if ALL installments now paid → mark recurrence COMPLETADA
          const allPaid = updated.every((s: any) => s.status === 'PAGADO');
          const nextPending = updated.find((s: any) => s.status !== 'PAGADO');

          await sb
            .from('adm_cot_recurrences')
            .update({
              schedule: updated,
              next_due_date: nextPending?.due_date || null,
              status: allPaid ? 'COMPLETADA' : 'ACTIVA',
            })
            .eq('id', recurrenceId);

          // If all paid, return flag so frontend can cancel PF recurrence
          if (allPaid) {
            (body as any)._completedRecurrences = (body as any)._completedRecurrences || [];
            (body as any)._completedRecurrences.push({
              recurrence_id: recurrenceId,
              pf_rec_cod_oper: rec.pf_rec_cod_oper,
            });
          }
        }

        // Audit log
        await sb.from('adm_cot_audit_log').insert({
          event_type: 'client_portal_payment',
          entity_type: 'payment',
          entity_id: confirmedPaymentIds[0] || null,
          user_id: null,
          detail: {
            payment_ids: confirmedPaymentIds,
            installment_nums: selectedInstallments.map((i: any) => i.num),
            pf_cod_oper,
            total_paid,
            source: 'CLIENT_PORTAL',
            type: selectedInstallments.some((i: any) => !i.existing_payment_id) ? 'adelanto' : 'overdue',
          },
        });

        // Collect completed recurrences for frontend
        const completedRecurrences: Array<{ recurrence_id: string; pf_rec_cod_oper: string | null }> = [];
        for (const [recurrenceId] of byRecurrence.entries()) {
          const { data: rec } = await sb
            .from('adm_cot_recurrences')
            .select('id, pf_rec_cod_oper, status')
            .eq('id', recurrenceId)
            .single();
          if (rec?.status === 'COMPLETADA') {
            completedRecurrences.push({
              recurrence_id: rec.id,
              pf_rec_cod_oper: rec.pf_rec_cod_oper,
            });
          }
        }

        return NextResponse.json({
          success: true,
          data: {
            confirmed: confirmedPaymentIds.length,
            completedRecurrences,
          },
        });
      }

      // ── Update recurrence card (register new card for future installments) ──
      case 'update_recurrence_card': {
        const { recurrence_id, pf_cod_oper, pf_rec_cod_oper } = body;
        if (!recurrence_id || !pf_cod_oper) {
          return NextResponse.json({ error: 'recurrence_id y pf_cod_oper requeridos' }, { status: 400 });
        }
        if (!isValidUUID(recurrence_id)) {
          return NextResponse.json({ error: 'recurrence_id inválido' }, { status: 400 });
        }

        const { error } = await sb
          .from('adm_cot_recurrences')
          .update({
            pf_cod_oper,
            pf_rec_cod_oper: pf_rec_cod_oper || null,
          })
          .eq('id', recurrence_id);

        if (error) {
          console.error('[PUBLIC overdue-payments POST] DB error:', error.message);
          return NextResponse.json({ error: 'Error al actualizar datos' }, { status: 500 });
        }

        await sb.from('adm_cot_audit_log').insert({
          event_type: 'client_recurrence_card_updated',
          entity_type: 'recurrence',
          entity_id: recurrence_id,
          user_id: null,
          detail: { pf_cod_oper, pf_rec_cod_oper, source: 'CLIENT_PORTAL' },
        });

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[PUBLIC overdue-payments POST]', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
