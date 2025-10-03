-- Step 10: cases, files, and checklist for pending items workflow

CREATE TABLE IF NOT EXISTS public.cases (
  id bigserial PRIMARY KEY,
  canal text,
  section public.case_section NOT NULL DEFAULT 'SIN_CLASIFICAR',
  ctype text,
  status public.case_status NOT NULL DEFAULT 'PENDIENTE_REVISION',
  broker_id uuid REFERENCES public.brokers(id),
  created_by uuid REFERENCES public.profiles(id),
  client_id bigint REFERENCES public.clients(id),
  policy_number text,
  insurer_id bigint REFERENCES public.insurers(id),
  ticket_ref text,
  seen_by_broker boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.case_files (
  id bigserial PRIMARY KEY,
  case_id bigint NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.case_checklist (
  id bigserial PRIMARY KEY,
  case_id bigint NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  item text NOT NULL,
  done boolean NOT NULL DEFAULT false
);
