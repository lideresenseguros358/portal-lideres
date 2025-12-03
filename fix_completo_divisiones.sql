-- FIX COMPLETO: Todas las divisiones
-- Asegurar que amount = monto de la transferencia (igual para todas las divisiones del batch)
-- Asegurar que amount_to_use = monto de la división (diferente para cada división)

-- PASO 1: VER PROBLEMA
-- Para cada batch, mostrar qué está mal
WITH batch_info AS (
  SELECT 
    pp.notes::jsonb->>'batch_id' as batch_id,
    pr.reference_number,
    -- El amount debe ser IGUAL para todas las divisiones del mismo batch
    MIN(pr.amount) as min_amount,
    MAX(pr.amount) as max_amount,
    -- Obtener el amount correcto desde bank_transfers
    bt.amount as amount_correcto_desde_banco
  FROM pending_payments pp
  JOIN payment_references pr ON pr.payment_id = pp.id
  LEFT JOIN bank_transfers bt ON bt.reference_number = pr.reference_number
  WHERE pp.status = 'pending'
    AND pp.notes IS NOT NULL
    AND pp.notes::jsonb ? 'batch_id'
  GROUP BY pp.notes::jsonb->>'batch_id', pr.reference_number, bt.amount
)
SELECT 
  batch_id,
  reference_number,
  min_amount,
  max_amount,
  amount_correcto_desde_banco,
  CASE 
    WHEN min_amount != max_amount THEN '❌ INCONSISTENTE - diferentes amounts en mismo batch'
    WHEN min_amount != amount_correcto_desde_banco THEN '❌ INCORRECTO - no coincide con banco'
    ELSE '✅ OK'
  END as status
FROM batch_info
ORDER BY batch_id, reference_number;

-- PASO 2: VER DETALLE DE CADA DIVISIÓN
SELECT 
  pp.id as payment_id,
  pp.client_name,
  pp.amount_to_pay as monto_division,
  pp.notes::jsonb->>'batch_id' as batch_id,
  pr.reference_number,
  pr.amount as amount_actual,
  bt.amount as amount_debe_ser,
  pr.amount_to_use as amount_to_use_actual,
  pp.amount_to_pay as amount_to_use_debe_ser,
  CASE 
    WHEN pr.amount != bt.amount THEN '❌ amount incorrecto'
    ELSE '✅ amount OK'
  END as status_amount,
  CASE 
    WHEN ABS(pr.amount_to_use - pp.amount_to_pay) > 0.01 THEN '❌ amount_to_use incorrecto'
    ELSE '✅ amount_to_use OK'
  END as status_amount_to_use
FROM pending_payments pp
JOIN payment_references pr ON pr.payment_id = pp.id
LEFT JOIN bank_transfers bt ON bt.reference_number = pr.reference_number
WHERE pp.status = 'pending'
  AND pp.notes IS NOT NULL
  AND pp.notes::jsonb ? 'batch_id'
ORDER BY pp.notes::jsonb->>'batch_id', pp.amount_to_pay DESC;

-- PASO 3: CORREGIR amount (debe ser igual al monto de la transferencia)
UPDATE payment_references pr
SET amount = bt.amount
FROM pending_payments pp
JOIN bank_transfers bt ON bt.reference_number = pr.reference_number
WHERE pr.payment_id = pp.id
  AND pp.status = 'pending'
  AND pp.notes IS NOT NULL
  AND pp.notes::jsonb ? 'batch_id'
  AND pr.amount != bt.amount;

-- PASO 4: CORREGIR amount_to_use (debe ser igual al monto de la división)
UPDATE payment_references pr
SET amount_to_use = pp.amount_to_pay
FROM pending_payments pp
WHERE pr.payment_id = pp.id
  AND pp.status = 'pending'
  AND pp.notes IS NOT NULL
  AND pp.notes::jsonb ? 'batch_id'
  AND ABS(pr.amount_to_use - pp.amount_to_pay) > 0.01;

-- PASO 5: VERIFICAR DESPUÉS
SELECT 
  pp.id as payment_id,
  pp.client_name,
  pp.amount_to_pay as monto_division,
  pr.reference_number,
  pr.amount as amount_transferencia,
  pr.amount_to_use as amount_division,
  CASE 
    WHEN pr.amount = bt.amount AND ABS(pr.amount_to_use - pp.amount_to_pay) < 0.01 THEN '✅ TODO OK'
    ELSE '❌ AÚN HAY PROBLEMA'
  END as status
FROM pending_payments pp
JOIN payment_references pr ON pr.payment_id = pp.id
LEFT JOIN bank_transfers bt ON bt.reference_number = pr.reference_number
WHERE pp.status = 'pending'
  AND pp.notes IS NOT NULL
  AND pp.notes::jsonb ? 'batch_id'
ORDER BY pp.notes::jsonb->>'batch_id', pp.amount_to_pay DESC;
