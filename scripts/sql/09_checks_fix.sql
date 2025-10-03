-- Step 9 patch: ensure check_items has required columns and indexes (híbrido)

ALTER TABLE public.check_items
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS is_refund boolean,
  ADD COLUMN IF NOT EXISTS bank_json jsonb;

UPDATE public.check_items
SET is_refund = COALESCE(is_refund, false);

UPDATE public.check_items
SET status = COALESCE(status, 'PENDIENTE');

ALTER TABLE public.check_items
  ALTER COLUMN is_refund SET NOT NULL,
  ALTER COLUMN is_refund SET DEFAULT false,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'PENDIENTE';

CREATE INDEX IF NOT EXISTS idx_check_items_reference ON public.check_items(reference);
CREATE INDEX IF NOT EXISTS idx_check_items_broker ON public.check_items(broker_id);
