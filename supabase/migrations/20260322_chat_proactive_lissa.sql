-- ═══════════════════════════════════════════════════════════════
-- Migration: Proactive Lissa — Sentiment, Follow-up, Human Intervention
-- ═══════════════════════════════════════════════════════════════

-- 1. Add timestamp columns for tracking AI vs user activity
ALTER TABLE chat_threads
  ADD COLUMN IF NOT EXISTS last_ai_message_at   timestamptz,
  ADD COLUMN IF NOT EXISTS last_user_message_at  timestamptz;

-- 2. Add sentiment tracking
ALTER TABLE chat_threads
  ADD COLUMN IF NOT EXISTS sentiment              text DEFAULT 'neutral',
  ADD COLUMN IF NOT EXISTS consecutive_angry_count integer DEFAULT 0;

-- 3. Add follow-up tracking (to know if we already sent a proactive message)
ALTER TABLE chat_threads
  ADD COLUMN IF NOT EXISTS followup_sent_at timestamptz;

-- 4. Backfill last_user_message_at from last_message_at for existing open threads
UPDATE chat_threads
  SET last_user_message_at = last_message_at
  WHERE status IN ('open', 'pending', 'urgent')
    AND last_user_message_at IS NULL;

-- NOTE: status already supports arbitrary text values (no enum constraint).
-- New valid statuses: 'active' (alias for 'open'), 'closed', 'urgent_human', 'human_intervention'
-- We keep 'open' as well for backward compat; the code will treat 'open' = 'active'.
