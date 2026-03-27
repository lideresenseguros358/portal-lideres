-- Fix insurer_mapping_rules:
-- 1. Drop ALL target_field check constraints (both the legacy "target_field_valid"
--    created directly in the DB and the one added in the previous migration).
-- 2. Re-create a single consolidated constraint that includes DELINQUENCY_* fields.
-- 3. Add RLS SELECT + ALL policies so authenticated users (and masters) can
--    read/write rules — previously RLS was ENABLED but no policy existed,
--    blocking every authenticated read (only service_role bypassed it).

-- ── 1. Drop all known target_field constraints ──────────────────────────────
ALTER TABLE public.insurer_mapping_rules
  DROP CONSTRAINT IF EXISTS target_field_valid;

ALTER TABLE public.insurer_mapping_rules
  DROP CONSTRAINT IF EXISTS insurer_mapping_rules_target_field_check;

-- ── 2. Single consolidated constraint ───────────────────────────────────────
ALTER TABLE public.insurer_mapping_rules
  ADD CONSTRAINT insurer_mapping_rules_target_field_check
  CHECK (lower(target_field) IN (
    -- Commission / commissions mapping fields
    'policy', 'insured', 'commission', 'amount', 'status', 'days',
    -- Delinquency mapping fields
    'delinquency_policy_number',
    'delinquency_due_soon',
    'delinquency_current',
    'delinquency_bucket_1_30',
    'delinquency_bucket_31_60',
    'delinquency_bucket_61_90',
    'delinquency_bucket_90_plus'
  ));

-- ── 3. RLS policies for insurer_mapping_rules ────────────────────────────────
-- All authenticated users can SELECT (needed by ImportTab & InsurerEditor).
-- Only masters can INSERT / UPDATE / DELETE.

DROP POLICY IF EXISTS "Authenticated can read insurer_mapping_rules" ON public.insurer_mapping_rules;
CREATE POLICY "Authenticated can read insurer_mapping_rules"
  ON public.insurer_mapping_rules FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Master can manage insurer_mapping_rules" ON public.insurer_mapping_rules;
CREATE POLICY "Master can manage insurer_mapping_rules"
  ON public.insurer_mapping_rules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );
