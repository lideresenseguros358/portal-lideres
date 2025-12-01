-- ================================================
-- SCRIPT DE LIMPIEZA COMPLETA - SISTEMA DE AJUSTES
-- ================================================
-- EJECUTAR EN SUPABASE SQL EDITOR
-- Este script resetea TODOS los ajustes a estado inicial
-- ================================================

-- ========================================
-- PASO 1: VERIFICAR TABLAS EXISTENTES
-- ========================================
-- Ejecuta esto primero para ver qué tablas tienes:
/*
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%adjustment%' 
  OR table_name LIKE '%report%'
ORDER BY table_name;
*/

-- ========================================
-- PASO 2: ELIMINAR DATOS DE REPORTES
-- ========================================
-- Esto BORRA todos los reportes y sus ítems

-- 2.1 Eliminar ítems de reportes
DELETE FROM adjustment_report_items;

-- 2.2 Eliminar reportes
DELETE FROM adjustment_reports;

-- NOTA: Si existe tabla duplicada "adjustments_report_items" o "adjustments_reports":
-- DELETE FROM adjustments_report_items;
-- DELETE FROM adjustments_reports;

-- ========================================
-- PASO 3: RESETEAR PENDING_ITEMS
-- ========================================
-- Esto devuelve TODOS los pending_items a estado inicial (sin identificar)

UPDATE pending_items 
SET 
  status = 'open',
  assigned_broker_id = NULL
WHERE status IN ('in_review', 'approved', 'rejected');

-- ========================================
-- PASO 4: CORREGIR CÁLCULOS EN ADJUSTMENT_REPORT_ITEMS
-- ========================================
-- Si necesitas corregir reportes EXISTENTES (NO ejecutar si ya borraste en PASO 2)
-- Este UPDATE recalcula broker_commission usando percent_default de brokers

/*
UPDATE adjustment_report_items AS ari
SET broker_commission = ari.commission_raw * b.percent_default
FROM pending_items AS pi
INNER JOIN brokers AS b ON pi.assigned_broker_id = b.id
WHERE ari.pending_item_id = pi.id;
*/

-- ========================================
-- PASO 5: RECALCULAR TOTALES DE REPORTES
-- ========================================
-- Si necesitas corregir reportes EXISTENTES (NO ejecutar si ya borraste en PASO 2)
-- Este UPDATE recalcula total_amount sumando broker_commission de todos los ítems

/*
UPDATE adjustment_reports AS ar
SET total_amount = (
  SELECT COALESCE(SUM(broker_commission), 0)
  FROM adjustment_report_items
  WHERE report_id = ar.id
)
WHERE ar.id IS NOT NULL;
*/

-- ========================================
-- PASO 6: VERIFICAR RESULTADO
-- ========================================
-- Ejecuta estas queries para verificar que todo quedó limpio:

-- 6.1 Ver pending_items (todos deben estar en 'open' y sin assigned_broker_id)
SELECT 
  id,
  policy_number,
  insured_name,
  commission_raw,
  status,
  assigned_broker_id
FROM pending_items
ORDER BY created_at DESC
LIMIT 20;

-- 6.2 Ver reportes (debe estar vacío si ejecutaste PASO 2)
SELECT COUNT(*) as total_reportes FROM adjustment_reports;

-- 6.3 Ver ítems de reportes (debe estar vacío si ejecutaste PASO 2)
SELECT COUNT(*) as total_items FROM adjustment_report_items;

-- ========================================
-- PASO 7 (OPCIONAL): ELIMINAR TABLAS DUPLICADAS
-- ========================================
-- SOLO ejecutar SI existe tabla duplicada
-- VERIFICAR PRIMERO con el query del PASO 1

/*
-- Si existe "adjustments_report_items" (con S):
DROP TABLE IF EXISTS adjustments_report_items CASCADE;

-- Si existe "adjustments_reports" (con S):
DROP TABLE IF EXISTS adjustments_reports CASCADE;
*/

-- ========================================
-- RESUMEN DE LO QUE HACE ESTE SCRIPT:
-- ========================================
/*
1. Borra TODOS los reportes y sus ítems
2. Resetea TODOS los pending_items a:
   - status = 'open' (sin identificar)
   - assigned_broker_id = NULL (sin broker asignado)
3. Opcionalmente corrige cálculos si no borraste reportes
4. Opcionalmente elimina tablas duplicadas

DESPUÉS DE EJECUTAR:
- Todos los ítems aparecerán en "Sin Identificar"
- No habrá reportes en "Reportados" ni "Identificados"
- El sistema estará LIMPIO para empezar de nuevo
*/

-- ========================================
-- SCRIPT RÁPIDO (TODO EN UNO)
-- ========================================
-- Si quieres RESETEAR TODO de una vez, ejecuta esto:

/*
BEGIN;

-- Eliminar reportes
DELETE FROM adjustment_report_items;
DELETE FROM adjustment_reports;

-- Resetear pending_items
UPDATE pending_items 
SET 
  status = 'open',
  assigned_broker_id = NULL
WHERE status IN ('in_review', 'approved', 'rejected');

COMMIT;
*/
