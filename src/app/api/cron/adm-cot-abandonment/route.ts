/**
 * CRON: ADM COT — Abandonment Recovery Emails
 * 
 * Runs daily to:
 * 1. Find quotes with status ABANDONADA that have a valid email
 * 2. That haven't been emailed yet (abandonment_email_sent_at IS NULL)
 * 3. That were abandoned in the last 48 hours (not too old)
 * 4. Send branded recovery email via ZeptoMail
 * 5. Mark record so we don't re-send
 * 
 * Protection: CRON_SECRET header
 * Schedule: "0 15 * * *" (10am Panama = 3pm UTC)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { emailService } from '@/lib/email/emailService';
import { buildAbandonmentRecoveryHtml } from '@/lib/email/templates/AbandonmentRecoveryEmailTemplate';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Only send to quotes abandoned within the last 48 hours
const MAX_AGE_HOURS = 48;

export async function GET(request: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.ADM_COT_CRON_SECRET || process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[CRON ABANDONMENT] No cron secret configured');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  const xCronSecret = request.headers.get('x-cron-secret');
  const isValid = authHeader === `Bearer ${cronSecret}` || xCronSecret === cronSecret;
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createClient(supabaseUrl, supabaseServiceKey);
  const now = new Date();
  const cutoff = new Date(now.getTime() - MAX_AGE_HOURS * 60 * 60 * 1000).toISOString();

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    console.log(`[CRON ABANDONMENT] Running at ${now.toISOString()}, cutoff: ${cutoff}`);

    // 1. Find abandoned quotes with valid email, not yet emailed, within cutoff
    const { data: abandoned, error: fetchErr } = await sb
      .from('adm_cot_quotes')
      .select('id, quote_ref, insurer, client_name, email, phone, cedula, coverage_type, last_step, status, quoted_at, abandonment_email_sent_at')
      .eq('status', 'ABANDONADA')
      .not('email', 'is', null)
      .is('abandonment_email_sent_at', null)
      .gte('quoted_at', cutoff)
      .order('quoted_at', { ascending: false });

    if (fetchErr) {
      console.error('[CRON ABANDONMENT] Fetch error:', fetchErr.message);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    if (!abandoned || abandoned.length === 0) {
      console.log('[CRON ABANDONMENT] No abandoned quotes to process');
      return NextResponse.json({ success: true, sent: 0, skipped: 0, message: 'No abandoned quotes' });
    }

    console.log(`[CRON ABANDONMENT] Found ${abandoned.length} abandoned quote(s) to email`);

    // 2. Deduplicate by email — only send one email per unique email address
    const seenEmails = new Set<string>();
    const toProcess: typeof abandoned = [];

    for (const q of abandoned) {
      const email = q.email?.trim().toLowerCase();
      if (!email || !email.includes('@')) {
        skipped++;
        continue;
      }
      if (seenEmails.has(email)) {
        skipped++;
        // Still mark as processed to avoid re-processing
        await sb
          .from('adm_cot_quotes')
          .update({ abandonment_email_sent_at: now.toISOString() })
          .eq('id', q.id);
        continue;
      }
      seenEmails.add(email);
      toProcess.push(q);
    }

    // 3. Send emails
    for (const q of toProcess) {
      try {
        const html = buildAbandonmentRecoveryHtml({
          clientName: q.client_name || 'Cliente',
          coverageType: q.coverage_type || undefined,
          insurer: q.insurer || undefined,
          lastStep: q.last_step || undefined,
          quoteRef: q.quote_ref || undefined,
        });

        const result = await emailService.send({
          to: q.email!,
          subject: `${q.client_name?.split(' ')[0] || 'Hola'}, tu seguro de auto te espera — ¡Complétalo hoy!`,
          html,
        });

        if (result.success) {
          sent++;
          console.log(`[CRON ABANDONMENT] ✓ Email sent to ${q.email} (ref: ${q.quote_ref})`);
        } else {
          errors.push(`${q.email}: ${result.error}`);
          console.error(`[CRON ABANDONMENT] ✗ Failed for ${q.email}:`, result.error);
        }

        // Mark as sent regardless (to avoid spamming on retry)
        await sb
          .from('adm_cot_quotes')
          .update({ abandonment_email_sent_at: now.toISOString() })
          .eq('id', q.id);

      } catch (emailErr: any) {
        errors.push(`${q.email}: ${emailErr.message}`);
        console.error(`[CRON ABANDONMENT] Exception for ${q.email}:`, emailErr);
      }
    }

    console.log(`[CRON ABANDONMENT] Done. Sent: ${sent}, Skipped: ${skipped}, Errors: ${errors.length}`);

    return NextResponse.json({
      success: true,
      sent,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      total: abandoned.length,
    });

  } catch (err: any) {
    console.error('[CRON ABANDONMENT] Fatal error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
