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

  try {
    // Thread
    const { data: thread, error: threadErr } = await sb
      .from('chat_threads').select('*').eq('id', id).single();
    if (threadErr) return NextResponse.json({ error: threadErr.message }, { status: 404 });

    // Messages — cursor-based pagination: newest `limit` first, optionally before a timestamp
    const limit = parseInt(searchParams.get('limit') || '20');
    const before = searchParams.get('before') || undefined;

    let msgQuery = sb
      .from('chat_messages')
      .select('*')
      .eq('thread_id', id)
      .order('created_at', { ascending: false })
      .limit(limit + 1); // fetch one extra to detect if there are more

    if (before) msgQuery = msgQuery.lt('created_at', before);

    const { data: messagesRaw, error: msgErr } = await msgQuery;
    if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });

    const hasMore = (messagesRaw?.length ?? 0) > limit;
    const messages = (hasMore ? messagesRaw!.slice(0, limit) : (messagesRaw ?? [])).reverse();


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
      data: { thread, messages, events: events ?? [], hasMore },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getMasterUserId();
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const sb = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Delete messages first (FK constraint)
    await sb.from('chat_messages').delete().eq('thread_id', id);
    await sb.from('chat_events').delete().eq('thread_id', id);
    const { error } = await sb.from('chat_threads').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
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
