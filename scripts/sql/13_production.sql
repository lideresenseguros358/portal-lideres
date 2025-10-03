-- Step 13: production matrix table

CREATE TABLE IF NOT EXISTS public.production (
  id bigserial PRIMARY KEY,
  year int NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  broker_id uuid NOT NULL REFERENCES public.brokers(id) ON DELETE CASCADE,
  bruto numeric(14,2) NOT NULL DEFAULT 0,
  cancelaciones numeric(14,2) NOT NULL DEFAULT 0,
  pma_neto numeric(14,2) GENERATED ALWAYS AS (bruto - cancelaciones) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, month, broker_id)
);
