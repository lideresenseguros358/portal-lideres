-- =====================================================
-- LIMPIEZA DE REPORTES RECHAZADOS
-- =====================================================
-- Este script elimina completamente los reportes rechazados
-- y libera los items para que vuelvan a "Sin Identificar"
-- =====================================================

BEGIN;

-- PASO 1: Obtener los pending_items de reportes rechazados
-- y restaurarlos a status='open' para que vuelvan a la lista
UPDATE pending_items
SET 
  status = 'open',
  assigned_broker_id = NULL
WHERE id IN (
  SELECT ari.pending_item_id
  FROM adjustment_report_items ari
  INNER JOIN adjustment_reports ar ON ar.id = ari.report_id
  WHERE ar.status = 'rejected'
);

-- Mostrar cuántos items fueron restaurados
DO $$
DECLARE
  restored_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT ari.pending_item_id)
  INTO restored_count
  FROM adjustment_report_items ari
  INNER JOIN adjustment_reports ar ON ar.id = ari.report_id
  WHERE ar.status = 'rejected';
  
  RAISE NOTICE 'Items restaurados a "Sin Identificar": %', restored_count;
END $$;

-- PASO 2: Eliminar adjustment_report_items de reportes rechazados
DELETE FROM adjustment_report_items
WHERE report_id IN (
  SELECT id 
  FROM adjustment_reports 
  WHERE status = 'rejected'
);

-- Mostrar cuántos report items fueron eliminados
DO $$
DECLARE
  deleted_items_count INTEGER;
BEGIN
  GET DIAGNOSTICS deleted_items_count = ROW_COUNT;
  RAISE NOTICE 'adjustment_report_items eliminados: %', deleted_items_count;
END $$;

-- PASO 3: Eliminar los reportes rechazados completamente
DELETE FROM adjustment_reports
WHERE status = 'rejected';

-- Mostrar cuántos reportes fueron eliminados
DO $$
DECLARE
  deleted_reports_count INTEGER;
BEGIN
  GET DIAGNOSTICS deleted_reports_count = ROW_COUNT;
  RAISE NOTICE 'Reportes rechazados eliminados: %', deleted_reports_count;
END $$;

-- Verificación final
DO $$
DECLARE
  pending_open_count INTEGER;
  rejected_reports_count INTEGER;
BEGIN
  -- Contar items en "Sin Identificar"
  SELECT COUNT(*) INTO pending_open_count
  FROM pending_items
  WHERE status = 'open' AND assigned_broker_id IS NULL;
  
  -- Verificar que no quedan reportes rechazados
  SELECT COUNT(*) INTO rejected_reports_count
  FROM adjustment_reports
  WHERE status = 'rejected';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'LIMPIEZA COMPLETADA';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Items disponibles en "Sin Identificar": %', pending_open_count;
  RAISE NOTICE 'Reportes rechazados restantes: %', rejected_reports_count;
  
  IF rejected_reports_count > 0 THEN
    RAISE WARNING 'Aún quedan reportes rechazados. Revisar manualmente.';
  ELSE
    RAISE NOTICE 'Todos los reportes rechazados fueron eliminados exitosamente.';
  END IF;
END $$;

COMMIT;

-- =====================================================
-- NOTAS:
-- =====================================================
-- 1. Este script elimina COMPLETAMENTE los reportes rechazados
-- 2. Los items vuelven a status='open' para aparecer en "Sin Identificar"
-- 3. Se limpian todas las referencias en adjustment_report_items
-- 4. No se mantiene historial de reportes rechazados
-- 5. Los brokers pueden volver a reportar estos items sin errores
-- =====================================================
