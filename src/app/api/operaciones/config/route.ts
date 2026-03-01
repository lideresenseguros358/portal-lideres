import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

// ═══════════════════════════════════════════════════════
// OPERACIONES — Configuration API (full rewrite)
// GET: config + cron health + email templates
// POST: update with diff logging, template CRUD, AI re-eval
// ═══════════════════════════════════════════════════════

async function getCurrentUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } } as any,
    );
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch { return null; }
}

// Cron jobs we monitor
const CRON_JOBS = [
  { name: 'ops-imap-sync', label: 'IMAP Sync', expectedIntervalMin: 2 },
  { name: 'ops-sla-check', label: 'SLA Check', expectedIntervalMin: 360 },
  { name: 'ops-metrics-nightly', label: 'Nightly Metrics', expectedIntervalMin: 1440 },
  { name: 'ops-ai-eval-urgencies', label: 'AI Eval Urgencias', expectedIntervalMin: 60 },
  { name: 'imap-ingest', label: 'IMAP Ingest (legacy)', expectedIntervalMin: 5 },
];

// ════════════════════════════════════════════
// GET
// ════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin() as any;
    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view');

    // ── Templates only ──
    if (view === 'templates') {
      const { data } = await supabase
        .from('ops_email_templates')
        .select('*')
        .order('template_key');
      return NextResponse.json({ data: data || [] });
    }

    // ── Cron health only ──
    if (view === 'cron_health') {
      const health: any[] = [];
      for (const job of CRON_JOBS) {
        const { data: lastRun } = await supabase
          .from('cron_runs')
          .select('id, job_name, started_at, finished_at, status, processed_count, error_message, metadata')
          .eq('job_name', job.name)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        let badge: 'green' | 'yellow' | 'red' = 'red';
        if (lastRun) {
          const minutesAgo = (Date.now() - new Date(lastRun.started_at).getTime()) / 60000;
          if (lastRun.status === 'success' && minutesAgo < job.expectedIntervalMin * 2) badge = 'green';
          else if (lastRun.status === 'success' && minutesAgo < job.expectedIntervalMin * 4) badge = 'yellow';
          else if (lastRun.status === 'running') badge = 'yellow';
        }

        health.push({
          ...job,
          lastRun: lastRun || null,
          badge,
        });
      }
      return NextResponse.json({ data: health });
    }

    // ── Full config ──
    const { data: config, error } = await supabase
      .from('ops_config')
      .select('*')
      .order('key');
    if (error) throw error;

    // Build key→value map for convenience
    const configMap: Record<string, any> = {};
    for (const row of (config || [])) {
      configMap[row.key] = row.value;
    }

    return NextResponse.json({ data: config || [], configMap });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ════════════════════════════════════════════
// POST
// ════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin() as any;
    const body = await req.json();
    const { action } = body;
    const userId = await getCurrentUserId();

    switch (action) {

      // ── Update single config with diff logging ──
      case 'update': {
        const { key, value } = body;

        // Get old value for diff
        const { data: old } = await supabase
          .from('ops_config')
          .select('value')
          .eq('key', key)
          .maybeSingle();

        const oldValue = old?.value;

        const { error } = await supabase
          .from('ops_config')
          .update({ value, updated_at: new Date().toISOString(), updated_by: userId })
          .eq('key', key);
        if (error) throw error;

        // Log change
        await supabase.from('ops_activity_log').insert({
          user_id: userId,
          action_type: 'status_change',
          entity_type: 'config',
          entity_id: key,
          metadata: {
            action: 'ops_config_updated',
            key,
            before: oldValue,
            after: value,
          },
        }).catch(() => {});

        return NextResponse.json({ success: true });
      }

      // ── Bulk update with diff logging ──
      case 'bulk_update': {
        const { configs } = body as { configs: Array<{ key: string; value: any }> };
        const changes: Array<{ key: string; before: any; after: any }> = [];

        for (const cfg of configs) {
          const { data: old } = await supabase
            .from('ops_config')
            .select('value')
            .eq('key', cfg.key)
            .maybeSingle();

          const oldValue = old?.value;

          // Upsert — insert if missing, update if exists
          const { error } = await supabase
            .from('ops_config')
            .upsert({
              key: cfg.key,
              value: cfg.value,
              updated_at: new Date().toISOString(),
              updated_by: userId,
            }, { onConflict: 'key' });
          if (error) throw error;

          if (JSON.stringify(oldValue) !== JSON.stringify(cfg.value)) {
            changes.push({ key: cfg.key, before: oldValue, after: cfg.value });
          }
        }

        // Single audit log for bulk update
        if (changes.length > 0) {
          await supabase.from('ops_activity_log').insert({
            user_id: userId,
            action_type: 'status_change',
            entity_type: 'config',
            entity_id: 'bulk',
            metadata: {
              action: 'ops_config_bulk_updated',
              changes_count: changes.length,
              changes,
            },
          }).catch(() => {});
        }

        return NextResponse.json({ success: true, changes_count: changes.length });
      }

      // ── Save email template ──
      case 'save_template': {
        const { template_key, subject, body_html, body_text, merge_vars } = body;

        const { error } = await supabase
          .from('ops_email_templates')
          .update({
            subject,
            body_html,
            body_text,
            merge_vars: merge_vars || [],
            updated_at: new Date().toISOString(),
            updated_by: userId,
          })
          .eq('template_key', template_key);
        if (error) throw error;

        await supabase.from('ops_activity_log').insert({
          user_id: userId,
          action_type: 'status_change',
          entity_type: 'config',
          entity_id: template_key,
          metadata: { action: 'ops_template_updated', template_key },
        }).catch(() => {});

        return NextResponse.json({ success: true });
      }

      // ── AI re-eval trigger (last 10 urgencies) ──
      case 'trigger_ai_reeval': {
        try {
          const cronSecret = process.env.CRON_SECRET;
          const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';

          const res = await fetch(`${baseUrl}/api/cron/ops-ai-eval-urgencies`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(cronSecret ? { authorization: `Bearer ${cronSecret}` } : {}),
            },
          });
          const json = await res.json();
          return NextResponse.json({ success: true, result: json });
        } catch (e: any) {
          return NextResponse.json({ success: false, error: e.message });
        }
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
