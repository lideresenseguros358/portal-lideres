-- FIX: TODAS las divisiones - SIMPLE

-- 1. VER QUÉ ESTÁ MAL
SELECT 
  pp.client_name,
  pp.amount_to_pay as monto_division,
  pr.reference_number,
  pr.amount as amount_actual,
  bt.amount as amount_debe_ser,
  pr.amount_to_use,
  CASE WHEN pr.amount != bt.amount THEN '❌ MAL' ELSE '✅ OK' END as status
FROM pending_payments pp
JOIN payment_references pr ON pr.payment_id = pp.id
LEFT JOIN bank_transfers bt ON bt.reference_number = pr.reference_number
WHERE pp.notes::jsonb ? 'batch_id'
  AND pp.status = 'pending'
ORDER BY pr.reference_number, pp.amount_to_pay DESC;

-- 2. CORREGIR amount (debe ser el monto de la transferencia)
UPDATE payment_references pr
SET amount = bt.amount
FROM bank_transfers bt
WHERE pr.reference_number = bt.reference_number
  AND pr.payment_id IN (
    SELECT id FROM pending_payments 
    WHERE notes::jsonb ? 'batch_id' 
      AND status = 'pending'
  )
  AND pr.amount != bt.amount;

-- 3. CORREGIR amount_to_use (debe ser el monto de la división)
UPDATE payment_references pr
SET amount_to_use = pp.amount_to_pay
FROM pending_payments pp
WHERE pr.payment_id = pp.id
  AND pp.notes::jsonb ? 'batch_id'
  AND pp.status = 'pending'
  AND pr.amount_to_use != pp.amount_to_pay;

-- 4. VERIFICAR
SELECT 
  pp.client_name,
  pr.reference_number,
  pr.amount as transferencia,
  pr.amount_to_use as division,
  pp.amount_to_pay as debe_ser,
  CASE 
    WHEN pr.amount_to_use = pp.amount_to_pay THEN '✅ OK'
    ELSE '❌ MAL'
  END as status
FROM pending_payments pp
JOIN payment_references pr ON pr.payment_id = pp.id
WHERE pp.notes::jsonb ? 'batch_id'
  AND pp.status = 'pending'
ORDER BY pr.reference_number, pp.amount_to_pay DESC;
