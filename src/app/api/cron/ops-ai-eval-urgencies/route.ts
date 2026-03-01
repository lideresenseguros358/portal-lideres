import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { evaluateUrgencyEffectiveness } from '@/lib/ai/evaluateEffectiveness';
import { learnFromHumanIntervention } from '@/lib/ai/learnFromHuman';
import { acquireCronLock, completeCronRun, failCronRun } from '@/lib/operaciones/cronHelper';

// ═══════════════════════════════════════════════════════
// CRON: AI Evaluation of Urgencies
// Frequency: Every 1 hour
// Finds urgencies closed in last 24h or with new human reply in last 2h
// ═══════════════════════════════════════════════════════

const JOB_NAME = 'ops-ai-eval-urgencies';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Acquire lock (cooldown 1800s = 30min)
    const ctx = await acquireCronLock(JOB_NAME, 1800);
    if (!ctx) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'Lock not acquired' });
    }

    const supabase = ctx.supabase;
    const now = new Date();
    const twentyFourAgo = new Date(now.getTime() - 24 * 3600000).toISOString();
    const twoHoursAgo = new Date(now.getTime() - 2 * 3600000).toISOString();

    // 1. Find urgencies closed in last 24h that haven't been evaluated yet
    const { data: closedCases } = await supabase
      .from('ops_cases')
      .select('id, chat_thread_id')
      .eq('case_type', 'urgencia')
      .in('status', ['resuelto', 'cerrado'])
      .gte('closed_at', twentyFourAgo)
      .not('id', 'in', `(SELECT case_id FROM ops_ai_evaluations WHERE case_id IS NOT NULL)`);

    // 2. Find urgencies with recent human activity (new messages in last 2h) not yet evaluated
    const { data: activeCases } = await supabase
      .from('ops_cases')
      .select('id, chat_thread_id')
      .eq('case_type', 'urgencia')
      .not('status', 'in', '(resuelto,cerrado)')
      .not('first_response_at', 'is', null)
      .gte('updated_at', twoHoursAgo);

    const allCases = [...(closedCases || []), ...(activeCases || [])];

    // Deduplicate
    const seen = new Set<string>();
    const uniqueCases = allCases.filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    let evaluated = 0;
    let learned = 0;
    let errors = 0;

    for (const c of uniqueCases) {
      // Evaluate effectiveness
      const evalResult = await evaluateUrgencyEffectiveness({
        caseId: c.id,
        sourceType: c.chat_thread_id ? 'adm_cot_chat' : 'ops_email_thread',
        sourceId: c.chat_thread_id || undefined,
      });

      if (evalResult.success) {
        evaluated++;
      } else {
        errors++;
        console.error(`[AI-CRON] Eval failed for ${c.id}: ${evalResult.error}`);
      }

      // Learn from human replies (only for closed cases)
      const isClosed = (closedCases || []).some((cc: any) => cc.id === c.id);
      if (isClosed) {
        const learnResult = await learnFromHumanIntervention(c.id);
        if (learnResult.success && learnResult.memoryId) {
          learned++;
        }
      }
    }

    // Log cron run (activity log)
    await supabase.from('ops_activity_log').insert({
      user_id: null,
      action_type: 'status_change',
      entity_type: 'session',
      entity_id: null,
      metadata: {
        cron: JOB_NAME,
        cases_found: uniqueCases.length,
        evaluated,
        learned,
        errors,
      },
    });

    // Complete heartbeat
    await completeCronRun(ctx, {
      success: errors === 0,
      processedCount: evaluated,
      errorMessage: errors > 0 ? `${errors} evaluation(s) failed` : undefined,
      metadata: { cases_found: uniqueCases.length, evaluated, learned, errors },
    });

    return NextResponse.json({
      ok: true,
      cases_found: uniqueCases.length,
      evaluated,
      learned,
      errors,
    });
  } catch (error) {
    console.error('Unexpected error in ops-ai-eval-urgencies cron:', error);
    try {
      const sb = getSupabaseAdmin() as any;
      await sb.rpc('ops_release_cron_lock', { p_job_name: JOB_NAME }).catch(() => {});
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
