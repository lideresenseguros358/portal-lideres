-- FIX INMEDIATO: División de OSCAR BOSQUEZ
-- Esta división específica tiene amount_to_use incorrecto

-- Ver estado actual
SELECT 
  pp.id as payment_id,
  pp.client_name,
  pp.amount_to_pay as division_amount,
  pr.reference_number,
  pr.amount as ref_total,
  pr.amount_to_use as actual_incorrecto,
  -- Calcular el correcto:
  -- Total transferencia: 138
  -- Total divisiones: 137.89 (110.59 + 27.30)
  -- Proporción: 27.30 / 137.89 = 0.198
  -- Correcto: 138 × 0.198 = 27.32
  ROUND((pr.amount * (pp.amount_to_pay / 137.89))::numeric, 2) as deberia_ser
FROM pending_payments pp
JOIN payment_references pr ON pr.payment_id = pp.id
WHERE pp.client_name = 'OSCAR BOSQUEZ'
  AND pp.status = 'pending'
  AND pp.amount_to_pay = 27.3
ORDER BY pr.reference_number;

-- APLICAR FIX (descomentar para ejecutar)
/*
UPDATE payment_references pr
SET amount_to_use = ROUND((pr.amount * (pp.amount_to_pay / 137.89))::numeric, 2)
FROM pending_payments pp
WHERE pr.payment_id = pp.id
  AND pp.client_name = 'OSCAR BOSQUEZ'
  AND pp.status = 'pending'
  AND pp.amount_to_pay = 27.3;

-- Verificar después
SELECT 
  pp.client_name,
  pp.amount_to_pay,
  pr.reference_number,
  pr.amount as ref_total,
  pr.amount_to_use as amount_to_use_actualizado
FROM pending_payments pp
JOIN payment_references pr ON pr.payment_id = pp.id
WHERE pp.client_name = 'OSCAR BOSQUEZ'
  AND pp.status = 'pending';
*/

-- VERIFICAR TODAS LAS DIVISIONES DEL MISMO BATCH
SELECT 
  pp.id,
  pp.client_name,
  pp.amount_to_pay,
  pp.notes::jsonb->>'batch_id' as batch_id,
  pr.reference_number,
  pr.amount as ref_total,
  pr.amount_to_use
FROM pending_payments pp
JOIN payment_references pr ON pr.payment_id = pp.id
WHERE pp.notes::jsonb->>'batch_id' IN (
  SELECT notes::jsonb->>'batch_id'
  FROM pending_payments
  WHERE client_name = 'OSCAR BOSQUEZ'
    AND amount_to_pay = 27.3
    AND status = 'pending'
)
ORDER BY pp.amount_to_pay DESC, pr.reference_number;
