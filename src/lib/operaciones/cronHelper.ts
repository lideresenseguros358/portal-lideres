import { getSupabaseAdmin } from '@/lib/supabase/admin';

// ═══════════════════════════════════════════════════════
// Shared cron helper: lock acquisition, heartbeat, logging
// ═══════════════════════════════════════════════════════

interface CronContext {
  supabase: any;
  jobName: string;
  runId: string | null;
  startTime: number;
}

/**
 * Acquire advisory lock for a cron job.
 * Returns null if lock not acquired (another instance running or cooldown).
 */
export async function acquireCronLock(
  jobName: string,
  cooldownSeconds: number = 30,
): Promise<CronContext | null> {
  const supabase = getSupabaseAdmin() as any;
  const startTime = Date.now();

  // Try to acquire lock via DB function
  const { data: acquired, error: lockErr } = await supabase.rpc('ops_acquire_cron_lock', {
    p_job_name: jobName,
    p_cooldown_seconds: cooldownSeconds,
  });

  if (lockErr) {
    // If the function doesn't exist yet (migration not run), proceed without lock
    console.warn(`[CRON ${jobName}] Lock function not available:`, lockErr.message);
  } else if (acquired === false) {
    console.log(`[CRON ${jobName}] Skipped — lock not acquired (cooldown or concurrent run)`);
    return null;
  }

  // Create heartbeat entry
  const { data: runData } = await supabase
    .from('cron_runs')
    .insert({
      job_name: jobName,
      started_at: new Date().toISOString(),
      status: 'running',
    })
    .select()
    .single();

  return {
    supabase,
    jobName,
    runId: runData?.id || null,
    startTime,
  };
}

/**
 * Complete a cron run: update heartbeat, release lock, log result.
 */
export async function completeCronRun(
  ctx: CronContext,
  result: {
    success: boolean;
    processedCount?: number;
    errorMessage?: string;
    metadata?: Record<string, any>;
  },
): Promise<void> {
  const durationMs = Date.now() - ctx.startTime;

  // Update heartbeat
  if (ctx.runId) {
    await ctx.supabase
      .from('cron_runs')
      .update({
        finished_at: new Date().toISOString(),
        status: result.success ? 'success' : 'failed',
        processed_count: result.processedCount ?? 0,
        error_message: result.errorMessage?.substring(0, 500) || null,
        metadata: { ...result.metadata, duration_ms: durationMs },
      })
      .eq('id', ctx.runId);
  }

  // Release lock
  await ctx.supabase.rpc('ops_release_cron_lock', { p_job_name: ctx.jobName }).catch(() => {});
}

/**
 * Fail a cron run: update heartbeat with error, release lock.
 */
export async function failCronRun(
  ctx: CronContext,
  error: Error | string,
): Promise<void> {
  const errMsg = typeof error === 'string' ? error : error.message;

  if (ctx.runId) {
    await ctx.supabase
      .from('cron_runs')
      .update({
        finished_at: new Date().toISOString(),
        status: 'failed',
        error_message: errMsg.substring(0, 500),
        metadata: { duration_ms: Date.now() - ctx.startTime },
      })
      .eq('id', ctx.runId);
  }

  await ctx.supabase.rpc('ops_release_cron_lock', { p_job_name: ctx.jobName }).catch(() => {});
}

/**
 * Check consecutive failures for a job. Returns count.
 */
export async function getConsecutiveFailures(
  supabase: any,
  jobName: string,
): Promise<number> {
  const { data } = await supabase
    .from('cron_runs')
    .select('status')
    .eq('job_name', jobName)
    .order('started_at', { ascending: false })
    .limit(5);

  if (!data) return 0;
  let count = 0;
  for (const r of data) {
    if (r.status === 'failed') count++;
    else break;
  }
  return count;
}
