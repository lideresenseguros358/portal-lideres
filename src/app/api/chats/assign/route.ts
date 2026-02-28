/**
 * POST /api/chats/assign — Assign thread to master or LISSA AI
 * Master-only endpoint.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { assignThread } from '@/lib/chat/chat-engine';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function getMasterUser(): Promise<{ id: string; email: string; name: string } | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} },
    } as any);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const sb = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await sb
      .from('profiles').select('role, full_name, email').eq('id', user.id).single();
    if (profile?.role !== 'master') return null;
    return { id: user.id, email: profile.email || user.email || '', name: profile.full_name || 'Master' };
  } catch { return null; }
}

export async function POST(request: NextRequest) {
  const actor = await getMasterUser();
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { thread_id, assign_to } = await request.json();

    if (!thread_id) {
      return NextResponse.json({ error: 'thread_id required' }, { status: 400 });
    }

    // assign_to can be:
    //   'ai' — reassign to LISSA AI
    //   { user_id, user_name?, user_email? } — assign to specific master
    //   undefined/null — assign to current user (actor)

    let assignTarget: 'ai' | { userId: string; userName: string; userEmail: string };

    if (assign_to === 'ai') {
      assignTarget = 'ai';
    } else if (assign_to && assign_to.user_id) {
      // Fetch target user info
      const sb = createClient(supabaseUrl, supabaseServiceKey);
      const { data: targetProfile } = await sb
        .from('profiles').select('full_name, email').eq('id', assign_to.user_id).single();

      assignTarget = {
        userId: assign_to.user_id,
        userName: assign_to.user_name || targetProfile?.full_name || 'Master',
        userEmail: assign_to.user_email || targetProfile?.email || '',
      };
    } else {
      // Default: assign to current user
      assignTarget = {
        userId: actor.id,
        userName: actor.name,
        userEmail: actor.email,
      };
    }

    const result = await assignThread(thread_id, assignTarget, actor.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[CHATS/ASSIGN] Error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
