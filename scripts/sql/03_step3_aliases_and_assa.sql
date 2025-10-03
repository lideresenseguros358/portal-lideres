-- Step 3 normalization: aliases as jsonb arrays and insurer_assa_codes schema
-- This script is idempotent and may be executed multiple times safely.

BEGIN;

CREATE SCHEMA IF NOT EXISTS public;

-- Helper function to normalize any legacy aliases representations into a jsonb array
CREATE OR REPLACE FUNCTION public.normalize_aliases_value(raw text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  attempt jsonb;
  text_array text[];
BEGIN
  IF raw IS NULL OR btrim(raw) = '' OR btrim(raw) = '{}' THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Try to parse as JSON first
  BEGIN
    attempt := raw::jsonb;
    IF jsonb_typeof(attempt) = 'array' THEN
      RETURN attempt;
    ELSIF jsonb_typeof(attempt) IS NOT NULL THEN
      RETURN jsonb_build_array(attempt);
    END IF;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  -- Try to interpret as a PostgreSQL array literal (e.g. "{foo,bar}")
  BEGIN
    text_array := raw::text[];
    IF text_array IS NOT NULL THEN
      RETURN to_jsonb(text_array);
    END IF;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  -- Fallback: split on commas and trim whitespace
  text_array := regexp_split_to_array(raw, '\s*,\s*');
  RETURN to_jsonb(text_array);
END;
$$;

-- insurer_mapping_rules aliases -> jsonb array
IF to_regclass('public.insurer_mapping_rules') IS NOT NULL THEN
  ALTER TABLE public.insurer_mapping_rules
    ALTER COLUMN aliases TYPE jsonb
    USING public.normalize_aliases_value(aliases::text);

  ALTER TABLE public.insurer_mapping_rules
    ALTER COLUMN aliases SET DEFAULT '[]'::jsonb;

  UPDATE public.insurer_mapping_rules
    SET aliases = public.normalize_aliases_value(aliases::text)
    WHERE aliases IS NULL OR jsonb_typeof(aliases) <> 'array';

  ALTER TABLE public.insurer_mapping_rules
    DROP CONSTRAINT IF EXISTS insurer_mapping_rules_aliases_array;

  ALTER TABLE public.insurer_mapping_rules
    ADD CONSTRAINT insurer_mapping_rules_aliases_array
      CHECK (aliases IS NOT NULL AND jsonb_typeof(aliases) = 'array');
END IF;

-- insurer_delinquency_rules aliases -> jsonb array
IF to_regclass('public.insurer_delinquency_rules') IS NOT NULL THEN
  ALTER TABLE public.insurer_delinquency_rules
    ALTER COLUMN aliases TYPE jsonb
    USING public.normalize_aliases_value(aliases::text);

  ALTER TABLE public.insurer_delinquency_rules
    ALTER COLUMN aliases SET DEFAULT '[]'::jsonb;

  UPDATE public.insurer_delinquency_rules
    SET aliases = public.normalize_aliases_value(aliases::text)
    WHERE aliases IS NULL OR jsonb_typeof(aliases) <> 'array';

  ALTER TABLE public.insurer_delinquency_rules
    DROP CONSTRAINT IF EXISTS insurer_delinquency_rules_aliases_array;

  ALTER TABLE public.insurer_delinquency_rules
    ADD CONSTRAINT insurer_delinquency_rules_aliases_array
      CHECK (aliases IS NOT NULL AND jsonb_typeof(aliases) = 'array');
END IF;

-- Create or align insurer_assa_codes table
DO $$
BEGIN
  IF to_regclass('public.insurer_assa_codes') IS NULL THEN
    CREATE TABLE public.insurer_assa_codes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      insurer_id uuid NOT NULL REFERENCES public.insurers(id) ON DELETE CASCADE,
      code text NOT NULL,
      broker_id uuid REFERENCES public.brokers(id) ON DELETE SET NULL,
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
      code_norm text GENERATED ALWAYS AS (upper(btrim(code))) STORED,
      CONSTRAINT insurer_assa_codes_code_format CHECK (code_norm ~ '^PJ750-[1-9][0-9]*$')
    );
  ELSE
    -- Ensure mandatory columns exist with correct definitions
    ALTER TABLE public.insurer_assa_codes
      ALTER COLUMN code TYPE text,
      ALTER COLUMN code SET NOT NULL;

    ALTER TABLE public.insurer_assa_codes
      ALTER COLUMN insurer_id SET NOT NULL;

    ALTER TABLE public.insurer_assa_codes
      ALTER COLUMN active SET DEFAULT true;

    ALTER TABLE public.insurer_assa_codes
      ALTER COLUMN created_at SET DEFAULT timezone('utc', now());

    -- Ensure foreign keys are in place
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints tc
      WHERE tc.table_schema = 'public'
        AND tc.table_name = 'insurer_assa_codes'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND tc.constraint_name = 'insurer_assa_codes_insurer_id_fkey'
    ) THEN
      ALTER TABLE public.insurer_assa_codes
        ADD CONSTRAINT insurer_assa_codes_insurer_id_fkey
          FOREIGN KEY (insurer_id) REFERENCES public.insurers(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints tc
      WHERE tc.table_schema = 'public'
        AND tc.table_name = 'insurer_assa_codes'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND tc.constraint_name = 'insurer_assa_codes_broker_id_fkey'
    ) THEN
      ALTER TABLE public.insurer_assa_codes
        ADD CONSTRAINT insurer_assa_codes_broker_id_fkey
          FOREIGN KEY (broker_id) REFERENCES public.brokers(id) ON DELETE SET NULL;
    END IF;

    -- Ensure code_norm exists as generated column
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'insurer_assa_codes'
        AND column_name = 'code_norm'
    ) THEN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'insurer_assa_codes'
          AND column_name = 'code_norm'
          AND (is_generated IS NULL OR is_generated = 'NEVER')
      ) THEN
        ALTER TABLE public.insurer_assa_codes
          DROP COLUMN code_norm;
        ALTER TABLE public.insurer_assa_codes
          ADD COLUMN code_norm text GENERATED ALWAYS AS (upper(btrim(code))) STORED;
      END IF;
    ELSE
      ALTER TABLE public.insurer_assa_codes
        ADD COLUMN code_norm text GENERATED ALWAYS AS (upper(btrim(code))) STORED;
    END IF;

    -- Ensure code format constraint
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.check_constraints cc
      JOIN information_schema.table_constraints tc
        ON tc.constraint_name = cc.constraint_name
       AND tc.constraint_schema = cc.constraint_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name = 'insurer_assa_codes'
        AND tc.constraint_name = 'insurer_assa_codes_code_format'
    ) THEN
      ALTER TABLE public.insurer_assa_codes
        ADD CONSTRAINT insurer_assa_codes_code_format CHECK (code_norm ~ '^PJ750-[1-9][0-9]*$');
    END IF;
  END IF;

  -- Unique constraint to avoid duplicates
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'insurer_assa_codes'
      AND tc.constraint_type = 'UNIQUE'
      AND tc.constraint_name = 'insurer_assa_codes_insurer_code_norm_key'
  ) THEN
    ALTER TABLE public.insurer_assa_codes
      ADD CONSTRAINT insurer_assa_codes_insurer_code_norm_key UNIQUE (insurer_id, code_norm);
  END IF;
END;
$$;

COMMIT;
