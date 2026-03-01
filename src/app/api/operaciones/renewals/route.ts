import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { RENEWAL_STATUSES } from '@/types/operaciones.types';

// ═══════════════════════════════════════════════════════
// OPERACIONES — Renewals API (unified ops_cases)
// ═══════════════════════════════════════════════════════

const CASE_TYPE = 'renovacion';

const VALID_TRANSITIONS: Record<string, string[]> = {
  pendiente: ['en_revision'],
  en_revision: ['en_proceso', 'aplazado', 'cerrado_renovado', 'cerrado_cancelado'],
  en_proceso: ['cerrado_renovado', 'cerrado_cancelado', 'aplazado'],
  aplazado: ['en_revision', 'en_proceso', 'cerrado_cancelado'],
};

function validateRenewalTransition(from: string | null, to: string): boolean {
  if (!from) return true;
  return (VALID_TRANSITIONS[from] || []).includes(to);
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin() as any;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const slaBreached = searchParams.get('sla_breached');
    const noFirstResponse = searchParams.get('no_first_response');
    const assignedTo = searchParams.get('assigned_to');
    const aplazado = searchParams.get('aplazado');
    const view = searchParams.get('view'); // 'history' for case history
    const caseId = searchParams.get('case_id');

    // ── History sub-endpoint ──
    if (view === 'history' && caseId) {
      const { data: history, error: hErr } = await supabase
        .from('ops_case_history')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (hErr) throw hErr;
      return NextResponse.json({ data: history });
    }

    // ── Masters sub-endpoint ──
    if (view === 'masters') {
      const { data: masters, error: mErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('role', 'master');
      if (mErr) throw mErr;
      return NextResponse.json({ data: masters || [] });
    }

    // ── Main list query (lean columns for list view) ──
    const LIST_COLS = 'id,ticket,case_type,status,policy_id,client_id,client_name,insurer_name,policy_number,renewal_date,ramo,assigned_master_id,created_at,updated_at,first_response_at,closed_at,sla_breached,urgency_flag,aplazado_until';
    let query = supabase
      .from('ops_cases')
      .select(LIST_COLS, { count: 'exact' })
      .eq('case_type', CASE_TYPE)
      .order('renewal_date', { ascending: true });

    if (status) query = query.eq('status', status);
    if (search) query = query.or(`client_name.ilike.%${search}%,policy_number.ilike.%${search}%,ticket.ilike.%${search}%`);
    if (slaBreached === 'true') query = query.eq('sla_breached', true);
    if (noFirstResponse === 'true') query = query.is('first_response_at', null).not('status', 'in', '(cerrado_renovado,cerrado_cancelado)');
    if (assignedTo) query = query.eq('assigned_master_id', assignedTo);
    if (aplazado === 'true') query = query.eq('status', 'aplazado');

    query = query.range((page - 1) * limit, page * limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    // ── Summary counts ──
    const { data: summaryRows } = await supabase
      .from('ops_cases')
      .select('status, sla_breached, first_response_at')
      .eq('case_type', CASE_TYPE);

    const counts: Record<string, number> = { sla_breached: 0, no_first_response: 0, total_active: 0 };
    RENEWAL_STATUSES.forEach((s) => { counts[s] = 0; });
    const allRows: any[] = summaryRows || [];
    for (const r of allRows) {
      const st = r.status as string;
      if (counts[st] !== undefined) counts[st] = (counts[st] ?? 0) + 1;
      if (r.sla_breached) counts['sla_breached'] = (counts['sla_breached'] ?? 0) + 1;
      if (!r.first_response_at && st !== 'cerrado_renovado' && st !== 'cerrado_cancelado') counts['no_first_response'] = (counts['no_first_response'] ?? 0) + 1;
      if (st !== 'cerrado_renovado' && st !== 'cerrado_cancelado') counts['total_active'] = (counts['total_active'] ?? 0) + 1;
    }

    return NextResponse.json({ data, total: count, counts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin() as any;
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'update_status': {
        const { id, status, aplazado_until, cancellation_reason, user_id } = body;

        // Get current state
        const { data: current } = await supabase.from('ops_cases').select('status, sla_breached').eq('id', id).single();
        const beforeStatus = current?.status;

        // Validate transition
        if (!validateRenewalTransition(beforeStatus, status)) {
          return NextResponse.json(
            { error: `Transición no permitida: ${beforeStatus} → ${status}` },
            { status: 400 },
          );
        }

        // Require cancellation reason for cerrado_cancelado
        if (status === 'cerrado_cancelado' && !cancellation_reason) {
          return NextResponse.json({ error: 'Motivo de cancelación obligatorio' }, { status: 400 });
        }

        const update: Record<string, any> = { status };
        if (status === 'aplazado' && aplazado_until) update.aplazado_until = aplazado_until;
        if (status === 'cerrado_cancelado' && cancellation_reason) update.cancellation_reason = cancellation_reason;
        if (status === 'cerrado_renovado' || status === 'cerrado_cancelado') update.closed_at = new Date().toISOString();

        const { error } = await supabase.from('ops_cases').update(update).eq('id', id).eq('case_type', CASE_TYPE);
        if (error) throw error;

        // Mark first response if transitioning to en_revision
        if (status === 'en_revision') {
          await supabase.rpc('ops_mark_first_response', { p_case_id: id, p_user_id: user_id || null });
        }

        // Log history
        await supabase.from('ops_case_history').insert({
          case_id: id,
          changed_by: user_id || null,
          change_type: 'status_change',
          before_state: { status: beforeStatus },
          after_state: { status },
        });

        // Log activity
        await supabase.from('ops_activity_log').insert({
          user_id: user_id || null,
          action_type: 'status_change',
          entity_type: 'case',
          entity_id: id,
          metadata: { from: beforeStatus, to: status },
        });

        return NextResponse.json({ success: true });
      }

      case 'confirm_renewal': {
        const { id, new_start_date, new_end_date, policy_id, user_id } = body;

        // Update case
        const { error } = await supabase.from('ops_cases').update({
          status: 'cerrado_renovado',
          new_start_date,
          new_end_date,
          closed_at: new Date().toISOString(),
        }).eq('id', id).eq('case_type', CASE_TYPE);
        if (error) throw error;

        // Update policy dates if policy_id provided
        if (policy_id) {
          await supabase.from('policies').update({
            start_date: new_start_date,
            end_date: new_end_date,
            status: 'vigente',
          }).eq('id', policy_id);
        }

        // Log activity
        await supabase.from('ops_activity_log').insert({
          user_id: user_id || null,
          action_type: 'renewal_confirmed',
          entity_type: 'case',
          entity_id: id,
          metadata: { new_start_date, new_end_date, policy_id },
        });

        return NextResponse.json({ success: true });
      }

      case 'cancel': {
        const { id, cancellation_reason, policy_id, user_id } = body;
        if (!cancellation_reason) {
          return NextResponse.json({ error: 'cancellation_reason is required' }, { status: 400 });
        }

        const { error } = await supabase.from('ops_cases').update({
          status: 'cerrado_cancelado',
          cancellation_reason,
          closed_at: new Date().toISOString(),
        }).eq('id', id).eq('case_type', CASE_TYPE);
        if (error) throw error;

        // Mark policy inactive if policy_id provided
        if (policy_id) {
          await supabase.from('policies').update({ status: 'inactivo' }).eq('id', policy_id);
        }

        // Log activity
        await supabase.from('ops_activity_log').insert({
          user_id: user_id || null,
          action_type: 'cancellation_confirmed',
          entity_type: 'case',
          entity_id: id,
          metadata: { cancellation_reason, policy_id },
        });

        return NextResponse.json({ success: true });
      }

      case 'assign': {
        const { case_id } = body;
        const { data: masterId } = await supabase.rpc('assign_case_equilibrado', { p_case_id: case_id });
        return NextResponse.json({ success: true, assigned_to: masterId });
      }

      case 'reassign': {
        const { case_id, master_id, user_id } = body;
        const { error } = await supabase.from('ops_cases')
          .update({ assigned_master_id: master_id })
          .eq('id', case_id).eq('case_type', CASE_TYPE);
        if (error) throw error;

        await supabase.from('ops_activity_log').insert({
          user_id: user_id || null,
          action_type: 'case_assigned',
          entity_type: 'case',
          entity_id: case_id,
          metadata: { assigned_to: master_id },
        });

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
