-- ============================================
-- FIX CORRECTO: Actualizar payment_details específico
-- ============================================
-- Transferencia: ac020810-299b-4186-815c-2345eecae6df (96.11 total)
-- Payment_detail a corregir: b55eae1d-c56c-421c-b432-7358635278e4
-- Monto actual: 39.01 (INCORRECTO)
-- Monto correcto: 57.10
-- ============================================

-- PASO 1: Ver estado ANTES de corregir
SELECT 
    'ANTES de corrección' as estado,
    pd.id,
    pd.client_name,
    pd.amount_used as monto_actual,
    bt.reference_number,
    bt.amount as total_transferencia,
    bt.used_amount as usado_total,
    bt.remaining_amount as disponible
FROM payment_details pd
JOIN bank_transfers bt ON pd.bank_transfer_id = bt.id
WHERE bt.id = 'ac020810-299b-4186-815c-2345eecae6df'
ORDER BY pd.paid_at;

-- PASO 2: EJECUTAR CORRECCIÓN
BEGIN;

-- Actualizar el payment_details específico
UPDATE payment_details
SET amount_used = 57.10
WHERE id = 'b55eae1d-c56c-421c-b432-7358635278e4';

-- Recalcular el used_amount de la transferencia
-- (39.01 del primer pago + 57.10 del segundo = 96.11 total)
UPDATE bank_transfers
SET used_amount = (
    SELECT COALESCE(SUM(pd.amount_used), 0)
    FROM payment_details pd
    WHERE pd.bank_transfer_id = 'ac020810-299b-4186-815c-2345eecae6df'
)
WHERE id = 'ac020810-299b-4186-815c-2345eecae6df';

-- PASO 3: Verificar resultado DESPUÉS de corrección
SELECT 
    'DESPUÉS de corrección' as estado,
    pd.id,
    pd.client_name,
    pd.amount_used as monto_corregido,
    bt.reference_number,
    bt.amount as total_transferencia,
    bt.used_amount as usado_total,
    bt.remaining_amount as disponible,
    bt.status as estado_transferencia
FROM payment_details pd
JOIN bank_transfers bt ON pd.bank_transfer_id = bt.id
WHERE bt.id = 'ac020810-299b-4186-815c-2345eecae6df'
ORDER BY pd.paid_at;

-- PASO 4: Verificar que la suma sea correcta
SELECT 
    'Validación final' as info,
    SUM(pd.amount_used) as suma_payment_details,
    (SELECT used_amount FROM bank_transfers WHERE id = 'ac020810-299b-4186-815c-2345eecae6df') as used_amount_banco,
    (SELECT amount FROM bank_transfers WHERE id = 'ac020810-299b-4186-815c-2345eecae6df') as total_transferencia,
    (SELECT remaining_amount FROM bank_transfers WHERE id = 'ac020810-299b-4186-815c-2345eecae6df') as saldo_final,
    CASE 
        WHEN (SELECT remaining_amount FROM bank_transfers WHERE id = 'ac020810-299b-4186-815c-2345eecae6df') < 0.01 
        THEN '✅ CORRECTO - Saldo en 0'
        ELSE '❌ ERROR - Aún hay saldo disponible'
    END as validacion
FROM payment_details pd
WHERE pd.bank_transfer_id = 'ac020810-299b-4186-815c-2345eecae6df';

-- Si todo está correcto (saldo en 0 o muy cerca):
COMMIT;

-- Si algo está mal:
-- ROLLBACK;

-- ============================================
-- RESULTADO ESPERADO:
-- ============================================
-- Payment 1: 39.01
-- Payment 2: 57.10
-- Total usado: 96.11 (igual al total de la transferencia)
-- Saldo disponible: 0.00
-- Status: 'used'
-- ============================================
