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
const PAYMENT_URL = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://portal.lideresenseguros.com'}/cotizadores?pagar=true`;

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

    // ── Notes for a policy (read from ops_activity_log, not ops_notes which has FK to ops_cases) ──
    const view = searchParams.get('view');
    if (view === 'notes') {
      const policyId = searchParams.get('policy_id');
      if (!policyId) return NextResponse.json({ error: 'policy_id required' }, { status: 400 });
      const { data } = await supabase
        .from('ops_activity_log')
        .select('id, user_id, action_type, metadata, created_at')
        .eq('entity_type', 'policy')
        .eq('entity_id', policyId)
        .in('action_type', ['morosidad_note', 'morosidad_follow_up'])
        .order('created_at', { ascending: false });

      const rows = data || [];
      const notes = rows.map((r: any) => ({
        id: r.id,
        case_id: policyId,
        user_id: r.user_id,
        note: r.metadata?.note || (r.action_type === 'morosidad_follow_up' ? 'Marcado en seguimiento por master.' : ''),
        note_type: r.metadata?.note_type || r.action_type,
        created_at: r.created_at,
      }));

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

    // ── ADM COT overdue installment payments (>15 days PENDIENTE_CONFIRMACION) ──
    if (view === 'adm_cot_overdue') {
      const search = searchParams.get('search') || undefined;
      const insurerF = searchParams.get('insurer') || undefined;

      const OVERDUE_DAYS = 15;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - OVERDUE_DAYS);
      const cutoffStr = cutoffDate.toISOString().slice(0, 10);

      let q = supabase
        .from('adm_cot_payments')
        .select('*')
        .eq('status', 'PENDIENTE_CONFIRMACION')
        .eq('is_recurring', true)
        .lte('payment_date', cutoffStr)
        .order('payment_date', { ascending: true });

      if (insurerF) q = q.eq('insurer', insurerF);
      if (search) q = q.or(`client_name.ilike.%${search}%,nro_poliza.ilike.%${search}%,cedula.ilike.%${search}%`);

      const { data: overduePayments, error: overdueErr } = await q;
      if (overdueErr) return NextResponse.json({ error: overdueErr.message }, { status: 500 });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const enriched = (overduePayments ?? []).map((p: any) => {
        const payDate = new Date(p.payment_date + 'T12:00:00');
        const diffMs = today.getTime() - payDate.getTime();
        const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        return { ...p, days_overdue: daysOverdue };
      });

      // Try to get client emails from recurrence records or quotes
      const polizas = [...new Set(enriched.map((p: any) => p.nro_poliza).filter(Boolean))];
      let emailMap: Record<string, string> = {};
      if (polizas.length > 0) {
        // Try adm_cot_quotes first (has client email from emission)
        const { data: quoteRows } = await supabase
          .from('adm_cot_quotes')
          .select('client_email, policy_number')
          .in('policy_number', polizas)
          .not('client_email', 'is', null);
        (quoteRows ?? []).forEach((q: any) => {
          if (q.client_email && q.policy_number) emailMap[q.policy_number] = q.client_email;
        });
      }

      const withEmails = enriched.map((p: any) => ({
        ...p,
        client_email: emailMap[p.nro_poliza] || null,
      }));

      return NextResponse.json({
        success: true,
        data: withEmails,
        total: withEmails.length,
        overdueDays: OVERDUE_DAYS,
      });
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
            cedula?: string | null;
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
<div style="padding:24px;text-align:center;">
<a href="${PAYMENT_URL}&cedula=${encodeURIComponent(row.cedula || '')}" style="display:inline-block;padding:14px 36px;background:#8AAA19;color:white;text-decoration:none;font-weight:bold;font-size:16px;border-radius:10px;letter-spacing:0.3px;">Realizar mi pago</a>
<p style="margin-top:10px;font-size:12px;color:#6b7280;">Haga clic en el botón para pagar sus cuotas pendientes de forma rápida y segura.</p>
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
            try {
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
              });
            } catch { /* non-fatal */ }
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

      // ── Add note (uses ops_activity_log — ops_notes has FK to ops_cases, not policies) ──
      case 'add_note': {
        const { policy_id, note, note_type } = body;
        if (!note || note.trim().length < 10) {
          return NextResponse.json({ error: 'Nota mínima: 10 caracteres' }, { status: 400 });
        }

        const { error } = await supabase.from('ops_activity_log').insert({
          user_id: userId,
          action_type: 'morosidad_note',
          entity_type: 'policy',
          entity_id: policy_id,
          metadata: { note: note.trim(), note_type: note_type || 'morosidad' },
        });
        if (error) throw error;

        return NextResponse.json({ success: true });
      }

      // ── Mark follow-up (uses ops_activity_log — ops_notes has FK to ops_cases, not policies) ──
      case 'mark_follow_up': {
        const { policy_id } = body;

        const { error } = await supabase.from('ops_activity_log').insert({
          user_id: userId,
          action_type: 'morosidad_follow_up',
          entity_type: 'policy',
          entity_id: policy_id,
          metadata: { note: 'Marcado en seguimiento por master.', note_type: 'seguimiento' },
        });
        if (error) throw error;

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
            try {
              await supabase.from('portal_notifications').insert({
                type: 'chat_urgent',
                title: `🔴 Morosidad crítica: ${row.client_name || row.policy_number}`,
                body: `Póliza ${row.policy_number} con ${row.days_overdue} días de atraso.`,
                link: `/operaciones/morosidad?policy=${row.policy_id}`,
                target_role: 'master',
                target_user_id: null,
              });
            } catch { /* non-fatal */ }
            notified++;
          }
        }

        return NextResponse.json({ success: true, notified });
      }

      // ── Send morosidad email for ADM COT overdue installment payments ──
      case 'send_adm_cot_overdue_email': {
        const { payments: overduePayments, subject: emailSubject, bodyTemplate: emailBodyTemplate } = body as {
          payments: Array<{
            id: string;
            client_name: string;
            client_email: string | null;
            cedula: string | null;
            nro_poliza: string;
            insurer: string;
            amount: number;
            installment_num: number;
            payment_date: string;
            days_overdue: number;
          }>;
          subject: string;
          bodyTemplate: string;
        };

        if (!overduePayments || overduePayments.length === 0) {
          return NextResponse.json({ error: 'No payments selected' }, { status: 400 });
        }

        let sent = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const p of overduePayments) {
          if (!p.client_email) {
            failed++;
            errors.push(`${p.nro_poliza}: sin correo`);
            continue;
          }

          const mergedSubject = (emailSubject || 'Aviso de pago pendiente - {{poliza_numero}}')
            .replace(/\{\{cliente_nombre\}\}/g, p.client_name || 'Cliente')
            .replace(/\{\{poliza_numero\}\}/g, p.nro_poliza || '—')
            .replace(/\{\{monto_adeudado\}\}/g, `$${Number(p.amount || 0).toFixed(2)}`)
            .replace(/\{\{dias_atraso\}\}/g, String(p.days_overdue || 0))
            .replace(/\{\{fecha_vencimiento\}\}/g, p.payment_date ? new Date(p.payment_date).toLocaleDateString('es-PA') : '—')
            .replace(/\{\{cuota\}\}/g, String(p.installment_num || '—'))
            .replace(/\{\{aseguradora\}\}/g, p.insurer || '—');

          const mergedBody = (emailBodyTemplate || '')
            .replace(/\{\{cliente_nombre\}\}/g, p.client_name || 'Cliente')
            .replace(/\{\{poliza_numero\}\}/g, p.nro_poliza || '—')
            .replace(/\{\{monto_adeudado\}\}/g, `$${Number(p.amount || 0).toFixed(2)}`)
            .replace(/\{\{dias_atraso\}\}/g, String(p.days_overdue || 0))
            .replace(/\{\{fecha_vencimiento\}\}/g, p.payment_date ? new Date(p.payment_date).toLocaleDateString('es-PA') : '—')
            .replace(/\{\{cuota\}\}/g, String(p.installment_num || '—'))
            .replace(/\{\{aseguradora\}\}/g, p.insurer || '—');

          const htmlBody = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;margin:0;padding:0;background:#f9fafb;">
<div style="max-width:640px;margin:0 auto;background:white;">
<div style="background:#010139;color:white;padding:20px 24px;">
<h1 style="margin:0;font-size:18px;">Aviso de Pago Pendiente</h1>
<p style="margin:4px 0 0;font-size:13px;opacity:0.9;">Líderes en Seguros</p>
</div>
<div style="padding:24px;font-size:14px;line-height:1.6;color:#374151;">
${mergedBody.replace(/\n/g, '<br/>')}
</div>
<div style="padding:24px;text-align:center;">
<a href="${PAYMENT_URL}&cedula=${encodeURIComponent(p.cedula || '')}" style="display:inline-block;padding:14px 36px;background:#8AAA19;color:white;text-decoration:none;font-weight:bold;font-size:16px;border-radius:10px;letter-spacing:0.3px;">Realizar mi pago</a>
<p style="margin-top:10px;font-size:12px;color:#6b7280;">Haga clic en el botón para pagar sus cuotas pendientes de forma rápida y segura.</p>
</div>
<div style="padding:16px 24px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;">
<p>Líderes en Seguros, S.A. | portal.lideresenseguros.com</p>
</div>
</div>
</body></html>`;

          const result = await sendZeptoEmail({
            to: p.client_email,
            subject: mergedSubject,
            htmlBody,
            textBody: mergedBody,
          });

          if (result.success) {
            sent++;
            try {
              await supabase.from('ops_activity_log').insert({
                user_id: userId,
                action_type: 'status_change',
                entity_type: 'adm_cot_payment',
                entity_id: p.id,
                metadata: {
                  action: 'adm_cot_morosidad_email_sent',
                  client_email: p.client_email,
                  nro_poliza: p.nro_poliza,
                  amount: p.amount,
                  days_overdue: p.days_overdue,
                  installment_num: p.installment_num,
                  zepto_message_id: result.messageId,
                },
              });
            } catch { /* non-fatal */ }
          } else {
            failed++;
            errors.push(`${p.nro_poliza}: ${result.error}`);
          }
        }

        return NextResponse.json({ success: true, sent, failed, errors: errors.slice(0, 10) });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
