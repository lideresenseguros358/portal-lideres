-- Add RECHAZADO_PF and other statuses to adm_cot_payments status check constraint
-- Required for webhook + cron reconciliation auto-rejection feature

ALTER TABLE adm_cot_payments DROP CONSTRAINT IF EXISTS adm_cot_payments_status_check;
ALTER TABLE adm_cot_payments ADD CONSTRAINT adm_cot_payments_status_check 
  CHECK (status IN (
    'PENDIENTE', 
    'PENDIENTE_CONFIRMACION', 
    'CONFIRMADO_PF', 
    'PAGADO', 
    'AGRUPADO', 
    'RECHAZADO_PF', 
    'CANCELADO', 
    'REEMBOLSO'
  ));
