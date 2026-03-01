import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { sendZeptoEmail } from '@/lib/email/zepto-api';

// ═══════════════════════════════════════════════════════
// OPERACIONES — Morosidad API (full rewrite)
// GET: list+counts+filters+pagination
// POST: bulk_email, send_individual, add_note, mark_follow_up
// ═══════════════════════════════════════════════════════

const PAGE_SIZE = 25;

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

// ════════════════════════════════════════════
// GET
// ════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin() as any;
    const { searchParams } = new URL(req.url);

    // ── Notes for a policy ──
    const view = searchParams.get('view');
    if (view === 'notes') {
      const policyId = searchParams.get('policy_id');
      if (!policyId) return NextResponse.json({ error: 'policy_id required' }, { status: 400 });
      const { data } = await supabase
        .from('ops_notes')
        .select('id, case_id, user_id, note, note_type, created_at')
        .eq('case_id', policyId)
        .order('created_at', { ascending: false });

      const notes = data || [];
      if (notes.length > 0) {
        const userIds = [...new Set(notes.map((n: any) => n.user_id).filter(Boolean))];
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds);
          const nameMap: Record<string, string> = {};
          (profiles || []).forEach((p: any) => { nameMap[p.id] = p.full_name; });
          notes.forEach((n: any) => { n.user_name = nameMap[n.user_id] || null; });
        }
      }
      return NextResponse.json({ data: notes });
    }

    // ── Main list with filters + pagination ──
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || String(PAGE_SIZE));
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const ramo = searchParams.get('ramo');
    const overdue30 = searchParams.get('overdue_30');
    const recurring = searchParams.get('recurring');
    const contado = searchParams.get('contado');

    let query = supabase
      .from('ops_morosidad_view')
      .select('*', { count: 'exact' })
      .order('days_overdue', { ascending: false });

    if (status) query = query.eq('morosidad_status', status);
    if (search) query = query.or(`client_name.ilike.%${search}%,policy_number.ilike.%${search}%`);
    if (ramo) query = query.eq('ramo', ramo);
    if (overdue30 === 'true') query = query.gte('days_overdue', 30);
    if (recurring === 'true') query = query.eq('is_recurring', true);
    if (contado === 'true') query = query.eq('is_recurring', false);

    query = query.range((page - 1) * limit, page * limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    // ── Counts (always return) ──
    const { data: allRows } = await supabase
      .from('ops_morosidad_view')
      .select('morosidad_status');

    const counts: { [k: string]: number } = { total: 0, al_dia: 0, atrasado: 0, pago_recibido: 0, cancelado: 0 };
    for (const r of (allRows || [])) {
      counts['total'] = (counts['total'] || 0) + 1;
      const st = r.morosidad_status as string;
      if (st in counts) counts[st] = (counts[st] || 0) + 1;
    }

    // ── Get distinct ramos for filter dropdown ──
    const { data: ramoRows } = await supabase
      .from('ops_morosidad_view')
      .select('ramo')
      .not('ramo', 'is', null);
    const ramos = [...new Set((ramoRows || []).map((r: any) => r.ramo).filter(Boolean))].sort();

    return NextResponse.json({ data: data || [], total: count || 0, counts, ramos });
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

      // ── Bulk email ──
      case 'bulk_email': {
        const { rows, subject, bodyTemplate } = body as {
          rows: Array<{
            policy_id: string;
            client_name: string;
            client_email: string | null;
            policy_number: string;
            ramo: string | null;
            payment_amount: number | null;
            installment_amount: number | null;
            days_overdue: number;
            renewal_date: string | null;
          }>;
          subject: string;
          bodyTemplate: string;
        };

        if (!rows || rows.length === 0) {
          return NextResponse.json({ error: 'No rows selected' }, { status: 400 });
        }

        let sent = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const row of rows) {
          if (!row.client_email) {
            failed++;
            errors.push(`${row.policy_number}: sin correo`);
            continue;
          }

          // Merge placeholders
          const mergedSubject = subject
            .replace(/\{\{cliente_nombre\}\}/g, row.client_name || 'Cliente')
            .replace(/\{\{poliza_numero\}\}/g, row.policy_number || '—')
            .replace(/\{\{ramo\}\}/g, row.ramo || 'N/A')
            .replace(/\{\{monto_adeudado\}\}/g, (row.payment_amount || row.installment_amount || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' }))
            .replace(/\{\{dias_atraso\}\}/g, String(row.days_overdue || 0))
            .replace(/\{\{fecha_vencimiento\}\}/g, row.renewal_date ? new Date(row.renewal_date).toLocaleDateString('es-PA') : '—');

          const mergedBody = bodyTemplate
            .replace(/\{\{cliente_nombre\}\}/g, row.client_name || 'Cliente')
            .replace(/\{\{poliza_numero\}\}/g, row.policy_number || '—')
            .replace(/\{\{ramo\}\}/g, row.ramo || 'N/A')
            .replace(/\{\{monto_adeudado\}\}/g, (row.payment_amount || row.installment_amount || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' }))
            .replace(/\{\{dias_atraso\}\}/g, String(row.days_overdue || 0))
            .replace(/\{\{fecha_vencimiento\}\}/g, row.renewal_date ? new Date(row.renewal_date).toLocaleDateString('es-PA') : '—');

          const htmlBody = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;margin:0;padding:0;background:#f9fafb;">
<div style="max-width:640px;margin:0 auto;background:white;">
<div style="background:#010139;color:white;padding:20px 24px;">
<h1 style="margin:0;font-size:18px;">Aviso de Morosidad</h1>
<p style="margin:4px 0 0;font-size:13px;opacity:0.9;">Líderes en Seguros</p>
</div>
<div style="padding:24px;font-size:14px;line-height:1.6;color:#374151;">
${mergedBody.replace(/\n/g, '<br/>')}
</div>
<div style="padding:16px 24px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;">
<p>Líderes en Seguros, S.A. | portal.lideresenseguros.com</p>
</div>
</div>
</body></html>`;

          const result = await sendZeptoEmail({
            to: row.client_email,
            subject: mergedSubject,
            htmlBody,
            textBody: mergedBody,
          });

          if (result.success) {
            sent++;
            // Log each send
            await supabase.from('ops_activity_log').insert({
              user_id: userId,
              action_type: 'status_change',
              entity_type: 'policy',
              entity_id: row.policy_id,
              metadata: {
                action: 'morosidad_email_sent',
                client_email: row.client_email,
                policy_number: row.policy_number,
                monto: row.payment_amount || row.installment_amount,
                zepto_message_id: result.messageId,
              },
            }).catch(() => {});
          } else {
            failed++;
            errors.push(`${row.policy_number}: ${result.error}`);
          }
        }

        return NextResponse.json({ success: true, sent, failed, errors: errors.slice(0, 10) });
      }

      // ── Send individual email ──
      case 'send_individual': {
        const { row, subject, bodyTemplate } = body;
        if (!row?.client_email) {
          return NextResponse.json({ error: 'Cliente sin correo electrónico' }, { status: 400 });
        }

        // reuse bulk logic for single
        const res = await fetch(req.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: req.headers.get('cookie') || '' },
          body: JSON.stringify({ action: 'bulk_email', rows: [row], subject, bodyTemplate }),
        });
        const json = await res.json();
        return NextResponse.json(json);
      }

      // ── Add note (reuses ops_notes) ──
      case 'add_note': {
        const { policy_id, note, note_type } = body;
        if (!note || note.trim().length < 10) {
          return NextResponse.json({ error: 'Nota mínima: 10 caracteres' }, { status: 400 });
        }

        const { error } = await supabase.from('ops_notes').insert({
          case_id: policy_id, // reuse case_id column for policy_id
          user_id: userId,
          note: note.trim(),
          note_type: note_type || 'morosidad',
        });
        if (error) throw error;

        await supabase.from('ops_activity_log').insert({
          user_id: userId,
          action_type: 'status_change',
          entity_type: 'policy',
          entity_id: policy_id,
          metadata: { action: 'morosidad_note_added', note_type: note_type || 'morosidad' },
        }).catch(() => {});

        return NextResponse.json({ success: true });
      }

      // ── Mark follow-up ──
      case 'mark_follow_up': {
        const { policy_id } = body;

        // Add a note marking follow-up
        await supabase.from('ops_notes').insert({
          case_id: policy_id,
          user_id: userId,
          note: 'Marcado en seguimiento por master.',
          note_type: 'seguimiento',
        }).catch(() => {});

        await supabase.from('ops_activity_log').insert({
          user_id: userId,
          action_type: 'status_change',
          entity_type: 'policy',
          entity_id: policy_id,
          metadata: { action: 'morosidad_follow_up' },
        }).catch(() => {});

        return NextResponse.json({ success: true });
      }

      // ── Check 30-day notifications (called from cron or manually) ──
      case 'check_30day_notifications': {
        const { data: overdue } = await supabase
          .from('ops_morosidad_view')
          .select('policy_id, client_name, policy_number, days_overdue')
          .gte('days_overdue', 30)
          .eq('morosidad_status', 'atrasado');

        let notified = 0;
        for (const row of (overdue || [])) {
          // Check if notification was sent in last 7 days
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600000).toISOString();
          const { data: recent } = await supabase
            .from('portal_notifications')
            .select('id')
            .eq('link', `/operaciones/morosidad?policy=${row.policy_id}`)
            .gte('created_at', sevenDaysAgo)
            .limit(1);

          if (!recent || recent.length === 0) {
            await supabase.from('portal_notifications').insert({
              type: 'chat_urgent',
              title: `🔴 Morosidad crítica: ${row.client_name || row.policy_number}`,
              body: `Póliza ${row.policy_number} con ${row.days_overdue} días de atraso.`,
              link: `/operaciones/morosidad?policy=${row.policy_id}`,
              target_role: 'master',
              target_user_id: null,
            }).catch(() => {});
            notified++;
          }
        }

        return NextResponse.json({ success: true, notified });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
