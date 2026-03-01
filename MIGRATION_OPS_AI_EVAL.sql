-- ╔═══════════════════════════════════════════════════════╗
-- ║ MIGRATION: OPS AI EVALUATION ENGINE                  ║
-- ║ Tables: ops_ai_evaluations, ops_ai_memory_items,     ║
-- ║         ops_ai_training_events                       ║
-- ╚═══════════════════════════════════════════════════════╝

-- 1. AI Evaluations (sentiment + effectiveness per case)
CREATE TABLE IF NOT EXISTS ops_ai_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES ops_cases(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'adm_cot_chat',  -- adm_cot_chat | ops_email_thread
  source_id TEXT,                                     -- chat_id or thread_id
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  evaluator_version TEXT NOT NULL DEFAULT 'v1',
  final_sentiment_label TEXT NOT NULL DEFAULT 'neutral',  -- positive | neutral | negative
  final_sentiment_score NUMERIC NOT NULL DEFAULT 50,      -- 0-100
  effectiveness_score NUMERIC NOT NULL DEFAULT 50,        -- 0-100
  escalation_recommended BOOLEAN NOT NULL DEFAULT false,
  unresolved_signals JSONB DEFAULT '[]'::jsonb,
  rationale TEXT,
  evidence JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_eval_case_date ON ops_ai_evaluations (case_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_eval_sentiment ON ops_ai_evaluations (final_sentiment_label);

-- 2. AI Memory Items (learned policies, procedures, response templates)
CREATE TABLE IF NOT EXISTS ops_ai_memory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL DEFAULT 'auto',
  domain TEXT NOT NULL DEFAULT 'procedimiento',  -- quejas|pagos|renovaciones|politicas|tono|procedimiento
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  confidence NUMERIC NOT NULL DEFAULT 0.5,       -- 0-1
  last_used_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_ai_memory_domain ON ops_ai_memory_items (domain);
CREATE INDEX IF NOT EXISTS idx_ai_memory_tags ON ops_ai_memory_items USING GIN (tags);

-- 3. AI Training Events (audit trail of learning)
CREATE TABLE IF NOT EXISTS ops_ai_training_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  case_id UUID REFERENCES ops_cases(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,  -- learn_from_human_reply | learn_policy_update | score_case
  payload JSONB DEFAULT '{}'::jsonb,
  model_provider TEXT,       -- vertex | openai | mock
  model_name TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_training_case ON ops_ai_training_events (case_id);
CREATE INDEX IF NOT EXISTS idx_ai_training_type ON ops_ai_training_events (event_type);

-- 4. Add effectiveness columns to ops_metrics_daily (if not exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ops_metrics_daily' AND column_name='urgencies_effectiveness_avg') THEN
    ALTER TABLE ops_metrics_daily ADD COLUMN urgencies_effectiveness_avg NUMERIC DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ops_metrics_daily' AND column_name='urgencies_negative_outcomes') THEN
    ALTER TABLE ops_metrics_daily ADD COLUMN urgencies_negative_outcomes INT DEFAULT 0;
  END IF;
END $$;

-- 5. Notes table for mandatory notes
CREATE TABLE IF NOT EXISTS ops_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES ops_cases(id) ON DELETE CASCADE,
  user_id UUID,
  note TEXT NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'manual',  -- manual | cierre | sla_breached | status_change
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ops_notes_case ON ops_notes (case_id, created_at DESC);

-- 6. RLS
ALTER TABLE ops_ai_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_ai_memory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_ai_training_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_notes ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (idempotent: drop if exists first)
DROP POLICY IF EXISTS "service_role_ai_eval" ON ops_ai_evaluations;
CREATE POLICY "service_role_ai_eval" ON ops_ai_evaluations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_ai_memory" ON ops_ai_memory_items;
CREATE POLICY "service_role_ai_memory" ON ops_ai_memory_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_ai_training" ON ops_ai_training_events;
CREATE POLICY "service_role_ai_training" ON ops_ai_training_events FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_ops_notes" ON ops_notes;
CREATE POLICY "service_role_ops_notes" ON ops_notes FOR ALL USING (true) WITH CHECK (true);

-- Done
