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

        // Enrich rows with SLA computed fields
        // SLA window: 15 days from payment_date to pay the insurer
        const SLA_DAYS = 15;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const enrichedRows = (data ?? []).map((r: any) => {
          if (r.status === 'PAGADO' || r.status === 'AGRUPADO' || r.is_refund) return { ...r, sla_status: 'none', sla_color: 'gray', days_until_due: null };
          const registered = r.payment_date ? new Date(r.payment_date + 'T12:00:00') : null;
          if (!registered) return { ...r, sla_status: 'unknown', sla_color: 'gray', days_until_due: null };
          const dueDate = new Date(registered);
          dueDate.setDate(dueDate.getDate() + SLA_DAYS);
          const diffMs = dueDate.getTime() - today.getTime();
          const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          let sla_status = 'on_track'; // green
          let sla_color = 'green';
          if (days < 0) { sla_status = 'overdue'; sla_color = 'red'; }
          else if (days <= 3) { sla_status = 'urgent'; sla_color = 'red'; }
          else if (days <= 7) { sla_status = 'warning'; sla_color = 'amber'; }
          return { ...r, sla_status, sla_color, days_until_due: days };
        });

        // Summary counts
        const { data: summaryData } = await sb.from('adm_cot_payments').select('status, amount, is_refund, insurer');
        const summary: Record<string, any> = { pending: 0, pendingAmt: 0, pendingConfirm: 0, pendingConfirmAmt: 0, grouped: 0, groupedAmt: 0, paid: 0, paidAmt: 0, refunds: 0, refundsAmt: 0, overdueCount: 0, urgentCount: 0 };
        const insurerMap: Record<string, { count: number; amount: number; statuses: Record<string, number> }> = {};
        (summaryData ?? []).forEach((r: any) => {
          const amt = Number(r.amount) || 0;
          if (r.is_refund) { summary.refunds++; summary.refundsAmt += amt; }
          else if (r.status === 'PENDIENTE_CONFIRMACION') { summary.pendingConfirm++; summary.pendingConfirmAmt += amt; }
          else if (r.status === 'PENDIENTE') { summary.pending++; summary.pendingAmt += amt; }
          else if (r.status === 'AGRUPADO') { summary.grouped++; summary.groupedAmt += amt; }
          else if (r.status === 'PAGADO') { summary.paid++; summary.paidAmt += amt; }
          // Insurer grouping
          const ins = r.insurer || 'OTROS';
          if (!insurerMap[ins]) insurerMap[ins] = { count: 0, amount: 0, statuses: {} };
          insurerMap[ins].count++;
          insurerMap[ins].amount += amt;
          insurerMap[ins].statuses[r.status] = (insurerMap[ins].statuses[r.status] || 0) + 1;
        });
        // Count SLA urgencies from enriched rows
        enrichedRows.forEach((r: any) => {
          if (r.sla_status === 'overdue') summary.overdueCount++;
          else if (r.sla_status === 'urgent') summary.urgentCount++;
        });
        summary.byInsurer = Object.entries(insurerMap).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.amount - a.amount);

        return NextResponse.json({ success: true, data: { rows: enrichedRows, total: count ?? 0, summary } });
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
        const categoryF = searchParams.get('category') || undefined;
        let q = sb.from('adm_cot_bank_transfers').select('*')
          .order('transfer_date', { ascending: false }).limit(200);
        if (statusF) q = q.eq('status', statusF);
        const { data, error } = await q;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // For each transfer, fetch which groups used it + their payment details + compute flex fields
        const transfers = [];
        for (const t of (data ?? [])) {
          const { data: usages } = await sb.from('adm_cot_payment_group_references')
            .select('amount_used, group_id').eq('bank_transfer_id', t.id);

          // Fetch actual payment details for each group usage (like cheques page)
          const paymentDetails: any[] = [];
          for (const u of (usages ?? [])) {
            const { data: items } = await sb.from('adm_cot_payment_group_items')
              .select('payment_id, amount_applied, adm_cot_payments(client_name, nro_poliza, insurer, amount, cedula, ramo, payment_date, status, installment_num)')
              .eq('group_id', u.group_id);
            for (const item of (items ?? [])) {
              const p = (item as any).adm_cot_payments;
              if (p) paymentDetails.push({
                client_name: p.client_name, nro_poliza: p.nro_poliza, insurer: p.insurer,
                amount: p.amount, cedula: p.cedula, ramo: p.ramo,
                payment_date: p.payment_date, status: p.status,
                installment_num: p.installment_num,
                amount_applied: item.amount_applied || p.amount,
                group_id: u.group_id,
              });
            }
          }
          const meta = (t.metadata as Record<string, any>) || {};
          const totalAmt = Number(t.transfer_amount || 0);
          const usedAmt = Number(t.transfer_amount || 0) - Number(t.remaining_amount || 0);
          const maxAllowed = totalAmt * 1.10;
          const flexUsed = Math.max(0, usedAmt - totalAmt);
          const flexPct = totalAmt > 0 ? (flexUsed / totalAmt) * 100 : 0;

          const enriched = {
            ...t,
            usages: usages ?? [],
            payment_details: paymentDetails,
            // Categorization & blocking from metadata
            category: meta.category || 'uncategorized',
            is_blocked: !!meta.is_blocked,
            blocked_reason: meta.blocked_reason || null,
            blocked_at: meta.blocked_at || null,
            blocked_by: meta.blocked_by || null,
            is_paguelofacil: !!meta.is_paguelofacil,
            // 110% flex computed fields
            used_amount: usedAmt,
            max_allowed: maxAllowed,
            flex_used: flexUsed,
            flex_pct: Math.round(flexPct * 100) / 100,
            capacity_remaining: Math.max(0, maxAllowed - usedAmt),
          };

          // Apply category filter client-side (stored in metadata)
          if (categoryF && categoryF !== 'all' && enriched.category !== categoryF) continue;

          transfers.push(enriched);
        }

        // Compute summary counters
        const allTransfers = (data ?? []);
        let totalReceived = 0, totalUsed = 0;
        allTransfers.forEach((t: any) => {
          const meta = (t.metadata as Record<string, any>) || {};
          if (!meta.is_blocked) {
            totalReceived += Number(t.transfer_amount || 0);
            totalUsed += Number(t.transfer_amount || 0) - Number(t.remaining_amount || 0);
          }
        });

        return NextResponse.json({
          success: true,
          data: {
            transfers,
            summary: {
              totalReceived,
              totalUsed,
              balance: totalReceived - totalUsed,
              count: transfers.length,
              blockedCount: transfers.filter(t => t.is_blocked).length,
            },
          },
        });
      }

      case 'recurrences': {
        const { data, error } = await sb.from('adm_cot_recurrences').select('*')
          .order('next_due_date', { ascending: true }).limit(200);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, data: { recurrences: data ?? [] } });
      }

      case 'reference_ledger': {
        // Fetch all group references with their bank transfer and group details
        const { data: refs, error } = await sb.from('adm_cot_payment_group_references')
          .select('*, adm_cot_bank_transfers(id, reference_number, bank_name, transfer_amount, remaining_amount, transfer_date, status, metadata), adm_cot_payment_groups(id, status, total_amount, created_at, notes)')
          .order('created_at', { ascending: false })
          .limit(500);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // For each ref, also fetch which payments are in that group
        const ledger = [];
        for (const ref of (refs ?? [])) {
          const groupId = ref.group_id;
          const { data: items } = await sb.from('adm_cot_payment_group_items')
            .select('payment_id, adm_cot_payments(client_name, nro_poliza, insurer, amount)')
            .eq('group_id', groupId);
          ledger.push({
            ...ref,
            group_payments: (items ?? []).map((i: any) => ({
              payment_id: i.payment_id,
              client_name: i.adm_cot_payments?.client_name || '',
              nro_poliza: i.adm_cot_payments?.nro_poliza || '',
              insurer: i.adm_cot_payments?.insurer || '',
              amount: i.adm_cot_payments?.amount || 0,
            })),
          });
        }

        return NextResponse.json({ success: true, data: { ledger } });
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

      // ── Block a bank transfer ──
      case 'block_transfer': {
        const { transfer_id, reason } = data;
        if (!transfer_id || !reason) return NextResponse.json({ error: 'Missing transfer_id or reason' }, { status: 400 });

        const { data: existing } = await sb.from('adm_cot_bank_transfers').select('metadata').eq('id', transfer_id).single();
        const meta = (existing?.metadata as Record<string, any>) || {};

        const { error } = await sb.from('adm_cot_bank_transfers').update({
          metadata: { ...meta, is_blocked: true, blocked_reason: reason, blocked_at: new Date().toISOString(), blocked_by: userId },
        }).eq('id', transfer_id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        await sb.from('adm_cot_audit_log').insert({
          event_type: 'transfer_blocked', entity_type: 'bank_transfer', entity_id: transfer_id,
          user_id: userId, detail: { reason },
        });
        return NextResponse.json({ success: true });
      }

      // ── Unblock a bank transfer ──
      case 'unblock_transfer': {
        const { transfer_id } = data;
        if (!transfer_id) return NextResponse.json({ error: 'Missing transfer_id' }, { status: 400 });

        const { data: existing } = await sb.from('adm_cot_bank_transfers').select('metadata').eq('id', transfer_id).single();
        const meta = (existing?.metadata as Record<string, any>) || {};
        const { is_blocked, blocked_reason, blocked_at, blocked_by, ...cleanMeta } = meta;

        const { error } = await sb.from('adm_cot_bank_transfers').update({
          metadata: { ...cleanMeta, unblocked_at: new Date().toISOString(), unblocked_by: userId },
        }).eq('id', transfer_id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        await sb.from('adm_cot_audit_log').insert({
          event_type: 'transfer_unblocked', entity_type: 'bank_transfer', entity_id: transfer_id,
          user_id: userId, detail: {},
        });
        return NextResponse.json({ success: true });
      }

      // ── Categorize a bank transfer ──
      case 'categorize_transfer': {
        const { transfer_id, category, is_paguelofacil, category_notes } = data;
        if (!transfer_id || !category) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

        const { data: existing } = await sb.from('adm_cot_bank_transfers').select('metadata').eq('id', transfer_id).single();
        const meta = (existing?.metadata as Record<string, any>) || {};

        const { error } = await sb.from('adm_cot_bank_transfers').update({
          metadata: {
            ...meta,
            category,
            is_paguelofacil: !!is_paguelofacil,
            category_notes: category_notes || null,
            categorized_at: new Date().toISOString(),
            categorized_by: userId,
          },
        }).eq('id', transfer_id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        await sb.from('adm_cot_audit_log').insert({
          event_type: 'transfer_categorized', entity_type: 'bank_transfer', entity_id: transfer_id,
          user_id: userId, detail: { category, is_paguelofacil },
        });
        return NextResponse.json({ success: true });
      }

      // ── Manual wizard: apply multiple references to selected pending payments ──
      case 'apply_references_to_payments': {
        const { payment_ids, reference_allocations } = data;
        // reference_allocations: [{ transfer_id, amount }]
        if (!payment_ids?.length || !reference_allocations?.length) {
          return NextResponse.json({ error: 'Missing payment_ids or reference_allocations' }, { status: 400 });
        }

        // Validate 110% flex rule for each reference
        for (const alloc of reference_allocations) {
          const { data: tf } = await sb.from('adm_cot_bank_transfers').select('*').eq('id', alloc.transfer_id).single();
          if (!tf) return NextResponse.json({ error: `Transfer ${alloc.transfer_id} not found` }, { status: 404 });

          const meta = (tf.metadata as Record<string, any>) || {};
          if (meta.is_blocked) {
            return NextResponse.json({ error: `Referencia ${tf.reference_number} está bloqueada: ${meta.blocked_reason || 'Sin motivo'}` }, { status: 400 });
          }

          const totalAmt = Number(tf.transfer_amount || 0);
          const usedSoFar = totalAmt - Number(tf.remaining_amount || 0);
          const maxAllowed = totalAmt * 1.10;
          const newTotal = usedSoFar + Number(alloc.amount || 0);

          if (newTotal > maxAllowed) {
            const pctOver = ((newTotal / totalAmt) * 100 - 100).toFixed(1);
            return NextResponse.json({
              error: `Referencia ${tf.reference_number}: asignación excede el 10% máximo de financiamiento. Intentando ${pctOver}% sobre el monto recibido.`,
            }, { status: 400 });
          }
        }

        // Create a group for this manual assignment
        const totalPayAmount = reference_allocations.reduce((s: number, a: any) => s + Number(a.amount || 0), 0);
        const { data: grp, error: grpErr } = await sb.from('adm_cot_payment_groups').insert({
          status: 'CONFIRMED', total_amount: totalPayAmount, paid_amount: totalPayAmount,
          insurers: [], created_by: userId, notes: 'Asignación manual de referencias',
        }).select('id').single();
        if (grpErr) return NextResponse.json({ error: grpErr.message }, { status: 500 });

        // Add group items (payments)
        for (const pid of payment_ids) {
          await sb.from('adm_cot_payment_group_items').insert({
            group_id: grp.id, payment_id: pid,
          });
        }

        // Apply references & deduct remaining_amount
        for (const alloc of reference_allocations) {
          const allocAmount = Number(alloc.amount || 0);
          await sb.from('adm_cot_payment_group_references').insert({
            group_id: grp.id, bank_transfer_id: alloc.transfer_id, amount_used: allocAmount,
          });

          // Deduct from remaining
          const { data: tf } = await sb.from('adm_cot_bank_transfers').select('remaining_amount, transfer_amount').eq('id', alloc.transfer_id).single();
          if (tf) {
            const newRemaining = Math.max(0, Number(tf.remaining_amount) - allocAmount);
            const newStatus = newRemaining <= 0 ? 'EXHAUSTED' : 'PARTIAL';
            await sb.from('adm_cot_bank_transfers').update({
              remaining_amount: newRemaining,
              status: newStatus,
            }).eq('id', alloc.transfer_id);
          }
        }

        // Mark payments as AGRUPADO
        await sb.from('adm_cot_payments').update({ status: 'AGRUPADO' }).in('id', payment_ids);

        await sb.from('adm_cot_audit_log').insert({
          event_type: 'manual_reference_applied', entity_type: 'payment_group', entity_id: grp.id,
          user_id: userId, detail: { payment_ids, reference_allocations, total: totalPayAmount },
        });

        return NextResponse.json({ success: true, data: { group_id: grp.id, total_applied: totalPayAmount } });
      }

      // ── Get insurer payment detail (for export) ──
      case 'get_insurer_export': {
        const { insurer, dateFrom, dateTo } = data;
        if (!insurer) return NextResponse.json({ error: 'Missing insurer' }, { status: 400 });

        let q = sb.from('adm_cot_payments').select('*')
          .eq('insurer', insurer)
          .in('status', ['AGRUPADO', 'PAGADO'])
          .eq('is_refund', false)
          .order('payment_date', { ascending: true });
        if (dateFrom) q = q.gte('payment_date', dateFrom);
        if (dateTo) q = q.lte('payment_date', dateTo);

        const { data: payments, error } = await q;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // Build CSV rows
        const rows = (payments ?? []).map((p: any) => ({
          poliza: p.nro_poliza || '',
          cliente: p.client_name || '',
          cedula: p.cedula || '',
          ramo: p.ramo || '',
          cuota: p.installment_num || 1,
          monto: Number(p.amount || 0).toFixed(2),
          fecha_pago: p.payment_date || '',
          estado: p.status || '',
        }));

        const total = rows.reduce((s: number, r: any) => s + Number(r.monto), 0);

        return NextResponse.json({
          success: true,
          data: {
            insurer,
            rows,
            total: total.toFixed(2),
            count: rows.length,
          },
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (e: any) {
    console.error('[ADM-COT PAYMENTS] Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
