import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { acquireCronLock, completeCronRun, failCronRun } from '@/lib/operaciones/cronHelper';

// ═══════════════════════════════════════════════════════
// CRON: Operaciones SLA Check
// Frequency: Every 6 hours
// Calls ops_check_sla() to mark breached cases
// ═══════════════════════════════════════════════════════

const JOB_NAME = 'ops-sla-check';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const xCronSecret = request.headers.get('x-cron-secret');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || (authHeader !== `Bearer ${cronSecret}` && xCronSecret !== cronSecret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Acquire lock (cooldown 300s = 5min for SLA check)
    const ctx = await acquireCronLock(JOB_NAME, 300);
    if (!ctx) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'Lock not acquired' });
    }

    try {
      // Try RPC first; if it doesn't exist, fall back to direct query
      let breached: any[] = [];
      let rpcAvailable = true;

      try {
        const { data, error } = await ctx.supabase.rpc('ops_check_sla');
        if (error) {
          console.warn('ops_check_sla RPC failed, falling back to direct query:', error.message);
          rpcAvailable = false;
        } else {
          breached = data || [];
        }
      } catch {
        console.warn('ops_check_sla RPC unavailable, falling back to direct query');
        rpcAvailable = false;
      }

      // Fallback: mark cases with SLA breach directly
      if (!rpcAvailable) {
        const CLOSED = ['cerrado_renovado', 'cerrado_cancelado', 'cerrado', 'perdido', 'resuelto'];
        const slaHours: Record<string, number> = { urgencia: 4, peticion: 48, renovacion: 72 };

        for (const [caseType, hours] of Object.entries(slaHours)) {
          const cutoff = new Date(Date.now() - hours * 3600000).toISOString();
          const { data: cases } = await ctx.supabase
            .from('ops_cases')
            .select('id, case_type')
            .eq('case_type', caseType)
            .eq('sla_breached', false)
            .not('status', 'in', `(${CLOSED.join(',')})`)
            .lt('created_at', cutoff);

          if (cases && cases.length > 0) {
            const ids = cases.map((c: any) => c.id);
            await ctx.supabase
              .from('ops_cases')
              .update({ sla_breached: true })
              .in('id', ids);
            breached.push(...cases.map((c: any) => ({ case_id: c.id, case_type: c.case_type, hours_elapsed: hours })));
          }
        }
      }

      const breachedCount = breached.length;

      // Log activity
      await ctx.supabase.from('ops_activity_log').insert({
        user_id: null,
        action_type: 'status_change',
        entity_type: 'case',
        entity_id: null,
        metadata: {
          cron: JOB_NAME,
          breached_count: breachedCount,
          used_fallback: !rpcAvailable,
          breached_cases: breached.slice(0, 20).map((b: any) => ({
            case_id: b.case_id,
            case_type: b.case_type,
            hours_elapsed: b.hours_elapsed,
          })),
        },
      });

      await completeCronRun(ctx, {
        success: true,
        processedCount: breachedCount,
        metadata: { breached_count: breachedCount, used_fallback: !rpcAvailable },
      });

      return NextResponse.json({
        ok: true,
        message: `SLA check completed`,
        breached_count: breachedCount,
        used_fallback: !rpcAvailable,
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

