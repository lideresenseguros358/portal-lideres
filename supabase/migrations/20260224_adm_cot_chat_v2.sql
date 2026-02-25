-- ============================================================
-- ADM COT — Chat V2: Normalized conversations, messages, tasks
-- Created: 2026-02-24 (Prompt 5)
-- ============================================================

-- ┌─────────────────────────────────────────────┐
-- │ A) adm_cot_conversations                    │
-- └─────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS adm_cot_conversations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source            TEXT NOT NULL DEFAULT 'PORTAL'
    CHECK (source IN ('PORTAL','WHATSAPP')),
  phone             TEXT,
  email             TEXT,
  cedula            TEXT,
  client_name       TEXT,
  session_id        TEXT,
  ip_address        TEXT,
  region            TEXT,
  status            TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','ESCALATED','CLOSED')),
  classification    TEXT DEFAULT 'CONSULTA'
    CHECK (classification IN ('CONSULTA','COTIZACION','SOPORTE','QUEJA')),
  is_complex        BOOLEAN NOT NULL DEFAULT false,
  ai_summary        TEXT,
  escalated_at      TIMESTAMPTZ,
  escalated_reason  TEXT,
  closed_at         TIMESTAMPTZ,
  closed_by         UUID,
  metadata          JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_adm_cot_conv_status ON adm_cot_conversations(status);
CREATE INDEX IF NOT EXISTS idx_adm_cot_conv_classification ON adm_cot_conversations(classification);
CREATE INDEX IF NOT EXISTS idx_adm_cot_conv_complex ON adm_cot_conversations(is_complex) WHERE is_complex = true;
CREATE INDEX IF NOT EXISTS idx_adm_cot_conv_source ON adm_cot_conversations(source);
CREATE INDEX IF NOT EXISTS idx_adm_cot_conv_created ON adm_cot_conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_adm_cot_conv_session ON adm_cot_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_adm_cot_conv_cedula ON adm_cot_conversations(cedula);

-- ┌─────────────────────────────────────────────┐
-- │ B) adm_cot_messages                         │
-- └─────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS adm_cot_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID NOT NULL REFERENCES adm_cot_conversations(id) ON DELETE CASCADE,
  role              TEXT NOT NULL CHECK (role IN ('USER','ASSISTANT','SYSTEM')),
  content           TEXT NOT NULL,
  tokens_used       INTEGER DEFAULT 0,
  metadata          JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_adm_cot_msg_conv ON adm_cot_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_adm_cot_msg_created ON adm_cot_messages(created_at);

-- ┌─────────────────────────────────────────────┐
-- │ C) adm_cot_tasks                            │
-- └─────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS adm_cot_tasks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID NOT NULL REFERENCES adm_cot_conversations(id) ON DELETE CASCADE,
  assigned_to       UUID,
  status            TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','IN_PROGRESS','RESOLVED')),
  priority          TEXT NOT NULL DEFAULT 'NORMAL'
    CHECK (priority IN ('NORMAL','URGENTE')),
  summary           TEXT,
  resolved_at       TIMESTAMPTZ,
  resolved_by       UUID,
  metadata          JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_adm_cot_tasks_conv ON adm_cot_tasks(conversation_id);
CREATE INDEX IF NOT EXISTS idx_adm_cot_tasks_status ON adm_cot_tasks(status);
CREATE INDEX IF NOT EXISTS idx_adm_cot_tasks_priority ON adm_cot_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_adm_cot_tasks_created ON adm_cot_tasks(created_at);

-- ┌─────────────────────────────────────────────┐
-- │ D) RLS — Master only                        │
-- └─────────────────────────────────────────────┘
ALTER TABLE adm_cot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE adm_cot_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE adm_cot_tasks ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'adm_cot_conversations',
      'adm_cot_messages',
      'adm_cot_tasks'
    ])
  LOOP
    EXECUTE format(
      'CREATE POLICY master_all ON %I FOR ALL USING (is_master()) WITH CHECK (is_master())',
      tbl
    );
  END LOOP;
END $$;

-- ┌─────────────────────────────────────────────┐
-- │ E) Updated_at triggers                      │
-- └─────────────────────────────────────────────┘
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY['adm_cot_conversations', 'adm_cot_tasks'])
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION adm_cot_set_updated_at()',
      tbl, tbl
    );
  END LOOP;
END $$;
