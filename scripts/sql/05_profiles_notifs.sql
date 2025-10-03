-- Step 5: profiles, notifications, and related RLS policies

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  email text,
  full_name text,
  role public.user_role DEFAULT 'BROKER',
  avatar_url text,
  demo_enabled boolean DEFAULT false,
  must_change_password boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Perfil UI enlazado a auth.users';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS role public.user_role,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS demo_enabled boolean,
  ADD COLUMN IF NOT EXISTS must_change_password boolean,
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

UPDATE public.profiles
SET role = 'BROKER'
WHERE role IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles
      ALTER COLUMN role TYPE public.user_role
      USING CASE
        WHEN role::text IN ('MASTER', 'BROKER') THEN role::text::public.user_role
        ELSE 'BROKER'::public.user_role
      END;
    ALTER TABLE public.profiles
      ALTER COLUMN role SET DEFAULT 'BROKER';
    ALTER TABLE public.profiles
      ALTER COLUMN role SET NOT NULL;
  END IF;
END $$;

ALTER TABLE public.profiles
  ALTER COLUMN email SET NOT NULL;

ALTER TABLE public.profiles
  ALTER COLUMN demo_enabled SET DEFAULT false;

ALTER TABLE public.profiles
  ALTER COLUMN demo_enabled SET NOT NULL;

ALTER TABLE public.profiles
  ALTER COLUMN must_change_password SET DEFAULT false;

ALTER TABLE public.profiles
  ALTER COLUMN must_change_password SET NOT NULL;

ALTER TABLE public.profiles
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.profiles
  ALTER COLUMN created_at SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.notifications (
  id bigserial PRIMARY KEY,
  title text NOT NULL,
  body text,
  audience public.event_audience NOT NULL DEFAULT 'ALL',
  target_broker_ids uuid[] DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_reads (
  id bigserial PRIMARY KEY,
  notification_id bigint NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_id, profile_id)
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_self ON public.profiles;
CREATE POLICY profiles_self
  ON public.profiles
  FOR SELECT
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'MASTER'
    )
  );

DROP POLICY IF EXISTS notif_read ON public.notifications;
CREATE POLICY notif_read
  ON public.notifications
  FOR SELECT
  USING (
    audience = 'ALL'
    OR (
      audience = 'SELECTED'
      AND target_broker_ids IS NOT NULL
      AND auth.uid() = ANY(target_broker_ids)
    )
  );

DROP POLICY IF EXISTS notif_reads_self ON public.notification_reads;
CREATE POLICY notif_reads_self
  ON public.notification_reads
  FOR SELECT
  USING (profile_id = auth.uid());
