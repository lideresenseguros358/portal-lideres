-- Add EMISION_FALLIDA status for payments where PF charged but insurer emission failed.
-- These payments need manual attention: either emit manually or refund the client.

ALTER TABLE adm_cot_payments DROP CONSTRAINT IF EXISTS adm_cot_payments_status_check;
ALTER TABLE adm_cot_payments ADD CONSTRAINT adm_cot_payments_status_check 
  CHECK (status IN (
    'PENDIENTE', 
    'PENDIENTE_CONFIRMACION', 
    'CONFIRMADO_PF', 
    'EMISION_FALLIDA',
    'PAGADO', 
    'AGRUPADO', 
    'RECHAZADO_PF', 
    'CANCELADO', 
    'REEMBOLSO'
  ));

-- Add emission_error column for storing error details
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'adm_cot_payments' AND column_name = 'emission_error') THEN
    ALTER TABLE adm_cot_payments ADD COLUMN emission_error TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'adm_cot_payments' AND column_name = 'ops_case_id') THEN
    ALTER TABLE adm_cot_payments ADD COLUMN ops_case_id UUID;
  END IF;
END $$;
