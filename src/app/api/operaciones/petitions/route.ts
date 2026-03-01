import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { PETITION_STATUSES, generateTicketNumber } from '@/types/operaciones.types';

// ═══════════════════════════════════════════════════════
// OPERACIONES — Petitions API (unified ops_cases)
// Full inbox: list, counts, history, masters, status,
// reassign, lost, convert-to-emission, create-from-quote
// ═══════════════════════════════════════════════════════

const CASE_TYPE = 'peticion';

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin() as any;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const ramo = searchParams.get('ramo');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const slaBreached = searchParams.get('sla_breached');
    const noFirstResponse = searchParams.get('no_first_response');
    const assignedTo = searchParams.get('assigned_to');
    const view = searchParams.get('view');
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
    const LIST_COLS = 'id,ticket,case_type,status,policy_id,client_id,client_name,insurer_name,policy_number,ramo,assigned_master_id,created_at,updated_at,first_response_at,closed_at,sla_breached,client_email,cedula,source';
    let query = supabase
      .from('ops_cases')
      .select(LIST_COLS, { count: 'exact' })
      .eq('case_type', CASE_TYPE)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (ramo) query = query.eq('ramo', ramo);
    if (search) query = query.or(`client_name.ilike.%${search}%,ticket.ilike.%${search}%,policy_number.ilike.%${search}%,client_email.ilike.%${search}%`);
    if (slaBreached === 'true') query = query.eq('sla_breached', true);
    if (noFirstResponse === 'true') query = query.is('first_response_at', null).not('status', 'in', '(cerrado,perdido)');
    if (assignedTo) query = query.eq('assigned_master_id', assignedTo);

    query = query.range((page - 1) * limit, page * limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    // ── Summary counts ──
    const { data: summaryRows } = await supabase
      .from('ops_cases')
      .select('status, sla_breached, first_response_at')
      .eq('case_type', CASE_TYPE);

    const counts: Record<string, number> = { sla_breached: 0, no_first_response: 0, total_active: 0 };
    PETITION_STATUSES.forEach((s) => { counts[s] = 0; });
    const allRows: any[] = summaryRows || [];
    for (const r of allRows) {
      const st = r.status as string;
      if (counts[st] !== undefined) counts[st] = (counts[st] ?? 0) + 1;
      if (r.sla_breached) counts['sla_breached'] = (counts['sla_breached'] ?? 0) + 1;
      if (!r.first_response_at && st !== 'cerrado' && st !== 'perdido') counts['no_first_response'] = (counts['no_first_response'] ?? 0) + 1;
      if (st !== 'cerrado' && st !== 'perdido') counts['total_active'] = (counts['total_active'] ?? 0) + 1;
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
      // ── Create from cotizador form ──
      case 'create':
      case 'create_from_quote': {
        const { client_name, client_email, client_phone, cedula, ramo, details, source, insurer_name } = body;
        const ticket = generateTicketNumber('PET');
        const { data, error } = await supabase.from('ops_cases').insert({
          ticket,
          case_type: CASE_TYPE,
          status: 'pendiente',
          client_name,
          client_email,
          client_phone,
          cedula,
          ramo: ramo || null,
          insurer_name: insurer_name || null,
          details: details || {},
          source: source || 'COTIZADOR',
        }).select().single();
        if (error) throw error;

        // Auto-assign
        try {
          await supabase.rpc('assign_case_equilibrado', { p_case_id: data.id });
        } catch { /* auto-assign may not exist yet */ }

        // Log activity
        await supabase.from('ops_activity_log').insert({
          user_id: null,
          action_type: 'case_created',
          entity_type: 'case',
          entity_id: data.id,
          metadata: { ticket, ramo, source: source || 'COTIZADOR', client_email },
        });

        return NextResponse.json({ success: true, data });
      }

      // ── Status transition ──
      case 'update_status': {
        const { id, status, user_id } = body;

        // Get current state for history
        const { data: current } = await supabase.from('ops_cases').select('status').eq('id', id).single();
        const beforeStatus = current?.status;

        // Validate transition
        const valid = validateTransition(beforeStatus, status);
        if (!valid) {
          return NextResponse.json({ error: `Transición no permitida: ${beforeStatus} → ${status}` }, { status: 400 });
        }

        const update: Record<string, any> = { status };
        if (status === 'cerrado' || status === 'perdido') {
          update.closed_at = new Date().toISOString();
        }

        const { error } = await supabase.from('ops_cases').update(update).eq('id', id).eq('case_type', CASE_TYPE);
        if (error) throw error;

        // Mark first response if transitioning to en_gestion
        if (status === 'en_gestion') {
          try { await supabase.rpc('ops_mark_first_response', { p_case_id: id, p_user_id: user_id || null }); } catch { /* */ }
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

      // ── Mark as lost (requires reason) ──
      case 'mark_lost': {
        const { id, reason, user_id } = body;
        if (!reason || reason.trim().length < 5) {
          return NextResponse.json({ error: 'Motivo obligatorio (mín. 5 caracteres)' }, { status: 400 });
        }

        const { data: current } = await supabase.from('ops_cases').select('status').eq('id', id).single();

        const { error } = await supabase.from('ops_cases').update({
          status: 'perdido',
          cancellation_reason: reason.trim(),
          closed_at: new Date().toISOString(),
        }).eq('id', id).eq('case_type', CASE_TYPE);
        if (error) throw error;

        await supabase.from('ops_case_history').insert({
          case_id: id,
          changed_by: user_id || null,
          change_type: 'mark_lost',
          before_state: { status: current?.status },
          after_state: { status: 'perdido', cancellation_reason: reason.trim() },
        });

        await supabase.from('ops_activity_log').insert({
          user_id: user_id || null,
          action_type: 'status_change',
          entity_type: 'case',
          entity_id: id,
          metadata: { to: 'perdido', reason: reason.trim() },
        });

        return NextResponse.json({ success: true });
      }

      // ── Convert to emission ──
      case 'convert_to_emission': {
        const { id, user_id } = body;

        // Verify case exists and is in "enviado" status
        const { data: caseData, error: cErr } = await supabase
          .from('ops_cases')
          .select('*')
          .eq('id', id)
          .eq('case_type', CASE_TYPE)
          .single();

        if (cErr || !caseData) {
          return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 });
        }
        if (caseData.status !== 'enviado') {
          return NextResponse.json({ error: 'Solo se puede convertir a emisión desde estado "enviado"' }, { status: 400 });
        }

        // Check that a quote was sent (at least one outbound message)
        const { data: outboundMsgs } = await supabase
          .from('ops_case_messages')
          .select('id')
          .eq('case_id', id)
          .eq('direction', 'outbound')
          .limit(1);

        if (!outboundMsgs || outboundMsgs.length === 0) {
          return NextResponse.json({ error: 'No se puede convertir: no hay cotización enviada' }, { status: 400 });
        }

        // Close the petition as "cerrado"
        await supabase.from('ops_cases').update({
          status: 'cerrado',
          closed_at: new Date().toISOString(),
        }).eq('id', id);

        // Log conversion
        await supabase.from('ops_case_history').insert({
          case_id: id,
          changed_by: user_id || null,
          change_type: 'petition_converted_to_emission',
          before_state: { status: 'enviado' },
          after_state: { status: 'cerrado', converted: true },
        });

        await supabase.from('ops_activity_log').insert({
          user_id: user_id || null,
          action_type: 'petition_converted_to_emission',
          entity_type: 'case',
          entity_id: id,
          metadata: {
            ticket: caseData.ticket,
            client_name: caseData.client_name,
            ramo: caseData.ramo,
          },
        });

        // Return case data for the wizard to use
        return NextResponse.json({
          success: true,
          converted: true,
          caseData: {
            id: caseData.id,
            ticket: caseData.ticket,
            client_name: caseData.client_name,
            client_email: caseData.client_email,
            client_phone: caseData.client_phone,
            cedula: caseData.cedula,
            ramo: caseData.ramo,
            insurer_name: caseData.insurer_name,
          },
        });
      }

      // ── Reassign ──
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

      // ── Auto-assign ──
      case 'assign': {
        const { case_id } = body;
        const { data: masterId } = await supabase.rpc('assign_case_equilibrado', { p_case_id: case_id });
        return NextResponse.json({ success: true, assigned_to: masterId });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── Transition validator ──
function validateTransition(from: string | null, to: string): boolean {
  const allowed: Record<string, string[]> = {
    pendiente: ['en_gestion'],
    en_gestion: ['enviado', 'perdido'],
    enviado: ['cerrado', 'perdido'],
  };
  if (!from) return true; // new case
  return (allowed[from] || []).includes(to);
}
