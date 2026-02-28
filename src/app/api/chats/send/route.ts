/**
 * POST /api/chats/send — Send manual message from portal
 * Master-only. Sends via Twilio WhatsApp and stores in chat_messages.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { saveOutboundMessage } from '@/lib/chat/chat-engine';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || '';

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

async function sendTwilioMessage(to: string, body: string): Promise<{ success: boolean; sid?: string; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_NUMBER) {
    return { success: false, error: 'Twilio credentials not configured' };
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const authString = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

    const fromNum = TWILIO_WHATSAPP_NUMBER.startsWith('whatsapp:') ? TWILIO_WHATSAPP_NUMBER : `whatsapp:${TWILIO_WHATSAPP_NUMBER}`;
    const toNum = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: fromNum,
        To: toNum,
        Body: body.substring(0, 1600),
      }).toString(),
    });

    if (!response.ok) {
      const err = await response.text();
      return { success: false, error: err.substring(0, 300) };
    }

    const data = await response.json();
    return { success: true, sid: data.sid };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
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

    const fromPhone = TWILIO_WHATSAPP_NUMBER.replace(/^whatsapp:/i, '');

    // Send via Twilio
    const twilioResult = await sendTwilioMessage(thread.phone_e164, body.trim());

    // Save outbound message
    const saved = await saveOutboundMessage(sb, thread_id, body.trim(), fromPhone, thread.phone_e164, {
      provider: 'portal',
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
        twilio_sent: twilioResult.success,
        twilio_sid: twilioResult.sid || null,
        twilio_error: twilioResult.error || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        message: saved,
        twilio_sent: twilioResult.success,
        twilio_error: twilioResult.error || null,
      },
    });
  } catch (e: any) {
    console.error('[CHATS/SEND] Error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
