/**
 * GET /api/chats/thread/[id] — Get thread detail + messages
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getMasterUserId();
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const sb = createClient(supabaseUrl, supabaseServiceKey);
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '100');

  try {
    // Thread
    const { data: thread, error: threadErr } = await sb
      .from('chat_threads').select('*').eq('id', id).single();
    if (threadErr) return NextResponse.json({ error: threadErr.message }, { status: 404 });

    // Messages (paginated, newest first but we reverse for display)
    const { data: messages, error: msgErr, count } = await sb
      .from('chat_messages')
      .select('*', { count: 'exact' })
      .eq('thread_id', id)
      .order('created_at', { ascending: true })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });

    // Events (last 20)
    const { data: events } = await sb
      .from('chat_events')
      .select('*')
      .eq('thread_id', id)
      .order('created_at', { ascending: false })
      .limit(20);

    // Mark unread as 0 for this thread
    await sb.from('chat_threads').update({ unread_count_master: 0 }).eq('id', id);

    return NextResponse.json({
      success: true,
      data: {
        thread,
        messages: messages ?? [],
        events: events ?? [],
        totalMessages: count ?? 0,
        page,
        pageSize,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getMasterUserId();
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const sb = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await request.json();
    const allowedFields: Record<string, boolean> = { status: true, category: true, severity: true };
    const updateData: Record<string, any> = {};

    for (const key of Object.keys(body)) {
      if (allowedFields[key]) updateData[key] = body[key];
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { error } = await sb.from('chat_threads').update(updateData).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Log event
    await sb.from('chat_events').insert({
      thread_id: id,
      event_type: 'status_changed',
      actor_user_id: userId,
      payload: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
