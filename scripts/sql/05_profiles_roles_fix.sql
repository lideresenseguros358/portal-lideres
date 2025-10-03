-- Step 5 (patch): normalize profiles schema and role enum (híbrido Biblia)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS demo_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

DO $$
DECLARE
  col_type text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'role';

  IF col_type IS DISTINCT FROM 'USER-DEFINED' THEN
    UPDATE public.profiles
    SET role = CASE
      WHEN role IS NULL OR trim(role::text) = '' THEN 'broker'
      WHEN LOWER(role::text) = 'master' THEN 'master'
      WHEN LOWER(role::text) = 'broker' THEN 'broker'
      ELSE 'broker'
    END;
  END IF;

  ALTER TABLE public.profiles
    ALTER COLUMN role TYPE public.role_enum
    USING CASE
      WHEN role IS NULL OR trim(role::text) = '' THEN 'broker'::public.role_enum
      WHEN LOWER(role::text) = 'master' THEN 'master'::public.role_enum
      WHEN LOWER(role::text) = 'broker' THEN 'broker'::public.role_enum
      ELSE 'broker'::public.role_enum
    END;

  UPDATE public.profiles
  SET role = 'broker'::public.role_enum
  WHERE role IS NULL;

  ALTER TABLE public.profiles
    ALTER COLUMN role SET DEFAULT 'broker'::public.role_enum;
END $$;
