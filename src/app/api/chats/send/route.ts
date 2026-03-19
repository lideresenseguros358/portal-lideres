/**
 * POST /api/chats/send — Send manual message from portal
 * Master-only. Sends via Meta WhatsApp Cloud API and stores in chat_messages.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { saveOutboundMessage } from '@/lib/chat/chat-engine';
import { sendWhatsAppMessage } from '@/app/api/whatsapp/route';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';

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

export async function POST(request: NextRequest) {
  const userId = await getMasterUserId();
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sb = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { thread_id, body } = await request.json();

    if (!thread_id || !body?.trim()) {
      return NextResponse.json({ error: 'thread_id and body required' }, { status: 400 });
    }

    // Get thread
    const { data: thread, error: threadErr } = await sb
      .from('chat_threads').select('*').eq('id', thread_id).single();
    if (threadErr || !thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    // Send via Meta WhatsApp Cloud API
    const sent = await sendWhatsAppMessage(thread.phone_e164, body.trim());

    // Save outbound message
    const saved = await saveOutboundMessage(sb, thread_id, body.trim(), WHATSAPP_PHONE_NUMBER_ID, thread.phone_e164, {
      provider: 'whatsapp_cloud',
      aiGenerated: false,
    });

    // Update thread
    await sb.from('chat_threads').update({
      last_message_at: new Date().toISOString(),
      last_message_preview: body.trim().substring(0, 200),
      unread_count_master: 0,
    }).eq('id', thread_id);

    // Log event
    await sb.from('chat_events').insert({
      thread_id,
      event_type: 'manual_reply',
      actor_user_id: userId,
      payload: {
        whatsapp_sent: sent,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        message: saved,
        whatsapp_sent: sent,
      },
    });
  } catch (e: any) {
    console.error('[CHATS/SEND] Error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
