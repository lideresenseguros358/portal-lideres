import { getSupabaseAdmin } from '@/lib/supabase/admin';

// ═══════════════════════════════════════════════════════
// Internal Observability Alerts for Operaciones
// Called from nightly cron or can be invoked standalone
// ═══════════════════════════════════════════════════════

interface AlertCheck {
  type: string;
  title: string;
  body: string;
  link: string;
}

/**
 * Run all observability checks and send notifications to masters.
 * Returns the count of alerts sent.
 */
export async function runOpsAlertChecks(): Promise<{ alerts: AlertCheck[]; sent: number }> {
  const supabase = getSupabaseAdmin() as any;
  const alerts: AlertCheck[] = [];

  // ── 1. Cron failures: 2+ consecutive failures for any job ──
  try {
    const jobNames = ['ops-imap-sync', 'ops-sla-check', 'ops-metrics-nightly', 'ops-ai-eval-urgencies'];
    for (const job of jobNames) {
      const { data: runs } = await supabase
        .from('cron_runs')
        .select('status')
        .eq('job_name', job)
        .order('started_at', { ascending: false })
        .limit(3);

      if (runs && runs.length >= 2) {
        const consecutiveFails = runs.filter((_: any, i: number) => {
          // Count from start until first non-failure
          for (let j = 0; j <= i; j++) {
            if (runs[j].status !== 'failed') return false;
          }
          return true;
        }).length;

        if (consecutiveFails >= 2) {
          alerts.push({
            type: 'cron_failure',
            title: `⚠️ Cron ${job} fallando`,
            body: `${consecutiveFails} ejecuciones consecutivas fallidas. Revisar logs.`,
            link: `/operaciones/config`,
          });
        }
      }
    }
  } catch (e) {
    console.error('[OPS-ALERTS] Error checking cron failures:', e);
  }

  // ── 2. IMAP not running > 5 min ──
  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: lastImap } = await supabase
      .from('cron_runs')
      .select('started_at, status')
      .eq('job_name', 'ops-imap-sync')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (!lastImap || lastImap.started_at < fiveMinAgo) {
      alerts.push({
        type: 'imap_down',
        title: '📧 IMAP Sync inactivo',
        body: 'No se ha ejecutado la sincronización IMAP en los últimos 5 minutos.',
        link: '/operaciones/config',
      });
    }
  } catch (e) {
    console.error('[OPS-ALERTS] Error checking IMAP status:', e);
  }

  // ── 3. SLA breach spikes in last 24h ──
  try {
    const twentyFourAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count: slaCount } = await supabase
      .from('ops_cases')
      .select('id', { count: 'exact', head: true })
      .eq('sla_breached', true)
      .gte('updated_at', twentyFourAgo);

    if (slaCount && slaCount >= 5) {
      alerts.push({
        type: 'sla_spike',
        title: `🔴 ${slaCount} SLA breaches en 24h`,
        body: `Se detectaron ${slaCount} casos con SLA vencido en las últimas 24 horas.`,
        link: '/operaciones/renovaciones',
      });
    }
  } catch (e) {
    console.error('[OPS-ALERTS] Error checking SLA spikes:', e);
  }

  // ── 4. AI effectiveness below threshold (weekly check) ──
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    // Get AI effectiveness threshold from config
    let threshold = 60;
    const { data: configRow } = await supabase
      .from('ops_config')
      .select('value')
      .eq('key', 'ai_effectiveness_threshold')
      .single();
    if (configRow?.value) threshold = Number(configRow.value) || 60;

    const { data: evals } = await supabase
      .from('ops_ai_evaluations')
      .select('effectiveness_score')
      .gte('evaluated_at', sevenDaysAgo);

    if (evals && evals.length >= 3) {
      const avgScore = evals.reduce((s: number, e: any) => s + (e.effectiveness_score || 0), 0) / evals.length;
      if (avgScore < threshold) {
        alerts.push({
          type: 'ai_low_score',
          title: `🤖 IA baja efectividad: ${Math.round(avgScore)}%`,
          body: `Promedio semanal de efectividad IA: ${Math.round(avgScore)}% (umbral: ${threshold}%). Revisar entrenamiento.`,
          link: '/operaciones/config',
        });
      }
    }
  } catch (e) {
    console.error('[OPS-ALERTS] Error checking AI effectiveness:', e);
  }

  // ── Send all alerts as portal_notifications ──
  let sent = 0;
  for (const alert of alerts) {
    try {
      // Avoid duplicate notifications within 6 hours
      const sixHoursAgo = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
      const { data: existing } = await supabase
        .from('portal_notifications')
        .select('id')
        .eq('title', alert.title)
        .gte('created_at', sixHoursAgo)
        .limit(1);

      if (existing && existing.length > 0) continue;

      await supabase.from('portal_notifications').insert({
        type: 'chat_urgent',
        title: alert.title,
        body: alert.body,
        link: alert.link,
        target_role: 'master',
        target_user_id: null,
      });
      sent++;
    } catch (e) {
      console.error(`[OPS-ALERTS] Error sending alert "${alert.title}":`, e);
    }
  }

  return { alerts, sent };
}
