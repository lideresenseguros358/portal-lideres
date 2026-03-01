import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { URGENCY_STATUSES, generateTicketNumber } from '@/types/operaciones.types';
import { evaluateUrgencyEffectiveness } from '@/lib/ai/evaluateEffectiveness';
import { learnFromHumanIntervention } from '@/lib/ai/learnFromHuman';

// ═══════════════════════════════════════════════════════
// OPERACIONES — Urgencies Inbox API (full rewrite)
// GET: list, counts, masters, history, notes
// POST: create, update_status, reassign, add_note,
//       log_chat_open, re_evaluate
// ═══════════════════════════════════════════════════════

const CASE_TYPE = 'urgencia';
const PAGE_SIZE = 20;

const VALID_TRANSITIONS: Record<string, string[]> = {
  pendiente: ['en_atencion'],
  en_atencion: ['resuelto', 'cerrado'],
  resuelto: ['cerrado'],
};

async function getCurrentUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } } as any,
    );
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch { return null; }
}

// ════════════════════════════════════════════
// GET
// ════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin() as any;
    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view');

    // ── Masters list ──
    if (view === 'masters') {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('role', 'master');
      return NextResponse.json({ data: data || [] });
    }

    // ── History for a case ──
    if (view === 'history') {
      const caseId = searchParams.get('case_id');
      if (!caseId) return NextResponse.json({ error: 'case_id required' }, { status: 400 });
      const { data } = await supabase
        .from('ops_case_history')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false })
        .limit(50);
      return NextResponse.json({ data: data || [] });
    }

    // ── Notes for a case ──
    if (view === 'notes') {
      const caseId = searchParams.get('case_id');
      if (!caseId) return NextResponse.json({ error: 'case_id required' }, { status: 400 });
      const { data } = await supabase
        .from('ops_notes')
        .select('id, case_id, user_id, note, note_type, created_at')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false });

      // Enrich with user names
      const notes = data || [];
      if (notes.length > 0) {
        const userIds = [...new Set(notes.map((n: any) => n.user_id).filter(Boolean))];
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds);
          const nameMap: Record<string, string> = {};
          (profiles || []).forEach((p: any) => { nameMap[p.id] = p.full_name; });
          notes.forEach((n: any) => { n.user_name = nameMap[n.user_id] || null; });
        }
      }
      return NextResponse.json({ data: notes });
    }

    // ── Main list with filters + pagination ──
    const page = Number(searchParams.get('page') || '1');
    const limit = Number(searchParams.get('limit') || String(PAGE_SIZE));
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const slaBr = searchParams.get('sla_breached');
    const noResp = searchParams.get('no_first_response');
    const assignedTo = searchParams.get('assigned_to');
    const today = searchParams.get('today');

    // Lean columns for list view
    const LIST_COLS = 'id,ticket,case_type,status,policy_id,client_id,client_name,insurer_name,policy_number,ramo,assigned_master_id,created_at,updated_at,first_response_at,closed_at,sla_breached,urgency_flag,severity,category,chat_thread_id';
    let query = supabase
      .from('ops_cases')
      .select(LIST_COLS, { count: 'exact' })
      .eq('case_type', CASE_TYPE)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (slaBr === 'true') query = query.eq('sla_breached', true);
    if (noResp === 'true') query = query.is('first_response_at', null);
    if (search) query = query.or(`client_name.ilike.%${search}%,ticket.ilike.%${search}%,category.ilike.%${search}%`);
    if (today === 'true') {
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
      query = query.gte('created_at', `${todayStr}T00:00:00`);
    }
    if (assignedTo === 'me') {
      const userId = await getCurrentUserId();
      if (userId) query = query.eq('assigned_master_id', userId);
    }

    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    // ── Counts (always return regardless of filters) ──
    const { data: allCases } = await supabase
      .from('ops_cases')
      .select('status, sla_breached, first_response_at, created_at')
      .eq('case_type', CASE_TYPE);

    const counts: { [k: string]: number } = {
      total_active: 0, sla_breached: 0, no_first_response: 0,
      pendiente: 0, en_atencion: 0, resuelto: 0, cerrado: 0,
    };
    const closedStatuses = ['resuelto', 'cerrado'];
    for (const r of (allCases || [])) {
      const st = r.status as string;
      if (st in counts) counts[st] = (counts[st] || 0) + 1;
      if (!closedStatuses.includes(st)) counts['total_active'] = (counts['total_active'] || 0) + 1;
      if (r.sla_breached) counts['sla_breached'] = (counts['sla_breached'] || 0) + 1;
      if (!r.first_response_at && !closedStatuses.includes(st)) counts['no_first_response'] = (counts['no_first_response'] || 0) + 1;
    }

    return NextResponse.json({ data: data || [], total: count || 0, counts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ════════════════════════════════════════════
// POST
// ════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin() as any;
    const body = await req.json();
    const { action } = body;
    const userId = await getCurrentUserId();

    switch (action) {

      // ── Create urgency ──
      case 'create': {
        const { chat_thread_id, client_name, severity, category, metadata } = body;
        const ticket = generateTicketNumber('URG');
        const { data, error } = await supabase.from('ops_cases').insert({
          ticket,
          case_type: CASE_TYPE,
          status: 'pendiente',
          urgency_flag: true,
          chat_thread_id,
          client_name,
          severity,
          category,
          metadata: metadata || {},
        }).select().single();
        if (error) throw error;

        await supabase.rpc('assign_case_equilibrado', { p_case_id: data.id }).catch(() => {});

        // Notification for all masters
        await supabase.from('portal_notifications').insert({
          type: 'chat_urgent',
          title: `🚨 Nueva urgencia: ${client_name || ticket}`,
          body: `Categoría: ${category || 'N/A'} — Severidad: ${severity || 'N/A'}`,
          link: `/operaciones/urgencias`,
          target_role: 'master',
          target_user_id: null,
        }).catch(() => {});

        // Activity log
        await supabase.from('ops_activity_log').insert({
          user_id: userId,
          action_type: 'case_created',
          entity_type: 'case',
          entity_id: data.id,
          metadata: { ticket, case_type: CASE_TYPE, severity, category },
        }).catch(() => {});

        return NextResponse.json({ success: true, data });
      }

      // ── Update status (with transition validation) ──
      case 'update_status': {
        const { id, status: newStatus, note } = body;

        // Get current case
        const { data: caseRow, error: getErr } = await supabase
          .from('ops_cases')
          .select('status, chat_thread_id, sla_breached, assigned_master_id')
          .eq('id', id)
          .eq('case_type', CASE_TYPE)
          .single();
        if (getErr || !caseRow) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

        // Validate transition
        const allowed = VALID_TRANSITIONS[caseRow.status] || [];
        if (!allowed.includes(newStatus)) {
          return NextResponse.json({
            error: `Transición inválida: ${caseRow.status} → ${newStatus}. Permitidas: ${allowed.join(', ')}`,
          }, { status: 400 });
        }

        // Require note for closing or if SLA breached
        if ((newStatus === 'cerrado' || caseRow.sla_breached) && (!note || note.trim().length < 10)) {
          return NextResponse.json({
            error: 'Nota obligatoria (mín. 10 caracteres) requerida para cerrar o cuando SLA está vencido.',
          }, { status: 400 });
        }

        const update: Record<string, any> = { status: newStatus };
        if (newStatus === 'resuelto' || newStatus === 'cerrado') {
          update.closed_at = new Date().toISOString();
        }

        const { error: updErr } = await supabase.from('ops_cases').update(update).eq('id', id);
        if (updErr) throw updErr;

        // Mark first response on en_atencion
        if (newStatus === 'en_atencion') {
          await supabase.rpc('ops_mark_first_response', { p_case_id: id, p_user_id: userId }).catch(() => {});
        }

        // Save mandatory note
        if (note && note.trim().length >= 10) {
          await supabase.from('ops_notes').insert({
            case_id: id,
            user_id: userId,
            note: note.trim(),
            note_type: newStatus === 'cerrado' ? 'cierre' : (caseRow.sla_breached ? 'sla_breached' : 'status_change'),
          }).catch(() => {});
        }

        // Activity log
        await supabase.from('ops_activity_log').insert({
          user_id: userId,
          action_type: 'status_change',
          entity_type: 'case',
          entity_id: id,
          metadata: { from: caseRow.status, to: newStatus, note: note || null },
        }).catch(() => {});

        // Fire-and-forget AI evaluation on close/resolve
        if (newStatus === 'resuelto' || newStatus === 'cerrado') {
          const sourceType = caseRow.chat_thread_id ? 'adm_cot_chat' : 'ops_email_thread';
          evaluateUrgencyEffectiveness({ caseId: id, sourceType, sourceId: caseRow.chat_thread_id }).catch(() => {});
          learnFromHumanIntervention(id).catch(() => {});
        }

        return NextResponse.json({ success: true });
      }

      // ── Reassign ──
      case 'reassign': {
        const { case_id, master_id } = body;
        const { data: prev } = await supabase.from('ops_cases').select('assigned_master_id').eq('id', case_id).single();

        const { error } = await supabase.from('ops_cases').update({ assigned_master_id: master_id }).eq('id', case_id);
        if (error) throw error;

        await supabase.from('ops_activity_log').insert({
          user_id: userId,
          action_type: 'reassignment',
          entity_type: 'case',
          entity_id: case_id,
          metadata: { from: prev?.assigned_master_id, to: master_id },
        }).catch(() => {});

        // Notify new assignee
        await supabase.from('portal_notifications').insert({
          type: 'chat_urgent',
          title: '🚨 Urgencia reasignada a ti',
          body: 'Se te ha asignado un caso urgente. Revisa la bandeja de urgencias.',
          link: '/operaciones/urgencias',
          target_role: null,
          target_user_id: master_id,
        }).catch(() => {});

        return NextResponse.json({ success: true });
      }

      // ── Add note ──
      case 'add_note': {
        const { case_id, note, note_type } = body;
        if (!note || note.trim().length < 10) {
          return NextResponse.json({ error: 'Nota mínima: 10 caracteres' }, { status: 400 });
        }

        const { error } = await supabase.from('ops_notes').insert({
          case_id,
          user_id: userId,
          note: note.trim(),
          note_type: note_type || 'manual',
        });
        if (error) throw error;

        await supabase.from('ops_activity_log').insert({
          user_id: userId,
          action_type: 'case_note_added',
          entity_type: 'case',
          entity_id: case_id,
          metadata: { note_type: note_type || 'manual' },
        }).catch(() => {});

        return NextResponse.json({ success: true });
      }

      // ── Log chat open (deep link) ──
      case 'log_chat_open': {
        const { case_id, chat_thread_id } = body;
        await supabase.from('ops_activity_log').insert({
          user_id: userId,
          action_type: 'navigation',
          entity_type: 'case',
          entity_id: case_id,
          metadata: { action: 'open_adm_cot_chat', chat_thread_id },
        }).catch(() => {});

        return NextResponse.json({ success: true });
      }

      // ── Re-evaluate AI ──
      case 're_evaluate': {
        const { case_id } = body;
        const { data: caseRow } = await supabase
          .from('ops_cases')
          .select('chat_thread_id')
          .eq('id', case_id)
          .single();

        const sourceType = caseRow?.chat_thread_id ? 'adm_cot_chat' : 'ops_email_thread';
        const result = await evaluateUrgencyEffectiveness({
          caseId: case_id,
          sourceType,
          sourceId: caseRow?.chat_thread_id,
        });

        await supabase.from('ops_activity_log').insert({
          user_id: userId,
          action_type: 'status_change',
          entity_type: 'case',
          entity_id: case_id,
          metadata: { action: 'ai_case_scored', manual: true, success: result.success },
        }).catch(() => {});

        return NextResponse.json({ success: result.success, evaluationId: result.evaluationId, error: result.error });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
