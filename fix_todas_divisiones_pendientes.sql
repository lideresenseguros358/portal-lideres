-- FIX: TODAS las divisiones pendientes con amount_to_use incorrecto
-- Fecha: 3 de diciembre, 2025

-- PASO 1: IDENTIFICAR TODAS LAS DIVISIONES PROBLEMÁTICAS
-- Las divisiones tienen batch_id en notes y el amount_to_use no coincide con el amount_to_pay
SELECT 
  pr.id as reference_id,
  pr.payment_id,
  pp.client_name,
  pp.amount_to_pay as division_amount,
  pp.notes::jsonb->>'batch_id' as batch_id,
  pr.reference_number,
  pr.amount as ref_total,
  pr.amount_to_use as actual,
  pp.amount_to_pay as deberia_ser,
  pp.amount_to_pay - pr.amount_to_use as diferencia
FROM payment_references pr
JOIN pending_payments pp ON pp.id = pr.payment_id
WHERE pp.status = 'pending'
  AND pp.notes IS NOT NULL
  AND pp.notes::jsonb ? 'batch_id'
  AND ABS(pr.amount_to_use - pp.amount_to_pay) > 0.01 -- Tolerancia de 1 centavo
ORDER BY pp.notes::jsonb->>'batch_id', pp.amount_to_pay DESC;

-- PASO 2: APLICAR CORRECCIÓN
-- Para divisiones, amount_to_use debe ser igual a amount_to_pay de la división
UPDATE payment_references pr
SET amount_to_use = pp.amount_to_pay
FROM pending_payments pp
WHERE pr.payment_id = pp.id
  AND pp.status = 'pending'
  AND pp.notes IS NOT NULL
  AND pp.notes::jsonb ? 'batch_id'
  AND ABS(pr.amount_to_use - pp.amount_to_pay) > 0.01;

-- PASO 3: VERIFICAR CORRECCIÓN
SELECT 
  pr.payment_id,
  pp.client_name,
  pp.amount_to_pay as division_amount,
  pr.reference_number,
  pr.amount as ref_total,
  pr.amount_to_use as corregido,
  CASE 
    WHEN ABS(pr.amount_to_use - pp.amount_to_pay) < 0.01 THEN '✅ OK'
    ELSE '❌ ERROR'
  END as status
FROM payment_references pr
JOIN pending_payments pp ON pp.id = pr.payment_id
WHERE pp.status = 'pending'
  AND pp.notes IS NOT NULL
  AND pp.notes::jsonb ? 'batch_id'
ORDER BY pp.notes::jsonb->>'batch_id', pp.amount_to_pay DESC;

-- PASO 4: VERIFICAR QUE LAS SUMAS CUADREN POR BATCH
-- La suma de amount_to_use de todas las divisiones de un batch debe igualar la suma de amount_to_pay
WITH batch_sums AS (
  SELECT 
    pp.notes::jsonb->>'batch_id' as batch_id,
    pr.reference_number,
    MAX(pr.amount) as ref_total,
    SUM(pr.amount_to_use) as suma_amount_to_use,
    SUM(pp.amount_to_pay) as suma_divisiones
  FROM payment_references pr
  JOIN pending_payments pp ON pp.id = pr.payment_id
  WHERE pp.status = 'pending'
    AND pp.notes IS NOT NULL
    AND pp.notes::jsonb ? 'batch_id'
  GROUP BY pp.notes::jsonb->>'batch_id', pr.reference_number
)
SELECT 
  batch_id,
  reference_number,
  ref_total,
  suma_amount_to_use,
  suma_divisiones,
  suma_divisiones - suma_amount_to_use as diferencia,
  CASE 
    WHEN ABS(suma_amount_to_use - suma_divisiones) < 0.02 THEN '✅ OK'
    ELSE '❌ NO CUADRA'
  END as status
FROM batch_sums
ORDER BY batch_id, reference_number;
