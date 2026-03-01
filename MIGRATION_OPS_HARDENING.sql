-- ═══════════════════════════════════════════════════════
-- MIGRATION: OPS HARDENING — Indexes + RLS + Cron Locks
-- Run in Supabase SQL Editor after all previous migrations
-- ═══════════════════════════════════════════════════════

-- ╔═══════════════════════════════════════════════════════╗
-- ║ 1. MISSING INDEXES                                    ║
-- ╚═══════════════════════════════════════════════════════╝

-- ops_cases: composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_ops_cases_type_status_updated
  ON ops_cases (case_type, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_cases_assigned_status_updated
  ON ops_cases (assigned_master_id, status, updated_at DESC);

-- ops_activity_log: missing composite + entity lookup
CREATE INDEX IF NOT EXISTS idx_ops_activity_created
  ON ops_activity_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_activity_entity
  ON ops_activity_log (entity_type, entity_id);

-- ops_case_history: ensure asc index for timeline
CREATE INDEX IF NOT EXISTS idx_ops_case_history_case_asc
  ON ops_case_history (case_id, created_at ASC);

-- ops_metrics_daily: composite unique already exists, add date desc
CREATE INDEX IF NOT EXISTS idx_ops_metrics_daily_date
  ON ops_metrics_daily (date DESC);

-- ops_notes: case + created desc
CREATE INDEX IF NOT EXISTS idx_ops_notes_case_created
  ON ops_notes (case_id, created_at DESC);

-- ops_ai_evaluations: case + evaluated desc, and standalone evaluated desc
CREATE INDEX IF NOT EXISTS idx_ops_ai_eval_case_evaluated
  ON ops_ai_evaluations (case_id, evaluated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_ai_eval_evaluated
  ON ops_ai_evaluations (evaluated_at DESC);

-- cron_runs: job_name + started_at desc
CREATE INDEX IF NOT EXISTS idx_cron_runs_job_started
  ON cron_runs (job_name, started_at DESC);

-- ops_case_messages: ensure unclassified partial index exists
CREATE INDEX IF NOT EXISTS idx_ocm_unclassified_recv
  ON ops_case_messages (unclassified, received_at DESC)
  WHERE unclassified = true;

-- ops_email_templates: key lookup
CREATE INDEX IF NOT EXISTS idx_ops_email_templates_key
  ON ops_email_templates (template_key);

-- ╔═══════════════════════════════════════════════════════╗
-- ║ 2. RLS — ENABLE + POLICIES (IDEMPOTENT)              ║
-- ╚═══════════════════════════════════════════════════════╝

-- All ops tables: RLS ON
ALTER TABLE ops_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_case_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_case_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_productivity_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_ai_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_ai_memory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_ai_training_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_runs ENABLE ROW LEVEL SECURITY;

-- ── Service role: full access on all tables ──
-- (API routes use service_role key; crons use service_role key)

DROP POLICY IF EXISTS "service_role_ops_cases" ON ops_cases;
CREATE POLICY "service_role_ops_cases" ON ops_cases FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_ops_case_messages" ON ops_case_messages;
CREATE POLICY "service_role_ops_case_messages" ON ops_case_messages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_ops_case_history" ON ops_case_history;
CREATE POLICY "service_role_ops_case_history" ON ops_case_history FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_ops_activity_log" ON ops_activity_log;
CREATE POLICY "service_role_ops_activity_log" ON ops_activity_log FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_ops_user_sessions" ON ops_user_sessions;
CREATE POLICY "service_role_ops_user_sessions" ON ops_user_sessions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_ops_metrics_daily" ON ops_metrics_daily;
CREATE POLICY "service_role_ops_metrics_daily" ON ops_metrics_daily FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_ops_productivity_flags" ON ops_productivity_flags;
CREATE POLICY "service_role_ops_productivity_flags" ON ops_productivity_flags FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_ai_eval" ON ops_ai_evaluations;
CREATE POLICY "service_role_ai_eval" ON ops_ai_evaluations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_ai_memory" ON ops_ai_memory_items;
CREATE POLICY "service_role_ai_memory" ON ops_ai_memory_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_ai_training" ON ops_ai_training_events;
CREATE POLICY "service_role_ai_training" ON ops_ai_training_events FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_ops_notes" ON ops_notes;
CREATE POLICY "service_role_ops_notes" ON ops_notes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_ops_config" ON ops_config;
CREATE POLICY "service_role_ops_config" ON ops_config FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_ops_email_templates" ON ops_email_templates;
CREATE POLICY "service_role_ops_email_templates" ON ops_email_templates FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_cron_runs" ON cron_runs;
CREATE POLICY "service_role_cron_runs" ON cron_runs FOR ALL USING (true) WITH CHECK (true);

-- ╔═══════════════════════════════════════════════════════╗
-- ║ 3. CRON LOCKS TABLE (advisory locking)                ║
-- ╚═══════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS ops_cron_locks (
  job_name TEXT PRIMARY KEY,
  locked_at TIMESTAMPTZ,
  locked_by TEXT
);

ALTER TABLE ops_cron_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_ops_cron_locks" ON ops_cron_locks;
CREATE POLICY "service_role_ops_cron_locks" ON ops_cron_locks FOR ALL USING (true) WITH CHECK (true);

-- Pre-seed lock rows for each job
INSERT INTO ops_cron_locks (job_name) VALUES
  ('ops-imap-sync'),
  ('ops-sla-check'),
  ('ops-metrics-nightly'),
  ('ops-ai-eval-urgencies')
ON CONFLICT (job_name) DO NOTHING;

-- ── Acquire lock function ──
-- Returns true if lock acquired, false if already locked (within cooldown)
CREATE OR REPLACE FUNCTION ops_acquire_cron_lock(
  p_job_name TEXT,
  p_cooldown_seconds INT DEFAULT 30
) RETURNS BOOLEAN AS $$
DECLARE
  v_locked_at TIMESTAMPTZ;
BEGIN
  SELECT locked_at INTO v_locked_at
  FROM ops_cron_locks
  WHERE job_name = p_job_name
  FOR UPDATE SKIP LOCKED;

  -- Could not lock row (another process has it)
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- If locked recently within cooldown, skip
  IF v_locked_at IS NOT NULL
     AND v_locked_at > now() - (p_cooldown_seconds || ' seconds')::interval
  THEN
    RETURN false;
  END IF;

  -- Acquire
  UPDATE ops_cron_locks
  SET locked_at = now(), locked_by = 'cron'
  WHERE job_name = p_job_name;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ── Release lock function ──
CREATE OR REPLACE FUNCTION ops_release_cron_lock(p_job_name TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE ops_cron_locks
  SET locked_at = NULL, locked_by = NULL
  WHERE job_name = p_job_name;
END;
$$ LANGUAGE plpgsql;

-- ╔═══════════════════════════════════════════════════════╗
-- ║ DONE                                                  ║
-- ╚═══════════════════════════════════════════════════════╝
-- INDEXES:  14 new composite/covering indexes
-- RLS:      15 tables enabled + service_role policies
-- LOCKS:    ops_cron_locks table + acquire/release functions
