/**
 * OPS E2E TEST — IMAP Ingestion + Zepto Email Sending
 * ====================================================
 * Comprehensive end-to-end test of the Operaciones email pipeline:
 * 
 * Phase 1: IMAP Ingestion (ops-imap-sync)
 *   - Connect to Zoho IMAP
 *   - Fetch & process messages
 *   - Verify threading & classification
 * 
 * Phase 2: IMAP Ingest Legacy (imap-ingest)
 *   - Connect to Zoho IMAP (tramites@)
 *   - Fetch, classify with Vertex AI, create/link cases
 * 
 * Phase 3: Zepto Email Sending — all templates
 *   - send_email (generic)
 *   - send_payment_link (renovacion, peticion, urgencia)
 *   - send_case_notification
 * 
 * Phase 4: Cron health check
 *   - Verify cron_runs table for stuck locks
 *   - Report status of each cron job
 * 
 * GET /api/test/ops-e2e
 * GET /api/test/ops-e2e?phase=imap
 * GET /api/test/ops-e2e?phase=zepto
 * GET /api/test/ops-e2e?phase=crons
 * GET /api/test/ops-e2e?phase=all (default)
 * 
 * Optional: ?send_test_email=contacto@lideresenseguros.com
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { emailService } from '@/lib/email/emailService';
import { buildPaymentLinkEmail, buildCaseNotificationEmail } from '@/lib/email/templates/OpsEmailTemplates';

export const runtime = 'nodejs';
export const maxDuration = 120;

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip' | 'warn';
  duration_ms: number;
  detail?: string;
  error?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const phase = searchParams.get('phase') || 'all';
  const testEmail = searchParams.get('send_test_email') || '';
  const dryRun = searchParams.get('dry_run') === 'true';

  // Auth check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized. Pass Authorization: Bearer <CRON_SECRET>' }, { status: 401 });
  }

  const allResults: TestResult[] = [];
  const startTotal = Date.now();

  // ════════════════════════════════════════════
  // PHASE 1: IMAP Sync (ops-imap-sync)
  // ════════════════════════════════════════════
  if (phase === 'all' || phase === 'imap') {
    // Test 1a: IMAP Sync connection + fetch
    const t1 = Date.now();
    try {
      const { run } = await import('@/lib/email/zohoImapSync');
      const result = await run();
      allResults.push({
        name: 'IMAP Sync (ops-imap-sync)',
        status: result.success ? 'pass' : 'fail',
        duration_ms: Date.now() - t1,
        detail: `new=${result.count_new_messages} classified=${result.count_classified} unclassified=${result.count_unclassified} dupes=${result.count_skipped_duplicate}`,
        error: result.errors.length > 0 ? result.errors.join('; ') : undefined,
      });
    } catch (err: any) {
      allResults.push({
        name: 'IMAP Sync (ops-imap-sync)',
        status: 'fail',
        duration_ms: Date.now() - t1,
        error: err.message,
      });
    }

    // Test 1b: IMAP Ingest Legacy (tramites@)
    const t2 = Date.now();
    try {
      if (process.env.FEATURE_ENABLE_IMAP !== 'true') {
        allResults.push({
          name: 'IMAP Ingest Legacy (imap-ingest)',
          status: 'skip',
          duration_ms: 0,
          detail: 'FEATURE_ENABLE_IMAP not set to true',
        });
      } else {
        const { runIngestionCycle } = await import('@/lib/imap/imapIngestor');
        const result = await runIngestionCycle();
        allResults.push({
          name: 'IMAP Ingest Legacy (imap-ingest)',
          status: result.success ? 'pass' : 'fail',
          duration_ms: Date.now() - t2,
          detail: `processed=${result.messagesProcessed} created=${result.casesCreated} linked=${result.casesLinked} errors=${result.errors.length}`,
          error: result.errors.length > 0 ? result.errors.map(e => `${e.messageId}: ${e.error}`).join('; ') : undefined,
        });
      }
    } catch (err: any) {
      allResults.push({
        name: 'IMAP Ingest Legacy (imap-ingest)',
        status: 'fail',
        duration_ms: Date.now() - t2,
        error: err.message,
      });
    }
  }

  // ════════════════════════════════════════════
  // PHASE 2: Zepto Email Sending — all templates
  // ════════════════════════════════════════════
  if (phase === 'all' || phase === 'zepto') {
    // Test 2a: Email env check
    const envStatus = emailService.getEnvStatus();
    allResults.push({
      name: 'Zepto Env Config',
      status: envStatus.configured ? 'pass' : 'fail',
      duration_ms: 0,
      detail: `provider=${envStatus.provider} sender=${envStatus.sender} hasKey=${envStatus.hasApiKey}`,
    });

    const targetEmail = testEmail || 'contacto@lideresenseguros.com';

    if (!envStatus.configured || dryRun) {
      allResults.push({
        name: 'Zepto Send: Generic Email',
        status: 'skip',
        duration_ms: 0,
        detail: dryRun ? 'Dry run mode' : 'Zepto not configured',
      });
      allResults.push({
        name: 'Zepto Send: Payment Link (renovacion)',
        status: 'skip',
        duration_ms: 0,
        detail: dryRun ? 'Dry run mode' : 'Zepto not configured',
      });
      allResults.push({
        name: 'Zepto Send: Payment Link (peticion)',
        status: 'skip',
        duration_ms: 0,
        detail: dryRun ? 'Dry run mode' : 'Zepto not configured',
      });
      allResults.push({
        name: 'Zepto Send: Payment Link (urgencia)',
        status: 'skip',
        duration_ms: 0,
        detail: dryRun ? 'Dry run mode' : 'Zepto not configured',
      });
      allResults.push({
        name: 'Zepto Send: Case Notification',
        status: 'skip',
        duration_ms: 0,
        detail: dryRun ? 'Dry run mode' : 'Zepto not configured',
      });
    } else {
      // Test 2b: Generic email send
      const t3 = Date.now();
      try {
        const result = await emailService.send({
          to: targetEmail,
          subject: `[E2E TEST] Generic email — ${new Date().toISOString()}`,
          html: '<h2>E2E Test</h2><p>This is a test email from the Operaciones E2E test suite.</p>',
          text: 'E2E Test — Generic email send test',
        });
        allResults.push({
          name: 'Zepto Send: Generic Email',
          status: result.success ? 'pass' : 'fail',
          duration_ms: Date.now() - t3,
          detail: result.messageId || undefined,
          error: result.error || undefined,
        });
      } catch (err: any) {
        allResults.push({
          name: 'Zepto Send: Generic Email',
          status: 'fail',
          duration_ms: Date.now() - t3,
          error: err.message,
        });
      }

      // Test 2c: Payment link templates for each case type
      for (const caseType of ['renovacion', 'peticion', 'urgencia'] as const) {
        const t4 = Date.now();
        try {
          const email = buildPaymentLinkEmail({
            clientName: 'Cliente E2E Test',
            policyNumber: 'POL-2024-TEST',
            insurerName: 'Aseguradora Test',
            ticket: `${caseType === 'renovacion' ? 'REN' : caseType === 'peticion' ? 'PET' : 'URG'}-2503-00001`,
            caseType,
            paymentLink: 'https://portal.lideresenseguros.com/pago/test-e2e',
            amount: '150.00',
            concept: `Pago de ${caseType} E2E test`,
          });

          const result = await emailService.send({
            to: targetEmail,
            subject: `[E2E TEST] ${email.subject}`,
            html: email.html,
            text: email.text,
          });

          allResults.push({
            name: `Zepto Send: Payment Link (${caseType})`,
            status: result.success ? 'pass' : 'fail',
            duration_ms: Date.now() - t4,
            detail: result.messageId || undefined,
            error: result.error || undefined,
          });
        } catch (err: any) {
          allResults.push({
            name: `Zepto Send: Payment Link (${caseType})`,
            status: 'fail',
            duration_ms: Date.now() - t4,
            error: err.message,
          });
        }
      }

      // Test 2d: Case notification
      const t5 = Date.now();
      try {
        const email = buildCaseNotificationEmail({
          clientName: 'Cliente E2E Test',
          ticket: 'REN-2503-00001',
          caseType: 'renovacion',
          policyNumber: 'POL-2024-TEST',
          insurerName: 'Aseguradora Test',
          bodyHtml: '<p>Su renovación ha sido procesada exitosamente. Este es un correo de prueba E2E.</p>',
          senderName: 'Equipo Operaciones',
        });

        const result = await emailService.send({
          to: targetEmail,
          subject: `[E2E TEST] ${email.subject}`,
          html: email.html,
          text: email.text,
        });

        allResults.push({
          name: 'Zepto Send: Case Notification',
          status: result.success ? 'pass' : 'fail',
          duration_ms: Date.now() - t5,
          detail: result.messageId || undefined,
          error: result.error || undefined,
        });
      } catch (err: any) {
        allResults.push({
          name: 'Zepto Send: Case Notification',
          status: 'fail',
          duration_ms: Date.now() - t5,
          error: err.message,
        });
      }
    }
  }

  // ════════════════════════════════════════════
  // PHASE 3: Cron Health Check
  // ════════════════════════════════════════════
  if (phase === 'all' || phase === 'crons') {
    const t6 = Date.now();
    try {
      const supabase = getSupabaseAdmin() as any;

      // Get latest run for each cron job
      const cronJobs = [
        'ops-imap-sync',
        'imap-ingest',
        'ops-sla-check',
        'ops-metrics-nightly',
        'ops-ai-eval-urgencies',
      ];

      for (const jobName of cronJobs) {
        const { data: lastRun } = await supabase
          .from('cron_runs')
          .select('id, job_name, status, started_at, finished_at, error_message')
          .eq('job_name', jobName)
          .order('started_at', { ascending: false })
          .limit(1)
          .single();

        if (!lastRun) {
          allResults.push({
            name: `Cron: ${jobName}`,
            status: 'warn',
            duration_ms: 0,
            detail: 'No runs found in cron_runs table',
          });
          continue;
        }

        // Check if stuck (running for >10 min)
        const isStuck = lastRun.status === 'running' &&
          (Date.now() - new Date(lastRun.started_at).getTime()) > 10 * 60 * 1000;

        // If stuck, release the lock
        if (isStuck) {
          try {
            await supabase.rpc('ops_release_cron_lock', { p_job_name: jobName });
            await supabase
              .from('cron_runs')
              .update({ status: 'failed', finished_at: new Date().toISOString(), error_message: 'Force-released by E2E test (stuck >10min)' })
              .eq('id', lastRun.id);
          } catch { /* ignore lock release errors */ }
        }

        const ageMinutes = Math.round((Date.now() - new Date(lastRun.started_at).getTime()) / 60000);

        allResults.push({
          name: `Cron: ${jobName}`,
          status: isStuck ? 'fail' : lastRun.status === 'success' ? 'pass' : lastRun.status === 'failed' ? 'fail' : 'warn',
          duration_ms: 0,
          detail: `status=${lastRun.status} age=${ageMinutes}min${isStuck ? ' (STUCK — lock released)' : ''}`,
          error: lastRun.error_message || undefined,
        });
      }
    } catch (err: any) {
      allResults.push({
        name: 'Cron Health Check',
        status: 'fail',
        duration_ms: Date.now() - t6,
        error: err.message,
      });
    }
  }

  // ════════════════════════════════════════════
  // REPORT
  // ════════════════════════════════════════════
  const passed = allResults.filter(r => r.status === 'pass').length;
  const failed = allResults.filter(r => r.status === 'fail').length;
  const skipped = allResults.filter(r => r.status === 'skip').length;
  const warned = allResults.filter(r => r.status === 'warn').length;

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    total_duration_ms: Date.now() - startTotal,
    phase,
    summary: { total: allResults.length, passed, failed, skipped, warned },
    overall: failed === 0 ? '✅ ALL PASSED' : `❌ ${failed} FAILED`,
    results: allResults,
  });
}
