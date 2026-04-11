/**
 * GET /api/notifications/ops-check
 * ===================================
 * Scans ops_cases for new cases (all types) created in the last `window` minutes
 * and creates bell notifications for any that haven't been notified yet.
 * Uses createNotification() idempotency so repeated calls are safe.
 *
 * Called every 30 seconds by NotificationsBell (master users only).
 * Primarily serves renovation cases which have no JS creation hook.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { createNotification } from '@/lib/notifications/create';

export const dynamic = 'force-dynamic';

async function getAuthenticatedMaster(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } } as any,
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single();
    return profile?.role === 'master' ? user.id : null;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  // Must be authenticated master
  const masterId = await getAuthenticatedMaster();
  if (!masterId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  // How far back to look (default 35 min — slightly more than the 30s poll window to avoid gaps)
  const windowMinutes = Math.min(parseInt(searchParams.get('window') || '35'), 120);

  const supabase = getSupabaseAdmin() as any;
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://portal.lideresenseguros.com';

  try {
    // Fetch recent ops_cases of all types
    const { data: newCases, error } = await supabase
      .from('ops_cases')
      .select('id, ticket, case_type, status, client_name, ramo, category, severity, chat_thread_id, created_at')
      .eq('status', 'pendiente')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    let created = 0;
    let skipped = 0;

    for (const c of (newCases || [])) {
      let title = '';
      let body = '';
      let cta_url = '';
      let ops_type = '';

      switch (c.case_type) {
        case 'renovacion':
          title = `Nueva Renovación — ${c.ticket}`;
          body = `Cliente: ${c.client_name || 'N/A'}`;
          cta_url = `${baseUrl}/operaciones/renovaciones?case=${c.id}`;
          ops_type = 'renovacion';
          break;
        case 'peticion':
          title = `Nueva Petición — ${c.ticket}`;
          body = `Cliente: ${c.client_name || 'N/A'}${c.ramo ? ` | Ramo: ${c.ramo}` : ''}`;
          cta_url = `${baseUrl}/operaciones/peticiones?case=${c.id}`;
          ops_type = 'peticion';
          break;
        case 'urgencia':
          title = c.chat_thread_id
            ? `Chat Urgente — ${c.client_name || c.ticket}`
            : `Nueva Urgencia — ${c.ticket}`;
          body = `Cliente: ${c.client_name || 'N/A'}${c.category ? ` | Categoría: ${c.category}` : ''}${c.severity ? ` | Severidad: ${c.severity}` : ''}`;
          cta_url = `${baseUrl}/operaciones/urgencias?case=${c.id}`;
          ops_type = c.chat_thread_id ? 'chat_urgente' : 'urgencia';
          break;
        default:
          continue;
      }

      const result = await createNotification({
        type: 'other',
        target: 'MASTER',
        title,
        body,
        meta: { ops_type, cta_url, ticket: c.ticket, case_id: c.id },
        entityId: c.id,
        condition: 'created',
      });

      if (result.isDuplicate) {
        skipped++;
      } else if (result.success) {
        created++;
      }
    }

    return NextResponse.json({ ok: true, created, skipped, checked: (newCases || []).length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
