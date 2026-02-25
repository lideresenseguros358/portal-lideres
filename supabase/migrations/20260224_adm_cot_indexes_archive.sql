-- ============================================================
-- ADM COT — Additional indexes + archive table
-- Created: 2026-02-24 (Prompt 3)
-- ============================================================

-- ┌─────────────────────────────────────────────┐
-- │ ADDITIONAL INDEXES (avoid full scans)       │
-- └─────────────────────────────────────────────┘

-- Single-column indexes not in original migration
CREATE INDEX IF NOT EXISTS idx_adm_cot_quotes_region ON adm_cot_quotes(region);
CREATE INDEX IF NOT EXISTS idx_adm_cot_quotes_device ON adm_cot_quotes(device);
CREATE INDEX IF NOT EXISTS idx_adm_cot_quotes_quote_ref ON adm_cot_quotes(quote_ref);
CREATE INDEX IF NOT EXISTS idx_adm_cot_quotes_emitted_at ON adm_cot_quotes(emitted_at);
CREATE INDEX IF NOT EXISTS idx_adm_cot_quotes_client_name ON adm_cot_quotes(client_name);
CREATE INDEX IF NOT EXISTS idx_adm_cot_quotes_ip_address ON adm_cot_quotes(ip_address);

-- Composite indexes for common filter combinations
CREATE INDEX IF NOT EXISTS idx_adm_cot_quotes_insurer_status ON adm_cot_quotes(insurer, status);
CREATE INDEX IF NOT EXISTS idx_adm_cot_quotes_quoted_at_status ON adm_cot_quotes(quoted_at DESC, status);
CREATE INDEX IF NOT EXISTS idx_adm_cot_quotes_insurer_ramo_status ON adm_cot_quotes(insurer, ramo, status);

-- GIN index for JSONB full-text search on quote_payload (policy_number lookup)
CREATE INDEX IF NOT EXISTS idx_adm_cot_quotes_payload_gin ON adm_cot_quotes USING gin(quote_payload jsonb_path_ops);

-- Partial index for emitted quotes only (faster emission lookups)
CREATE INDEX IF NOT EXISTS idx_adm_cot_quotes_emitted ON adm_cot_quotes(emitted_at DESC) WHERE status = 'EMITIDA';

-- Partial index for failed quotes
CREATE INDEX IF NOT EXISTS idx_adm_cot_quotes_failed ON adm_cot_quotes(quoted_at DESC) WHERE status = 'FALLIDA';

-- ┌─────────────────────────────────────────────┐
-- │ ARCHIVE TABLE (3-year retention policy)     │
-- └─────────────────────────────────────────────┘

-- Mirror structure of adm_cot_quotes for archival
-- Records older than 3 years will be moved here (not deleted)
CREATE TABLE IF NOT EXISTS adm_cot_quotes_archive (
  id            UUID PRIMARY KEY,
  quote_ref     TEXT NOT NULL,
  client_name   TEXT NOT NULL,
  cedula        TEXT,
  email         TEXT,
  phone         TEXT,
  ip_address    TEXT,
  region        TEXT,
  device        TEXT,
  user_agent    TEXT,
  status        TEXT NOT NULL,
  insurer       TEXT NOT NULL,
  ramo          TEXT NOT NULL,
  coverage_type TEXT,
  plan_name     TEXT,
  annual_premium NUMERIC(12,2),
  vehicle_info  JSONB,
  quote_payload JSONB,
  last_step     TEXT,
  steps_log     JSONB,
  quoted_at     TIMESTAMPTZ NOT NULL,
  emitted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL,
  archived_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_adm_cot_quotes_archive_quoted_at ON adm_cot_quotes_archive(quoted_at);
CREATE INDEX IF NOT EXISTS idx_adm_cot_quotes_archive_quote_ref ON adm_cot_quotes_archive(quote_ref);
CREATE INDEX IF NOT EXISTS idx_adm_cot_quotes_archive_insurer ON adm_cot_quotes_archive(insurer);

-- RLS: Master only
ALTER TABLE adm_cot_quotes_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "adm_cot_quotes_archive_master_select"
  ON adm_cot_quotes_archive FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'master'
    )
  );

-- ┌─────────────────────────────────────────────┐
-- │ ARCHIVE FUNCTION (callable manually or cron)│
-- └─────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION archive_old_adm_cot_quotes(retention_years INT DEFAULT 3)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff TIMESTAMPTZ;
  moved INTEGER;
BEGIN
  cutoff := now() - (retention_years || ' years')::INTERVAL;

  INSERT INTO adm_cot_quotes_archive
    SELECT *, now() AS archived_at
    FROM adm_cot_quotes
    WHERE quoted_at < cutoff;

  GET DIAGNOSTICS moved = ROW_COUNT;

  DELETE FROM adm_cot_quotes WHERE quoted_at < cutoff;

  RETURN moved;
END;
$$;
