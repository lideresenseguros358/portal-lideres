-- ═══════════════════════════════════════════════════════
-- OPERACIONES MODULE V2 — Enums, Unified Cases, Triggers,
-- RPC Functions, SLA Engine, Metrics, Sessions, Morosidad
-- ═══════════════════════════════════════════════════════
-- Run AFTER MIGRATION_OPERACIONES.sql has been executed.
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE).
-- ═══════════════════════════════════════════════════════

-- ╔═══════════════════════════════════════════════════════╗
-- ║ 1. ENUMS                                             ║
-- ╚═══════════════════════════════════════════════════════╝

DO $$ BEGIN
  CREATE TYPE ops_case_type_enum AS ENUM ('renovacion', 'peticion', 'urgencia');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ops_case_status_enum AS ENUM (
    'pendiente',
    'en_revision',
    'aplazado',
    'cerrado_renovado',
    'cerrado_cancelado',
    'en_gestion',
    'enviado',
    'cerrado',
    'perdido',
    'en_atencion',
    'resuelto'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ops_morosidad_status_enum AS ENUM (
    'al_dia',
    'atrasado',
    'pago_recibido',
    'cancelado'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ╔═══════════════════════════════════════════════════════╗
-- ║ 2. OPS_CASES — Unified cases table                   ║
-- ╚═══════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS ops_cases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket TEXT NOT NULL UNIQUE,
  case_type ops_case_type_enum NOT NULL,
  status ops_case_status_enum NOT NULL DEFAULT 'pendiente',

  -- Relations
  policy_id UUID,
  client_id UUID,
  client_name TEXT,
  insurer_name TEXT,
  policy_number TEXT,
  renewal_date DATE,
  ramo TEXT,

  -- Assignment
  assigned_master_id UUID REFERENCES auth.users(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  first_response_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,

  -- SLA
  sla_breached BOOLEAN DEFAULT false,

  -- Urgency
  urgency_flag BOOLEAN DEFAULT false,
  chat_thread_id UUID,
  severity TEXT,
  category TEXT,

  -- Renovacion specifics
  aplazado_until TIMESTAMPTZ,
  cancellation_reason TEXT,
  new_start_date DATE,
  new_end_date DATE,
  last_email_summary TEXT,

  -- Peticion specifics
  client_email TEXT,
  client_phone TEXT,
  cedula TEXT,
  source TEXT DEFAULT 'COTIZADOR',
  details JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_ops_cases_type ON ops_cases(case_type);
CREATE INDEX IF NOT EXISTS idx_ops_cases_status ON ops_cases(status);
CREATE INDEX IF NOT EXISTS idx_ops_cases_assigned ON ops_cases(assigned_master_id);
CREATE INDEX IF NOT EXISTS idx_ops_cases_ticket ON ops_cases(ticket);
CREATE INDEX IF NOT EXISTS idx_ops_cases_policy ON ops_cases(policy_id);
CREATE INDEX IF NOT EXISTS idx_ops_cases_client ON ops_cases(client_id);
CREATE INDEX IF NOT EXISTS idx_ops_cases_renewal ON ops_cases(renewal_date);
CREATE INDEX IF NOT EXISTS idx_ops_cases_sla ON ops_cases(sla_breached);
CREATE INDEX IF NOT EXISTS idx_ops_cases_created ON ops_cases(created_at DESC);

ALTER TABLE ops_cases ENABLE ROW LEVEL SECURITY;

-- ╔═══════════════════════════════════════════════════════╗
-- ║ 3. OPS_CASE_HISTORY — Bitácora with before/after     ║
-- ╚═══════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS ops_case_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES ops_cases(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES auth.users(id),
  change_type TEXT NOT NULL,
  before_state JSONB,
  after_state JSONB,
  related_message_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ops_case_history_case ON ops_case_history(case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_case_history_user ON ops_case_history(changed_by);

ALTER TABLE ops_case_history ENABLE ROW LEVEL SECURITY;

-- Trigger: auto-log before/after on ops_cases UPDATE
CREATE OR REPLACE FUNCTION ops_case_history_trigger_fn()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO ops_case_history (
    case_id, changed_by, change_type, before_state, after_state
  ) VALUES (
    NEW.id,
    COALESCE(current_setting('app.current_user_id', true)::uuid, NULL),
    'status_change',
    to_jsonb(OLD),
    to_jsonb(NEW)
  );

  -- Auto-update updated_at
  NEW.updated_at := now();

  -- Auto-set closed_at when status changes to a closed state
  IF NEW.status IN ('cerrado_renovado', 'cerrado_cancelado', 'cerrado', 'perdido', 'resuelto')
     AND OLD.status NOT IN ('cerrado_renovado', 'cerrado_cancelado', 'cerrado', 'perdido', 'resuelto')
  THEN
    NEW.closed_at := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_ops_case_history ON ops_cases;
CREATE TRIGGER trg_ops_case_history
  BEFORE UPDATE ON ops_cases
  FOR EACH ROW
  EXECUTE FUNCTION ops_case_history_trigger_fn();

-- ╔═══════════════════════════════════════════════════════╗
-- ║ 4. AUTO-ASSIGNMENT RPC                               ║
-- ╚═══════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION assign_case_equilibrado(p_case_id UUID)
RETURNS UUID AS $$
DECLARE
  v_auto_enabled BOOLEAN;
  v_master_id UUID;
  v_count INT;
BEGIN
  -- Check if auto-assignment is enabled
  SELECT (value::text)::boolean INTO v_auto_enabled
  FROM ops_config
  WHERE key = 'auto_assign_enabled';

  IF NOT COALESCE(v_auto_enabled, false) THEN
    RETURN NULL; -- disabled
  END IF;

  -- Find master with fewest open cases
  -- Tie-break: most time since last assignment
  SELECT p.id INTO v_master_id
  FROM profiles p
  WHERE p.role = 'master'
  ORDER BY (
    SELECT COUNT(*) FROM ops_cases c
    WHERE c.assigned_master_id = p.id
      AND c.status NOT IN ('cerrado_renovado','cerrado_cancelado','cerrado','perdido','resuelto')
  ) ASC,
  (
    SELECT COALESCE(MAX(c.created_at), '1970-01-01'::timestamptz) FROM ops_cases c
    WHERE c.assigned_master_id = p.id
  ) ASC
  LIMIT 1;

  IF v_master_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Assign
  UPDATE ops_cases
  SET assigned_master_id = v_master_id,
      updated_at = now()
  WHERE id = p_case_id;

  -- Log
  INSERT INTO ops_activity_log (user_id, action_type, entity_type, entity_id, metadata)
  VALUES (
    v_master_id,
    'case_assigned',
    'case',
    p_case_id::text,
    jsonb_build_object('auto_assigned', true, 'method', 'equilibrado')
  );

  RETURN v_master_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ╔═══════════════════════════════════════════════════════╗
-- ║ 5. SLA ENGINE — Business hours calculator            ║
-- ╚═══════════════════════════════════════════════════════╝

-- Calculate business hours between two timestamps
-- Excludes Saturday (6) and Sunday (0)
-- Assumes 9:00-17:00 Panama time (8h/day)
CREATE OR REPLACE FUNCTION calculate_business_hours(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ
) RETURNS NUMERIC AS $$
DECLARE
  v_current TIMESTAMPTZ;
  v_hours NUMERIC := 0;
  v_day_start TIME := '09:00:00';
  v_day_end TIME := '17:00:00';
  v_hours_per_day NUMERIC := 8;
  v_dow INT;
  v_start_local TIMESTAMPTZ;
  v_end_local TIMESTAMPTZ;
BEGIN
  v_start_local := p_start AT TIME ZONE 'America/Panama';
  v_end_local := p_end AT TIME ZONE 'America/Panama';
  v_current := date_trunc('day', v_start_local);

  WHILE v_current <= v_end_local LOOP
    v_dow := EXTRACT(DOW FROM v_current);

    -- Skip weekends
    IF v_dow NOT IN (0, 6) THEN
      DECLARE
        v_day_s TIMESTAMPTZ := v_current + v_day_start;
        v_day_e TIMESTAMPTZ := v_current + v_day_end;
        v_eff_start TIMESTAMPTZ;
        v_eff_end TIMESTAMPTZ;
      BEGIN
        v_eff_start := GREATEST(v_start_local, v_day_s);
        v_eff_end := LEAST(v_end_local, v_day_e);

        IF v_eff_end > v_eff_start THEN
          v_hours := v_hours + EXTRACT(EPOCH FROM (v_eff_end - v_eff_start)) / 3600.0;
        END IF;
      END;
    END IF;

    v_current := v_current + INTERVAL '1 day';
  END LOOP;

  RETURN ROUND(v_hours, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- SLA check function (called by cron)
-- Marks sla_breached for cases that exceed their SLA
CREATE OR REPLACE FUNCTION ops_check_sla()
RETURNS TABLE(case_id UUID, case_type ops_case_type_enum, hours_elapsed NUMERIC) AS $$
BEGIN
  RETURN QUERY

  -- Renovations & Petitions: 48h wall-clock since created_at, no first_response
  SELECT c.id, c.case_type,
    EXTRACT(EPOCH FROM (now() - c.created_at)) / 3600.0 AS hrs
  FROM ops_cases c
  WHERE c.case_type IN ('renovacion', 'peticion')
    AND c.first_response_at IS NULL
    AND c.sla_breached = false
    AND c.status NOT IN ('cerrado_renovado','cerrado_cancelado','cerrado','perdido','resuelto')
    AND EXTRACT(EPOCH FROM (now() - c.created_at)) / 3600.0 > 48

  UNION ALL

  -- Urgencies: 24 business hours
  SELECT c.id, c.case_type,
    calculate_business_hours(c.created_at, now()) AS hrs
  FROM ops_cases c
  WHERE c.case_type = 'urgencia'
    AND c.first_response_at IS NULL
    AND c.sla_breached = false
    AND c.status NOT IN ('resuelto','cerrado')
    AND calculate_business_hours(c.created_at, now()) > 24;

  -- Mark them as breached
  UPDATE ops_cases
  SET sla_breached = true, updated_at = now()
  WHERE id IN (
    SELECT c2.id FROM ops_cases c2
    WHERE (
      (c2.case_type IN ('renovacion','peticion')
       AND c2.first_response_at IS NULL
       AND c2.sla_breached = false
       AND c2.status NOT IN ('cerrado_renovado','cerrado_cancelado','cerrado','perdido','resuelto')
       AND EXTRACT(EPOCH FROM (now() - c2.created_at)) / 3600.0 > 48)
      OR
      (c2.case_type = 'urgencia'
       AND c2.first_response_at IS NULL
       AND c2.sla_breached = false
       AND c2.status NOT IN ('resuelto','cerrado')
       AND calculate_business_hours(c2.created_at, now()) > 24)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ╔═══════════════════════════════════════════════════════╗
-- ║ 6. FIRST RESPONSE TRACKER (helper function)          ║
-- ╚═══════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION ops_mark_first_response(
  p_case_id UUID,
  p_user_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE ops_cases
  SET first_response_at = now(),
      updated_at = now()
  WHERE id = p_case_id
    AND first_response_at IS NULL;

  IF FOUND THEN
    INSERT INTO ops_activity_log (user_id, action_type, entity_type, entity_id, metadata)
    VALUES (p_user_id, 'status_change', 'case', p_case_id::text,
      jsonb_build_object('event', 'first_response_recorded'));
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ╔═══════════════════════════════════════════════════════╗
-- ║ 7. OPS_METRICS_DAILY — Daily per-user metrics        ║
-- ╚═══════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS ops_metrics_daily (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  date DATE NOT NULL,
  hours_worked NUMERIC(6,2) DEFAULT 0,
  cases_handled INT DEFAULT 0,
  renewals_handled INT DEFAULT 0,
  petitions_handled INT DEFAULT 0,
  urgencies_handled INT DEFAULT 0,
  emissions_confirmed INT DEFAULT 0,
  conversions_count INT DEFAULT 0,
  sla_breaches INT DEFAULT 0,
  unresolved_cases INT DEFAULT 0,
  productivity_score NUMERIC(5,2) DEFAULT 0,
  low_productivity BOOLEAN DEFAULT false,
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_ops_metrics_daily_user ON ops_metrics_daily(user_id, date DESC);

ALTER TABLE ops_metrics_daily ENABLE ROW LEVEL SECURITY;

-- Nightly aggregation function
CREATE OR REPLACE FUNCTION ops_aggregate_daily_metrics(p_date DATE DEFAULT CURRENT_DATE)
RETURNS INT AS $$
DECLARE
  v_count INT := 0;
  v_user RECORD;
  v_hours NUMERIC;
  v_cases INT;
  v_renewals INT;
  v_petitions INT;
  v_urgencies INT;
  v_sla INT;
  v_unresolved INT;
  v_conversions INT;
  v_monthly_avg NUMERIC;
BEGIN
  FOR v_user IN
    SELECT id, full_name FROM profiles WHERE role = 'master'
  LOOP
    -- Hours worked (from session blocks)
    SELECT COALESCE(SUM(duration_minutes) / 60.0, 0) INTO v_hours
    FROM ops_user_sessions
    WHERE user_id = v_user.id
      AND session_start::date = p_date;

    -- Cases handled (closed on this date)
    SELECT COUNT(*) INTO v_cases
    FROM ops_cases
    WHERE assigned_master_id = v_user.id
      AND closed_at::date = p_date;

    -- By type
    SELECT COUNT(*) INTO v_renewals
    FROM ops_cases WHERE assigned_master_id = v_user.id
      AND case_type = 'renovacion' AND closed_at::date = p_date;

    SELECT COUNT(*) INTO v_petitions
    FROM ops_cases WHERE assigned_master_id = v_user.id
      AND case_type = 'peticion' AND closed_at::date = p_date;

    SELECT COUNT(*) INTO v_urgencies
    FROM ops_cases WHERE assigned_master_id = v_user.id
      AND case_type = 'urgencia' AND closed_at::date = p_date;

    -- SLA breaches on this date
    SELECT COUNT(*) INTO v_sla
    FROM ops_cases WHERE assigned_master_id = v_user.id
      AND sla_breached = true AND updated_at::date = p_date;

    -- Currently unresolved
    SELECT COUNT(*) INTO v_unresolved
    FROM ops_cases WHERE assigned_master_id = v_user.id
      AND status NOT IN ('cerrado_renovado','cerrado_cancelado','cerrado','perdido','resuelto');

    -- Conversions (petitions closed as 'cerrado' on this date)
    SELECT COUNT(*) INTO v_conversions
    FROM ops_cases WHERE assigned_master_id = v_user.id
      AND case_type = 'peticion' AND status = 'cerrado' AND closed_at::date = p_date;

    -- Upsert
    INSERT INTO ops_metrics_daily (
      user_id, date, hours_worked, cases_handled,
      renewals_handled, petitions_handled, urgencies_handled,
      sla_breaches, unresolved_cases, conversions_count
    ) VALUES (
      v_user.id, p_date, v_hours, v_cases,
      v_renewals, v_petitions, v_urgencies,
      v_sla, v_unresolved, v_conversions
    )
    ON CONFLICT (user_id, date)
    DO UPDATE SET
      hours_worked = EXCLUDED.hours_worked,
      cases_handled = EXCLUDED.cases_handled,
      renewals_handled = EXCLUDED.renewals_handled,
      petitions_handled = EXCLUDED.petitions_handled,
      urgencies_handled = EXCLUDED.urgencies_handled,
      sla_breaches = EXCLUDED.sla_breaches,
      unresolved_cases = EXCLUDED.unresolved_cases,
      conversions_count = EXCLUDED.conversions_count;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ╔═══════════════════════════════════════════════════════╗
-- ║ 8. OPS_USER_SESSIONS — Work blocks                   ║
-- ╚═══════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS ops_user_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  session_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_end TIMESTAMPTZ,
  duration_minutes NUMERIC(8,2) DEFAULT 0,
  block_id UUID
);

CREATE INDEX IF NOT EXISTS idx_ops_user_sessions_user ON ops_user_sessions(user_id, session_start DESC);
CREATE INDEX IF NOT EXISTS idx_ops_user_sessions_block ON ops_user_sessions(block_id);

ALTER TABLE ops_user_sessions ENABLE ROW LEVEL SECURITY;

-- Close session block (called when inactivity detected)
CREATE OR REPLACE FUNCTION ops_close_session_block(
  p_user_id UUID,
  p_block_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE ops_user_sessions
  SET session_end = now(),
      duration_minutes = EXTRACT(EPOCH FROM (now() - session_start)) / 60.0
  WHERE user_id = p_user_id
    AND block_id = p_block_id
    AND session_end IS NULL;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Start new session block
CREATE OR REPLACE FUNCTION ops_start_session_block(
  p_user_id UUID,
  p_block_id UUID
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO ops_user_sessions (user_id, block_id, session_start)
  VALUES (p_user_id, p_block_id, now())
  RETURNING id INTO v_id;

  INSERT INTO ops_activity_log (user_id, action_type, entity_type, entity_id, metadata, session_block_id)
  VALUES (p_user_id, 'session_start', 'session', v_id::text,
    jsonb_build_object('block_id', p_block_id), p_block_id);

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ╔═══════════════════════════════════════════════════════╗
-- ║ 9. OPS_PRODUCTIVITY_FLAGS                            ║
-- ╚═══════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS ops_productivity_flags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  date DATE NOT NULL,
  low_productivity BOOLEAN DEFAULT false,
  monthly_avg_cases NUMERIC(6,2) DEFAULT 0,
  actual_cases INT DEFAULT 0,
  threshold_pct NUMERIC(4,2) DEFAULT 0.40,
  note TEXT,
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_ops_productivity_user ON ops_productivity_flags(user_id, date DESC);

ALTER TABLE ops_productivity_flags ENABLE ROW LEVEL SECURITY;

-- Detect low productivity for a given date
CREATE OR REPLACE FUNCTION ops_detect_low_productivity(p_date DATE DEFAULT CURRENT_DATE)
RETURNS INT AS $$
DECLARE
  v_count INT := 0;
  v_user RECORD;
  v_monthly_avg NUMERIC;
  v_actual INT;
  v_threshold NUMERIC := 0.40;
BEGIN
  FOR v_user IN
    SELECT id FROM profiles WHERE role = 'master'
  LOOP
    -- Monthly average cases handled (last 30 days)
    SELECT COALESCE(AVG(cases_handled), 0) INTO v_monthly_avg
    FROM ops_metrics_daily
    WHERE user_id = v_user.id
      AND date >= p_date - INTERVAL '30 days'
      AND date < p_date;

    -- Actual cases today
    SELECT COALESCE(cases_handled, 0) INTO v_actual
    FROM ops_metrics_daily
    WHERE user_id = v_user.id AND date = p_date;

    -- Flag if below threshold
    INSERT INTO ops_productivity_flags (
      user_id, date, low_productivity, monthly_avg_cases, actual_cases, threshold_pct
    ) VALUES (
      v_user.id, p_date,
      (v_actual < v_monthly_avg * v_threshold),
      v_monthly_avg, v_actual, v_threshold
    )
    ON CONFLICT (user_id, date)
    DO UPDATE SET
      low_productivity = EXCLUDED.low_productivity,
      monthly_avg_cases = EXCLUDED.monthly_avg_cases,
      actual_cases = EXCLUDED.actual_cases;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ╔═══════════════════════════════════════════════════════╗
-- ║ 10. CONVERSION RATE (helper)                         ║
-- ╚═══════════════════════════════════════════════════════╝

-- Update conversion rate in daily metrics after a petition closes
CREATE OR REPLACE FUNCTION ops_update_conversion_rate(
  p_user_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
) RETURNS NUMERIC AS $$
DECLARE
  v_petitions INT;
  v_conversions INT;
  v_rate NUMERIC;
BEGIN
  SELECT COALESCE(petitions_handled, 0), COALESCE(conversions_count, 0)
  INTO v_petitions, v_conversions
  FROM ops_metrics_daily
  WHERE user_id = p_user_id AND date = p_date;

  IF v_petitions > 0 THEN
    v_rate := ROUND((v_conversions::numeric / v_petitions::numeric) * 100, 2);
  ELSE
    v_rate := 0;
  END IF;

  UPDATE ops_metrics_daily
  SET productivity_score = v_rate
  WHERE user_id = p_user_id AND date = p_date;

  RETURN v_rate;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ╔═══════════════════════════════════════════════════════╗
-- ║ 11. MOROSIDAD VIEW                                   ║
-- ╚═══════════════════════════════════════════════════════╝

CREATE OR REPLACE VIEW ops_morosidad_view AS
SELECT
  p.id AS policy_id,
  p.policy_number,
  p.ramo,
  p.renewal_date,
  p.status AS policy_status,
  c.id AS client_id,
  c.name AS client_name,
  c.national_id AS cedula,
  c.email AS client_email,
  c.phone AS client_phone,
  i.name AS insurer_name,
  pay.id AS payment_id,
  pay.amount AS payment_amount,
  pay.payment_date,
  pay.status AS payment_status,
  pay.is_recurring,
  pay.recurrence_id,
  rec.status AS recurrence_status,
  rec.next_due_date,
  rec.total_installments,
  rec.installment_amount,
  CASE
    WHEN pay.status = 'PAGADO' THEN 'al_dia'
    WHEN pay.status IN ('PENDIENTE','PENDIENTE_CONFIRMACION','AGRUPADO')
         AND pay.payment_date < CURRENT_DATE - INTERVAL '30 days'
    THEN 'atrasado'
    WHEN pay.status IN ('PENDIENTE','PENDIENTE_CONFIRMACION','AGRUPADO')
    THEN 'al_dia'
    WHEN pay.is_refund = true THEN 'cancelado'
    ELSE 'al_dia'
  END::text AS morosidad_status,
  CASE
    WHEN pay.payment_date < CURRENT_DATE
    THEN (CURRENT_DATE - pay.payment_date::date)
    ELSE 0
  END AS days_overdue
FROM policies p
JOIN clients c ON c.id = p.client_id
LEFT JOIN insurers i ON i.id = p.insurer_id
LEFT JOIN adm_cot_payments pay ON pay.nro_poliza = p.policy_number
LEFT JOIN adm_cot_recurrences rec ON rec.id = pay.recurrence_id
WHERE p.broker_id IN (
  SELECT b.id FROM brokers b
  JOIN profiles pr ON pr.id = b.p_id
  WHERE pr.email = 'portal@lideresenseguros.com'
);

-- ╔═══════════════════════════════════════════════════════╗
-- ║ 12. ADDITIONAL CONFIG SEED                           ║
-- ╚═══════════════════════════════════════════════════════╝

INSERT INTO ops_config (key, value, description) VALUES
  ('sla_petition_first_response_hours', '48', 'Horas para primera respuesta en peticiones')
ON CONFLICT (key) DO NOTHING;

-- ╔═══════════════════════════════════════════════════════╗
-- ║ DONE — Summary of objects created                    ║
-- ╚═══════════════════════════════════════════════════════╝
-- ENUMS:  ops_case_type_enum, ops_case_status_enum, ops_morosidad_status_enum
-- TABLES: ops_cases, ops_case_history, ops_metrics_daily,
--         ops_user_sessions, ops_productivity_flags
-- TRIGGER: trg_ops_case_history (before/after diff on ops_cases)
-- RPC:    assign_case_equilibrado, calculate_business_hours,
--         ops_check_sla, ops_mark_first_response,
--         ops_aggregate_daily_metrics, ops_detect_low_productivity,
--         ops_update_conversion_rate, ops_close_session_block,
--         ops_start_session_block
-- VIEW:   ops_morosidad_view
