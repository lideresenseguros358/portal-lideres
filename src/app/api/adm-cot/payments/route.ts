/**
 * ADM COT — Payments API (Master-only)
 * 
 * GET  /api/adm-cot/payments?tab=pending|groups|transfers|recurrences&...filters
 * POST /api/adm-cot/payments  { action: 'create_pending' | 'create_group' | 'confirm_group' | 'post_group' | 'import_transfer' | 'mark_refund' | 'update_recurrence' | 'cancel_recurrence' | 'create_pending_payment' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getSb() { return createClient(supabaseUrl, supabaseServiceKey); }

async function getMasterUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    } as any);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    return profile?.role === 'master' ? user.id : null;
  } catch { return null; }
}

// ═══════════════════════════════════════
// GET — Fetch data by tab
// ═══════════════════════════════════════

export async function GET(request: NextRequest) {
  const userId = await getMasterUserId();
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const tab = searchParams.get('tab') || 'pending';
  const sb = getSb();

  try {
    switch (tab) {
      case 'pending': {
        const insurer = searchParams.get('insurer') || undefined;
        const status = searchParams.get('status') || undefined;
        const type = searchParams.get('type') || undefined;
        const search = searchParams.get('search') || undefined;
        const dateFrom = searchParams.get('dateFrom') || undefined;
        const dateTo = searchParams.get('dateTo') || undefined;

        let q = sb.from('adm_cot_payments').select('*', { count: 'exact' })
          .order('created_at', { ascending: false });
        if (insurer) q = q.eq('insurer', insurer);
        if (status) q = q.eq('status', status);
        if (type === 'REFUND') q = q.eq('is_refund', true);
        if (type === 'PAY') q = q.eq('is_refund', false);
        if (dateFrom) q = q.gte('payment_date', dateFrom);
        if (dateTo) q = q.lte('payment_date', dateTo);
        if (search) q = q.or(`client_name.ilike.%${search}%,nro_poliza.ilike.%${search}%,cedula.ilike.%${search}%`);
        q = q.limit(200);

        const { data, error, count } = await q;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // Summary counts
        const { data: summaryData } = await sb.from('adm_cot_payments').select('status, amount, is_refund');
        const summary = { pending: 0, pendingAmt: 0, pendingConfirm: 0, pendingConfirmAmt: 0, grouped: 0, groupedAmt: 0, paid: 0, paidAmt: 0, refunds: 0, refundsAmt: 0 };
        (summaryData ?? []).forEach((r: any) => {
          const amt = Number(r.amount) || 0;
          if (r.is_refund) { summary.refunds++; summary.refundsAmt += amt; }
          else if (r.status === 'PENDIENTE_CONFIRMACION') { summary.pendingConfirm++; summary.pendingConfirmAmt += amt; }
          else if (r.status === 'PENDIENTE') { summary.pending++; summary.pendingAmt += amt; }
          else if (r.status === 'AGRUPADO') { summary.grouped++; summary.groupedAmt += amt; }
          else if (r.status === 'PAGADO') { summary.paid++; summary.paidAmt += amt; }
        });

        return NextResponse.json({ success: true, data: { rows: data ?? [], total: count ?? 0, summary } });
      }

      case 'groups': {
        const { data, error } = await sb.from('adm_cot_payment_groups').select('*')
          .order('created_at', { ascending: false }).limit(100);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // For each group, fetch items and references
        const groups = [];
        for (const g of (data ?? [])) {
          const { data: items } = await sb.from('adm_cot_payment_group_items').select('*').eq('group_id', g.id);
          const { data: refs } = await sb.from('adm_cot_payment_group_references')
            .select('*, adm_cot_bank_transfers(reference_number, bank_name)')
            .eq('group_id', g.id);
          groups.push({ ...g, items: items ?? [], references: refs ?? [] });
        }
        return NextResponse.json({ success: true, data: { groups } });
      }

      case 'transfers': {
        const statusF = searchParams.get('status') || undefined;
        let q = sb.from('adm_cot_bank_transfers').select('*')
          .order('transfer_date', { ascending: false }).limit(200);
        if (statusF) q = q.eq('status', statusF);
        const { data, error } = await q;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // For each transfer, fetch which groups used it
        const transfers = [];
        for (const t of (data ?? [])) {
          const { data: usages } = await sb.from('adm_cot_payment_group_references')
            .select('amount_used, group_id').eq('bank_transfer_id', t.id);
          transfers.push({ ...t, usages: usages ?? [] });
        }
        return NextResponse.json({ success: true, data: { transfers } });
      }

      case 'recurrences': {
        const { data, error } = await sb.from('adm_cot_recurrences').select('*')
          .order('next_due_date', { ascending: true }).limit(200);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, data: { recurrences: data ?? [] } });
      }

      default:
        return NextResponse.json({ error: 'Invalid tab' }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ═══════════════════════════════════════
// POST — Actions
// ═══════════════════════════════════════

export async function POST(request: NextRequest) {
  const userId = await getMasterUserId();
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sb = getSb();
  const body = await request.json();
  const { action, data } = body;

  try {
    switch (action) {

      // ── Create pending payment (auto from emission or manual) ──
      case 'create_pending': {
        const { insurer, policy_number, insured_name, amount_due, payment_date, type, cedula, ramo, installment_num, recurrence_id, source } = data;
        if (!insurer || !policy_number || !insured_name || !amount_due || !payment_date) {
          return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Idempotency check
        if (installment_num) {
          const { data: existing } = await sb.from('adm_cot_payments')
            .select('id').eq('nro_poliza', policy_number).eq('insurer', insurer)
            .eq('payment_date', payment_date).eq('installment_num', installment_num).maybeSingle();
          if (existing) {
            return NextResponse.json({ success: true, data: { id: existing.id, idempotent: true } });
          }
        }

        const { data: created, error } = await sb.from('adm_cot_payments').insert({
          client_name: insured_name,
          cedula: cedula || null,
          nro_poliza: policy_number,
          amount: amount_due,
          insurer,
          ramo: ramo || 'AUTO',
          status: 'PENDIENTE',
          payment_date,
          is_refund: type === 'REFUND_TO_CLIENT',
          is_recurring: !!recurrence_id,
          recurrence_id: recurrence_id || null,
          installment_num: installment_num || null,
          payment_source: source || 'EMISSION',
          created_by: userId,
        }).select('id').single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        await sb.from('adm_cot_audit_log').insert({
          event_type: 'payment_created', entity_type: 'payment', entity_id: created.id,
          user_id: userId, detail: { insurer, policy_number, amount_due, type },
        });

        return NextResponse.json({ success: true, data: { id: created.id } });
      }

      // ── Mark payment as refund (add bank details) ──
      case 'mark_refund': {
        const { payment_id, refund_bank, refund_account, refund_account_type, refund_reason } = data;
        if (!payment_id || !refund_bank || !refund_account || !refund_account_type) {
          return NextResponse.json({ error: 'Missing refund fields' }, { status: 400 });
        }
        const { error } = await sb.from('adm_cot_payments').update({
          is_refund: true,
          refund_bank, refund_account, refund_account_type,
          refund_reason: refund_reason || null,
        }).eq('id', payment_id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        await sb.from('adm_cot_audit_log').insert({
          event_type: 'refund_marked', entity_type: 'payment', entity_id: payment_id,
          user_id: userId, detail: { refund_bank, refund_account },
        });
        return NextResponse.json({ success: true });
      }

      // ── Create group (DRAFT) ──
      case 'create_group': {
        const { data: grp, error } = await sb.from('adm_cot_payment_groups').insert({
          status: 'DRAFT', total_amount: 0, paid_amount: 0,
          insurers: [], created_by: userId, notes: data.notes || null,
        }).select('id').single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, data: { group_id: grp.id } });
      }

      // ── Confirm group (atomic via RPC) ──
      case 'confirm_group': {
        const { group_id, items, references } = data;
        if (!group_id || !items?.length || !references?.length) {
          return NextResponse.json({ error: 'Missing group_id, items, or references' }, { status: 400 });
        }
        const { data: result, error } = await sb.rpc('adm_cot_confirm_group', {
          p_group_id: group_id,
          p_items: items,
          p_references: references,
          p_user_id: userId,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, data: result });
      }

      // ── Post group (CONFIRMED → POSTED) ──
      case 'post_group': {
        const { group_id } = data;
        if (!group_id) return NextResponse.json({ error: 'Missing group_id' }, { status: 400 });
        const { data: result, error } = await sb.rpc('adm_cot_post_group', {
          p_group_id: group_id,
          p_user_id: userId,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, data: result });
      }

      // ── Import bank transfer ──
      case 'import_transfer': {
        const { bank_name, reference_number, transfer_amount, transfer_date, notes } = data;
        if (!bank_name || !reference_number || !transfer_amount || !transfer_date) {
          return NextResponse.json({ error: 'Missing transfer fields' }, { status: 400 });
        }
        const { data: created, error } = await sb.from('adm_cot_bank_transfers').insert({
          bank_name, reference_number,
          transfer_amount: Number(transfer_amount),
          remaining_amount: Number(transfer_amount),
          transfer_date, notes: notes || null,
          status: 'OPEN', imported_by: userId,
        }).select('id').single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        await sb.from('adm_cot_audit_log').insert({
          event_type: 'transfer_imported', entity_type: 'bank_transfer', entity_id: created.id,
          user_id: userId, detail: { bank_name, reference_number, transfer_amount },
        });
        return NextResponse.json({ success: true, data: { id: created.id } });
      }

      // ── Update recurrence next_due_date ──
      case 'update_recurrence': {
        const { recurrence_id, new_date, apply_to } = data;
        if (!recurrence_id || !new_date) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

        if (apply_to === 'all_future') {
          // Get current recurrence
          const { data: rec } = await sb.from('adm_cot_recurrences').select('*').eq('id', recurrence_id).single();
          if (!rec) return NextResponse.json({ error: 'Not found' }, { status: 404 });

          // Recalculate all future dates in schedule
          const schedule = Array.isArray(rec.schedule) ? rec.schedule : [];
          const freqMonths = rec.frequency === 'MENSUAL' ? 1 : 6;
          let currentDate = new Date(new_date);
          const updatedSchedule = schedule.map((s: any) => {
            if (s.status === 'PENDIENTE') {
              const d = currentDate.toISOString().slice(0, 10);
              currentDate = new Date(currentDate);
              currentDate.setMonth(currentDate.getMonth() + freqMonths);
              return { ...s, due_date: d };
            }
            return s;
          });

          const { error } = await sb.from('adm_cot_recurrences').update({
            next_due_date: new_date, schedule: updatedSchedule,
          }).eq('id', recurrence_id);
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        } else {
          // Only this one
          const { error } = await sb.from('adm_cot_recurrences').update({
            next_due_date: new_date,
          }).eq('id', recurrence_id);
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        }

        await sb.from('adm_cot_audit_log').insert({
          event_type: 'recurrence_updated', entity_type: 'recurrence', entity_id: recurrence_id,
          user_id: userId, detail: { new_date, apply_to },
        });
        return NextResponse.json({ success: true });
      }

      // ── Cancel recurrence ──
      case 'cancel_recurrence': {
        const { recurrence_id, reason } = data;
        if (!recurrence_id) return NextResponse.json({ error: 'Missing recurrence_id' }, { status: 400 });
        const { error } = await sb.from('adm_cot_recurrences').update({
          status: 'CANCELADA',
          cancelled_at: new Date().toISOString(),
          cancelled_by: userId,
          cancel_reason: reason || 'Cancelación manual',
        }).eq('id', recurrence_id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        await sb.from('adm_cot_audit_log').insert({
          event_type: 'recurrence_cancelled', entity_type: 'recurrence', entity_id: recurrence_id,
          user_id: userId, detail: { reason },
        });
        return NextResponse.json({ success: true });
      }

      // ── Confirm recurring payment (PENDIENTE_CONFIRMACION → PENDIENTE) ──
      case 'confirm_recurring_payment': {
        const { payment_ids } = data;
        if (!payment_ids || !Array.isArray(payment_ids) || payment_ids.length === 0) {
          return NextResponse.json({ error: 'Missing payment_ids array' }, { status: 400 });
        }

        const { error } = await sb.from('adm_cot_payments')
          .update({ status: 'PENDIENTE' })
          .in('id', payment_ids)
          .eq('status', 'PENDIENTE_CONFIRMACION');
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        await sb.from('adm_cot_audit_log').insert({
          event_type: 'recurring_payment_confirmed', entity_type: 'payment', entity_id: payment_ids[0],
          user_id: userId, detail: { payment_ids, count: payment_ids.length },
        });
        return NextResponse.json({ success: true, data: { confirmed: payment_ids.length } });
      }

      // ── Create recurrence (from emission with installments) ──
      case 'create_recurrence': {
        const { nro_poliza, client_name, cedula, insurer, total_installments, frequency, installment_amount, start_date, end_date, next_due_date, schedule } = data;
        if (!nro_poliza || !client_name || !insurer || !total_installments || !installment_amount || !start_date || !end_date) {
          return NextResponse.json({ error: 'Missing recurrence fields' }, { status: 400 });
        }

        // Idempotency: check by policy + insurer
        const { data: existingRec } = await sb.from('adm_cot_recurrences')
          .select('id').eq('nro_poliza', nro_poliza).eq('insurer', insurer)
          .eq('status', 'ACTIVA').maybeSingle();
        if (existingRec) {
          return NextResponse.json({ success: true, data: { id: existingRec.id, idempotent: true } });
        }

        const { data: created, error } = await sb.from('adm_cot_recurrences').insert({
          nro_poliza, client_name, cedula: cedula || null, insurer,
          total_installments, frequency: frequency || 'MENSUAL',
          installment_amount, status: 'ACTIVA',
          start_date, end_date, next_due_date,
          schedule: schedule || [],
          created_by: userId,
        }).select('id').single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        await sb.from('adm_cot_audit_log').insert({
          event_type: 'recurrence_created', entity_type: 'recurrence', entity_id: created.id,
          user_id: userId, detail: { nro_poliza, insurer, total_installments, frequency },
        });
        return NextResponse.json({ success: true, data: { id: created.id } });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (e: any) {
    console.error('[ADM-COT PAYMENTS] Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
