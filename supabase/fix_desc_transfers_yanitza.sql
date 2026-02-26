-- ============================================================================
-- FIX: Reasignar transferencias DESC a referencias bancarias reales
-- Broker: YANITZA KATIWSCA JUSTINIANI
-- Problema: Se crearon descuentos (DESC-B595EDE6, DESC-2F207DC9) pero el
--           corredor ya había pagado via banco (718213926, 719338288).
--           Los DESC consumieron los pagos pendientes, dejando las refs reales
--           "Disponible" sin usar.
-- Solución: Mover los payment_details de DESC → refs reales, y eliminar DESC.
-- ============================================================================

-- PASO 0: VERIFICAR estado actual (EJECUTAR PRIMERO PARA CONFIRMAR)
-- Descomentar y ejecutar para ver los datos antes de aplicar cambios

SELECT 'TRANSFERENCIAS DESC Y REALES:' as info;
SELECT id, reference_number, amount, used_amount, remaining_amount, status, description
FROM bank_transfers
WHERE reference_number IN ('DESC-B595EDE6', 'DESC-2F207DC9', '718213926', '719338288')
ORDER BY reference_number;

SELECT 'PAYMENT_DETAILS vinculados a DESC:' as info;
SELECT pd.id, pd.bank_transfer_id, pd.payment_id, pd.amount_used, pd.client_name, pd.purpose,
       bt.reference_number
FROM payment_details pd
JOIN bank_transfers bt ON bt.id = pd.bank_transfer_id
WHERE bt.reference_number IN ('DESC-B595EDE6', 'DESC-2F207DC9');

SELECT 'PAYMENT_REFERENCES con DESC:' as info;
SELECT pr.id, pr.payment_id, pr.reference_number, pr.amount, pr.amount_to_use, pr.exists_in_bank
FROM payment_references pr
WHERE pr.reference_number IN ('DESC-B595EDE6', 'DESC-2F207DC9');

SELECT 'PENDING_PAYMENTS asociados:' as info;
SELECT pp.id, pp.client_name, pp.amount_to_pay, pp.total_received, pp.status, pp.purpose
FROM pending_payments pp
WHERE pp.id IN (
  SELECT pd.payment_id FROM payment_details pd
  JOIN bank_transfers bt ON bt.id = pd.bank_transfer_id
  WHERE bt.reference_number IN ('DESC-B595EDE6', 'DESC-2F207DC9')
);


-- ============================================================================
-- PASO 1: Reasignar payment_details de DESC-2F207DC9 ($62.64) → 718213926 ($62.64)
-- ============================================================================
BEGIN;

-- 1a. Obtener el ID de la transferencia real 718213926
-- UPDATE payment_details: cambiar bank_transfer_id del DESC al real
UPDATE payment_details
SET bank_transfer_id = (SELECT id FROM bank_transfers WHERE reference_number = '718213926' LIMIT 1)
WHERE bank_transfer_id = (SELECT id FROM bank_transfers WHERE reference_number = 'DESC-2F207DC9' LIMIT 1);

-- 1b. Actualizar used_amount de la transferencia real 718213926
UPDATE bank_transfers
SET used_amount = 62.64
WHERE reference_number = '718213926';

-- ============================================================================
-- PASO 2: Reasignar payment_details de DESC-B595EDE6 ($64.00) → 719338288 ($64.00)
-- ============================================================================

-- 2a. Mover payment_details
UPDATE payment_details
SET bank_transfer_id = (SELECT id FROM bank_transfers WHERE reference_number = '719338288' LIMIT 1)
WHERE bank_transfer_id = (SELECT id FROM bank_transfers WHERE reference_number = 'DESC-B595EDE6' LIMIT 1);

-- 2b. Actualizar used_amount de la transferencia real 719338288
UPDATE bank_transfers
SET used_amount = 64.00
WHERE reference_number = '719338288';

-- ============================================================================
-- PASO 3: Actualizar payment_references para apuntar a refs reales
-- ============================================================================

-- 3a. Cambiar referencia DESC-2F207DC9 → 718213926
UPDATE payment_references
SET reference_number = '718213926',
    exists_in_bank = true
WHERE reference_number = 'DESC-2F207DC9';

-- 3b. Cambiar referencia DESC-B595EDE6 → 719338288
UPDATE payment_references
SET reference_number = '719338288',
    exists_in_bank = true
WHERE reference_number = 'DESC-B595EDE6';

-- ============================================================================
-- PASO 4: Eliminar transferencias DESC (ya no tienen payment_details vinculados)
-- ============================================================================
DELETE FROM bank_transfers WHERE reference_number = 'DESC-2F207DC9';
DELETE FROM bank_transfers WHERE reference_number = 'DESC-B595EDE6';

COMMIT;

-- ============================================================================
-- PASO 5: VERIFICAR resultado final
-- ============================================================================
SELECT 'VERIFICACIÓN FINAL - Transferencias:' as info;
SELECT id, reference_number, amount, used_amount, remaining_amount, status
FROM bank_transfers
WHERE reference_number IN ('718213926', '719338288')
ORDER BY reference_number;

SELECT 'VERIFICACIÓN FINAL - Payment Details:' as info;
SELECT pd.id, pd.bank_transfer_id, pd.amount_used, pd.client_name,
       bt.reference_number, bt.used_amount, bt.remaining_amount
FROM payment_details pd
JOIN bank_transfers bt ON bt.id = pd.bank_transfer_id
WHERE bt.reference_number IN ('718213926', '719338288');

SELECT 'VERIFICACIÓN FINAL - Payment References:' as info;
SELECT pr.id, pr.payment_id, pr.reference_number, pr.amount, pr.amount_to_use, pr.exists_in_bank
FROM payment_references pr
WHERE pr.reference_number IN ('718213926', '719338288');

-- Confirmar que no quedan DESC
SELECT 'VERIFICACIÓN: No deben quedar DESC:' as info;
SELECT count(*) as desc_remaining
FROM bank_transfers
WHERE reference_number LIKE 'DESC-%'
  AND reference_number IN ('DESC-B595EDE6', 'DESC-2F207DC9');
