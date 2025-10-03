-- Step 6: brokers, insurers, mappings, and ASSA codes

CREATE TABLE IF NOT EXISTS public.brokers (
  id uuid PRIMARY KEY,
  p_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL,
  phone text,
  active boolean NOT NULL DEFAULT true,
  default_percent numeric(5,2) NOT NULL DEFAULT 1.00,
  bank_name text,
  bank_account text,
  bank_type text,
  assa_code text,
  license_no text,
  role public.user_role NOT NULL DEFAULT 'BROKER',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brokers
  ADD COLUMN IF NOT EXISTS p_id uuid,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS active boolean,
  ADD COLUMN IF NOT EXISTS default_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS bank_type text,
  ADD COLUMN IF NOT EXISTS assa_code text,
  ADD COLUMN IF NOT EXISTS license_no text,
  ADD COLUMN IF NOT EXISTS role public.user_role,
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'brokers'
      AND column_name = 'percent_default'
  ) THEN
    ALTER TABLE public.brokers RENAME COLUMN percent_default TO default_percent;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'brokers'
      AND column_name = 'bank_account_no'
  ) THEN
    ALTER TABLE public.brokers RENAME COLUMN bank_account_no TO bank_account;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'brokers'
      AND column_name = 'bank_id'
  ) THEN
    ALTER TABLE public.brokers RENAME COLUMN bank_id TO bank_name;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'brokers'
      AND column_name = 'p_id'
  ) THEN
    ALTER TABLE public.brokers
      ALTER COLUMN p_id TYPE uuid,
      ALTER COLUMN p_id SET NOT NULL;
  END IF;
END $$;

UPDATE public.brokers b
SET role = p.role
FROM public.profiles p
WHERE b.p_id = p.id
  AND p.role IS NOT NULL
  AND b.role IS DISTINCT FROM p.role;

ALTER TABLE public.brokers
  ALTER COLUMN active SET DEFAULT true,
  ALTER COLUMN active SET NOT NULL,
  ALTER COLUMN default_percent SET DEFAULT 1.00,
  ALTER COLUMN default_percent SET NOT NULL,
  ALTER COLUMN role SET DEFAULT 'BROKER',
  ALTER COLUMN role SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'brokers'
      AND constraint_name = 'brokers_profiles_fkey'
  ) THEN
    ALTER TABLE public.brokers
      ADD CONSTRAINT brokers_profiles_fkey
        FOREIGN KEY (p_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'brokers'
      AND constraint_name = 'brokers_default_percent_check'
  ) THEN
    ALTER TABLE public.brokers
      ADD CONSTRAINT brokers_default_percent_check
        CHECK (default_percent IN (0.50, 0.60, 0.70, 0.80, 0.82, 0.94, 1.00));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS brokers_email_lower_key ON public.brokers (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS brokers_profile_unique ON public.brokers (p_id);

CREATE TABLE IF NOT EXISTS public.insurers (
  id bigserial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.insurer_mappings (
  id bigserial PRIMARY KEY,
  insurer_id bigint NOT NULL REFERENCES public.insurers(id) ON DELETE CASCADE,
  map_kind public.map_kind NOT NULL,
  standard_key text NOT NULL,
  aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
  options jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insurer_mappings_kind
  ON public.insurer_mappings (insurer_id, map_kind);

CREATE TABLE IF NOT EXISTS public.insurer_assa_codes (
  id bigserial PRIMARY KEY,
  insurer_id bigint NOT NULL REFERENCES public.insurers(id) ON DELETE CASCADE,
  code text NOT NULL,
  code_norm text GENERATED ALWAYS AS (regexp_replace(code, '^0+', '')) STORED,
  broker_id uuid REFERENCES public.brokers(id),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (insurer_id, code)
);

ALTER TABLE public.brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurer_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurer_assa_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS brokers_self
  ON public.brokers
  FOR SELECT
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'MASTER'
    )
  );

CREATE POLICY IF NOT EXISTS insurers_all_read
  ON public.insurers
  FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS mappings_all_read
  ON public.insurer_mappings
  FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS assa_codes_all_read
  ON public.insurer_assa_codes
  FOR SELECT
  USING (true);
