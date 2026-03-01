import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

// ═══════════════════════════════════════════════════════
// OPERACIONES — Auditoría API
// Unified feed from: ops_activity_log, ops_case_history,
// ops_ai_training_events, ops_ai_evaluations, ops_notes,
// ops_user_sessions, cron_runs
// ═══════════════════════════════════════════════════════

export const runtime = 'nodejs';

interface FeedItem {
  source: 'activity' | 'history' | 'ai_eval' | 'ai_event' | 'note' | 'session' | 'cron';
  timestamp: string;
  user_id: string | null;
  user_name: string | null;
  case_id: string | null;
  ticket: string | null;
  case_type: string | null;
  label: string;
  severity: 'info' | 'warn' | 'critical';
  summary: string;
  raw_ref: string;
  metadata: Record<string, any> | null;
}

// ── Label generators ──

function activityLabel(action: string): string {
  const map: Record<string, string> = {
    session_start: 'Inicio de sesión',
    session_end: 'Fin de sesión',
    status_change: 'Cambio de estado',
    email_sent: 'Email enviado',
    chat_reply: 'Respuesta chat',
    document_attached: 'Documento adjuntado',
    case_created: 'Caso creado',
    case_assigned: 'Caso asignado',
    note_added: 'Nota añadida',
    renewal_confirmed: 'Renovación confirmada',
    cancellation_confirmed: 'Cancelación confirmada',
    first_response: 'Primera respuesta',
    navigation: 'Navegación',
  };
  return map[action] || action.replace(/_/g, ' ');
}

function activitySeverity(action: string, meta: any): 'info' | 'warn' | 'critical' {
  if (meta?.action === 'ops_config_updated' || meta?.action === 'ops_config_bulk_updated') return 'warn';
  if (action === 'status_change' && meta?.new_status === 'sla_breached') return 'critical';
  if (action === 'email_sent') return 'info';
  if (action === 'cancellation_confirmed') return 'warn';
  return 'info';
}

function historySeverity(changeType: string, after: any): 'info' | 'warn' | 'critical' {
  if (changeType === 'sla_breach' || after?.status === 'sla_breached') return 'critical';
  if (changeType === 'escalation') return 'warn';
  return 'info';
}

function summarizeMeta(meta: any): string {
  if (!meta) return '';
  if (meta.action) return meta.action.replace(/_/g, ' ');
  const parts: string[] = [];
  if (meta.new_status) parts.push(`→ ${meta.new_status}`);
  if (meta.old_status) parts.push(`(desde ${meta.old_status})`);
  if (meta.template_key) parts.push(`plantilla: ${meta.template_key}`);
  if (meta.cron) parts.push(`cron: ${meta.cron}`);
  if (meta.breached_count != null) parts.push(`breached: ${meta.breached_count}`);
  return parts.join(' ') || JSON.stringify(meta).substring(0, 100);
}

