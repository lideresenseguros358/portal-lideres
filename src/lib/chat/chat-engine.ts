/**
 * Chat Engine — Core pipeline for inbound messages
 * ==================================================
 * Orchestrates: save → classify → update thread → escalate → AI reply → send
 *
 * Used by:
 *   - POST /api/whatsapp (Twilio webhook)
 *   - Can also be called from portal for testing
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { classifyMessageVertex, generateAiReply } from './vertex-classify';
import { sendEscalationEmail } from '@/lib/email/zepto-api';
import type {
  ChatThread,
  ChatMessage,
  ClassificationResult,
  ThreadCategory,
  PortalNotificationInsert,
} from '@/types/chat.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSb(): SupabaseClient {
  return createClient(supabaseUrl, supabaseServiceKey);
}

const PORTAL_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://portal.lideresenseguros.com';

// ════════════════════════════════════════════
// Upsert Thread
// ════════════════════════════════════════════

export async function upsertThread(
  sb: SupabaseClient,
  phoneE164: string,
  clientName?: string | null,
  channel: string = 'whatsapp',
): Promise<ChatThread> {
  // Try to find existing open thread for this phone
  const { data: existing } = await sb
    .from('chat_threads')
    .select('*')
    .eq('phone_e164', phoneE164)
    .neq('status', 'closed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return existing as ChatThread;
  }

  // Try to find client by phone
  let clientId: string | null = null;
  let resolvedName = clientName || null;
  let region: string | null = null;

  const cleanPhone = phoneE164.replace(/\D/g, '');
  const { data: clientMatch } = await sb
    .from('clients')
    .select('id, name, region')
    .or(`phone.ilike.%${cleanPhone.slice(-8)}%,mobile.ilike.%${cleanPhone.slice(-8)}%`)
    .limit(1)
    .maybeSingle();

  if (clientMatch) {
    clientId = clientMatch.id;
    resolvedName = resolvedName || clientMatch.name;
    region = clientMatch.region;
  }

  // Create new thread
  const { data: newThread, error } = await sb
    .from('chat_threads')
    .insert({
      channel,
      external_thread_key: phoneE164,
      client_id: clientId,
      phone_e164: phoneE164,
      client_name: resolvedName,
      region,
      status: 'open',
      category: 'simple',
      severity: 'low',
      assigned_type: 'ai',
      assigned_master_user_id: null,
      ai_enabled: true,
      last_message_at: new Date().toISOString(),
      last_message_preview: null,
      unread_count_master: 0,
      tags: [],
      metadata: {},
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create thread: ${error.message}`);
  return newThread as ChatThread;
}

// ════════════════════════════════════════════
// Save Inbound Message
// ════════════════════════════════════════════

async function saveInboundMessage(
  sb: SupabaseClient,
  threadId: string,
  body: string,
  fromPhone: string,
  toPhone: string,
  providerMessageId?: string,
): Promise<ChatMessage> {
  const { data, error } = await sb
    .from('chat_messages')
    .insert({
      thread_id: threadId,
      direction: 'inbound',
      provider: 'twilio',
      provider_message_id: providerMessageId || null,
      from_phone: fromPhone,
      to_phone: toPhone,
      body,
      ai_generated: false,
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to save message: ${error.message}`);
  return data as ChatMessage;
}

// ════════════════════════════════════════════
// Save Outbound Message (AI or Manual)
// ════════════════════════════════════════════

export async function saveOutboundMessage(
  sb: SupabaseClient,
  threadId: string,
  body: string,
  fromPhone: string,
  toPhone: string,
  opts: {
    provider?: 'twilio' | 'portal' | 'system';
    aiGenerated?: boolean;
    aiModel?: string;
    intent?: string;
    categorySnapshot?: string;
    severitySnapshot?: string;
    tokens?: number;
    latencyMs?: number;
  } = {},
): Promise<ChatMessage> {
  const { data, error } = await sb
    .from('chat_messages')
    .insert({
      thread_id: threadId,
      direction: 'outbound',
      provider: opts.provider || 'twilio',
      from_phone: fromPhone,
      to_phone: toPhone,
      body,
      ai_generated: opts.aiGenerated || false,
      ai_model: opts.aiModel || null,
      intent: opts.intent || null,
      category_snapshot: opts.categorySnapshot || null,
      severity_snapshot: opts.severitySnapshot || null,
      tokens: opts.tokens || null,
      latency_ms: opts.latencyMs || null,
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to save outbound message: ${error.message}`);
  return data as ChatMessage;
}

// ════════════════════════════════════════════
// Notify Masters (Portal Notifications)
// ════════════════════════════════════════════

async function notifyMasters(
  sb: SupabaseClient,
  notification: PortalNotificationInsert,
): Promise<void> {
  try {
    // Insert notification for all masters (target_role='master', target_user_id=null)
    await sb.from('portal_notifications').insert({
      type: notification.type,
      title: notification.title,
      body: notification.body,
      link: notification.link,
      target_role: 'master',
      target_user_id: null,
    });

    await sb.from('chat_events').insert({
      thread_id: (notification as any).thread_id || null,
      event_type: 'notification_sent',
      payload: { type: notification.type, title: notification.title },
    });
  } catch (err: any) {
    console.error('[CHAT-ENGINE] Failed to create notification:', err.message);
  }
}

// ════════════════════════════════════════════
// Escalate Urgent Thread
// ════════════════════════════════════════════

async function escalateThread(
  sb: SupabaseClient,
  thread: ChatThread,
  classification: ClassificationResult,
  messages: { direction: string; body: string; created_at: string; ai_generated?: boolean }[],
): Promise<void> {
  const threadLink = `${PORTAL_BASE_URL}/adm-cot/chats?thread=${thread.id}`;

  // 1. Send escalation email via ZeptoMail API
  const emailResult = await sendEscalationEmail({
    threadId: thread.id,
    phoneE164: thread.phone_e164,
    clientName: thread.client_name,
    category: classification.category,
    severity: classification.severity,
    executiveSummary: classification.executive_summary,
    suggestedNextStep: classification.suggested_next_step,
    tags: classification.tags,
    messages,
    threadLink,
  });

  // 2. Log email event
  await sb.from('chat_events').insert({
    thread_id: thread.id,
    event_type: emailResult.success ? 'email_sent' : 'email_failed',
    payload: {
      to: 'contacto@lideresenseguros.com',
      attempts: emailResult.attempts,
      messageId: emailResult.messageId || null,
      error: emailResult.error || null,
    },
  });

  // 3. If email failed, create additional portal notification
  if (!emailResult.success) {
    await sb.from('portal_notifications').insert({
      type: 'chat_urgent',
      title: '⚠️ EMAIL ESCALAMIENTO FALLÓ',
      body: `No se pudo enviar email de escalamiento para ${thread.phone_e164}. Error: ${emailResult.error}. Revisar conversación urgente manualmente.`,
      link: threadLink,
      target_role: 'master',
      target_user_id: null,
    });
  }

  // 4. Portal notification for ALL masters
  await notifyMasters(sb, {
    type: 'chat_urgent',
    title: `🔴 CASO URGENTE: ${thread.client_name || thread.phone_e164}`,
    body: classification.executive_summary.join(' • ') || 'Caso urgente detectado',
    link: threadLink,
    target_role: 'master',
    target_user_id: null,
  });

  // 5. Log escalation event
  await sb.from('chat_events').insert({
    thread_id: thread.id,
    event_type: 'escalated',
    payload: {
      category: classification.category,
      severity: classification.severity,
      summary: classification.executive_summary,
    },
  });

  console.log(`[CHAT-ENGINE] Thread ${thread.id} escalated. Email: ${emailResult.success ? 'OK' : 'FAILED'}`);
}

// ════════════════════════════════════════════
// MAIN: Process Inbound Message
// ════════════════════════════════════════════

export interface ProcessInboundInput {
  fromPhone: string;
  toPhone: string;
  body: string;
  profileName?: string;
  providerMessageId?: string;
  channel?: string;
}

export interface ProcessInboundResult {
  threadId: string;
  messageId: string;
  classification: ClassificationResult;
  aiReply: string | null;
  aiReplySent: boolean;
}

export async function processInboundMessage(input: ProcessInboundInput): Promise<ProcessInboundResult> {
  const sb = getSb();
  const { fromPhone, toPhone, body, profileName, providerMessageId, channel } = input;

  console.log(`[CHAT-ENGINE] Processing inbound from ${fromPhone}: "${body.substring(0, 80)}..."`);

  // 1. Upsert thread
  const thread = await upsertThread(sb, fromPhone, profileName, channel || 'whatsapp');

  // 2. Dedup check by provider_message_id
  if (providerMessageId) {
    const { data: existing } = await sb
      .from('chat_messages')
      .select('id')
      .eq('provider_message_id', providerMessageId)
      .maybeSingle();

    if (existing) {
      console.log(`[CHAT-ENGINE] Duplicate message ${providerMessageId}, skipping`);
      return {
        threadId: thread.id,
        messageId: existing.id,
        classification: {
          category: thread.category as any,
          severity: thread.severity as any,
          intent: 'duplicate',
          tags: [],
          executive_summary: [],
          suggested_next_step: '',
        },
        aiReply: null,
        aiReplySent: false,
      };
    }
  }

  // 3. Save inbound message
  const savedMsg = await saveInboundMessage(sb, thread.id, body, fromPhone, toPhone, providerMessageId);

  // 4. Get recent messages for classification context
  const { data: recentMsgs } = await sb
    .from('chat_messages')
    .select('direction, body, created_at, ai_generated')
    .eq('thread_id', thread.id)
    .order('created_at', { ascending: false })
    .limit(10);

  const lastMessages = (recentMsgs || []).reverse().map((m: any) => ({
    direction: m.direction,
    body: m.body,
    created_at: m.created_at,
    ai_generated: m.ai_generated,
  }));

  // 5. Classify with Vertex AI
  const classification = await classifyMessageVertex({
    lastMessages: lastMessages.map(m => ({ direction: m.direction, body: m.body })),
    clientName: thread.client_name,
    phone: thread.phone_e164,
  });

  // 6. Update thread with classification
  const threadUpdate: Record<string, any> = {
    category: classification.category,
    severity: classification.severity,
    tags: classification.tags,
    last_message_at: new Date().toISOString(),
    last_message_preview: body.substring(0, 200),
    metadata: {
      ...(thread.metadata || {}),
      last_classification: {
        intent: classification.intent,
        executive_summary: classification.executive_summary,
        suggested_next_step: classification.suggested_next_step,
        classified_at: new Date().toISOString(),
      },
    },
  };

  // If urgent, update status
  if (classification.category === 'urgent') {
    threadUpdate.status = 'urgent';
  }

  // Increment unread count if assigned to master (master needs to see new message)
  if (thread.assigned_type === 'master') {
    threadUpdate.unread_count_master = (thread.unread_count_master || 0) + 1;
  }

  await sb.from('chat_threads').update(threadUpdate).eq('id', thread.id);

  // Log classification event
  await sb.from('chat_events').insert({
    thread_id: thread.id,
    event_type: 'classified',
    payload: classification,
  });

  // 7. Handle urgent escalation
  if (classification.category === 'urgent') {
    await escalateThread(sb, { ...thread, ...threadUpdate } as ChatThread, classification, lastMessages);
  }

  // 8. Generate AI reply if ai_enabled=true and assigned_type=ai
  let aiReply: string | null = null;
  let aiReplySent = false;

  if (thread.ai_enabled && thread.assigned_type === 'ai') {
    const replyResult = await generateAiReply({
      currentMessage: body,
      conversationHistory: lastMessages.slice(0, -1).map(m => ({
        direction: m.direction,
        body: m.body,
      })),
      clientName: thread.client_name,
      category: classification.category,
      severity: classification.severity,
    });

    aiReply = replyResult.reply;

    // Save outbound AI message
    await saveOutboundMessage(sb, thread.id, aiReply, toPhone, fromPhone, {
      provider: 'twilio',
      aiGenerated: true,
      aiModel: process.env.VERTEX_MODEL_CHAT || 'gemini-2.0-flash',
      intent: classification.intent,
      categorySnapshot: classification.category,
      severitySnapshot: classification.severity,
      tokens: replyResult.tokens,
      latencyMs: replyResult.latencyMs,
    });

    aiReplySent = true;
    console.log(`[CHAT-ENGINE] AI reply saved for thread ${thread.id}`);
  } else {
    // Not AI-handled: increment unread for master
    if (thread.assigned_type === 'master') {
      console.log(`[CHAT-ENGINE] Thread ${thread.id} assigned to master — no AI reply`);
    }
  }

  return {
    threadId: thread.id,
    messageId: savedMsg.id,
    classification,
    aiReply,
    aiReplySent,
  };
}

// ════════════════════════════════════════════
// ASSIGN Thread
// ════════════════════════════════════════════

export interface AssignResult {
  success: boolean;
  error?: string;
}

export async function assignThread(
  threadId: string,
  assignTo: 'ai' | { userId: string; userName: string; userEmail: string },
  actorUserId?: string,
): Promise<AssignResult> {
  const sb = getSb();

  const { data: thread, error: fetchErr } = await sb
    .from('chat_threads')
    .select('*')
    .eq('id', threadId)
    .single();

  if (fetchErr || !thread) return { success: false, error: 'Thread not found' };

  if (assignTo === 'ai') {
    // Reassign to LISSA AI
    await sb.from('chat_threads').update({
      assigned_type: 'ai',
      assigned_master_user_id: null,
      ai_enabled: true,
    }).eq('id', threadId);

    await sb.from('chat_events').insert({
      thread_id: threadId,
      event_type: 'ai_enabled',
      actor_user_id: actorUserId || null,
      payload: { previous_assigned: thread.assigned_master_user_id },
    });

    // System message in thread
    await sb.from('chat_messages').insert({
      thread_id: threadId,
      direction: 'outbound',
      provider: 'system',
      from_phone: null,
      to_phone: null,
      body: '🤖 LISSA AI ha retomado la atención de esta conversación.',
      ai_generated: false,
    });

    return { success: true };
  }

  // Assign to master
  const { userId, userName, userEmail } = assignTo;

  await sb.from('chat_threads').update({
    assigned_type: 'master',
    assigned_master_user_id: userId,
    ai_enabled: false,
    unread_count_master: 0,
  }).eq('id', threadId);

  await sb.from('chat_events').insert({
    thread_id: threadId,
    event_type: 'assigned',
    actor_user_id: actorUserId || null,
    payload: { assigned_to: userId, assigned_name: userName },
  });

  // System message
  await sb.from('chat_messages').insert({
    thread_id: threadId,
    direction: 'outbound',
    provider: 'system',
    from_phone: null,
    to_phone: null,
    body: `👨‍💼 Conversación asignada a ${userName}. LISSA AI desactivada.`,
    ai_generated: false,
  });

  // Notify assigned master via portal
  const threadLink = `${PORTAL_BASE_URL}/adm-cot/chats?thread=${threadId}`;
  await sb.from('portal_notifications').insert({
    type: 'chat_assigned',
    title: `💬 Chat asignado: ${thread.client_name || thread.phone_e164}`,
    body: thread.last_message_preview || 'Nueva conversación asignada',
    link: threadLink,
    target_role: 'master',
    target_user_id: userId,
  });

  // Notify via email
  try {
    const { sendAssignmentEmail } = await import('@/lib/email/zepto-api');
    await sendAssignmentEmail({
      masterEmail: userEmail,
      masterName: userName,
      threadId,
      phoneE164: thread.phone_e164,
      clientName: thread.client_name,
      preview: thread.last_message_preview,
      threadLink,
    });
  } catch (emailErr: any) {
    console.error('[CHAT-ENGINE] Assignment email failed:', emailErr.message);
  }

  return { success: true };
}
