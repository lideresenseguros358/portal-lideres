-- ============================================================
-- MIGRATION: ADM COT CHATS — Full Contact Center Tables
-- Run in Supabase SQL Editor
-- ============================================================

-- 1) chat_threads
CREATE TABLE IF NOT EXISTS chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL DEFAULT 'whatsapp',
  external_thread_key text, -- phone e164 or session id
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  phone_e164 text NOT NULL,
  client_name text,
  region text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','urgent','closed')),
  category text NOT NULL DEFAULT 'simple' CHECK (category IN ('simple','lead','urgent')),
  severity text DEFAULT 'low' CHECK (severity IN ('low','medium','high')),
  assigned_type text NOT NULL DEFAULT 'ai' CHECK (assigned_type IN ('ai','master')),
  assigned_master_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ai_enabled boolean NOT NULL DEFAULT true,
  last_message_at timestamptz DEFAULT now(),
  last_message_preview text,
  unread_count_master int NOT NULL DEFAULT 0,
  tags jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_threads_phone ON chat_threads(phone_e164);
CREATE INDEX IF NOT EXISTS idx_chat_threads_status ON chat_threads(status);
CREATE INDEX IF NOT EXISTS idx_chat_threads_category ON chat_threads(category);
CREATE INDEX IF NOT EXISTS idx_chat_threads_assigned ON chat_threads(assigned_type, assigned_master_user_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_last_msg ON chat_threads(last_message_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_threads_ext_key ON chat_threads(external_thread_key) WHERE external_thread_key IS NOT NULL;

-- 2) chat_messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  provider text NOT NULL DEFAULT 'twilio' CHECK (provider IN ('twilio','portal','system')),
  provider_message_id text,
  from_phone text,
  to_phone text,
  body text NOT NULL,
  attachments jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  ai_generated boolean DEFAULT false,
  ai_model text,
  intent text,
  category_snapshot text,
  severity_snapshot text,
  tokens int,
  latency_ms int
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_messages_provider_id ON chat_messages(provider_message_id) WHERE provider_message_id IS NOT NULL;

-- 3) chat_events (audit)
CREATE TABLE IF NOT EXISTS chat_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'classified','assigned','unassigned','ai_disabled','ai_enabled',
    'email_sent','email_failed','notification_sent','notification_failed',
    'status_changed','manual_reply','escalated'
  )),
  actor_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_events_thread ON chat_events(thread_id, created_at);

-- 4) portal_notifications
CREATE TABLE IF NOT EXISTS portal_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('chat_urgent','chat_assigned','chat_mention','system')),
  title text NOT NULL,
  body text,
  link text,
  target_role text DEFAULT 'master',
  target_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_notif_user ON portal_notifications(target_user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_portal_notif_role ON portal_notifications(target_role, read_at);

-- 5) RLS Policies
ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_notifications ENABLE ROW LEVEL SECURITY;

-- Masters can see all chat data
CREATE POLICY "masters_chat_threads" ON chat_threads
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'master')
  );

CREATE POLICY "masters_chat_messages" ON chat_messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'master')
  );

CREATE POLICY "masters_chat_events" ON chat_events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'master')
  );

-- Notifications: masters see all role='master' notifications OR their own
CREATE POLICY "own_or_master_notifications" ON portal_notifications
  FOR ALL USING (
    target_user_id = auth.uid()
    OR (target_role = 'master' AND target_user_id IS NULL AND EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'master'
    ))
  );

-- Service role bypass (for API routes using service key)
CREATE POLICY "service_role_chat_threads" ON chat_threads
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_chat_messages" ON chat_messages
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_chat_events" ON chat_events
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_portal_notifications" ON portal_notifications
  FOR ALL USING (auth.role() = 'service_role');

-- 6) Updated_at trigger
CREATE OR REPLACE FUNCTION update_chat_thread_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chat_threads_updated_at ON chat_threads;
CREATE TRIGGER trg_chat_threads_updated_at
  BEFORE UPDATE ON chat_threads
  FOR EACH ROW EXECUTE FUNCTION update_chat_thread_updated_at();
