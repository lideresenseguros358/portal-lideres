-- ═══════════════════════════════════════════════════════
-- MIGRATION: Add notes JSONB column to:
--   1. adm_cot_recurrences — tracks cuota_emails sent per installment
--   2. delinquency          — tracks morosidad_emails sent per stage
--
-- Run in Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════

-- 1. adm_cot_recurrences.notes
--    Stores: { cuota_emails: { pre10_<num>: "YYYY-MM-DD", day0_<num>: "YYYY-MM-DD" } }
ALTER TABLE adm_cot_recurrences
  ADD COLUMN IF NOT EXISTS notes JSONB DEFAULT '{}'::jsonb;

-- 2. delinquency.notes
--    Stores: { morosidad_emails: { d30: "YYYY-MM-DD", d60: "YYYY-MM-DD", d90: "YYYY-MM-DD" } }
ALTER TABLE delinquency
  ADD COLUMN IF NOT EXISTS notes JSONB DEFAULT '{}'::jsonb;

-- Indexes for JSONB notes columns (GIN for efficient key lookups)
CREATE INDEX IF NOT EXISTS idx_adm_cot_recurrences_notes
  ON adm_cot_recurrences USING GIN (notes);

CREATE INDEX IF NOT EXISTS idx_delinquency_notes
  ON delinquency USING GIN (notes);
