-- ============================================
-- SCRIPT: Actualizar transferencias PAGADAS con tipo PENDIENTE
-- ============================================
-- 
-- PROBLEMA:
-- Existen transferencias bancarias que fueron marcadas como PAGADO
-- pero tienen el tipo de transferencia como PENDIENTE.
-- Esto causa inconsistencias en los reportes.
--
-- SOLUCIÓN:
-- Actualizar todas las transferencias con:
--   - status = 'PAGADO'
--   - transfer_type = 'PENDIENTE'
-- Cambiar transfer_type a 'REPORTE' (valor por defecto más común)
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
  description_raw
FROM bank_transfers_comm
WHERE status = 'PAGADO' 
  AND transfer_type = 'PENDIENTE'
ORDER BY date DESC;

-- 2. CONTAR registros afectados
SELECT COUNT(*) as total_afectados
FROM bank_transfers_comm
WHERE status = 'PAGADO' 
  AND transfer_type = 'PENDIENTE';

-- ============================================
-- 3. ACTUALIZAR transferencias
-- ============================================
-- IMPORTANTE: Ejecutar solo después de verificar los registros arriba
--
-- Cambiar transfer_type de 'PENDIENTE' a 'REPORTE' 
-- para todas las transferencias marcadas como PAGADO

UPDATE bank_transfers_comm
SET transfer_type = 'REPORTE'
WHERE status = 'PAGADO' 
  AND transfer_type = 'PENDIENTE';

-- ============================================
-- 4. VERIFICAR resultado después de actualizar
-- ============================================

-- Debería retornar 0 registros
SELECT 
  id,
  reference_number,
  status,
  transfer_type
FROM bank_transfers_comm
WHERE status = 'PAGADO' 
  AND transfer_type = 'PENDIENTE';

-- Verificar que se actualizaron correctamente a REPORTE
SELECT 
  COUNT(*) as total_reportes_pagados,
  SUM(amount) as monto_total
FROM bank_transfers_comm
WHERE status = 'PAGADO' 
  AND transfer_type = 'REPORTE';
