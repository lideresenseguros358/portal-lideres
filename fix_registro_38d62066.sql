-- FIX ESPECÍFICO: payment_id 38d62066-608b-4313-b7eb-a51cb0e8e02c
-- amount_to_use debe ser 27.30

-- VER ESTADO ACTUAL
SELECT 
  pr.id as reference_id,
  pr.payment_id,
  pp.client_name,
  pp.amount_to_pay as division_amount,
  pr.reference_number,
  pr.amount as ref_total,
  pr.amount_to_use as actual_incorrecto
FROM payment_references pr
JOIN pending_payments pp ON pp.id = pr.payment_id
WHERE pr.payment_id = '38d62066-608b-4313-b7eb-a51cb0e8e02c';

-- APLICAR CORRECCIÓN
UPDATE payment_references
SET amount_to_use = 27.30
WHERE payment_id = '38d62066-608b-4313-b7eb-a51cb0e8e02c';

-- VERIFICAR DESPUÉS
SELECT 
  pr.id as reference_id,
  pr.payment_id,
  pp.client_name,
  pp.amount_to_pay as division_amount,
  pr.reference_number,
  pr.amount as ref_total,
  pr.amount_to_use as corregido
FROM payment_references pr
JOIN pending_payments pp ON pp.id = pr.payment_id
WHERE pr.payment_id = '38d62066-608b-4313-b7eb-a51cb0e8e02c';
