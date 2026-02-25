/**
 * CHAT LOGGING — Log all interactions to chat_interactions
 * =========================================================
 * Centralizes logging for both WhatsApp and Portal channels.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSb() { return createClient(supabaseUrl, supabaseServiceKey); }

export interface ChatLogEntry {
  channel: 'whatsapp' | 'portal';
  clientId?: string | null;
  phone?: string | null;
  message: string;
  response: string | null;
  intent: string | null;
  escalated: boolean;
  ipAddress?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Log a chat interaction to the database
 */
export async function logChatInteraction(entry: ChatLogEntry): Promise<string | null> {
  try {
    const sb = getSb();
    const { data, error } = await sb.from('chat_interactions').insert({
      channel: entry.channel,
      client_id: entry.clientId || null,
      phone: entry.phone || null,
      message: entry.message,
      response: entry.response,
      intent: entry.intent,
      escalated: entry.escalated,
      ip_address: entry.ipAddress || null,
      session_id: entry.sessionId || null,
      metadata: entry.metadata || {},
    }).select('id').single();

    if (error) {
      console.error('[LOGGING] Error inserting chat_interaction:', error.message);
      return null;
    }

    return data.id;
  } catch (err: any) {
    console.error('[LOGGING] Fatal error:', err.message);
    return null;
  }
}
