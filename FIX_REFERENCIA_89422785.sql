-- ============================================
-- CORRECCIÓN: Referencia 89422785 tiene montos invertidos
-- ============================================
-- Problema: Se registró $93.93 cuando debía ser $27.30
-- Solución: Actualizar a los valores correctos
-- ============================================

-- PASO 1: Ver el estado actual
SELECT 
  bt.reference_number,
  bt.amount as total,
  bt.used_amount as usado_actual,
  bt.remaining_amount as disponible_actual,
  bt.status,
  pd.amount_used as monto_en_payment_details,
  pd.client_name,
  pd.policy_number
FROM bank_transfers bt
LEFT JOIN payment_details pd ON pd.bank_transfer_id = bt.id
WHERE bt.reference_number = '89422785'
ORDER BY pd.paid_at DESC;

-- PASO 2: Actualizar payment_details (cambiar 93.93 → 27.30)
-- IMPORTANTE: Verifica que el query retorne 1 fila antes de ejecutar
UPDATE payment_details
SET amount_used = 27.30
WHERE bank_transfer_id = (
  SELECT id FROM bank_transfers WHERE reference_number = '89422785'
)
AND amount_used = 93.93
AND client_name = 'MIGUEL GUTIERREZ';

-- PASO 3: Actualizar bank_transfers (cambiar used_amount 93.93 → 27.30)
UPDATE bank_transfers
SET used_amount = 27.30
WHERE reference_number = '89422785';

-- PASO 4: Verificar el resultado
SELECT 
  bt.reference_number,
  bt.amount as total,
  bt.used_amount as usado_corregido,
  bt.remaining_amount as disponible_corregido,
  bt.status,
  pd.amount_used as monto_en_payment_details,
  pd.client_name,
  pd.policy_number
FROM bank_transfers bt
LEFT JOIN payment_details pd ON pd.bank_transfer_id = bt.id
WHERE bt.reference_number = '89422785'
ORDER BY pd.paid_at DESC;

-- ============================================
-- RESULTADO ESPERADO:
-- reference_number: 89422785
-- total: 121.23
-- usado_corregido: 27.30
-- disponible_corregido: 93.93
-- status: partial
-- ============================================
