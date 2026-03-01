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

        // Hours today
        const { data: sessions } = await supabase
          .from('ops_user_sessions')
          .select('duration_minutes')
          .eq('user_id', m.id)
          .gte('session_start', `${today}T00:00:00`)
          .lte('session_start', `${today}T23:59:59`);

        const hoursToday = (sessions || []).reduce(
          (s: number, r: { duration_minutes: number }) => s + (r.duration_minutes || 0), 0
        ) / 60;

        // Cases handled today (closed today)
        const { count: casesToday } = await supabase
          .from('ops_cases')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_master_id', m.id)
          .gte('closed_at', `${today}T00:00:00`)
          .lte('closed_at', `${today}T23:59:59`);

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
    // ════════════════════════════════════════════
    if (view === 'detail') {
      const userId = searchParams.get('user_id');
      const from = searchParams.get('from');
      const to = searchParams.get('to');
      if (!userId || !from || !to) {
        return NextResponse.json({ error: 'user_id, from, to required' }, { status: 400 });
      }

      // Daily metrics in range
      const { data: dailyMetrics } = await supabase
        .from('ops_metrics_daily')
        .select('*')
        .eq('user_id', userId)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: true });

      // Sessions in range
      const { data: sessions } = await supabase
        .from('ops_user_sessions')
        .select('session_start, duration_minutes')
        .eq('user_id', userId)
        .gte('session_start', `${from}T00:00:00`)
        .lte('session_start', `${to}T23:59:59`);

      // Hours from sessions
      const totalMinutes = (sessions || []).reduce(
        (s: number, r: { duration_minutes: number }) => s + (r.duration_minutes || 0), 0
      );
      const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

      // Aggregate daily metrics
      const rows = dailyMetrics || [];
      const agg = {
        total_hours: totalHours,
        days_with_data: rows.length,
        avg_daily_hours: rows.length > 0 ? Math.round((totalHours / rows.length) * 10) / 10 : 0,
        cases_handled: rows.reduce((s: number, r: any) => s + (r.cases_handled || 0), 0),
        renewals_handled: rows.reduce((s: number, r: any) => s + (r.renewals_handled || 0), 0),
        petitions_handled: rows.reduce((s: number, r: any) => s + (r.petitions_handled || 0), 0),
        urgencies_handled: rows.reduce((s: number, r: any) => s + (r.urgencies_handled || 0), 0),
        emissions_confirmed: rows.reduce((s: number, r: any) => s + (r.emissions_confirmed || 0), 0),
        conversions_count: rows.reduce((s: number, r: any) => s + (r.conversions_count || 0), 0),
        sla_breaches: rows.reduce((s: number, r: any) => s + (r.sla_breaches || 0), 0),
      };

      // Conversion rate
      const conversionRate = agg.petitions_handled > 0
        ? Math.round((agg.conversions_count / agg.petitions_handled) * 10000) / 100
        : 0;

      // Unattended cases (>48h no first_response, currently open)
      const { count: unattended } = await supabase
        .from('ops_cases')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_master_id', userId)
        .is('first_response_at', null)
        .not('status', 'in', `(${CLOSED.join(',')})`)
        .lt('created_at', new Date(Date.now() - 48 * 3600000).toISOString());

      // Pending cases
      const { count: pendingCases } = await supabase
        .from('ops_cases')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_master_id', userId)
        .not('status', 'in', `(${CLOSED.join(',')})`);

      // Avg first response time (in hours) for cases closed in range
      const { data: responseTimes } = await supabase
        .from('ops_cases')
        .select('created_at, first_response_at')
        .eq('assigned_master_id', userId)
        .not('first_response_at', 'is', null)
        .gte('closed_at', `${from}T00:00:00`)
        .lte('closed_at', `${to}T23:59:59`);

      let avgResponseHours = 0;
      if (responseTimes && responseTimes.length > 0) {
        const total = responseTimes.reduce((s: number, r: any) => {
          return s + (new Date(r.first_response_at).getTime() - new Date(r.created_at).getTime()) / 3600000;
        }, 0);
        avgResponseHours = Math.round((total / responseTimes.length) * 10) / 10;
      }

      // SLA detail — urgencies within/outside SLA
      const { data: urgCases } = await supabase
        .from('ops_cases')
        .select('id, sla_breached')
        .eq('assigned_master_id', userId)
        .eq('case_type', 'urgencia')
        .gte('created_at', `${from}T00:00:00`)
        .lte('created_at', `${to}T23:59:59`);

      const urgTotal = (urgCases || []).length;
      const urgBreached = (urgCases || []).filter((c: any) => c.sla_breached).length;
      const urgWithinSla = urgTotal - urgBreached;

      // AI effectiveness data
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

      // Productivity flags in range
      const { data: flags } = await supabase
        .from('ops_productivity_flags')
        .select('*')
        .eq('user_id', userId)
        .eq('low_productivity', true)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: false });

      // Previous period comparison (same duration before 'from')
      const fromDate = new Date(from);
      const toDate = new Date(to);
      const rangeDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;
      const prevTo = new Date(fromDate.getTime() - 86400000).toISOString().slice(0, 10);
      const prevFrom = new Date(fromDate.getTime() - rangeDays * 86400000).toISOString().slice(0, 10);

      const { data: prevMetrics } = await supabase
        .from('ops_metrics_daily')
        .select('petitions_handled, conversions_count')
        .eq('user_id', userId)
        .gte('date', prevFrom)
        .lte('date', prevTo);

      const prevRows = prevMetrics || [];
      const prevPetitions = prevRows.reduce((s: number, r: any) => s + (r.petitions_handled || 0), 0);
      const prevConversions = prevRows.reduce((s: number, r: any) => s + (r.conversions_count || 0), 0);
      const prevConvRate = prevPetitions > 0
        ? Math.round((prevConversions / prevPetitions) * 10000) / 100
        : 0;

      return NextResponse.json({
        daily: rows,
        summary: {
          ...agg,
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
          'status_change', 'case_assigned', 'petition_converted_to_emission',
          'cancellation_confirmed', 'renewal_confirmed', 'email_sent', 'first_response',
        ])
        .order('created_at', { ascending: false })
        .limit(100);

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
