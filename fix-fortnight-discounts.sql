-- =============================================================================
-- FIX: Quincena a58166d9-c866-4518-a62f-4d1681af4ca4
-- 
-- Problemas a corregir:
-- 1. Se crearon bank_transfers incorrectos con ref DESCUENTO-COMISIONES-*
-- 2. Se crearon pending_payments incorrectos con source=fortnight_discount
-- 3. Los pending_payments ORIGINALES (del wizard) no se habilitaron (can_be_paid sigue false)
-- 4. fortnight_broker_totals no tiene discounts_json con los descuentos reales
-- =============================================================================

-- =============================================
-- PASO 1: DIAGNÓSTICO (solo SELECT, no modifica nada)
-- =============================================

-- 1a. Ver descuentos aplicados en esta quincena
SELECT 
  fd.id,
  fd.broker_id,
  fd.advance_id,
  fd.amount,
  fd.applied,
  a.reason AS advance_reason,
  a.status AS advance_status,
  b.name AS broker_name
FROM fortnight_discounts fd
JOIN advances a ON a.id = fd.advance_id
JOIN brokers b ON b.id = fd.broker_id
WHERE fd.fortnight_id = 'a58166d9-c866-4518-a62f-4d1681af4ca4';

-- 1b. Ver bank_transfers INCORRECTOS que se crearon (a eliminar)
SELECT id, reference_number, amount, transaction_code, description
FROM bank_transfers 
WHERE reference_number LIKE 'DESCUENTO-COMISIONES-A58166D9%';

-- 1c. Ver pending_payments INCORRECTOS que se crearon (a eliminar)
SELECT id, client_name, amount_to_pay, status, can_be_paid, notes
FROM pending_payments 
WHERE notes::text LIKE '%fortnight_discount%'
  AND notes::text LIKE '%a58166d9-c866-4518-a62f-4d1681af4ca4%';

-- 1d. Ver pending_payments ORIGINALES del wizard que deben habilitarse
-- Estos tienen advance_id en notes y can_be_paid=false
SELECT pp.id, pp.client_name, pp.amount_to_pay, pp.can_be_paid, pp.status, pp.notes
FROM pending_payments pp
WHERE pp.status = 'pending'
  AND pp.can_be_paid = false
  AND pp.notes::text LIKE '%advance_id%'
  AND pp.notes::text LIKE '%is_auto_advance%';

-- 1e. Estado actual de fortnight_broker_totals
SELECT 
  fbt.broker_id,
  b.name AS broker_name,
  fbt.gross_amount,
  fbt.net_amount,
  fbt.discounts_json
FROM fortnight_broker_totals fbt
JOIN brokers b ON b.id = fbt.broker_id
WHERE fbt.fortnight_id = 'a58166d9-c866-4518-a62f-4d1681af4ca4'
ORDER BY b.name;

-- =============================================
-- PASO 2: LIMPIAR bank_transfers INCORRECTOS
-- =============================================
DELETE FROM bank_transfers 
WHERE reference_number LIKE 'DESCUENTO-COMISIONES-A58166D9%';

-- =============================================
-- PASO 3: LIMPIAR pending_payments INCORRECTOS (los creados por el bug)
-- Solo eliminar los que tienen source=fortnight_discount (creados por el código incorrecto)
-- NO tocar los originales del wizard (tienen is_auto_advance=true)
-- =============================================
DELETE FROM pending_payments 
WHERE notes::text LIKE '%"source":"fortnight_discount"%'
  AND notes::text LIKE '%a58166d9-c866-4518-a62f-4d1681af4ca4%';

-- =============================================
-- PASO 4: HABILITAR pending_payments ORIGINALES del wizard
-- Buscar los que tienen advance_id que coincida con los adelantos de esta quincena
-- =============================================
WITH paid_advance_ids AS (
  SELECT DISTINCT fd.advance_id
  FROM fortnight_discounts fd
  WHERE fd.fortnight_id = 'a58166d9-c866-4518-a62f-4d1681af4ca4'
    AND fd.applied = true
)
UPDATE pending_payments pp
SET can_be_paid = true
WHERE pp.status = 'pending'
  AND pp.can_be_paid = false
  AND EXISTS (
    SELECT 1 FROM paid_advance_ids pai
    WHERE pp.notes::text LIKE '%' || pai.advance_id || '%'
  );

-- =============================================
-- PASO 5: ACTUALIZAR fortnight_broker_totals con discounts_json correcto
-- =============================================
WITH discount_details AS (
  SELECT 
    fd.broker_id,
    json_agg(
      json_build_object(
        'advance_id', fd.advance_id,
        'amount', fd.amount,
        'description', COALESCE(a.reason, 'Adelanto')
      )
    ) AS adelantos,
    json_agg(
      json_build_object(
        'reason', COALESCE(a.reason, 'Adelanto'),
        'amount', fd.amount
      )
    ) AS details,
    SUM(fd.amount) AS total_discount
  FROM fortnight_discounts fd
  JOIN advances a ON a.id = fd.advance_id
  WHERE fd.fortnight_id = 'a58166d9-c866-4518-a62f-4d1681af4ca4'
  GROUP BY fd.broker_id
)
UPDATE fortnight_broker_totals fbt
SET discounts_json = json_build_object(
  'adelantos', dd.adelantos,
  'total', dd.total_discount,
  'details', dd.details
)::jsonb
FROM discount_details dd
WHERE fbt.fortnight_id = 'a58166d9-c866-4518-a62f-4d1681af4ca4'
  AND fbt.broker_id = dd.broker_id;

-- =============================================
-- PASO 6: VERIFICACIÓN FINAL
-- =============================================

-- 6a. Verificar que no quedan bank_transfers incorrectos
SELECT count(*) AS bank_transfers_incorrectos
FROM bank_transfers 
WHERE reference_number LIKE 'DESCUENTO-COMISIONES-A58166D9%';

-- 6b. Verificar que no quedan pending_payments incorrectos
SELECT count(*) AS pending_payments_incorrectos
FROM pending_payments 
WHERE notes::text LIKE '%"source":"fortnight_discount"%'
  AND notes::text LIKE '%a58166d9-c866-4518-a62f-4d1681af4ca4%';

-- 6c. Verificar pending_payments habilitados (can_be_paid=true)
SELECT pp.id, pp.client_name, pp.amount_to_pay, pp.can_be_paid, pp.status
FROM pending_payments pp
WHERE pp.status = 'pending'
  AND pp.notes::text LIKE '%is_auto_advance%'
  AND EXISTS (
    SELECT 1 FROM fortnight_discounts fd
    WHERE fd.fortnight_id = 'a58166d9-c866-4518-a62f-4d1681af4ca4'
      AND pp.notes::text LIKE '%' || fd.advance_id || '%'
  );

-- 6d. Verificar fortnight_broker_totals con descuentos
SELECT 
  b.name,
  fbt.gross_amount,
  COALESCE((fbt.discounts_json->>'total')::numeric, 0) AS descuento,
  fbt.gross_amount - COALESCE((fbt.discounts_json->>'total')::numeric, 0) AS neto_real
FROM fortnight_broker_totals fbt
JOIN brokers b ON b.id = fbt.broker_id
WHERE fbt.fortnight_id = 'a58166d9-c866-4518-a62f-4d1681af4ca4'
ORDER BY b.name;
