/**
 * CRON: Chat Follow-up — Proactive Lissa Messages & Auto-close
 * ==============================================================
 * Runs every 5 minutes to:
 *
 * 1. FOLLOW-UP (10 min idle):
 *    - Find 'open' threads where:
 *      - assigned_type = 'ai' AND ai_enabled = true
 *      - last_ai_message_at > last_user_message_at (Lissa replied, user hasn't)
 *      - last_ai_message_at <= now − 10 minutes
 *      - followup_sent_at IS NULL (haven't sent follow-up yet)
 *    - Send a proactive WhatsApp message
 *    - Set followup_sent_at
 *
 * 2. AUTO-CLOSE (30 min after follow-up):
 *    - Find 'open' threads where:
 *      - followup_sent_at IS NOT NULL
 *      - followup_sent_at <= now − 30 minutes
 *      - last_user_message_at < followup_sent_at (user didn't respond after follow-up)
 *    - Send closing message via WhatsApp
 *    - Set status = 'closed'
 *
 * Protection: CRON_SECRET header
 * Recommended schedule: every 5 minutes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppMessage } from '@/app/api/whatsapp/route';
import { saveOutboundMessage } from '@/lib/chat/chat-engine';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';

const FOLLOWUP_IDLE_MINUTES = 10;  // Send follow-up after 10 min of user silence
const AUTOCLOSE_MINUTES = 30;      // Close thread 30 min after follow-up with no response

const FOLLOWUP_MESSAGES = [
  '¿Sigues por ahí? 😊 Si tienes alguna otra duda, con gusto te ayudo.',
  '¡Hola! Solo quería saber si necesitas algo más. Estoy aquí para ayudarte 💚',
  '¿Te quedó alguna duda? Si necesitas más información, aquí estoy 😊',
];

const CLOSING_MESSAGE = 'Como no he recibido respuesta, voy a cerrar esta conversación por ahora. Si necesitas ayuda en el futuro, ¡escríbeme cuando quieras! 💚\n\n— Lissa, Líderes en Seguros';

function pickFollowupMessage(): string {
  return FOLLOWUP_MESSAGES[Math.floor(Math.random() * FOLLOWUP_MESSAGES.length)] ?? FOLLOWUP_MESSAGES[0]!;
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[CRON CHAT-FOLLOWUP] No cron secret configured');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  const xCronSecret = request.headers.get('x-cron-secret');
  const isValid = authHeader === `Bearer ${cronSecret}` || xCronSecret === cronSecret;
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createClient(supabaseUrl, supabaseServiceKey);
  const now = new Date();
  const followupCutoff = new Date(now.getTime() - FOLLOWUP_IDLE_MINUTES * 60_000).toISOString();
  const autocloseCutoff = new Date(now.getTime() - AUTOCLOSE_MINUTES * 60_000).toISOString();

  let followupsSent = 0;
  let threadsClosed = 0;
  const errors: string[] = [];

  try {
    console.log(`[CRON CHAT-FOLLOWUP] Running at ${now.toISOString()}`);

    // ────────────────────────────────────────────────
    // STAGE 1: Proactive follow-up messages
    // ────────────────────────────────────────────────
    const { data: idleThreads, error: err1 } = await sb
      .from('chat_threads')
      .select('id, phone_e164, client_name, last_ai_message_at, last_user_message_at')
      .in('status', ['open', 'pending'])
      .eq('assigned_type', 'ai')
      .eq('ai_enabled', true)
      .is('followup_sent_at', null)
      .not('last_ai_message_at', 'is', null)
      .lte('last_ai_message_at', followupCutoff)
      .order('last_ai_message_at', { ascending: true })
      .limit(20);

    if (err1) {
      console.error('[CRON CHAT-FOLLOWUP] Stage 1 fetch error:', err1.message);
      errors.push(`Fetch idle: ${err1.message}`);
    }

    for (const thread of (idleThreads || [])) {
      // Extra check: user hasn't replied after Lissa's last message
      if (thread.last_user_message_at && thread.last_ai_message_at &&
          new Date(thread.last_user_message_at) > new Date(thread.last_ai_message_at)) {
        continue; // User replied after AI — skip
      }

      try {
        const followupMsg = pickFollowupMessage();

        // Send via WhatsApp
        const sent = await sendWhatsAppMessage(thread.phone_e164, followupMsg);
        if (!sent) {
          errors.push(`WA send failed: ${thread.phone_e164}`);
          continue;
        }

        // Save outbound message
        await saveOutboundMessage(sb, thread.id, followupMsg, WHATSAPP_PHONE_NUMBER_ID, thread.phone_e164, {
          provider: 'whatsapp_cloud',
          aiGenerated: true,
          aiModel: 'cron-followup',
          intent: 'proactive_followup',
        });

        // Update thread
        await sb.from('chat_threads').update({
          followup_sent_at: now.toISOString(),
          last_ai_message_at: now.toISOString(),
          last_message_at: now.toISOString(),
          last_message_preview: followupMsg.substring(0, 200),
        }).eq('id', thread.id);

        // Log event
        await sb.from('chat_events').insert({
          thread_id: thread.id,
          event_type: 'notification_sent',
          payload: { type: 'proactive_followup', message: followupMsg },
        });

        followupsSent++;
        console.log(`[CRON CHAT-FOLLOWUP] ✓ Follow-up → ${thread.phone_e164} (${thread.client_name || 'unknown'})`);
      } catch (e: any) {
        errors.push(`Followup ${thread.phone_e164}: ${e.message}`);
      }
    }

    // ────────────────────────────────────────────────
    // STAGE 2: Auto-close stale threads
    // ────────────────────────────────────────────────
    const { data: staleThreads, error: err2 } = await sb
      .from('chat_threads')
      .select('id, phone_e164, client_name, followup_sent_at, last_user_message_at')
      .in('status', ['open', 'pending'])
      .eq('assigned_type', 'ai')
      .eq('ai_enabled', true)
      .not('followup_sent_at', 'is', null)
      .lte('followup_sent_at', autocloseCutoff)
      .order('followup_sent_at', { ascending: true })
      .limit(20);

    if (err2) {
      console.error('[CRON CHAT-FOLLOWUP] Stage 2 fetch error:', err2.message);
      errors.push(`Fetch stale: ${err2.message}`);
    }

    for (const thread of (staleThreads || [])) {
      // Extra check: user didn't respond after the follow-up
      if (thread.last_user_message_at && thread.followup_sent_at &&
          new Date(thread.last_user_message_at) > new Date(thread.followup_sent_at)) {
        // User responded after follow-up — reset followup_sent_at, don't close
        await sb.from('chat_threads').update({ followup_sent_at: null }).eq('id', thread.id);
        continue;
      }

      try {
        // Send closing message via WhatsApp
        const sent = await sendWhatsAppMessage(thread.phone_e164, CLOSING_MESSAGE);

        // Save outbound message (even if WA send failed, to track internally)
        await saveOutboundMessage(sb, thread.id, CLOSING_MESSAGE, WHATSAPP_PHONE_NUMBER_ID, thread.phone_e164, {
          provider: 'whatsapp_cloud',
          aiGenerated: true,
          aiModel: 'cron-autoclose',
          intent: 'auto_close',
        });

        // Close the thread
        await sb.from('chat_threads').update({
          status: 'closed',
          last_ai_message_at: now.toISOString(),
          last_message_at: now.toISOString(),
          last_message_preview: CLOSING_MESSAGE.substring(0, 200),
        }).eq('id', thread.id);

        // Log event
        await sb.from('chat_events').insert({
          thread_id: thread.id,
          event_type: 'status_changed',
          payload: {
            from: 'open',
            to: 'closed',
            reason: 'auto_close_no_response',
            wa_sent: sent,
          },
        });

        threadsClosed++;
        console.log(`[CRON CHAT-FOLLOWUP] ✓ Auto-closed → ${thread.phone_e164} (${thread.client_name || 'unknown'})`);
      } catch (e: any) {
        errors.push(`Autoclose ${thread.phone_e164}: ${e.message}`);
      }
    }

    console.log(`[CRON CHAT-FOLLOWUP] Done. Follow-ups: ${followupsSent}, Closed: ${threadsClosed}, Errors: ${errors.length}`);

    return NextResponse.json({
      success: true,
      followupsSent,
      threadsClosed,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (err: any) {
    console.error('[CRON CHAT-FOLLOWUP] Fatal error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
