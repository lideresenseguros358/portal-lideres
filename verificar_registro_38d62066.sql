-- VERIFICAR registro 38d62066-608b-4313-b7eb-a51cb0e8e02c
-- Qué valores tiene actualmente

SELECT 
  pr.id as reference_id,
  pr.payment_id,
  pp.client_name,
  pp.amount_to_pay as monto_division,
  pr.reference_number,
  pr.amount as monto_transferencia_debe_ser_138,
  pr.amount_to_use as monto_division_debe_ser_27_30,
  CASE 
    WHEN pr.amount = 138 THEN '✅ Correcto'
    ELSE '❌ INCORRECTO - debería ser 138'
  END as status_amount,
  CASE 
    WHEN ABS(pr.amount_to_use - 27.30) < 0.01 THEN '✅ Correcto'
    ELSE '❌ INCORRECTO - debería ser 27.30'
  END as status_amount_to_use
FROM payment_references pr
JOIN pending_payments pp ON pp.id = pr.payment_id
WHERE pr.payment_id = '38d62066-608b-4313-b7eb-a51cb0e8e02c';

-- Si amount NO es 138, corregirlo:
-- UPDATE payment_references
-- SET amount = 138
-- WHERE payment_id = '38d62066-608b-4313-b7eb-a51cb0e8e02c';

-- Si amount_to_use NO es 27.30, corregirlo:
-- UPDATE payment_references
-- SET amount_to_use = 27.30
-- WHERE payment_id = '38d62066-608b-4313-b7eb-a51cb0e8e02c';

-- Ver todas las divisiones del mismo batch
SELECT 
  pp.id as payment_id,
  pp.client_name,
  pp.amount_to_pay as monto_division,
  pp.notes::jsonb->>'batch_id' as batch_id,
  pr.reference_number,
  pr.amount as monto_transferencia,
  pr.amount_to_use as amount_to_use
FROM pending_payments pp
JOIN payment_references pr ON pr.payment_id = pp.id
WHERE pp.notes::jsonb->>'batch_id' = (
  SELECT notes::jsonb->>'batch_id'
  FROM pending_payments
  WHERE id = '38d62066-608b-4313-b7eb-a51cb0e8e02c'
)
ORDER BY pp.amount_to_pay DESC;
