-- ═══════════════════════════════════════════════════════════════
-- MIGRATION: ops_case_messages + ops_config checkpoint
-- For IMAP sync → Renovaciones threading
-- ═══════════════════════════════════════════════════════════════

-- 1) Direction enum
DO $$ BEGIN
  CREATE TYPE ops_message_direction AS ENUM ('inbound', 'outbound');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) Provider enum
DO $$ BEGIN
  CREATE TYPE ops_message_provider AS ENUM ('zoho_imap', 'zepto');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3) Main messages table
CREATE TABLE IF NOT EXISTS ops_case_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id       uuid REFERENCES ops_cases(id) ON DELETE SET NULL,
  unclassified  boolean NOT NULL DEFAULT false,
  direction     ops_message_direction NOT NULL,
  provider      ops_message_provider NOT NULL,
  message_id    text UNIQUE NOT NULL,          -- RFC Message-ID header
  in_reply_to   text,
  "references"  text,
  from_email    text NOT NULL,
  to_emails     text[] DEFAULT '{}',
  subject       text NOT NULL DEFAULT '',
  body_text     text,
  body_html     text,
  received_at   timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  metadata      jsonb DEFAULT '{}'::jsonb       -- headers, flags, has_attachments, discarded, etc.
);

-- 4) Indices
CREATE INDEX IF NOT EXISTS idx_ocm_case_received
  ON ops_case_messages (case_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_ocm_unclassified
  ON ops_case_messages (unclassified, received_at DESC)
  WHERE unclassified = true;

-- message_id unique already from table def

CREATE INDEX IF NOT EXISTS idx_ocm_from_email
  ON ops_case_messages (from_email);

-- 5) ops_config table (if not exists) for checkpoint storage
CREATE TABLE IF NOT EXISTS ops_config (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text UNIQUE NOT NULL,
  value       jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text
);

-- 6) Seed checkpoint row
INSERT INTO ops_config (key, value, description)
VALUES (
  'imap_sync_checkpoint',
  '{"last_uid": 0, "last_synced_at": null}'::jsonb,
  'IMAP sync checkpoint for ops renovaciones'
)
ON CONFLICT (key) DO NOTHING;

-- Done
