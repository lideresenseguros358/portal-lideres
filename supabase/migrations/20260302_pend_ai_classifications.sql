-- ══════════════════════════════════════════════════════════════
-- Migration: pend_ai_classifications
-- Purpose: Store Vertex AI classification results for Pendientes
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pend_ai_classifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     uuid REFERENCES cases(id) ON DELETE SET NULL,
  message_id  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  json_result jsonb NOT NULL DEFAULT '{}',
  applied     boolean NOT NULL DEFAULT false,
  applied_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  applied_at  timestamptz
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pend_ai_class_case_id ON pend_ai_classifications (case_id);
CREATE INDEX IF NOT EXISTS idx_pend_ai_class_message_id ON pend_ai_classifications (message_id);
CREATE INDEX IF NOT EXISTS idx_pend_ai_class_applied ON pend_ai_classifications (applied, created_at DESC);

-- RLS (service role only — cron/system writes, masters read)
ALTER TABLE pend_ai_classifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON pend_ai_classifications
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE pend_ai_classifications IS 'Vertex AI classification results for Pendientes module emails';
