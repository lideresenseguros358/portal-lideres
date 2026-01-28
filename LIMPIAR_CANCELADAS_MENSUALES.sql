-- ============================================================================
-- SCRIPT: Limpiar Canceladas Mes a Mes (Mantener Solo Cifra Anual)
-- ============================================================================
-- PROPÓSITO:
-- Eliminar todos los valores de canceladas guardados mes por mes en la tabla
-- production, dejándolos en 0. La cifra anual total se maneja por separado
-- a nivel del broker.
--
-- ANTES:
-- Cada mes tenía su valor de canceladas (ej: ene: $50, feb: $30, mar: $162.73)
--
-- DESPUÉS:
-- Todos los meses tendrán canceladas = 0
-- La cifra anual se guarda y muestra a nivel del broker completo
-- ============================================================================

BEGIN;

-- Actualizar todos los registros de production
-- Poner canceladas = 0 en todos los meses
UPDATE production
SET 
  canceladas = 0,
  updated_at = NOW()
WHERE canceladas IS NOT NULL AND canceladas > 0;

-- Verificar cuántos registros fueron actualizados
-- (Este query se puede ejecutar antes del COMMIT para verificar)
SELECT 
  year,
  COUNT(*) as registros_limpiados,
  SUM(canceladas) as total_canceladas_antes
FROM production
WHERE canceladas > 0
GROUP BY year
ORDER BY year DESC;

COMMIT;

-- ============================================================================
-- VERIFICACIÓN POST-LIMPIEZA
-- ============================================================================
-- Ejecutar este query DESPUÉS del commit para verificar que todo está en 0:

SELECT 
  b.name as broker,
  p.year,
  p.month,
  p.bruto,
  p.canceladas,
  p.num_polizas
FROM production p
JOIN brokers b ON p.broker_id = b.id
WHERE p.canceladas > 0
ORDER BY p.year DESC, b.name, p.month;

-- Si este query NO retorna filas, la limpieza fue exitosa ✅

-- ============================================================================
-- NOTAS IMPORTANTES:
-- ============================================================================
-- 1. Este script pone todos los valores mensuales de canceladas en 0
-- 2. La cifra anual de canceladas se maneja en el frontend como canceladas_ytd
-- 3. El campo canceladas_ytd se calcula/guarda por separado en los brokers
-- 4. Después de ejecutar este script, los tooltips ya NO mostrarán canceladas
--    mensuales, solo la cifra anual total del broker
-- ============================================================================
