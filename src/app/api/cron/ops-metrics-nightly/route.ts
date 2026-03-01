import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { acquireCronLock, completeCronRun, failCronRun } from '@/lib/operaciones/cronHelper';
import { runOpsAlertChecks } from '@/lib/operaciones/opsAlerts';

// ═══════════════════════════════════════════════════════
// CRON: Operaciones Nightly Metrics Aggregation
// Frequency: Daily at 23:55 Panama time
// Aggregates daily metrics + detects low productivity
// ═══════════════════════════════════════════════════════

const JOB_NAME = 'ops-metrics-nightly';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Acquire lock (cooldown 3600s = 1hr for nightly)
    const ctx = await acquireCronLock(JOB_NAME, 3600);
    if (!ctx) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'Lock not acquired' });
    }

    const supabase = ctx.supabase;

    // Get today's date in Panama timezone
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });

    // 1. Aggregate daily metrics
    const { data: metricsCount, error: metricsError } = await supabase.rpc(
      'ops_aggregate_daily_metrics',
      { p_date: today }
    );

    if (metricsError) {
      console.error('Error running ops_aggregate_daily_metrics:', metricsError);
      return NextResponse.json({ error: metricsError.message }, { status: 500 });
    }

    // 2. Detect low productivity
    const { data: flagsCount, error: flagsError } = await supabase.rpc(
      'ops_detect_low_productivity',
      { p_date: today }
    );

    if (flagsError) {
      console.error('Error running ops_detect_low_productivity:', flagsError);
      // Non-fatal, continue
    }

    // 3. Update conversion rates for users with petition closures today
    const { data: usersWithPetitions } = await supabase
      .from('ops_metrics_daily')
      .select('user_id')
      .eq('date', today)
      .gt('petitions_handled', 0);

    let conversionUpdates = 0;
    if (usersWithPetitions) {
      for (const row of usersWithPetitions) {
        await supabase.rpc('ops_update_conversion_rate', {
          p_user_id: row.user_id,
          p_date: today,
        });
        conversionUpdates++;
      }
    }

    // 4. Aggregate AI effectiveness into ops_metrics_daily
    let effectivenessUpdates = 0;
    const { data: allMetricsUsers } = await supabase
      .from('ops_metrics_daily')
      .select('user_id')
      .eq('date', today);

    if (allMetricsUsers) {
      for (const row of allMetricsUsers) {
        // Get avg effectiveness for this user's urgencies evaluated today
        const { data: evals } = await supabase
          .from('ops_ai_evaluations')
          .select('effectiveness_score, final_sentiment_label')
          .in('case_id', supabase
            .from('ops_cases')
            .select('id')
            .eq('assigned_master_id', row.user_id)
            .eq('case_type', 'urgencia')
          )
          .gte('evaluated_at', `${today}T00:00:00`)
          .lte('evaluated_at', `${today}T23:59:59`);

        if (evals && evals.length > 0) {
          const avgEff = evals.reduce((s: number, e: any) => s + (e.effectiveness_score || 0), 0) / evals.length;
          const negCount = evals.filter((e: any) => e.final_sentiment_label === 'negative').length;

          await supabase
            .from('ops_metrics_daily')
            .update({
              urgencies_effectiveness_avg: Math.round(avgEff * 10) / 10,
              urgencies_negative_outcomes: negCount,
            })
            .eq('user_id', row.user_id)
            .eq('date', today);

          effectivenessUpdates++;
        }
      }
    }

    // 5. Morosidad: count emails sent today + cases handled today
    let morosidadNoticesSent = 0;
    let morosidadCasesHandled = 0;
    const { data: morosidadLogs } = await supabase
      .from('ops_activity_log')
      .select('action_type, metadata')
      .in('action_type', ['status_change'])
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`);

    for (const log of (morosidadLogs || [])) {
      const action = log.metadata?.action;
      if (action === 'morosidad_email_sent') morosidadNoticesSent++;
      if (action === 'morosidad_note_added' || action === 'morosidad_follow_up') morosidadCasesHandled++;
    }

    // 6. Morosidad: check 30-day overdue notifications
    let morosidad30dayNotified = 0;
    const { data: overdue30 } = await supabase
      .from('ops_morosidad_view')
      .select('policy_id, client_name, policy_number, days_overdue')
      .gte('days_overdue', 30)
      .eq('morosidad_status', 'atrasado');

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600000).toISOString();
    for (const row of (overdue30 || [])) {
      const { data: recent } = await supabase
        .from('portal_notifications')
        .select('id')
        .eq('link', `/operaciones/morosidad?policy=${row.policy_id}`)
        .gte('created_at', sevenDaysAgo)
        .limit(1);

      if (!recent || recent.length === 0) {
        await supabase.from('portal_notifications').insert({
          type: 'chat_urgent',
          title: `🔴 Morosidad crítica: ${row.client_name || row.policy_number}`,
          body: `Póliza ${row.policy_number} con ${row.days_overdue} días de atraso.`,
          link: `/operaciones/morosidad?policy=${row.policy_id}`,
          target_role: 'master',
          target_user_id: null,
        }).catch(() => {});
        morosidad30dayNotified++;
      }
    }

    // 7. Run observability alert checks
    let alertsSent = 0;
    try {
      const alertResult = await runOpsAlertChecks();
      alertsSent = alertResult.sent;
      console.log(`[CRON ${JOB_NAME}] Alerts: ${alertResult.alerts.length} detected, ${alertsSent} sent`);
    } catch (alertErr) {
      console.error(`[CRON ${JOB_NAME}] Alert check failed (non-fatal):`, alertErr);
    }

    // Log the cron run (activity log)
    await supabase.from('ops_activity_log').insert({
      user_id: null,
      action_type: 'status_change',
      entity_type: 'session',
      entity_id: null,
      metadata: {
        cron: JOB_NAME,
        date: today,
        users_aggregated: metricsCount || 0,
        productivity_flags_checked: flagsCount || 0,
        conversion_rate_updates: conversionUpdates,
        effectiveness_updates: effectivenessUpdates,
        morosidad_notices_sent: morosidadNoticesSent,
        morosidad_cases_handled: morosidadCasesHandled,
        morosidad_30day_notified: morosidad30dayNotified,
      },
    });

    // Complete heartbeat
    await completeCronRun(ctx, {
      success: true,
      processedCount: (metricsCount || 0) + morosidad30dayNotified,
      metadata: {
        date: today,
        users_aggregated: metricsCount || 0,
        productivity_flags_checked: flagsCount || 0,
        conversion_rate_updates: conversionUpdates,
        effectiveness_updates: effectivenessUpdates,
        morosidad_notices_sent: morosidadNoticesSent,
        morosidad_30day_notified: morosidad30dayNotified,
        alerts_sent: alertsSent,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Nightly metrics aggregation completed`,
      date: today,
      users_aggregated: metricsCount || 0,
      productivity_flags_checked: flagsCount || 0,
      conversion_rate_updates: conversionUpdates,
      effectiveness_updates: effectivenessUpdates,
      morosidad_notices_sent: morosidadNoticesSent,
      morosidad_cases_handled: morosidadCasesHandled,
      morosidad_30day_notified: morosidad30dayNotified,
      alerts_sent: alertsSent,
    });
  } catch (error) {
    console.error('Unexpected error in ops-metrics-nightly cron:', error);
    // Try to fail the cron run if ctx exists
    try {
      const supabase = getSupabaseAdmin() as any;
      await supabase.rpc('ops_release_cron_lock', { p_job_name: JOB_NAME }).catch(() => {});
    } catch { /* */ }
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    error: 'Method not allowed. Use POST with proper authorization.',
  }, { status: 405 });
}
