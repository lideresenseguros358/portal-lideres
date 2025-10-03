-- Step 8: commissions imports, items, fortnights, and advances

CREATE TABLE IF NOT EXISTS public.comm_imports (
  id bigserial PRIMARY KEY,
  insurer_id bigint NOT NULL REFERENCES public.insurers(id) ON DELETE CASCADE,
  period_label text NOT NULL,
  uploaded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.comm_items (
  id bigserial PRIMARY KEY,
  import_id bigint NOT NULL REFERENCES public.comm_imports(id) ON DELETE CASCADE,
  policy_number text,
  insured_name text,
  gross_amount numeric(12,2) NOT NULL DEFAULT 0,
  insurer_id bigint REFERENCES public.insurers(id),
  broker_id uuid REFERENCES public.brokers(id),
  raw_row jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fortnights (
  id bigserial PRIMARY KEY,
  label text NOT NULL,
  opened_by uuid REFERENCES public.profiles(id),
  closed_by uuid REFERENCES public.profiles(id),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.fortnight_broker_totals (
  id bigserial PRIMARY KEY,
  fortnight_id bigint NOT NULL REFERENCES public.fortnights(id) ON DELETE CASCADE,
  broker_id uuid NOT NULL REFERENCES public.brokers(id) ON DELETE CASCADE,
  gross_amount numeric(12,2) NOT NULL DEFAULT 0,
  discounts numeric(12,2) NOT NULL DEFAULT 0,
  advances numeric(12,2) NOT NULL DEFAULT 0,
  net_amount numeric(12,2) NOT NULL DEFAULT 0,
  UNIQUE (fortnight_id, broker_id)
);

CREATE TABLE IF NOT EXISTS public.advances (
  id bigserial PRIMARY KEY,
  broker_id uuid NOT NULL REFERENCES public.brokers(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
