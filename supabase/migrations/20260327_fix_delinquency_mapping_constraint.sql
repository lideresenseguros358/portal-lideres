-- Fix insurer_mapping_rules target_field CHECK constraint to allow DELINQUENCY_* fields.
-- Previously the constraint only allowed commission/policy fields; any attempt to insert
-- a delinquency mapping rule failed with a check constraint violation.

ALTER TABLE insurer_mapping_rules
  DROP CONSTRAINT IF EXISTS insurer_mapping_rules_target_field_check;

ALTER TABLE insurer_mapping_rules
  ADD CONSTRAINT insurer_mapping_rules_target_field_check
  CHECK (lower(target_field) IN (
    -- Commission / policy mapping fields (existing)
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
