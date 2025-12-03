-- ============================================
-- FIX: Corrección de división de pagos incorrecta
-- ============================================
-- Problema: Al dividir pagos, todas las divisiones estaban usando
-- el mismo amount_to_use en lugar de distribución proporcional
-- 
-- Transferencia: ac020810-299b-4186-815c-2345eecae6df
-- Pago a corregir: b55eae1d-c56c-421c-b432-7358635278e4
-- Monto correcto: 57.10
-- ============================================

-- PASO 1: Verificar estado actual
SELECT 
    'Estado actual de payment_details' as info,
    pd.id,
    pd.payment_id,
    pd.client_name,
    pd.amount_used as monto_registrado,
    bt.reference_number,
    bt.amount as monto_transferencia,
    bt.used_amount as usado_total
FROM payment_details pd
JOIN bank_transfers bt ON pd.bank_transfer_id = bt.id
WHERE pd.payment_id = 'b55eae1d-c56c-421c-b432-7358635278e4'
   OR bt.id = 'ac020810-299b-4186-815c-2345eecae6df';

-- PASO 2: Verificar otros pagos que usaron esta transferencia
SELECT 
    'Otros pagos usando esta transferencia' as info,
    pd.id,
    pd.payment_id,
    pd.client_name,
    pd.amount_used
FROM payment_details pd
WHERE pd.bank_transfer_id = 'ac020810-299b-4186-815c-2345eecae6df'
ORDER BY pd.paid_at;

-- PASO 3: Obtener el monto incorrecto actual
-- (ejecuta esto primero para ver el valor actual)
WITH current_detail AS (
    SELECT amount_used as old_amount
    FROM payment_details
    WHERE payment_id = 'b55eae1d-c56c-421c-b432-7358635278e4'
      AND bank_transfer_id = 'ac020810-299b-4186-815c-2345eecae6df'
)
SELECT 
    old_amount as monto_incorrecto_actual,
    57.10 as monto_correcto,
    (old_amount - 57.10) as diferencia
FROM current_detail;

-- PASO 4: Corregir el payment_details
-- IMPORTANTE: Ejecuta esto después de verificar los pasos anteriores
BEGIN;

-- Actualizar el amount_used del pago específico
UPDATE payment_details
SET amount_used = 57.10
WHERE payment_id = 'b55eae1d-c56c-421c-b432-7358635278e4'
  AND bank_transfer_id = 'ac020810-299b-4186-815c-2345eecae6df';

-- Recalcular el used_amount de la transferencia bancaria
-- Sumar TODOS los amount_used de payment_details que usan esta transferencia
UPDATE bank_transfers bt
SET used_amount = (
    SELECT COALESCE(SUM(pd.amount_used), 0)
    FROM payment_details pd
    WHERE pd.bank_transfer_id = bt.id
)
WHERE bt.id = 'ac020810-299b-4186-815c-2345eecae6df';

-- Verificar el resultado
SELECT 
    'Resultado después de corrección' as info,
    pd.id,
    pd.payment_id,
    pd.client_name,
    pd.amount_used as monto_corregido,
    bt.reference_number,
    bt.amount as monto_transferencia,
    bt.used_amount as usado_total_actualizado,
    bt.remaining_amount as saldo_restante,
    bt.status as estado
FROM payment_details pd
JOIN bank_transfers bt ON pd.bank_transfer_id = bt.id
WHERE bt.id = 'ac020810-299b-4186-815c-2345eecae6df'
ORDER BY pd.paid_at;

-- Si todo se ve bien, confirmar:
COMMIT;

-- Si algo está mal, revertir:
-- ROLLBACK;

-- ============================================
-- NOTAS:
-- ============================================
-- 1. La transferencia debe quedar con status = 'used' si se usó completamente
-- 2. La columna remaining_amount es calculada automáticamente (generated column)
-- 3. Después de ejecutar, verifica que la suma de todos los amount_used
--    sea igual a bt.used_amount
-- ============================================
