/**
 * GET /api/chats/threads — List chat threads with filters
 * Master-only endpoint.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function getMasterUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} },
    } as any);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single();
    return profile?.role === 'master' ? user.id : null;
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const userId = await getMasterUserId();
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sb = createClient(supabaseUrl, supabaseServiceKey);
  const { searchParams } = new URL(request.url);

  const status = searchParams.get('status') || undefined;
  const category = searchParams.get('category') || undefined;
  const assignedType = searchParams.get('assigned_type') || undefined;
  const search = searchParams.get('search') || undefined;
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '50');

  try {
    let q = sb.from('chat_threads')
      .select('*', { count: 'exact' })
      .order('last_message_at', { ascending: false });

    if (status) q = q.eq('status', status);
    if (category) q = q.eq('category', category);
    if (assignedType) q = q.eq('assigned_type', assignedType);
    if (search) {
      q = q.or(`client_name.ilike.%${search}%,phone_e164.ilike.%${search}%,last_message_preview.ilike.%${search}%`);
    }

    q = q.range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error, count } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Summary counts
    const { data: allThreads } = await sb
      .from('chat_threads')
      .select('status, category, assigned_type, unread_count_master');

    const summary = {
      total: 0, open: 0, urgent: 0, pending: 0, closed: 0,
      simple: 0, lead: 0, urgentCat: 0,
      ai: 0, master: 0, unread: 0,
    };
    (allThreads ?? []).forEach((t: any) => {
      summary.total++;
      if (t.status === 'open') summary.open++;
      if (t.status === 'urgent') summary.urgent++;
      if (t.status === 'pending') summary.pending++;
      if (t.status === 'closed') summary.closed++;
      if (t.category === 'simple') summary.simple++;
      if (t.category === 'lead') summary.lead++;
      if (t.category === 'urgent') summary.urgentCat++;
      if (t.assigned_type === 'ai') summary.ai++;
      if (t.assigned_type === 'master') summary.master++;
      summary.unread += t.unread_count_master || 0;
    });

    return NextResponse.json({
      success: true,
      data: { rows: data ?? [], total: count ?? 0, page, pageSize, summary },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
