-- ================================================
-- SCRIPT DE LIMPIEZA COMPLETA Y VERIFICACIÓN
-- ================================================
-- EJECUTAR EN SUPABASE SQL EDITOR
-- Este script limpia TODA la base de datos del sistema de ajustes
-- ================================================

-- ========================================
-- PASO 1: VERIFICAR QUÉ TABLAS EXISTEN
-- ========================================
-- Ejecuta esto PRIMERO para ver todas las tablas relacionadas con ajustes

SELECT 
  table_name,
  table_schema
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (
    table_name LIKE '%adjustment%' 
    OR table_name LIKE '%report%'
  )
ORDER BY table_name;

-- ========================================
-- RESULTADO ESPERADO:
-- ========================================
-- Solo deben existir estas tablas:
-- ✅ adjustment_report_items
-- ✅ adjustment_reports
--
-- SI VES TABLAS DUPLICADAS COMO:
-- ❌ adjustments_report_items (con S)
-- ❌ adjustments_reports (con S)
-- ❌ adjustment_items
-- ❌ Cualquier otra variación
-- 
-- → Esas son DUPLICADAS y deben eliminarse


-- ========================================
-- PASO 2: LIMPIEZA COMPLETA DE DATOS
-- ========================================
-- Esto BORRA todos los reportes y RESETEA pending_items

BEGIN;

-- 2.1 Eliminar todos los ítems de reportes
DELETE FROM adjustment_report_items;

-- 2.2 Eliminar todos los reportes
DELETE FROM adjustment_reports;

-- 2.3 Resetear TODOS los pending_items a estado inicial
UPDATE pending_items 
SET 
  status = 'open',
  assigned_broker_id = NULL
WHERE 1=1;  -- Actualiza TODOS sin condición

COMMIT;


-- ========================================
-- PASO 3: VERIFICAR LIMPIEZA
-- ========================================

-- 3.1 Verificar que NO hay reportes
SELECT 
  'adjustment_reports' as tabla,
  COUNT(*) as registros
FROM adjustment_reports
UNION ALL
SELECT 
  'adjustment_report_items' as tabla,
  COUNT(*) as registros
FROM adjustment_report_items;
-- Ambos deben mostrar 0 registros


-- 3.2 Verificar que todos los pending_items están en 'open' y sin broker
SELECT 
  COUNT(*) as total_items,
  COUNT(CASE WHEN status = 'open' THEN 1 END) as items_open,
  COUNT(CASE WHEN assigned_broker_id IS NULL THEN 1 END) as items_sin_broker,
  COUNT(CASE WHEN status != 'open' OR assigned_broker_id IS NOT NULL THEN 1 END) as items_con_problema
FROM pending_items;
-- 'items_con_problema' debe ser 0


-- 3.3 Ver items que AÚN tienen problemas (si hay alguno)
SELECT 
  id,
  policy_number,
  insured_name,
  status,
  assigned_broker_id,
  created_at
FROM pending_items
WHERE status != 'open' 
   OR assigned_broker_id IS NOT NULL
ORDER BY created_at DESC;
-- Debe devolver 0 filas


-- ========================================
-- PASO 4: ELIMINAR TABLAS DUPLICADAS
-- ========================================
-- SOLO ejecutar SI el PASO 1 mostró tablas duplicadas

-- ⚠️ ADVERTENCIA: Esto ELIMINA tablas permanentemente
-- Solo ejecuta si estás SEGURO que son duplicadas

-- Si existe adjustments_report_items (con S):
-- DROP TABLE IF EXISTS adjustments_report_items CASCADE;

-- Si existe adjustments_reports (con S):
-- DROP TABLE IF EXISTS adjustments_reports CASCADE;

-- Si existe adjustment_items:
-- DROP TABLE IF EXISTS adjustment_items CASCADE;


-- ========================================
-- PASO 5: VERIFICACIÓN FINAL
-- ========================================

-- 5.1 Ver estructura de pending_items
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'pending_items'
  AND column_name IN ('id', 'policy_number', 'status', 'assigned_broker_id', 'commission_raw')
ORDER BY ordinal_position;


-- 5.2 Ver primeros 10 pending_items (deben estar limpios)
SELECT 
  id,
  policy_number,
  insured_name,
  commission_raw,
  status,
  assigned_broker_id,
  created_at
FROM pending_items
ORDER BY created_at DESC
LIMIT 10;
-- Todos deben tener status='open' y assigned_broker_id=NULL


-- 5.3 Contar items por insurer
SELECT 
  i.name as aseguradora,
  COUNT(*) as cantidad_items,
  SUM(pi.commission_raw) as total_bruto
FROM pending_items pi
INNER JOIN insurers i ON pi.insurer_id = i.id
WHERE pi.status = 'open'
GROUP BY i.name
ORDER BY cantidad_items DESC;


-- ========================================
-- PASO 6: REGENERAR TYPES (OPCIONAL)
-- ========================================
-- Si eliminaste tablas duplicadas, debes regenerar database.types.ts

-- EN LA TERMINAL DE TU PROYECTO:
-- npx supabase gen types typescript --project-id TU_PROJECT_ID > src/lib/database.types.ts


-- ========================================
-- RESUMEN DE LO QUE HACE ESTE SCRIPT:
-- ========================================
/*
1. ✅ Muestra TODAS las tablas relacionadas con ajustes
2. ✅ Borra TODOS los reportes y sus ítems
3. ✅ Resetea TODOS los pending_items:
   - status = 'open'
   - assigned_broker_id = NULL
4. ✅ Verifica que la limpieza fue exitosa
5. ✅ (Opcional) Elimina tablas duplicadas
6. ✅ Verificación final de estructura

DESPUÉS DE EJECUTAR:
- Todos los items en "Sin Identificar"
- No habrá reportes
- assigned_broker_id estará NULL en todos
- Sistema 100% limpio
*/


-- ========================================
-- SCRIPT TODO-EN-UNO (EJECUTAR SOLO ESTE)
-- ========================================
-- Si quieres hacer TODO de una vez:

/*
BEGIN;

-- Eliminar reportes
DELETE FROM adjustment_report_items;
DELETE FROM adjustment_reports;

-- Resetear pending_items COMPLETO
UPDATE pending_items 
SET 
  status = 'open',
  assigned_broker_id = NULL;

COMMIT;

-- Verificar
SELECT 'Items limpios' as resultado, COUNT(*) as total
FROM pending_items
WHERE status = 'open' AND assigned_broker_id IS NULL;
*/
