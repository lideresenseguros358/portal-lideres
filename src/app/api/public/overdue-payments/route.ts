/**
 * PUBLIC API — Overdue Payments (No auth required)
 * =================================================
 * GET  ?cedula=XXX  → Lookup overdue installments by cedula
 * POST              → Confirm payment after PagueloFacil charge
 *
 * Used by the "Realiza tu pago" modal on the cotizadores page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSb() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// ════════════════════════════════════════════
// GET — Lookup overdue payments by cedula
// ════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cedula = searchParams.get('cedula')?.trim();

    if (!cedula || cedula.length < 3) {
      return NextResponse.json({ error: 'Cédula inválida' }, { status: 400 });
    }

    const sb = getSb();

    // 1. Find overdue recurring payments for this cedula
    //    Status PENDIENTE_CONFIRMACION means PagueloFacil couldn't charge the card
    const { data: overduePayments, error: payErr } = await sb
      .from('adm_cot_payments')
      .select('*')
      .eq('cedula', cedula)
      .eq('is_recurring', true)
      .in('status', ['PENDIENTE_CONFIRMACION', 'PENDIENTE'])
      .eq('is_refund', false)
      .order('payment_date', { ascending: true });

    if (payErr) {
      return NextResponse.json({ error: payErr.message }, { status: 500 });
    }

    if (!overduePayments || overduePayments.length === 0) {
      return NextResponse.json({ success: true, data: [], message: 'No se encontraron pagos pendientes para esta cédula.' });
    }

    // 2. Group by policy number
    const policyMap: Record<string, {
      nro_poliza: string;
      client_name: string;
      insurer: string;
      ramo: string;
      cedula: string;
      payments: any[];
    }> = {};

    for (const p of overduePayments) {
      const key = p.nro_poliza || p.id;
      if (!policyMap[key]) {
        policyMap[key] = {
          nro_poliza: p.nro_poliza || '',
          client_name: p.client_name || '',
          insurer: p.insurer || '',
          ramo: p.ramo || '',
          cedula: p.cedula || '',
          payments: [],
        };
      }
      policyMap[key].payments.push({
        id: p.id,
        amount: Number(p.amount),
        installment_num: p.installment_num,
        payment_date: p.payment_date,
        status: p.status,
        recurrence_id: p.recurrence_id,
      });
    }

    const policies = Object.values(policyMap);

    // 3. For each policy, check if there's an active recurrence with more pending installments
    for (const pol of policies) {
      const recurrenceIds = [...new Set(pol.payments.map(p => p.recurrence_id).filter(Boolean))];
      if (recurrenceIds.length > 0) {
        const { data: recurrences } = await sb
          .from('adm_cot_recurrences')
          .select('id, total_installments, frequency, installment_amount, schedule, pf_cod_oper, pf_rec_cod_oper, status')
          .in('id', recurrenceIds)
          .eq('status', 'ACTIVA');

        (pol as any).recurrences = recurrences || [];
      } else {
        (pol as any).recurrences = [];
      }
    }

    return NextResponse.json({ success: true, data: policies });
  } catch (err: any) {
    console.error('[PUBLIC overdue-payments GET]', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}

// ════════════════════════════════════════════
// POST — Confirm payment after PagueloFacil charge
// ════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    const sb = getSb();

    switch (action) {
      // ── Confirm overdue payment(s) ──
      case 'confirm_payment': {
        const {
          payment_ids,
          pf_cod_oper,
          pf_card_type,
          pf_card_display,
          total_paid,
        } = body;

        if (!payment_ids || !Array.isArray(payment_ids) || payment_ids.length === 0) {
          return NextResponse.json({ error: 'payment_ids requerido' }, { status: 400 });
        }
        if (!pf_cod_oper) {
          return NextResponse.json({ error: 'pf_cod_oper requerido' }, { status: 400 });
        }

        // Mark each payment as CONFIRMADO_PF
        const { error: updateErr } = await sb
          .from('adm_cot_payments')
          .update({
            status: 'CONFIRMADO_PF',
            pf_cod_oper,
            pf_card_type: pf_card_type || null,
            pf_card_display: pf_card_display || null,
            pf_confirmed_at: new Date().toISOString(),
            payment_source: 'CLIENT_PORTAL',
          })
          .in('id', payment_ids);

        if (updateErr) {
          return NextResponse.json({ error: updateErr.message }, { status: 500 });
        }

        // Update recurrence schedule items if applicable
        for (const pid of payment_ids) {
          const { data: payment } = await sb
            .from('adm_cot_payments')
            .select('recurrence_id, installment_num')
            .eq('id', pid)
            .single();

          if (payment?.recurrence_id && payment?.installment_num) {
            const { data: rec } = await sb
              .from('adm_cot_recurrences')
              .select('schedule, next_due_date')
              .eq('id', payment.recurrence_id)
              .single();

            if (rec?.schedule) {
              const schedule = Array.isArray(rec.schedule) ? rec.schedule : [];
              const updated = schedule.map((s: any) => {
                if (s.num === payment.installment_num) {
                  return { ...s, status: 'PAGADO', payment_id: pid };
                }
                return s;
              });

              // Find next pending item for next_due_date
              const nextPending = updated.find((s: any) => s.status === 'PENDIENTE');
              await sb
                .from('adm_cot_recurrences')
                .update({
                  schedule: updated,
                  next_due_date: nextPending?.due_date || null,
                })
                .eq('id', payment.recurrence_id);
            }
          }
        }

        // Audit log
        await sb.from('adm_cot_audit_log').insert({
          event_type: 'client_overdue_payment',
          entity_type: 'payment',
          entity_id: payment_ids[0],
          user_id: null,
          detail: { payment_ids, pf_cod_oper, total_paid, source: 'CLIENT_PORTAL' },
        });

        return NextResponse.json({ success: true, data: { confirmed: payment_ids.length } });
      }

      // ── Update recurrence card (register new card for future installments) ──
      case 'update_recurrence_card': {
        const { recurrence_id, pf_cod_oper, pf_rec_cod_oper } = body;
        if (!recurrence_id || !pf_cod_oper) {
          return NextResponse.json({ error: 'recurrence_id y pf_cod_oper requeridos' }, { status: 400 });
        }

        const { error } = await sb
          .from('adm_cot_recurrences')
          .update({
            pf_cod_oper,
            pf_rec_cod_oper: pf_rec_cod_oper || null,
          })
          .eq('id', recurrence_id);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
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
        return NextResponse.json({ error: `Acción desconocida: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[PUBLIC overdue-payments POST]', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
