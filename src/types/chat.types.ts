/**
 * ADM COT CHATS — TypeScript Types
 * =================================
 * Types for chat_threads, chat_messages, chat_events, portal_notifications
 */

// ── Thread ──
export type ThreadStatus = 'open' | 'pending' | 'urgent' | 'closed';
export type ThreadCategory = 'simple' | 'lead' | 'urgent';
export type ThreadSeverity = 'low' | 'medium' | 'high';
export type AssignedType = 'ai' | 'master';

export interface ChatThread {
  id: string;
  channel: string;
  external_thread_key: string | null;
  client_id: string | null;
  phone_e164: string;
  client_name: string | null;
  region: string | null;
  status: ThreadStatus;
  category: ThreadCategory;
  severity: ThreadSeverity;
  assigned_type: AssignedType;
  assigned_master_user_id: string | null;
  ai_enabled: boolean;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count_master: number;
  tags: string[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// ── Message ──
export type MessageDirection = 'inbound' | 'outbound';
export type MessageProvider = 'twilio' | 'portal' | 'system';

export interface ChatMessage {
  id: string;
  thread_id: string;
  direction: MessageDirection;
  provider: MessageProvider;
  provider_message_id: string | null;
  from_phone: string | null;
  to_phone: string | null;
  body: string;
  attachments: any[];
  created_at: string;
  ai_generated: boolean;
  ai_model: string | null;
  intent: string | null;
  category_snapshot: string | null;
  severity_snapshot: string | null;
  tokens: number | null;
  latency_ms: number | null;
}

// ── Event ──
export type ChatEventType =
  | 'classified'
  | 'assigned'
  | 'unassigned'
  | 'ai_disabled'
  | 'ai_enabled'
  | 'email_sent'
  | 'email_failed'
  | 'notification_sent'
  | 'notification_failed'
  | 'status_changed'
  | 'manual_reply'
  | 'escalated';

export interface ChatEvent {
  id: string;
  thread_id: string;
  event_type: ChatEventType;
  actor_user_id: string | null;
  payload: Record<string, any>;
  created_at: string;
}

// ── Notification ──
export type NotificationType = 'chat_urgent' | 'chat_assigned' | 'chat_mention' | 'system';

export interface PortalNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  target_role: string;
  target_user_id: string | null;
  read_at: string | null;
  created_at: string;
}

// ── Vertex Classification Result ──
export interface ClassificationResult {
  category: ThreadCategory;
  severity: ThreadSeverity;
  intent: string;
  tags: string[];
  executive_summary: string[];
  suggested_next_step: string;
}

// ── Insert/Update helpers ──
export type ChatThreadInsert = Omit<ChatThread, 'id' | 'created_at' | 'updated_at'>;
export type ChatThreadUpdate = Partial<Omit<ChatThread, 'id' | 'created_at'>>;

export type ChatMessageInsert = Omit<ChatMessage, 'id' | 'created_at'>;

export type ChatEventInsert = Omit<ChatEvent, 'id' | 'created_at'>;

export type PortalNotificationInsert = Omit<PortalNotification, 'id' | 'created_at' | 'read_at'>;
