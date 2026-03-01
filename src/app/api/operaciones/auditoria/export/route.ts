import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import ExcelJS from 'exceljs';

// ═══════════════════════════════════════════════════════
// OPERACIONES — Auditoría Export (XLSX + PDF)
// POST ?format=xlsx | pdf
// Body: { from, to, user_id?, case_type?, action_type?, q?, scope?, case_id? }
// ═══════════════════════════════════════════════════════

export const runtime = 'nodejs';
export const maxDuration = 55;

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

// Rate limit map (userId → lastExport timestamp)
const exportRateLimit = new Map<string, number>();

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin() as any;
    const userId = await getCurrentUserId();
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'xlsx';

    // Rate limit: 1 export per 30s per user
    if (userId) {
      const last = exportRateLimit.get(userId) || 0;
      if (Date.now() - last < 30000) {
        return NextResponse.json(
          { error: 'Espera 30 segundos entre exportaciones' },
          { status: 429 },
        );
      }
      exportRateLimit.set(userId, Date.now());
    }

    const body = await req.json();
    const {
      from = new Date(Date.now() - 7 * 86400000).toISOString(),
      to = new Date().toISOString(),
      user_id: filterUserId,
      case_type: filterCaseType,
      action_type: filterActionType,
      q: filterQ,
      scope = 'global',
      case_id: filterCaseId,
    } = body;

    // ── Fetch data ──

    const [activityRes, historyRes, aiEvalsRes, aiEventsRes, notesRes, cronRes] = await Promise.all([
      supabase.from('ops_activity_log')
        .select('id, user_id, action_type, entity_type, entity_id, created_at, metadata')
        .gte('created_at', from).lte('created_at', to)
        .order('created_at', { ascending: false })
        .limit(2000),

      supabase.from('ops_case_history')
        .select('id, case_id, changed_by, change_type, before_state, after_state, created_at')
        .gte('created_at', from).lte('created_at', to)
        .order('created_at', { ascending: false })
        .limit(2000),

      supabase.from('ops_ai_evaluations')
        .select('id, case_id, effectiveness_score, final_sentiment_label, final_sentiment_score, escalation_recommended, rationale, unresolved_signals, created_at')
        .gte('created_at', from).lte('created_at', to)
        .order('created_at', { ascending: false })
        .limit(1000),

      supabase.from('ops_ai_training_events')
        .select('id, case_id, event_type, payload, model_provider, model_name, success, error, created_at')
        .gte('created_at', from).lte('created_at', to)
        .order('created_at', { ascending: false })
        .limit(1000),

      supabase.from('ops_notes')
        .select('id, case_id, user_id, note_type, content, created_at')
        .gte('created_at', from).lte('created_at', to)
        .order('created_at', { ascending: false })
        .limit(2000),

      supabase.from('cron_runs')
        .select('id, job_name, started_at, finished_at, status, processed_count, error_message')
        .gte('started_at', from).lte('started_at', to)
        .order('started_at', { ascending: false })
        .limit(500),
    ]);

    const activities: any[] = activityRes.data || [];
    const histories: any[] = historyRes.data || [];
    const aiEvals: any[] = aiEvalsRes.data || [];
    const aiEvents: any[] = aiEventsRes.data || [];
    const notes: any[] = notesRes.data || [];
    const crons: any[] = cronRes.data || [];

    // Profile map
    const userIds = new Set<string>();
    activities.forEach((r: any) => { if (r.user_id) userIds.add(r.user_id); });
    histories.forEach((r: any) => { if (r.changed_by) userIds.add(r.changed_by); });
    notes.forEach((r: any) => { if (r.user_id) userIds.add(r.user_id); });

    let profileMap: Record<string, string> = {};
    if (userIds.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', Array.from(userIds));
      for (const p of (profiles || [])) profileMap[p.id] = p.full_name || p.id.substring(0, 8);
    }

    // Case map
    const caseIds = new Set<string>();
    activities.forEach((r: any) => { if (r.entity_id) caseIds.add(r.entity_id); });
    histories.forEach((r: any) => { if (r.case_id) caseIds.add(r.case_id); });
    aiEvals.forEach((r: any) => { if (r.case_id) caseIds.add(r.case_id); });
    notes.forEach((r: any) => { if (r.case_id) caseIds.add(r.case_id); });

    let caseMap: Record<string, { ticket: string; case_type: string }> = {};
    if (caseIds.size > 0) {
      const ids = Array.from(caseIds).slice(0, 500);
      const { data: cases } = await supabase
        .from('ops_cases')
        .select('id, ticket_number, case_type')
        .in('id', ids);
      for (const c of (cases || [])) caseMap[c.id] = { ticket: c.ticket_number, case_type: c.case_type };
    }

    // Filter by scope/case_id
    const filterByCaseId = (rows: any[], field: string) => {
      if (scope === 'case' && filterCaseId) return rows.filter(r => r[field] === filterCaseId);
      return rows;
    };

    const filteredActivities = filterByCaseId(activities, 'entity_id');
    const filteredHistories = filterByCaseId(histories, 'case_id');
    const filteredAiEvals = filterByCaseId(aiEvals, 'case_id');
    const filteredAiEvents = filterByCaseId(aiEvents, 'case_id');
    const filteredNotes = filterByCaseId(notes, 'case_id');

    // Sanitize string to prevent formula injection in Excel
    const sanitize = (val: any): string => {
      if (val == null) return '';
      const s = typeof val === 'object' ? JSON.stringify(val) : String(val);
      // Prevent formula injection
      if (/^[=+\-@]/.test(s)) return `'${s}`;
      return s.substring(0, 500);
    };

    const fmtDate = (iso: string | null) => {
      if (!iso) return '';
      return new Date(iso).toLocaleString('es-PA', { timeZone: 'America/Panama' });
    };

    // ══════════════════════════════════════════
    // XLSX EXPORT
    // ══════════════════════════════════════════
    if (format === 'xlsx') {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Líderes en Seguros — Operaciones';
      wb.created = new Date();

      const headerStyle: Partial<ExcelJS.Style> = {
        font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF010139' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
      };

      // ── Sheet 1: RESUMEN ──
      const ws1 = wb.addWorksheet('RESUMEN');
      ws1.columns = [
        { header: 'Métrica', key: 'metric', width: 35 },
        { header: 'Valor', key: 'value', width: 20 },
      ];
      ws1.getRow(1).eachCell(c => { Object.assign(c, { style: headerStyle }); });

      const slaBreaches = filteredHistories.filter(h => h.change_type === 'sla_breach' || h.after_state?.status === 'sla_breached').length;
      const emailsSent = filteredActivities.filter(a => a.action_type === 'email_sent').length;
      const casesClosed = filteredHistories.filter(h => h.after_state?.status === 'cerrado' || h.after_state?.status === 'resuelto').length;
      const aiNeg = filteredAiEvals.filter(e => e.effectiveness_score < 50).length;

      ws1.addRows([
        { metric: 'Periodo', value: `${fmtDate(from)} — ${fmtDate(to)}` },
        { metric: 'Filtro usuario', value: filterUserId ? (profileMap[filterUserId] || filterUserId) : 'Todos' },
        { metric: 'Filtro tipo caso', value: filterCaseType || 'Todos' },
        { metric: 'Filtro acción', value: filterActionType || 'Todas' },
        { metric: 'Búsqueda', value: filterQ || '—' },
        { metric: '', value: '' },
        { metric: 'Total eventos actividad', value: filteredActivities.length },
        { metric: 'Total cambios de estado', value: filteredHistories.length },
        { metric: 'SLA breaches', value: slaBreaches },
        { metric: 'Correos enviados', value: emailsSent },
        { metric: 'Casos cerrados/resueltos', value: casesClosed },
        { metric: 'Evaluaciones IA', value: filteredAiEvals.length },
        { metric: 'IA score < 50 (negativas)', value: aiNeg },
        { metric: 'Notas registradas', value: filteredNotes.length },
        { metric: 'Cron runs', value: crons.length },
      ]);

      // ── Sheet 2: FEED ──
      const ws2 = wb.addWorksheet('FEED');
      ws2.columns = [
        { header: 'Fecha/Hora', key: 'ts', width: 20 },
        { header: 'Fuente', key: 'source', width: 12 },
        { header: 'Usuario', key: 'user', width: 20 },
        { header: 'Acción', key: 'action', width: 25 },
        { header: 'Ticket', key: 'ticket', width: 15 },
        { header: 'Tipo Caso', key: 'case_type', width: 15 },
        { header: 'Resumen', key: 'summary', width: 50 },
        { header: 'Severidad', key: 'severity', width: 10 },
      ];
      ws2.getRow(1).eachCell(c => { Object.assign(c, { style: headerStyle }); });

      // Build unified feed items for sheet
      type FeedRow = { ts: string; source: string; user: string; action: string; ticket: string; case_type: string; summary: string; severity: string };
      const feedRows: FeedRow[] = [];

      for (const r of filteredActivities) {
        feedRows.push({
          ts: fmtDate(r.created_at),
          source: 'Actividad',
          user: sanitize(profileMap[r.user_id] || ''),
          action: sanitize(r.action_type),
          ticket: sanitize(caseMap[r.entity_id]?.ticket || ''),
          case_type: sanitize(caseMap[r.entity_id]?.case_type || r.entity_type || ''),
          summary: sanitize(r.metadata?.action || r.action_type),
          severity: 'info',
        });
      }
      for (const r of filteredHistories) {
        feedRows.push({
          ts: fmtDate(r.created_at),
          source: 'Historial',
          user: sanitize(profileMap[r.changed_by] || ''),
          action: sanitize(r.change_type),
          ticket: sanitize(caseMap[r.case_id]?.ticket || ''),
          case_type: sanitize(caseMap[r.case_id]?.case_type || ''),
          summary: sanitize(r.after_state?.status ? `→ ${r.after_state.status}` : r.change_type),
          severity: r.change_type === 'sla_breach' ? 'critical' : 'info',
        });
      }
      for (const r of filteredAiEvals) {
        feedRows.push({
          ts: fmtDate(r.created_at),
          source: 'IA Eval',
          user: 'IA',
          action: 'Evaluación',
          ticket: sanitize(caseMap[r.case_id]?.ticket || ''),
          case_type: sanitize(caseMap[r.case_id]?.case_type || ''),
          summary: sanitize(`Score: ${r.effectiveness_score}% | ${r.final_sentiment_label}`),
          severity: r.effectiveness_score < 50 ? 'critical' : r.effectiveness_score < 70 ? 'warn' : 'info',
        });
      }
      for (const r of filteredNotes) {
        feedRows.push({
          ts: fmtDate(r.created_at),
          source: 'Nota',
          user: sanitize(profileMap[r.user_id] || ''),
          action: sanitize(r.note_type || 'nota'),
          ticket: sanitize(caseMap[r.case_id]?.ticket || ''),
          case_type: sanitize(caseMap[r.case_id]?.case_type || ''),
          summary: sanitize(r.content?.substring(0, 200)),
          severity: 'info',
        });
      }
      for (const r of crons) {
        feedRows.push({
          ts: fmtDate(r.started_at),
          source: 'Cron',
          user: 'Sistema',
          action: sanitize(r.job_name),
          ticket: '',
          case_type: '',
          summary: sanitize(`${r.status}${r.processed_count ? ` (${r.processed_count})` : ''}`),
          severity: r.status === 'failed' ? 'critical' : 'info',
        });
      }

      // Sort desc
      feedRows.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
      for (const row of feedRows) ws2.addRow(row);

      // ── Sheet 3: CAMBIOS_ESTADO ──
      const ws3 = wb.addWorksheet('CAMBIOS_ESTADO');
      ws3.columns = [
        { header: 'Fecha/Hora', key: 'ts', width: 20 },
        { header: 'Ticket', key: 'ticket', width: 15 },
        { header: 'Tipo', key: 'change_type', width: 18 },
        { header: 'Usuario', key: 'user', width: 20 },
        { header: 'Antes (status)', key: 'before_status', width: 18 },
        { header: 'Después (status)', key: 'after_status', width: 18 },
        { header: 'Before (JSON)', key: 'before_json', width: 40 },
        { header: 'After (JSON)', key: 'after_json', width: 40 },
      ];
      ws3.getRow(1).eachCell(c => { Object.assign(c, { style: headerStyle }); });

      for (const r of filteredHistories) {
        ws3.addRow({
          ts: fmtDate(r.created_at),
          ticket: sanitize(caseMap[r.case_id]?.ticket || ''),
          change_type: sanitize(r.change_type),
          user: sanitize(profileMap[r.changed_by] || ''),
          before_status: sanitize(r.before_state?.status || ''),
          after_status: sanitize(r.after_state?.status || ''),
          before_json: sanitize(r.before_state),
          after_json: sanitize(r.after_state),
        });
      }

      // ── Sheet 4: NOTAS ──
      const ws4 = wb.addWorksheet('NOTAS');
      ws4.columns = [
        { header: 'Fecha/Hora', key: 'ts', width: 20 },
        { header: 'Ticket', key: 'ticket', width: 15 },
        { header: 'Usuario', key: 'user', width: 20 },
        { header: 'Tipo', key: 'type', width: 15 },
        { header: 'Contenido', key: 'content', width: 60 },
      ];
      ws4.getRow(1).eachCell(c => { Object.assign(c, { style: headerStyle }); });

      for (const r of filteredNotes) {
        ws4.addRow({
          ts: fmtDate(r.created_at),
          ticket: sanitize(caseMap[r.case_id]?.ticket || ''),
          user: sanitize(profileMap[r.user_id] || ''),
          type: sanitize(r.note_type || ''),
          content: sanitize(r.content),
        });
      }

      // ── Sheet 5: IA_EVAL ──
      const ws5 = wb.addWorksheet('IA_EVAL');
      ws5.columns = [
        { header: 'Fecha/Hora', key: 'ts', width: 20 },
        { header: 'Ticket', key: 'ticket', width: 15 },
        { header: 'Score (%)', key: 'score', width: 12 },
        { header: 'Sentimiento', key: 'sentiment', width: 15 },
        { header: 'Escalar', key: 'escalate', width: 10 },
        { header: 'Razón', key: 'rationale', width: 50 },
        { header: 'Señales', key: 'signals', width: 40 },
      ];
      ws5.getRow(1).eachCell(c => { Object.assign(c, { style: headerStyle }); });

      for (const r of filteredAiEvals) {
        ws5.addRow({
          ts: fmtDate(r.created_at),
          ticket: sanitize(caseMap[r.case_id]?.ticket || ''),
          score: r.effectiveness_score,
          sentiment: sanitize(r.final_sentiment_label),
          escalate: r.escalation_recommended ? 'Sí' : 'No',
          rationale: sanitize(r.rationale),
          signals: sanitize((r.unresolved_signals || []).join(', ')),
        });
      }

      // ── Sheet 6: IA_EVENTS ──
      const ws6 = wb.addWorksheet('IA_EVENTS');
      ws6.columns = [
        { header: 'Fecha/Hora', key: 'ts', width: 20 },
        { header: 'Ticket', key: 'ticket', width: 15 },
        { header: 'Tipo Evento', key: 'event_type', width: 25 },
        { header: 'Proveedor', key: 'provider', width: 15 },
        { header: 'Modelo', key: 'model', width: 20 },
        { header: 'Éxito', key: 'success', width: 8 },
        { header: 'Error', key: 'error', width: 40 },
      ];
      ws6.getRow(1).eachCell(c => { Object.assign(c, { style: headerStyle }); });

      for (const r of filteredAiEvents) {
        ws6.addRow({
          ts: fmtDate(r.created_at),
          ticket: sanitize(caseMap[r.case_id]?.ticket || ''),
          event_type: sanitize(r.event_type),
          provider: sanitize(r.model_provider),
          model: sanitize(r.model_name),
          success: r.success ? 'Sí' : 'No',
          error: sanitize(r.error),
        });
      }

      // ── Sheet 7: CRON_HEALTH ──
      const ws7 = wb.addWorksheet('CRON_HEALTH');
      ws7.columns = [
        { header: 'Inicio', key: 'started', width: 20 },
        { header: 'Fin', key: 'finished', width: 20 },
        { header: 'Job', key: 'job', width: 25 },
        { header: 'Estado', key: 'status', width: 12 },
        { header: 'Procesados', key: 'processed', width: 12 },
        { header: 'Error', key: 'error', width: 40 },
      ];
      ws7.getRow(1).eachCell(c => { Object.assign(c, { style: headerStyle }); });

      for (const r of crons) {
        ws7.addRow({
          started: fmtDate(r.started_at),
          finished: fmtDate(r.finished_at),
          job: sanitize(r.job_name),
          status: sanitize(r.status),
          processed: r.processed_count ?? '',
          error: sanitize(r.error_message),
        });
      }

      // Generate buffer
      const buffer = await wb.xlsx.writeBuffer();

      // Log export
      await supabase.from('ops_activity_log').insert({
        user_id: userId,
        action_type: 'status_change',
        entity_type: 'config',
        entity_id: 'audit_export',
        metadata: {
          action: 'audit_export_xlsx',
          from, to,
          rows: feedRows.length,
          scope,
          case_id: filterCaseId || null,
        },
      }).catch(() => {});

      return new NextResponse(buffer as ArrayBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="auditoria_operaciones_${new Date().toISOString().slice(0, 10)}.xlsx"`,
        },
      });
    }

    // ══════════════════════════════════════════
    // PDF EXPORT (text-based, no pdfkit font issues)
    // ══════════════════════════════════════════
    if (format === 'pdf') {
      // Build a structured HTML → rendered as a downloadable HTML report
      // (More reliable than pdfkit in serverless without font files)
      const slaBreaches = filteredHistories.filter(h => h.change_type === 'sla_breach' || h.after_state?.status === 'sla_breached').length;
      const emailsSent = filteredActivities.filter(a => a.action_type === 'email_sent').length;
      const casesClosed = filteredHistories.filter(h => h.after_state?.status === 'cerrado' || h.after_state?.status === 'resuelto').length;
      const aiNeg = filteredAiEvals.filter(e => e.effectiveness_score < 50).length;

      // Top 20 critical events
      const criticalEvents: { ts: string; label: string; ticket: string; summary: string }[] = [];
      for (const r of filteredHistories.filter(h => h.change_type === 'sla_breach' || h.after_state?.status === 'sla_breached').slice(0, 20)) {
        criticalEvents.push({
          ts: fmtDate(r.created_at),
          label: 'SLA Breach',
          ticket: caseMap[r.case_id]?.ticket || '',
          summary: sanitize(r.after_state?.status || r.change_type),
        });
      }
      for (const r of filteredAiEvals.filter(e => e.effectiveness_score < 50).slice(0, 20 - criticalEvents.length)) {
        criticalEvents.push({
          ts: fmtDate(r.created_at),
          label: 'IA Score Bajo',
          ticket: caseMap[r.case_id]?.ticket || '',
          summary: `Score: ${r.effectiveness_score}%`,
        });
      }
      for (const r of (cronRes.data || []).filter((c: any) => c.status === 'failed').slice(0, 20 - criticalEvents.length)) {
        criticalEvents.push({
          ts: fmtDate(r.started_at),
          label: 'Cron Fallido',
          ticket: '',
          summary: sanitize(r.job_name + ': ' + (r.error_message || 'failed')),
        });
      }

      const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>Auditoría Operaciones</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; color: #1a1a2e; font-size: 12px; }
  h1 { color: #010139; font-size: 22px; border-bottom: 3px solid #8AAA19; padding-bottom: 8px; }
  h2 { color: #010139; font-size: 15px; margin-top: 30px; }
  .meta { color: #666; font-size: 11px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0 20px; font-size: 11px; }
  th { background: #010139; color: white; padding: 6px 8px; text-align: left; font-size: 10px; }
  td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) { background: #f9fafb; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
  .kpi { background: #f0f4ff; border-radius: 8px; padding: 12px; text-align: center; }
  .kpi-val { font-size: 24px; font-weight: bold; color: #010139; }
  .kpi-label { font-size: 10px; color: #666; margin-top: 4px; }
  .critical { color: #dc2626; font-weight: bold; }
  .warn { color: #d97706; }
  .footer { margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 10px; color: #999; font-size: 10px; }
  @media print { body { margin: 20px; } }
</style>
</head>
<body>
<h1>Operaciones — Informe de Auditoría</h1>
<p class="meta">
  Generado: ${fmtDate(new Date().toISOString())}<br/>
  Periodo: ${fmtDate(from)} — ${fmtDate(to)}<br/>
  ${filterUserId ? `Usuario: ${profileMap[filterUserId] || filterUserId}<br/>` : ''}
  ${filterCaseType ? `Tipo caso: ${filterCaseType}<br/>` : ''}
  ${filterQ ? `Búsqueda: ${filterQ}<br/>` : ''}
  ${scope === 'case' && filterCaseId ? `Caso: ${filterCaseId}<br/>` : ''}
</p>

<h2>KPIs del Periodo</h2>
<div class="kpi-grid">
  <div class="kpi"><div class="kpi-val">${filteredActivities.length}</div><div class="kpi-label">Eventos</div></div>
  <div class="kpi"><div class="kpi-val">${filteredHistories.length}</div><div class="kpi-label">Cambios Estado</div></div>
  <div class="kpi"><div class="kpi-val ${slaBreaches > 0 ? 'critical' : ''}">${slaBreaches}</div><div class="kpi-label">SLA Breaches</div></div>
  <div class="kpi"><div class="kpi-val">${emailsSent}</div><div class="kpi-label">Emails Enviados</div></div>
  <div class="kpi"><div class="kpi-val">${casesClosed}</div><div class="kpi-label">Casos Cerrados</div></div>
  <div class="kpi"><div class="kpi-val">${filteredAiEvals.length}</div><div class="kpi-label">Eval. IA</div></div>
  <div class="kpi"><div class="kpi-val ${aiNeg > 0 ? 'critical' : ''}">${aiNeg}</div><div class="kpi-label">IA Negativas</div></div>
  <div class="kpi"><div class="kpi-val">${filteredNotes.length}</div><div class="kpi-label">Notas</div></div>
</div>

<h2>Top Eventos Críticos</h2>
${criticalEvents.length > 0 ? `
<table>
<thead><tr><th>Fecha</th><th>Tipo</th><th>Ticket</th><th>Detalle</th></tr></thead>
<tbody>
${criticalEvents.map(e => `<tr><td>${e.ts}</td><td class="critical">${e.label}</td><td>${e.ticket}</td><td>${e.summary}</td></tr>`).join('')}
</tbody>
</table>
` : '<p>Sin eventos críticos en este periodo.</p>'}

<div class="footer">
  Líderes en Seguros — Operaciones Auditoría<br/>
  Este informe es confidencial y de uso interno.
</div>
</body>
</html>`;

      // Log export
      await supabase.from('ops_activity_log').insert({
        user_id: userId,
        action_type: 'status_change',
        entity_type: 'config',
        entity_id: 'audit_export',
        metadata: {
          action: 'audit_export_pdf',
          from, to,
          scope,
          case_id: filterCaseId || null,
        },
      }).catch(() => {});

      // Return as downloadable HTML report (print-ready)
      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="auditoria_operaciones_${new Date().toISOString().slice(0, 10)}.html"`,
        },
      });
    }

    return NextResponse.json({ error: 'format must be xlsx or pdf' }, { status: 400 });

  } catch (err: any) {
    console.error('[API auditoria/export] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
