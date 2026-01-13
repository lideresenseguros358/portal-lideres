-- ============================================================================
-- SCRIPT DE LIMPIEZA: CANCELADAS MENSUALES → CANCELADAS ANUALES
-- ============================================================================
-- 
-- PROPÓSITO:
-- Limpiar las canceladas mes a mes de la tabla production y mantener solo
-- el campo canceladas_ytd (Year-To-Date) que será el único input anual.
--
-- CAMBIO:
-- ANTES: Cada mes tenía su propio campo "canceladas" que se acumulaba
-- DESPUÉS: Solo existe un campo "canceladas_ytd" por broker/año que se resta
--          del bruto acumulado para calcular el neto acumulado
--
-- FÓRMULA:
-- Acumulado Neto = Acumulado Bruto - Canceladas YTD
--
-- ============================================================================

-- PASO 1: Verificar datos actuales (OPCIONAL - para revisar antes de limpiar)
-- Descomentar para ver qué datos existen actualmente
/*
SELECT 
  broker_id,
  year,
  month,
  bruto,
  canceladas,
  num_polizas
FROM production
WHERE canceladas > 0
ORDER BY broker_id, year, month;
*/

-- PASO 2: Limpiar todas las canceladas mensuales (poner en 0 o NULL)
-- Esto limpia el campo "canceladas" de cada registro mensual
UPDATE production
SET 
  canceladas = 0,
  updated_at = NOW()
WHERE canceladas IS NOT NULL AND canceladas > 0;

-- PASO 3: Verificar que la limpieza se hizo correctamente
-- Debería retornar 0 registros
SELECT 
  COUNT(*) as registros_con_canceladas_mensuales
FROM production
WHERE canceladas > 0;

-- PASO 4: Verificar que canceladas_ytd se mantiene intacto
-- Esto muestra los valores anuales que SÍ deben mantenerse
SELECT 
  b.name as broker_name,
  p.year,
  SUM(p.bruto) as bruto_acumulado,
  MAX(p.canceladas) as canceladas_ytd_actual
FROM production p
LEFT JOIN brokers b ON b.id = p.broker_id
GROUP BY b.name, p.year
HAVING MAX(p.canceladas) > 0
ORDER BY p.year DESC, b.name;

-- ============================================================================
-- NOTAS IMPORTANTES:
-- ============================================================================
--
-- 1. Este script NO toca el campo "canceladas_ytd" que es el que se usará
--    como input único anual.
--
-- 2. El campo "canceladas" en cada registro mensual se pone en 0 porque
--    ya no se usará para cálculos mes a mes.
--
-- 3. La UI mostrará un solo input de "Canceladas del Año" al final de
--    cada fila de broker, y ese valor se usará para calcular:
--    Neto Acumulado = Bruto Acumulado - Canceladas del Año
--
-- 4. Si necesitas restaurar datos, asegúrate de tener un backup antes
--    de ejecutar este script.
--
-- ============================================================================

-- VERIFICACIÓN FINAL: Contar registros afectados
SELECT 
  'Registros mensuales limpiados' as descripcion,
  COUNT(*) as cantidad
FROM production
WHERE canceladas = 0 OR canceladas IS NULL;
