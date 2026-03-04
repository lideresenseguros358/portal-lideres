import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

// ═══════════════════════════════════════════════════════
// OPERACIONES — Team Dashboard API
// GET ?view=cards         → summary cards for all masters
// GET ?view=detail&user_id=X&from=&to=  → full metrics for one user
// GET ?view=history&user_id=X&from=&to= → activity history timeline
// POST { action: 'log_view', user_id }  → log view_user_metrics
// ═══════════════════════════════════════════════════════

const CLOSED = ['cerrado_renovado', 'cerrado_cancelado', 'cerrado', 'perdido', 'resuelto'];

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin() as any;
    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view') || 'cards';

    // ════════════════════════════════════════════
    // VIEW: CARDS — one card per master
    // ════════════════════════════════════════════
    if (view === 'cards') {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });

      // Masters
      const { data: masters } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('role', 'master');

      if (!masters || masters.length === 0) {
        return NextResponse.json({ cards: [] });
      }

      const cards = [];
      for (const m of masters) {
        // Open cases
        const { count: openCases } = await supabase
          .from('ops_cases')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_master_id', m.id)
          .not('status', 'in', `(${CLOSED.join(',')})`);

        // SLA breached active
        const { count: slaBreached } = await supabase
          .from('ops_cases')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_master_id', m.id)
          .eq('sla_breached', true)
          .not('status', 'in', `(${CLOSED.join(',')})`);

        // Hours today — estimate from activity log timestamps (ops_user_sessions is empty)
        const { data: todayLogs } = await supabase
          .from('ops_activity_log')
          .select('created_at')
          .eq('user_id', m.id)
          .gte('created_at', `${today}T00:00:00`)
          .lte('created_at', `${today}T23:59:59`)
          .order('created_at', { ascending: true });

        let hoursToday = 0;
        const todayTimestamps = (todayLogs || []).map((l: any) => l.created_at);
        if (todayTimestamps.length === 1) {
          hoursToday = 0.25; // single action = 15 min
        } else if (todayTimestamps.length >= 2) {
          let mins = 0;
          for (let i = 1; i < todayTimestamps.length; i++) {
            const gap = (new Date(todayTimestamps[i]).getTime() - new Date(todayTimestamps[i - 1]).getTime()) / 60000;
            mins += Math.min(gap, 30); // Cap gaps at 30 min
          }
          hoursToday = Math.max(mins, 15) / 60;
        }

        // Supplement with ops_user_sessions if it has data
        const { data: sessions } = await supabase
          .from('ops_user_sessions')
          .select('duration_minutes')
          .eq('user_id', m.id)
          .gte('session_start', `${today}T00:00:00`)
          .lte('session_start', `${today}T23:59:59`);

        const sessionHours = (sessions || []).reduce(
          (s: number, r: { duration_minutes: number }) => s + (r.duration_minutes || 0), 0
        ) / 60;
        hoursToday = Math.max(hoursToday, sessionHours);

        // Cases today: cases created today + cases with activity today
        const { count: casesCreatedToday } = await supabase
          .from('ops_cases')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_master_id', m.id)
          .gte('created_at', `${today}T00:00:00`)
          .lte('created_at', `${today}T23:59:59`);

        const actionsToday = todayTimestamps.length;
        const casesToday = Math.max(casesCreatedToday || 0, actionsToday);

        // Recent unproductive days (last 30 days)
        const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
        const { count: unproductiveDays } = await supabase
          .from('ops_productivity_flags')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', m.id)
          .eq('low_productivity', true)
          .gte('date', thirtyAgo);

        cards.push({
          id: m.id,
          full_name: m.full_name,
          email: m.email,
          open_cases: openCases || 0,
          sla_breached: slaBreached || 0,
          hours_today: Math.round(hoursToday * 10) / 10,
          cases_today: casesToday || 0,
          unproductive_days_30d: unproductiveDays || 0,
        });
      }

      // Sort by open cases desc
      cards.sort((a, b) => b.open_cases - a.open_cases);

      return NextResponse.json({ cards });
    }

    // ════════════════════════════════════════════
    // VIEW: DETAIL — full metrics for one user
    // Computes metrics from ALL cases (open + closed) + activity log
    // ════════════════════════════════════════════
    if (view === 'detail') {
      const userId = searchParams.get('user_id');
      const from = searchParams.get('from');
      const to = searchParams.get('to');
      if (!userId || !from || !to) {
        return NextResponse.json({ error: 'user_id, from, to required' }, { status: 400 });
      }

      const rangeStart = `${from}T00:00:00`;
      const rangeEnd = `${to}T23:59:59`;

      // ── 1. ALL cases assigned to this user created OR updated in range ──
      const { data: casesCreatedInRange } = await supabase
        .from('ops_cases')
        .select('id, case_type, status, closed_at, sla_breached, created_at, first_response_at, updated_at')
        .eq('assigned_master_id', userId)
        .gte('created_at', rangeStart)
        .lte('created_at', rangeEnd);

      const { data: casesClosedInRange } = await supabase
        .from('ops_cases')
        .select('id, case_type, status, closed_at, sla_breached, created_at, first_response_at, updated_at')
        .eq('assigned_master_id', userId)
        .in('status', CLOSED)
        .gte('closed_at', rangeStart)
        .lte('closed_at', rangeEnd);

      // Deduplicate (a case can be both created and closed in range)
      const caseMap = new Map<string, any>();
      for (const c of (casesCreatedInRange || [])) caseMap.set(c.id, c);
      for (const c of (casesClosedInRange || [])) caseMap.set(c.id, c);
      const allCases = Array.from(caseMap.values());

      const allClosed = allCases.filter((c: any) => CLOSED.includes(c.status));
      const allOpen = allCases.filter((c: any) => !CLOSED.includes(c.status));

      // ── 2. Activity log in range (for daily breakdown + checks actions + hours estimation) ──
      const { data: activityLogs } = await supabase
        .from('ops_activity_log')
        .select('action_type, created_at, metadata')
        .eq('user_id', userId)
        .gte('created_at', rangeStart)
        .lte('created_at', rangeEnd)
        .order('created_at', { ascending: true });

      const allLogs = activityLogs || [];

      // ── 3. Estimate hours from activity timestamps (since ops_user_sessions has no data) ──
      // Group logs by day, estimate active hours from first→last activity + gap analysis
      const logsByDay = new Map<string, string[]>();
      for (const l of allLogs) {
        const day = l.created_at?.slice(0, 10);
        if (!day) continue;
        if (!logsByDay.has(day)) logsByDay.set(day, []);
        logsByDay.get(day)!.push(l.created_at);
      }

      let totalEstimatedMinutes = 0;
      const dailyHoursFromLogs = new Map<string, number>();
      for (const [day, timestamps] of logsByDay) {
        if (timestamps.length < 2) {
          // Single action = assume 15 min
          dailyHoursFromLogs.set(day, 0.25);
          totalEstimatedMinutes += 15;
          continue;
        }
        // Sum gaps between consecutive actions, capping each gap at 30 min (idle cutoff)
        let dayMinutes = 0;
        for (let i = 1; i < timestamps.length; i++) {
          const gap = (new Date(timestamps[i]).getTime() - new Date(timestamps[i - 1]).getTime()) / 60000;
          dayMinutes += Math.min(gap, 30); // Cap individual gaps at 30 min
        }
        dayMinutes = Math.max(dayMinutes, 15); // Minimum 15 min per active day
        dailyHoursFromLogs.set(day, dayMinutes / 60);
        totalEstimatedMinutes += dayMinutes;
      }

      // Also try ops_user_sessions as supplement (in case it does have data)
      const { data: sessions } = await supabase
        .from('ops_user_sessions')
        .select('session_start, duration_minutes')
        .eq('user_id', userId)
        .gte('session_start', rangeStart)
        .lte('session_start', rangeEnd);

      const sessionMinutes = (sessions || []).reduce(
        (s: number, r: { duration_minutes: number }) => s + (r.duration_minutes || 0), 0
      );

      // Use whichever is greater: session tracking or activity-based estimation
      const totalHours = Math.round(Math.max(totalEstimatedMinutes, sessionMinutes) / 60 * 10) / 10;

      // ── Compute aggregates from ALL cases (created + closed in range) ──
      const renewalsHandled = allCases.filter((c: any) => c.case_type === 'renovacion').length;
      const petitionsHandled = allCases.filter((c: any) => c.case_type === 'peticion').length;
      const urgenciesHandled = allCases.filter((c: any) => c.case_type === 'urgencia').length;

      // Emissions: closed cases that resulted in emission/renewal
      const emissionsConfirmed = allClosed.filter((c: any) =>
        c.status === 'cerrado_renovado' || c.status === 'emitido'
      ).length;

      // Conversions: petitions that ended as cerrado_renovado
      const conversionsCount = allClosed.filter((c: any) =>
        c.case_type === 'peticion' && (c.status === 'cerrado_renovado' || c.status === 'emitido')
      ).length;

      const slaBreaches = allCases.filter((c: any) => c.sla_breached).length;

      // Count check actions from activity log
      const checksActions = allLogs.filter((l: any) => l.action_type.startsWith('check_')).length;

      // cases_handled = all cases this user touched in range
      const casesHandled = allCases.length;

      // Build daily breakdown
      const dailyMap = new Map<string, {
        date: string; hours_worked: number; cases_handled: number;
        renewals_handled: number; petitions_handled: number;
        urgencies_handled: number; emissions_confirmed: number;
        conversions_count: number; sla_breaches: number;
        unresolved_cases: number; productivity_score: number;
        low_productivity: boolean;
      }>();

      // Init all dates in range
      const fDate = new Date(from);
      const tDate = new Date(to);
      for (let d = new Date(fDate); d <= tDate; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        dailyMap.set(key, {
          date: key, hours_worked: 0, cases_handled: 0,
          renewals_handled: 0, petitions_handled: 0, urgencies_handled: 0,
          emissions_confirmed: 0, conversions_count: 0, sla_breaches: 0,
          unresolved_cases: 0, productivity_score: 0, low_productivity: false,
        });
      }

      // Fill from cases created in range (by created_at date)
      for (const c of (casesCreatedInRange || [])) {
        const day = c.created_at?.slice(0, 10);
        if (!day || !dailyMap.has(day)) continue;
        const row = dailyMap.get(day)!;
        row.cases_handled++;
        if (c.case_type === 'renovacion') row.renewals_handled++;
        if (c.case_type === 'peticion') row.petitions_handled++;
        if (c.case_type === 'urgencia') row.urgencies_handled++;
        if (c.sla_breached) row.sla_breaches++;
      }

      // Also fill from closed cases (by closed_at date, for conversions)
      for (const c of allClosed) {
        const day = c.closed_at?.slice(0, 10);
        if (!day || !dailyMap.has(day)) continue;
        const row = dailyMap.get(day)!;
        if ((c.status === 'cerrado_renovado' || c.status === 'emitido')) row.emissions_confirmed++;
        if (c.case_type === 'peticion' && (c.status === 'cerrado_renovado' || c.status === 'emitido')) row.conversions_count++;
      }

      // Fill from activity logs (count any activity as productivity)
      for (const l of allLogs) {
        const day = l.created_at?.slice(0, 10);
        if (!day || !dailyMap.has(day)) continue;
        dailyMap.get(day)!.productivity_score++;
      }

      // Fill estimated hours per day from activity logs
      for (const [day, hours] of dailyHoursFromLogs) {
        if (dailyMap.has(day)) {
          dailyMap.get(day)!.hours_worked = Math.round(hours * 10) / 10;
        }
      }

      // Overlay sessions hours if they exist
      for (const s of (sessions || [])) {
        const day = (s.session_start as string)?.slice(0, 10);
        if (!day || !dailyMap.has(day)) continue;
        const sessionH = (s.duration_minutes || 0) / 60;
        // Use whichever is greater per day
        const current = dailyMap.get(day)!.hours_worked;
        if (sessionH > current) {
          dailyMap.get(day)!.hours_worked = Math.round(sessionH * 10) / 10;
        }
      }

      // Filter daily to only days with actual activity
      const daily = Array.from(dailyMap.values())
        .filter(d => d.cases_handled > 0 || d.productivity_score > 0 || d.hours_worked > 0);

      // Conversion rate
      const conversionRate = petitionsHandled > 0
        ? Math.round((conversionsCount / petitionsHandled) * 10000) / 100
        : 0;

      // ── Unattended cases (>48h no first_response, currently open) ──
      const { count: unattended } = await supabase
        .from('ops_cases')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_master_id', userId)
        .is('first_response_at', null)
        .not('status', 'in', `(${CLOSED.join(',')})`)
        .lt('created_at', new Date(Date.now() - 48 * 3600000).toISOString());

      // Pending cases (currently open)
      const { count: pendingCases } = await supabase
        .from('ops_cases')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_master_id', userId)
        .not('status', 'in', `(${CLOSED.join(',')})`);

      // Avg first response time (hours) for all cases with first_response
      const casesWithResponse = allCases.filter((c: any) => c.first_response_at);
      let avgResponseHours = 0;
      if (casesWithResponse.length > 0) {
        const total = casesWithResponse.reduce((s: number, r: any) => {
          return s + (new Date(r.first_response_at).getTime() - new Date(r.created_at).getTime()) / 3600000;
        }, 0);
        avgResponseHours = Math.round((total / casesWithResponse.length) * 10) / 10;
      }

      // ── Urgencies SLA detail ──
      const { data: urgCases } = await supabase
        .from('ops_cases')
        .select('id, sla_breached')
        .eq('assigned_master_id', userId)
        .eq('case_type', 'urgencia')
        .gte('created_at', rangeStart)
        .lte('created_at', rangeEnd);

      const urgTotal = (urgCases || []).length;
      const urgBreached = (urgCases || []).filter((c: any) => c.sla_breached).length;
      const urgWithinSla = urgTotal - urgBreached;

      // AI effectiveness
      const urgCaseIds = (urgCases || []).map((c: any) => c.id);
      let aiEffectivenessAvg = 0;
      let aiNegativeCount = 0;
      let aiTotalEvaluated = 0;
      if (urgCaseIds.length > 0) {
        const { data: aiEvals } = await supabase
          .from('ops_ai_evaluations')
          .select('effectiveness_score, final_sentiment_label')
          .in('case_id', urgCaseIds);
        if (aiEvals && aiEvals.length > 0) {
          aiTotalEvaluated = aiEvals.length;
          aiEffectivenessAvg = Math.round(
            (aiEvals.reduce((s: number, e: any) => s + (e.effectiveness_score || 0), 0) / aiEvals.length) * 10
          ) / 10;
          aiNegativeCount = aiEvals.filter((e: any) => e.final_sentiment_label === 'negative').length;
        }
      }

      // Productivity flags
      const { data: flags } = await supabase
        .from('ops_productivity_flags')
        .select('*')
        .eq('user_id', userId)
        .eq('low_productivity', true)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: false });

      // Previous period comparison
      const fromDate = new Date(from);
      const toDate2 = new Date(to);
      const rangeDays = Math.ceil((toDate2.getTime() - fromDate.getTime()) / 86400000) + 1;
      const prevTo = new Date(fromDate.getTime() - 86400000).toISOString().slice(0, 10);
      const prevFrom = new Date(fromDate.getTime() - rangeDays * 86400000).toISOString().slice(0, 10);

      // Previous period: count ALL cases (created in prev range)
      const { data: prevCases } = await supabase
        .from('ops_cases')
        .select('case_type, status')
        .eq('assigned_master_id', userId)
        .gte('created_at', `${prevFrom}T00:00:00`)
        .lte('created_at', `${prevTo}T23:59:59`);

      const prevAll = prevCases || [];
      const prevPetitions = prevAll.filter((c: any) => c.case_type === 'peticion').length;
      const prevConversions = prevAll.filter((c: any) =>
        c.case_type === 'peticion' && (c.status === 'cerrado_renovado' || c.status === 'emitido')
      ).length;
      const prevConvRate = prevPetitions > 0
        ? Math.round((prevConversions / prevPetitions) * 10000) / 100
        : 0;

      return NextResponse.json({
        daily,
        summary: {
          total_hours: totalHours,
          days_with_data: daily.length,
          avg_daily_hours: daily.length > 0 ? Math.round((totalHours / daily.length) * 10) / 10 : 0,
          cases_handled: casesHandled,
          renewals_handled: renewalsHandled,
          petitions_handled: petitionsHandled,
          urgencies_handled: urgenciesHandled,
          emissions_confirmed: emissionsConfirmed,
          conversions_count: conversionsCount,
          sla_breaches: slaBreaches,
          conversion_rate: conversionRate,
          unattended_cases: unattended || 0,
          pending_cases: pendingCases || 0,
          avg_response_hours: avgResponseHours,
          urgencies_total: urgTotal,
          urgencies_within_sla: urgWithinSla,
          urgencies_breached: urgBreached,
          urgency_effectiveness: urgTotal > 0 ? Math.round((urgWithinSla / urgTotal) * 100) : 0,
          ai_effectiveness_avg: aiEffectivenessAvg,
          ai_negative_count: aiNegativeCount,
          ai_total_evaluated: aiTotalEvaluated,
          checks_actions: checksActions,
        },
        productivity_flags: flags || [],
        previous_period: {
          petitions: prevPetitions,
          conversions: prevConversions,
          conversion_rate: prevConvRate,
        },
      });
    }

    // ════════════════════════════════════════════
    // VIEW: HISTORY — activity timeline
    // ════════════════════════════════════════════
    if (view === 'history') {
      const userId = searchParams.get('user_id');
      const from = searchParams.get('from');
      const to = searchParams.get('to');
      if (!userId) {
        return NextResponse.json({ error: 'user_id required' }, { status: 400 });
      }

      let q = supabase
        .from('ops_activity_log')
        .select('id, action_type, entity_type, entity_id, created_at, metadata')
        .eq('user_id', userId)
        .in('action_type', [
          // Operaciones
          'status_change', 'case_assigned', 'case_created', 'petition_converted_to_emission',
          'cancellation_confirmed', 'renewal_confirmed', 'email_sent', 'first_response',
          'imap_manual_assign', 'imap_manual_discard',
          // Cheques / Pagos
          'check_payment_created', 'check_payment_paid', 'check_payment_deleted',
          'check_payment_updated', 'check_bank_imported',
          'check_early_payment_enabled', 'check_early_payment_reverted',
        ])
        .order('created_at', { ascending: false })
        .limit(200);

      if (from) q = q.gte('created_at', `${from}T00:00:00`);
      if (to) q = q.lte('created_at', `${to}T23:59:59`);

      const { data: history } = await q;

      return NextResponse.json({ history: history || [] });
    }

    return NextResponse.json({ error: 'Invalid view parameter' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin() as any;
    const body = await req.json();

    if (body.action === 'log_view') {
      await supabase.from('ops_activity_log').insert({
        user_id: body.viewer_id || null,
        action_type: 'navigation',
        entity_type: 'session',
        entity_id: body.user_id || null,
        metadata: { action: 'view_user_metrics', target_user: body.user_id },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