// ════════════════════════════════════════════
// GET
// ════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin() as any;
    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view') || 'feed';

    // ── FILTERS VIEW ──
    if (view === 'filters') {
      const [mastersRes, actionsRes, caseTypesRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name').eq('role', 'master'),
        supabase.from('ops_activity_log').select('action_type').limit(500),
        supabase.from('ops_cases').select('case_type').limit(500),
      ]);

      const masters = (mastersRes.data || []).map((m: any) => ({ id: m.id, name: m.full_name }));
      const actionTypes = [...new Set((actionsRes.data || []).map((a: any) => a.action_type))].sort();
      const caseTypes = [...new Set((caseTypesRes.data || []).map((c: any) => c.case_type))].sort();

      return NextResponse.json({
        masters,
        action_types: actionTypes,
        case_types: caseTypes,
        statuses: ['nuevo', 'en_proceso', 'esperando_cliente', 'resuelto', 'cerrado', 'sla_breached'],
      });
    }

    // ── CASE TIMELINE VIEW ──
    if (view === 'case_timeline') {
      const caseId = searchParams.get('case_id');
      if (!caseId) return NextResponse.json({ error: 'case_id required' }, { status: 400 });

      // Fetch case info
      const { data: caseData } = await supabase
        .from('ops_cases')
        .select('id, ticket_number, case_type, status, assigned_to, created_at, closed_at, sla_deadline')
        .eq('id', caseId)
        .maybeSingle();

      // Fetch all related data in parallel
      const [historyRes, notesRes, aiEvalsRes, aiEventsRes, activityRes] = await Promise.all([
        supabase.from('ops_case_history').select('*').eq('case_id', caseId).order('created_at', { ascending: true }),
        supabase.from('ops_notes').select('*').eq('case_id', caseId).order('created_at', { ascending: true }),
        supabase.from('ops_ai_evaluations').select('*').eq('case_id', caseId).order('created_at', { ascending: true }),
        supabase.from('ops_ai_training_events').select('*').eq('case_id', caseId).order('created_at', { ascending: true }),
        supabase.from('ops_activity_log').select('*').eq('entity_id', caseId).order('created_at', { ascending: true }),
      ]);

      // Get profile names for user IDs
      const userIds = new Set<string>();
      for (const row of [...(historyRes.data || []), ...(notesRes.data || []), ...(activityRes.data || [])]) {
        if (row.user_id) userIds.add(row.user_id);
        if (row.changed_by) userIds.add(row.changed_by);
      }
      if (caseData?.assigned_to) userIds.add(caseData.assigned_to);

      let profileMap: Record<string, string> = {};
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', Array.from(userIds));
        for (const p of (profiles || [])) profileMap[p.id] = p.full_name || p.id.substring(0, 8);
      }

      // Build timeline events
      const timeline: any[] = [];

      for (const h of (historyRes.data || [])) {
        timeline.push({
          type: 'history',
          timestamp: h.created_at,
          user: profileMap[h.changed_by] || null,
          change_type: h.change_type,
          before: h.before_state,
          after: h.after_state,
          severity: historySeverity(h.change_type, h.after_state),
        });
      }

      for (const n of (notesRes.data || [])) {
        timeline.push({
          type: 'note',
          timestamp: n.created_at,
          user: profileMap[n.user_id] || null,
          content: n.content,
          note_type: n.note_type,
          severity: 'info',
        });
      }

      for (const e of (aiEvalsRes.data || [])) {
        timeline.push({
          type: 'ai_eval',
          timestamp: e.created_at,
          user: null,
          effectiveness_score: e.effectiveness_score,
          sentiment: e.final_sentiment_label,
          escalation_recommended: e.escalation_recommended,
          rationale: e.rationale,
          severity: e.effectiveness_score < 50 ? 'critical' : e.effectiveness_score < 70 ? 'warn' : 'info',
        });
      }

      for (const t of (aiEventsRes.data || [])) {
        timeline.push({
          type: 'ai_event',
          timestamp: t.created_at,
          user: null,
          event_type: t.event_type,
          success: t.success,
          error: t.error,
          severity: t.success ? 'info' : 'warn',
        });
      }

      for (const a of (activityRes.data || [])) {
        timeline.push({
          type: 'activity',
          timestamp: a.created_at,
          user: profileMap[a.user_id] || null,
          action_type: a.action_type,
          label: activityLabel(a.action_type),
          metadata: a.metadata,
          severity: activitySeverity(a.action_type, a.metadata),
        });
      }

      // Sort asc by timestamp
      timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      return NextResponse.json({
        case: caseData ? {
          ...caseData,
          assigned_master: profileMap[caseData.assigned_to] || null,
        } : null,
        timeline,
        profileMap,
      });
    }

    // ── UNIFIED FEED VIEW ──
    const from = searchParams.get('from') || new Date(Date.now() - 7 * 86400000).toISOString();
    const to = searchParams.get('to') || new Date().toISOString();
    const userId = searchParams.get('user_id');
    const caseType = searchParams.get('case_type');
    const actionType = searchParams.get('action_type');
    const q = searchParams.get('q');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(searchParams.get('page_size') || '50'), 100);
    const onlyCritical = searchParams.get('only_critical') === 'true';

    // Fetch from all sources in parallel
    const [activityRes, historyRes, aiEvalsRes, aiEventsRes, notesRes, sessionsRes, cronRes] = await Promise.all([
      // 1. Activity log
      supabase.from('ops_activity_log')
        .select('id, user_id, action_type, entity_type, entity_id, created_at, metadata')
        .gte('created_at', from).lte('created_at', to)
        .order('created_at', { ascending: false })
        .limit(500),

      // 2. Case history
      supabase.from('ops_case_history')
        .select('id, case_id, changed_by, change_type, before_state, after_state, created_at')
        .gte('created_at', from).lte('created_at', to)
        .order('created_at', { ascending: false })
        .limit(500),

      // 3. AI evaluations
      supabase.from('ops_ai_evaluations')
        .select('id, case_id, effectiveness_score, final_sentiment_label, escalation_recommended, rationale, created_at')
        .gte('created_at', from).lte('created_at', to)
        .order('created_at', { ascending: false })
        .limit(200),

      // 4. AI training events
      supabase.from('ops_ai_training_events')
        .select('id, case_id, event_type, success, error, model_provider, created_at')
        .gte('created_at', from).lte('created_at', to)
        .order('created_at', { ascending: false })
        .limit(200),

      // 5. Notes
      supabase.from('ops_notes')
        .select('id, case_id, user_id, note_type, content, created_at')
        .gte('created_at', from).lte('created_at', to)
        .order('created_at', { ascending: false })
        .limit(300),

      // 6. Sessions
      supabase.from('ops_user_sessions')
        .select('id, user_id, session_start, session_end, duration_minutes')
        .gte('session_start', from).lte('session_start', to)
        .order('session_start', { ascending: false })
        .limit(200),

      // 7. Cron runs
      supabase.from('cron_runs')
        .select('id, job_name, started_at, finished_at, status, processed_count, error_message, metadata')
        .gte('started_at', from).lte('started_at', to)
        .order('started_at', { ascending: false })
        .limit(200),
    ]);

    // Collect user IDs for profile lookup
    const userIdSet = new Set<string>();
    for (const r of (activityRes.data || [])) { if (r.user_id) userIdSet.add(r.user_id); }
    for (const r of (historyRes.data || [])) { if (r.changed_by) userIdSet.add(r.changed_by); }
    for (const r of (notesRes.data || [])) { if (r.user_id) userIdSet.add(r.user_id); }
    for (const r of (sessionsRes.data || [])) { if (r.user_id) userIdSet.add(r.user_id); }

    let profileMap: Record<string, string> = {};
    if (userIdSet.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', Array.from(userIdSet));
      for (const p of (profiles || [])) profileMap[p.id] = p.full_name || p.id.substring(0, 8);
    }

    // Collect case IDs for ticket/case_type lookup
    const caseIdSet = new Set<string>();
    for (const r of (activityRes.data || [])) { if (r.entity_id) caseIdSet.add(r.entity_id); }
    for (const r of (historyRes.data || [])) { if (r.case_id) caseIdSet.add(r.case_id); }
    for (const r of (aiEvalsRes.data || [])) { if (r.case_id) caseIdSet.add(r.case_id); }
    for (const r of (aiEventsRes.data || [])) { if (r.case_id) caseIdSet.add(r.case_id); }
    for (const r of (notesRes.data || [])) { if (r.case_id) caseIdSet.add(r.case_id); }

    let caseMap: Record<string, { ticket: string; case_type: string }> = {};
    if (caseIdSet.size > 0) {
      const ids = Array.from(caseIdSet).slice(0, 200);
      const { data: cases } = await supabase
        .from('ops_cases')
        .select('id, ticket_number, case_type')
        .in('id', ids);
      for (const c of (cases || [])) caseMap[c.id] = { ticket: c.ticket_number, case_type: c.case_type };
    }

    // Build unified feed
    const items: FeedItem[] = [];

    for (const r of (activityRes.data || [])) {
      items.push({
        source: 'activity',
        timestamp: r.created_at,
        user_id: r.user_id,
        user_name: profileMap[r.user_id] || null,
        case_id: r.entity_id,
        ticket: caseMap[r.entity_id]?.ticket || null,
        case_type: caseMap[r.entity_id]?.case_type || r.entity_type,
        label: activityLabel(r.action_type),
        severity: activitySeverity(r.action_type, r.metadata),
        summary: summarizeMeta(r.metadata),
        raw_ref: r.id,
        metadata: r.metadata,
      });
    }

    for (const r of (historyRes.data || [])) {
      items.push({
        source: 'history',
        timestamp: r.created_at,
        user_id: r.changed_by,
        user_name: profileMap[r.changed_by] || null,
        case_id: r.case_id,
        ticket: caseMap[r.case_id]?.ticket || null,
        case_type: caseMap[r.case_id]?.case_type || null,
        label: `Cambio: ${r.change_type}`,
        severity: historySeverity(r.change_type, r.after_state),
        summary: r.after_state?.status ? `→ ${r.after_state.status}` : r.change_type,
        raw_ref: r.id,
        metadata: { before: r.before_state, after: r.after_state },
      });
    }

    for (const r of (aiEvalsRes.data || [])) {
      const sev = r.effectiveness_score < 50 ? 'critical' as const : r.effectiveness_score < 70 ? 'warn' as const : 'info' as const;
      items.push({
        source: 'ai_eval',
        timestamp: r.created_at,
        user_id: null,
        user_name: 'IA',
        case_id: r.case_id,
        ticket: caseMap[r.case_id]?.ticket || null,
        case_type: caseMap[r.case_id]?.case_type || null,
        label: 'Evaluación IA',
        severity: sev,
        summary: `Score: ${r.effectiveness_score}% | ${r.final_sentiment_label}${r.escalation_recommended ? ' ⚠ Escalar' : ''}`,
        raw_ref: r.id,
        metadata: { score: r.effectiveness_score, sentiment: r.final_sentiment_label, rationale: r.rationale },
      });
    }

    for (const r of (aiEventsRes.data || [])) {
      items.push({
        source: 'ai_event',
        timestamp: r.created_at,
        user_id: null,
        user_name: 'IA',
        case_id: r.case_id,
        ticket: caseMap[r.case_id]?.ticket || null,
        case_type: caseMap[r.case_id]?.case_type || null,
        label: `IA: ${r.event_type.replace(/_/g, ' ')}`,
        severity: r.success ? 'info' : 'warn',
        summary: r.success ? `✓ ${r.model_provider || ''}` : `✗ ${r.error?.substring(0, 80) || 'error'}`,
        raw_ref: r.id,
        metadata: { event_type: r.event_type, success: r.success, error: r.error },
      });
    }

    for (const r of (notesRes.data || [])) {
      items.push({
        source: 'note',
        timestamp: r.created_at,
        user_id: r.user_id,
        user_name: profileMap[r.user_id] || null,
        case_id: r.case_id,
        ticket: caseMap[r.case_id]?.ticket || null,
        case_type: caseMap[r.case_id]?.case_type || null,
        label: `Nota (${r.note_type || 'general'})`,
        severity: 'info',
        summary: (r.content || '').substring(0, 100),
        raw_ref: r.id,
        metadata: { note_type: r.note_type },
      });
    }

    for (const r of (sessionsRes.data || [])) {
      items.push({
        source: 'session',
        timestamp: r.session_start,
        user_id: r.user_id,
        user_name: profileMap[r.user_id] || null,
        case_id: null,
        ticket: null,
        case_type: null,
        label: r.session_end ? 'Sesión cerrada' : 'Sesión activa',
        severity: 'info',
        summary: r.duration_minutes ? `${r.duration_minutes} min` : 'En curso',
        raw_ref: r.id,
        metadata: { duration_minutes: r.duration_minutes },
      });
    }

    for (const r of (cronRes.data || [])) {
      items.push({
        source: 'cron',
        timestamp: r.started_at,
        user_id: null,
        user_name: 'Sistema',
        case_id: null,
        ticket: null,
        case_type: null,
        label: `Cron: ${r.job_name}`,
        severity: r.status === 'failed' ? 'critical' : 'info',
        summary: `${r.status}${r.processed_count ? ` (${r.processed_count})` : ''}${r.error_message ? ` — ${r.error_message.substring(0, 60)}` : ''}`,
        raw_ref: r.id,
        metadata: r.metadata,
      });
    }

    // Sort descending by timestamp
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply filters
    let filtered = items;

    if (userId) filtered = filtered.filter(i => i.user_id === userId);
    if (caseType) filtered = filtered.filter(i => i.case_type === caseType);
    if (actionType) filtered = filtered.filter(i =>
      i.label.toLowerCase().includes(actionType.toLowerCase()) ||
      i.source === actionType
    );
    if (onlyCritical) filtered = filtered.filter(i => i.severity === 'critical');
    if (q) {
      const ql = q.toLowerCase();
      filtered = filtered.filter(i =>
        i.label.toLowerCase().includes(ql) ||
        i.summary.toLowerCase().includes(ql) ||
        (i.user_name || '').toLowerCase().includes(ql) ||
        (i.ticket || '').toLowerCase().includes(ql) ||
        (i.case_type || '').toLowerCase().includes(ql)
      );
    }

    // Paginate
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);

    // Counts by severity
    const counts = {
      total,
      info: filtered.filter(i => i.severity === 'info').length,
      warn: filtered.filter(i => i.severity === 'warn').length,
      critical: filtered.filter(i => i.severity === 'critical').length,
    };

    return NextResponse.json({ data: paged, total, page, pageSize, counts });

  } catch (err: any) {
    console.error('[API auditoria] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
