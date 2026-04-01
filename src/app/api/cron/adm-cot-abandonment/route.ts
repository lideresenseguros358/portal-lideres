/**
 * CRON: ADM COT — Abandonment Recovery Emails (2-stage)
 *
 * Runs every 15 minutes to:
 *
 * STAGE 1 (≥1 hour after abandon):
 *   - Find quotes with status ABANDONADA + valid email
 *   - abandonment_email_sent_at IS NULL
 *   - updated_at ≤ now − 1 hour  (abandoned at least 1h ago)
 *   - updated_at ≥ now − 72 hours (not too old)
 *   - Send first recovery email
 *   - Set abandonment_email_sent_at
 *
 * STAGE 2 (≥24 hours after abandon):
 *   - Same status/email filters
 *   - abandonment_email_sent_at IS NOT NULL (first email already sent)
 *   - quote_payload->>abandonment_email_2_sent_at IS NULL
 *   - updated_at ≤ now − 24 hours
 *   - Send second (more urgent) recovery email
 *   - Set quote_payload.abandonment_email_2_sent_at
 *
 * Protection: CRON_SECRET header
 * Recommended schedule: every 15 minutes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { emailService } from '@/lib/email/emailService';
import { buildAbandonmentRecoveryHtml } from '@/lib/email/templates/AbandonmentRecoveryEmailTemplate';
import { trackAbandonedCheckout } from '@/lib/meta/conversions';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const STAGE1_MIN_HOURS = 1;   // first email ≥ 1h after abandon
const STAGE2_MIN_HOURS = 24;  // second email ≥ 24h after abandon
const MAX_AGE_HOURS = 72;     // ignore quotes older than 72h

function ramoLabel(ramo: string | null): string {
  const map: Record<string, string> = {
    AUTO: 'seguro de auto',
    VIDA: 'seguro de vida',
    INCENDIO: 'seguro de incendio',
    CONTENIDO: 'seguro de contenido/hogar',
    SALUD: 'seguro de salud',
  };
  return map[(ramo || '').toUpperCase()] || 'seguro';
}

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
  const stage1Cutoff = new Date(now.getTime() - STAGE1_MIN_HOURS * 3600_000).toISOString();
  const stage2Cutoff = new Date(now.getTime() - STAGE2_MIN_HOURS * 3600_000).toISOString();
  const maxAgeCutoff = new Date(now.getTime() - MAX_AGE_HOURS * 3600_000).toISOString();

  let sentStage1 = 0;
  let sentStage2 = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    console.log(`[CRON ABANDONMENT] Running at ${now.toISOString()}`);

    // ────────────────────────────────────────────────
    // STAGE 1: First email (≥1h after abandon)
    // ────────────────────────────────────────────────
    const { data: stage1, error: err1 } = await sb
      .from('adm_cot_quotes')
      .select('id, quote_ref, insurer, client_name, email, phone, ramo, coverage_type, last_step, annual_premium, updated_at, quote_payload')
      .eq('status', 'ABANDONADA')
      .not('email', 'is', null)
      .is('abandonment_email_sent_at', null)
      .lte('updated_at', stage1Cutoff)
      .gte('updated_at', maxAgeCutoff)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (err1) {
      console.error('[CRON ABANDONMENT] Stage 1 fetch error:', err1.message);
    }

    // Deduplicate by email for stage 1
    const seenEmails1 = new Set<string>();
    for (const q of (stage1 || [])) {
      const email = q.email?.trim().toLowerCase();
      if (!email || !email.includes('@')) { skipped++; continue; }
      if (seenEmails1.has(email)) {
        skipped++;
        await sb.from('adm_cot_quotes').update({ abandonment_email_sent_at: now.toISOString() }).eq('id', q.id);
        continue;
      }
      seenEmails1.add(email);

      try {
        const rLabel = ramoLabel(q.ramo);
        const html = buildAbandonmentRecoveryHtml({
          clientName: q.client_name || 'Cliente',
          coverageType: q.coverage_type || rLabel,
          insurer: q.insurer || undefined,
          lastStep: q.last_step || undefined,
          quoteRef: q.quote_ref || undefined,
          ramo: q.ramo || 'AUTO',
          stage: 1,
        });

        const firstName = q.client_name?.split(' ')[0] || 'Hola';
        const result = await emailService.send({
          to: email,
          subject: `${firstName}, tu ${rLabel} te espera — ¡Complétalo hoy!`,
          html,
        });

        if (result.success) {
          sentStage1++;
          console.log(`[CRON ABANDONMENT] ✓ Stage1 email → ${email} (ref: ${q.quote_ref})`);

          // Fire Meta CAPI InitiateCheckout for retargeting (backup — in case session event was lost)
          const nameParts = (q.client_name || '').split(' ');
          trackAbandonedCheckout({
            quoteId: q.id,
            email,
            phone: q.phone || undefined,
            firstName: nameParts[0] || undefined,
            lastName: nameParts.slice(1).join(' ') || undefined,
            insurer: q.insurer,
            ramo: q.ramo || 'AUTO',
            coverageType: q.coverage_type || undefined,
            premium: q.annual_premium || undefined,
            lastStep: q.last_step || undefined,
          }).catch(() => { /* silent */ });
        } else {
          errors.push(`S1 ${email}: ${result.error}`);
        }

        await sb.from('adm_cot_quotes').update({ abandonment_email_sent_at: now.toISOString() }).eq('id', q.id);
      } catch (e: any) {
        errors.push(`S1 ${email}: ${e.message}`);
      }
    }

    // ────────────────────────────────────────────────
    // STAGE 2: Second email (≥24h after abandon)
    // ────────────────────────────────────────────────
    const { data: stage2, error: err2 } = await sb
      .from('adm_cot_quotes')
      .select('id, quote_ref, insurer, client_name, email, ramo, coverage_type, last_step, updated_at, quote_payload')
      .eq('status', 'ABANDONADA')
      .not('email', 'is', null)
      .not('abandonment_email_sent_at', 'is', null)
      .lte('updated_at', stage2Cutoff)
      .gte('updated_at', maxAgeCutoff)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (err2) {
      console.error('[CRON ABANDONMENT] Stage 2 fetch error:', err2.message);
    }

    const seenEmails2 = new Set<string>();
    for (const q of (stage2 || [])) {
      // Skip if second email already sent (tracked in quote_payload)
      const payload = (typeof q.quote_payload === 'object' && q.quote_payload) ? q.quote_payload as Record<string, any> : {};
      if (payload.abandonment_email_2_sent_at) { skipped++; continue; }

      const email = q.email?.trim().toLowerCase();
      if (!email || !email.includes('@')) { skipped++; continue; }
      if (seenEmails2.has(email)) { skipped++; continue; }
      seenEmails2.add(email);

      try {
        const rLabel = ramoLabel(q.ramo);
        const html = buildAbandonmentRecoveryHtml({
          clientName: q.client_name || 'Cliente',
          coverageType: q.coverage_type || rLabel,
          insurer: q.insurer || undefined,
          lastStep: q.last_step || undefined,
          quoteRef: q.quote_ref || undefined,
          ramo: q.ramo || 'AUTO',
          stage: 2,
        });

        const firstName = q.client_name?.split(' ')[0] || 'Hola';
        const result = await emailService.send({
          to: email,
          subject: `${firstName}, ¡no pierdas tu cotización! Tu ${rLabel} está a un paso`,
          html,
        });

        if (result.success) {
          sentStage2++;
          console.log(`[CRON ABANDONMENT] ✓ Stage2 email → ${email} (ref: ${q.quote_ref})`);
        } else {
          errors.push(`S2 ${email}: ${result.error}`);
        }

        // Mark second email sent in quote_payload
        await sb.from('adm_cot_quotes').update({
          quote_payload: { ...payload, abandonment_email_2_sent_at: now.toISOString() },
        }).eq('id', q.id);
      } catch (e: any) {
        errors.push(`S2 ${email}: ${e.message}`);
      }
    }

    const totalSent = sentStage1 + sentStage2;
    console.log(`[CRON ABANDONMENT] Done. Stage1: ${sentStage1}, Stage2: ${sentStage2}, Skipped: ${skipped}, Errors: ${errors.length}`);

    return NextResponse.json({
      success: true,
      sent: totalSent,
      sentStage1,
      sentStage2,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (err: any) {
    console.error('[CRON ABANDONMENT] Fatal error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
