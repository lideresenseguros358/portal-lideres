import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { acquireCronLock, completeCronRun, failCronRun } from '@/lib/operaciones/cronHelper';

// ═══════════════════════════════════════════════════════
// CRON: Operaciones SLA Check
// Frequency: Every 6 hours
// Calls ops_check_sla() to mark breached cases
// ═══════════════════════════════════════════════════════

const JOB_NAME = 'ops-sla-check';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Acquire lock (cooldown 300s = 5min for SLA check)
    const ctx = await acquireCronLock(JOB_NAME, 300);
    if (!ctx) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'Lock not acquired' });
    }

    try {
      const { data: breached, error } = await ctx.supabase.rpc('ops_check_sla');

      if (error) {
        console.error('Error running ops_check_sla:', error);
        await failCronRun(ctx, error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const breachedCount = breached?.length || 0;

      // Log activity
      await ctx.supabase.from('ops_activity_log').insert({
        user_id: null,
        action_type: 'status_change',
        entity_type: 'case',
        entity_id: null,
        metadata: {
          cron: JOB_NAME,
          breached_count: breachedCount,
          breached_cases: (breached || []).map((b: any) => ({
            case_id: b.case_id,
            case_type: b.case_type,
            hours_elapsed: b.hours_elapsed,
          })),
        },
      });

      await completeCronRun(ctx, {
        success: true,
        processedCount: breachedCount,
        metadata: { breached_count: breachedCount },
      });

      return NextResponse.json({
        ok: true,
        message: `SLA check completed`,
        breached_count: breachedCount,
        breached: breached || [],
      });
    } catch (innerErr: any) {
      await failCronRun(ctx, innerErr);
      throw innerErr;
    }
  } catch (error) {
    console.error('Unexpected error in ops-sla-check cron:', error);
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
