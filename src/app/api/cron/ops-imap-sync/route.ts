/**
 * CRON ENDPOINT — IMAP Sync for Renovaciones
 * =============================================
 * Called every 1 minute by Vercel Cron.
 * Syncs inbound emails from Zoho IMAP → ops_case_messages.
 */

import { NextRequest, NextResponse } from 'next/server';
import { run } from '@/lib/email/zohoImapSync';
import { acquireCronLock, completeCronRun, failCronRun } from '@/lib/operaciones/cronHelper';

export const runtime = 'nodejs';
export const maxDuration = 55; // Under 60s limit

const JOB_NAME = 'ops-imap-sync';

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization');
    const xCronSecret = request.headers.get('x-cron-secret');
    const cronSecret = process.env.CRON_SECRET;
    const provided = authHeader?.replace('Bearer ', '') || xCronSecret;

    if (cronSecret && provided !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Acquire lock (cooldown 30s for IMAP — runs every minute)
    const ctx = await acquireCronLock(JOB_NAME, 30);
    if (!ctx) {
      return NextResponse.json({ success: true, skipped: true, reason: 'Lock not acquired' });
    }

    console.log(`[CRON ${JOB_NAME}] Starting`);

    try {
      // Execute sync
      const result = await run();

      console.log(`[CRON ${JOB_NAME}] Result:`, JSON.stringify(result));

      await completeCronRun(ctx, {
        success: result.success,
        processedCount: result.count_new_messages,
        errorMessage: result.errors.length > 0 ? result.errors.join('; ') : undefined,
        metadata: {
          new: result.count_new_messages,
          classified: result.count_classified,
          unclassified: result.count_unclassified,
          dupes: result.count_skipped_duplicate,
        },
      });

      return NextResponse.json({
        success: result.success,
        timestamp: new Date().toISOString(),
        runId: ctx.runId,
        stats: {
          new_messages: result.count_new_messages,
          classified: result.count_classified,
          unclassified: result.count_unclassified,
          skipped_dupes: result.count_skipped_duplicate,
          duration_ms: Date.now() - ctx.startTime,
        },
        errors: result.errors.length > 0 ? result.errors : undefined,
      });
    } catch (innerErr: any) {
      console.error(`[CRON ${JOB_NAME}] Fatal:`, innerErr);
      await failCronRun(ctx, innerErr);
      return NextResponse.json(
        { success: false, error: innerErr.message, timestamp: new Date().toISOString(), runId: ctx.runId },
        { status: 500 },
      );
    }
  } catch (error: any) {
    console.error(`[CRON ${JOB_NAME}] Outer error:`, error);
    return NextResponse.json(
      { success: false, error: error.message, timestamp: new Date().toISOString() },
      { status: 500 },
    );
  }
}
