-- ============================================
-- SCRIPT: Actualizar transferencias SIN_CLASIFICAR a PENDIENTE
-- ============================================
-- 
-- PROBLEMA:
-- Existen transferencias bancarias con status 'SIN_CLASIFICAR'
-- que deben cambiar a 'PENDIENTE' para consistencia en el sistema.
--
-- SOLUCIÓN:
-- Actualizar todas las transferencias con:
--   - status = 'SIN_CLASIFICAR'
-- Cambiar status a 'PENDIENTE'
--
-- ============================================

-- 1. VERIFICAR registros afectados ANTES de actualizar
SELECT 
  id,
  reference_number,
  date,
  amount,
  status,
  transfer_type,
  description_raw,
  created_at
FROM bank_transfers_comm
WHERE status = 'SIN_CLASIFICAR'
ORDER BY created_at DESC;

-- 2. CONTAR registros afectados
SELECT COUNT(*) as total_sin_clasificar
FROM bank_transfers_comm
WHERE status = 'SIN_CLASIFICAR';

-- ============================================
-- 3. ACTUALIZAR transferencias
-- ============================================
-- IMPORTANTE: Ejecutar solo después de verificar los registros arriba
--
-- Cambiar status de 'SIN_CLASIFICAR' a 'PENDIENTE'

UPDATE bank_transfers_comm
SET status = 'PENDIENTE'
WHERE status = 'SIN_CLASIFICAR';

-- ============================================
-- 4. VERIFICAR resultado después de actualizar
-- ============================================

-- Debería retornar 0 registros
SELECT 
  id,
  reference_number,
  status
FROM bank_transfers_comm
WHERE status = 'SIN_CLASIFICAR';

-- Verificar total de transferencias PENDIENTE
SELECT 
  COUNT(*) as total_pendiente,
  SUM(amount) as monto_total
FROM bank_transfers_comm
WHERE status = 'PENDIENTE';

-- Resumen de todos los status
SELECT 
  status,
  COUNT(*) as cantidad,
  SUM(amount) as monto_total
FROM bank_transfers_comm
GROUP BY status
ORDER BY cantidad DESC;
