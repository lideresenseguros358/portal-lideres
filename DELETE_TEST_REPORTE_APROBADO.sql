-- ================================================================
-- SQL DE LIMPIEZA: ELIMINAR DATOS DE PRUEBA
-- Reporte de Ajuste Aprobado
-- ================================================================

-- IMPORTANTE: Ejecuta estas queries en orden para eliminar 
-- correctamente los datos de prueba sin dejar registros huérfanos

-- ================================================================
-- PASO 1: VERIFICAR QUÉ SE VA A ELIMINAR
-- ================================================================

-- Buscar por policy_number (identificador único del test)
SELECT 'PENDING ITEM A ELIMINAR' as tipo, id, policy_number, insured_name, commission_raw, status
FROM pending_items
WHERE policy_number = 'TEST-ANCON-2024-001';

-- Buscar reportes del broker de prueba con la nota específica
SELECT 'REPORTE A ELIMINAR' as tipo, ar.id, ar.status, ar.total_amount, ar.broker_notes
FROM adjustment_reports ar
WHERE ar.broker_notes ILIKE '%Reporte de prueba - ajuste ANCON cliente ficticio%';

-- Buscar items del reporte
SELECT 'ITEMS DEL REPORTE A ELIMINAR' as tipo, ari.id, ari.report_id, ari.pending_item_id, ari.broker_commission
FROM adjustment_report_items ari
WHERE ari.pending_item_id IN (
    SELECT id FROM pending_items WHERE policy_number = 'TEST-ANCON-2024-001'
);

-- ================================================================
-- PASO 2: ELIMINAR DATOS DE PRUEBA
-- (Ejecuta en este orden para respetar foreign keys)
-- ================================================================

DO $$
DECLARE
    v_pending_item_id uuid;
    v_report_id uuid;
BEGIN
    -- Obtener el ID del pending_item de prueba
    SELECT id INTO v_pending_item_id
    FROM pending_items
    WHERE policy_number = 'TEST-ANCON-2024-001'
    LIMIT 1;
    
    -- Obtener el ID del reporte de prueba
    SELECT ar.id INTO v_report_id
    FROM adjustment_reports ar
    WHERE ar.broker_notes ILIKE '%Reporte de prueba - ajuste ANCON cliente ficticio%'
    LIMIT 1;
    
    IF v_pending_item_id IS NOT NULL AND v_report_id IS NOT NULL THEN
        -- 1. Eliminar items del reporte primero
        DELETE FROM adjustment_report_items
        WHERE report_id = v_report_id;
        
        RAISE NOTICE 'Eliminados adjustment_report_items';
        
        -- 2. Eliminar el reporte
        DELETE FROM adjustment_reports
        WHERE id = v_report_id;
        
        RAISE NOTICE 'Eliminado adjustment_report: %', v_report_id;
        
        -- 3. Eliminar el pending_item
        DELETE FROM pending_items
        WHERE id = v_pending_item_id;
        
        RAISE NOTICE 'Eliminado pending_item: %', v_pending_item_id;
        RAISE NOTICE 'Limpieza completada exitosamente';
    ELSE
        RAISE NOTICE 'No se encontraron datos de prueba para eliminar';
    END IF;
END $$;

-- ================================================================
-- PASO 3: VERIFICACIÓN DE LIMPIEZA
-- ================================================================

-- Estas queries NO deben retornar resultados
SELECT 'PENDING ITEMS RESTANTES' as verificacion, COUNT(*) as count
FROM pending_items
WHERE policy_number = 'TEST-ANCON-2024-001';

SELECT 'REPORTES RESTANTES' as verificacion, COUNT(*) as count
FROM adjustment_reports
WHERE broker_notes ILIKE '%Reporte de prueba - ajuste ANCON cliente ficticio%';

SELECT 'ITEMS DEL REPORTE RESTANTES' as verificacion, COUNT(*) as count
FROM adjustment_report_items ari
WHERE ari.pending_item_id IN (
    SELECT id FROM pending_items WHERE policy_number = 'TEST-ANCON-2024-001'
);

-- ================================================================
-- RESULTADO ESPERADO:
-- ================================================================
-- Todas las verificaciones deben mostrar count = 0
-- Si alguna muestra count > 0, algo no se eliminó correctamente
-- ================================================================
