-- Step 9: checks batches and items tables

CREATE TABLE IF NOT EXISTS public.check_batches (
  id bigserial PRIMARY KEY,
  title text NOT NULL,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.check_items (
  id bigserial PRIMARY KEY,
  batch_id bigint REFERENCES public.check_batches(id) ON DELETE SET NULL,
  broker_id uuid REFERENCES public.brokers(id) ON DELETE SET NULL,
  client_name text,
  policy_number text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  is_refund boolean NOT NULL DEFAULT false,
  bank_json jsonb,
  status text NOT NULL DEFAULT 'PENDIENTE',
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_check_items_reference ON public.check_items(reference);
