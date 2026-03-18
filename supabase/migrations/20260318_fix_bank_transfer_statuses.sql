-- Expand bank transfer status constraint to include PARTIAL and EXHAUSTED
-- OPEN → new transfer with full balance
-- PARTIAL → some balance used but remaining > 0
-- EXHAUSTED → all balance used (remaining ≤ 0)
-- CLOSED → manually closed or legacy

ALTER TABLE adm_cot_bank_transfers DROP CONSTRAINT IF EXISTS adm_cot_bank_transfers_status_check;
ALTER TABLE adm_cot_bank_transfers ADD CONSTRAINT adm_cot_bank_transfers_status_check
  CHECK (status IN ('OPEN', 'PARTIAL', 'EXHAUSTED', 'CLOSED'));
