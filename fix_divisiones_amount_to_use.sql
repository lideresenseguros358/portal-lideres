-- FIX: Recalcular amount_to_use en divisiones existentes
-- Fecha: 3 de diciembre, 2025
-- Problema: Las divisiones tienen amount_to_use incorrecto porque se calculaba
--          proporcionalmente al amount_to_use del padre en lugar del amount total

-- IMPORTANTE: Hacer backup antes de ejecutar
-- SELECT * FROM payment_references WHERE payment_id IN (
--   SELECT id FROM pending_payments WHERE notes::jsonb ? 'batch_id'
-- );

-- Paso 1: Identificar divisiones con problema
-- Las divisiones tienen batch_id en notes
WITH divisiones AS (
  SELECT 
    pp.id as payment_id,
    pp.client_name,
    pp.amount_to_pay,
    pp.notes::jsonb->>'batch_id' as batch_id,
    (pp.notes::jsonb->>'division_index')::int as division_index,
    (pp.notes::jsonb->>'total_divisions')::int as total_divisions
  FROM pending_payments pp
  WHERE pp.status = 'pending'
    AND pp.notes IS NOT NULL
    AND pp.notes::jsonb ? 'batch_id'
),

-- Paso 2: Para cada batch, calcular el total
batch_totals AS (
  SELECT 
    batch_id,
    SUM(amount_to_pay) as total_batch_amount,
    COUNT(*) as division_count
  FROM divisiones
  GROUP BY batch_id
),

-- Paso 3: Calcular proporción de cada división
division_proportions AS (
  SELECT 
    d.payment_id,
    d.client_name,
    d.amount_to_pay,
    d.batch_id,
    d.division_index,
    bt.total_batch_amount,
    d.amount_to_pay / bt.total_batch_amount as proportion
  FROM divisiones d
  JOIN batch_totals bt ON d.batch_id = bt.batch_id
),

-- Paso 4: Para cada payment_reference de divisiones, recalcular amount_to_use
reference_fixes AS (
  SELECT 
    pr.id as reference_id,
    pr.payment_id,
    pr.reference_number,
    pr.amount as ref_total_amount,
    pr.amount_to_use as current_amount_to_use,
    dp.proportion,
    ROUND((pr.amount * dp.proportion)::numeric, 2) as new_amount_to_use,
    dp.client_name,
    dp.amount_to_pay as division_amount
  FROM payment_references pr
  JOIN division_proportions dp ON pr.payment_id = dp.payment_id
)

-- Ver los cambios que se harían
SELECT 
  client_name,
  reference_number,
  division_amount,
  ref_total_amount,
  proportion,
  current_amount_to_use as actual_incorrecto,
  new_amount_to_use as deberia_ser,
  new_amount_to_use - current_amount_to_use as diferencia
FROM reference_fixes
ORDER BY reference_number, division_amount DESC;

-- Paso 5: APLICAR LA CORRECCIÓN (descomentar para ejecutar)
-- IMPORTANTE: Verificar primero los resultados del SELECT arriba
/*
WITH divisiones AS (
  SELECT 
    pp.id as payment_id,
    pp.client_name,
    pp.amount_to_pay,
    pp.notes::jsonb->>'batch_id' as batch_id,
    (pp.notes::jsonb->>'division_index')::int as division_index,
    (pp.notes::jsonb->>'total_divisions')::int as total_divisions
  FROM pending_payments pp
  WHERE pp.status = 'pending'
    AND pp.notes IS NOT NULL
    AND pp.notes::jsonb ? 'batch_id'
),

batch_totals AS (
  SELECT 
    batch_id,
    SUM(amount_to_pay) as total_batch_amount,
    COUNT(*) as division_count
  FROM divisiones
  GROUP BY batch_id
),

division_proportions AS (
  SELECT 
    d.payment_id,
    d.client_name,
    d.amount_to_pay,
    d.batch_id,
    d.division_index,
    bt.total_batch_amount,
    d.amount_to_pay / bt.total_batch_amount as proportion
  FROM divisiones d
  JOIN batch_totals bt ON d.batch_id = bt.batch_id
),

reference_fixes AS (
  SELECT 
    pr.id as reference_id,
    pr.payment_id,
    pr.reference_number,
    pr.amount as ref_total_amount,
    pr.amount_to_use as current_amount_to_use,
    dp.proportion,
    ROUND((pr.amount * dp.proportion)::numeric, 2) as new_amount_to_use,
    dp.client_name,
    dp.amount_to_pay as division_amount
  FROM payment_references pr
  JOIN division_proportions dp ON pr.payment_id = dp.payment_id
)

UPDATE payment_references pr
SET amount_to_use = rf.new_amount_to_use
FROM reference_fixes rf
WHERE pr.id = rf.reference_id
  AND pr.amount_to_use != rf.new_amount_to_use;

-- Ver cuántos se actualizaron
SELECT COUNT(*) as registros_actualizados FROM reference_fixes 
WHERE current_amount_to_use != new_amount_to_use;
*/

-- VERIFICACIÓN POST-FIX (ejecutar después de aplicar la corrección)
-- Verificar que las sumas cuadren
/*
WITH divisiones AS (
  SELECT 
    pp.id as payment_id,
    pp.client_name,
    pp.amount_to_pay,
    pp.notes::jsonb->>'batch_id' as batch_id
  FROM pending_payments pp
  WHERE pp.status = 'pending'
    AND pp.notes IS NOT NULL
    AND pp.notes::jsonb ? 'batch_id'
),

division_ref_sums AS (
  SELECT 
    d.batch_id,
    pr.reference_number,
    SUM(pr.amount_to_use) as total_amount_to_use,
    MAX(pr.amount) as ref_amount
  FROM divisiones d
  JOIN payment_references pr ON pr.payment_id = d.payment_id
  GROUP BY d.batch_id, pr.reference_number
)

SELECT 
  batch_id,
  reference_number,
  ref_amount as monto_total_transferencia,
  total_amount_to_use as suma_divisiones,
  ref_amount - total_amount_to_use as diferencia,
  CASE 
    WHEN ABS(ref_amount - total_amount_to_use) < 0.02 THEN '✅ OK'
    ELSE '❌ ERROR'
  END as status
FROM division_ref_sums
ORDER BY batch_id, reference_number;
*/
