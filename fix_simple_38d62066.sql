-- FIX SIMPLE Y DIRECTO
-- payment_id: 38d62066-608b-4313-b7eb-a51cb0e8e02c

-- 1. VER QUÉ TIENE AHORA
SELECT 
  pr.reference_number,
  pr.amount as amount_actual,
  pr.amount_to_use,
  bt.amount as amount_debe_ser
FROM payment_references pr
LEFT JOIN bank_transfers bt ON bt.reference_number = pr.reference_number
WHERE pr.payment_id = '38d62066-608b-4313-b7eb-a51cb0e8e02c';

-- 2. CORREGIR (si amount_actual no es 138)
UPDATE payment_references pr
SET amount = bt.amount
FROM bank_transfers bt
WHERE pr.reference_number = bt.reference_number
  AND pr.payment_id = '38d62066-608b-4313-b7eb-a51cb0e8e02c';

-- 3. VERIFICAR
SELECT 
  pr.reference_number,
  pr.amount as debe_ser_138,
  pr.amount_to_use as debe_ser_27_30
FROM payment_references pr
WHERE pr.payment_id = '38d62066-608b-4313-b7eb-a51cb0e8e02c';
