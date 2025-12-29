-- ============================================
-- RESET TOTAL - NUEVA QUINCENA
-- Limpia TODO para empezar desde 0
-- Portal Líderes
-- ============================================

DO $$
DECLARE
    v_fortnight_id UUID;
    v_import_ids UUID[];
    v_deleted_count INT;
BEGIN
    -- 1. OBTENER QUINCENA DRAFT ACTUAL
    SELECT id INTO v_fortnight_id
    FROM fortnights
    WHERE status = 'DRAFT'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_fortnight_id IS NULL THEN
        RAISE NOTICE '❌ No hay quincena DRAFT activa';
        RETURN;
    END IF;

    RAISE NOTICE '========================================';
    RAISE NOTICE '🔄 INICIANDO RESET TOTAL DE QUINCENA';
    RAISE NOTICE 'Quincena ID: %', v_fortnight_id;
    RAISE NOTICE '========================================';

    -- 2. OBTENER TODOS LOS IMPORT IDs DE ESTA QUINCENA
    SELECT ARRAY_AGG(id) INTO v_import_ids
    FROM comm_imports
    WHERE period_label = v_fortnight_id::text;

    RAISE NOTICE 'Imports encontrados: %', COALESCE(array_length(v_import_ids, 1), 0);

    -- ==========================================
    -- PASO 1: LIMPIAR COMM_ITEMS
    -- ==========================================
    IF v_import_ids IS NOT NULL AND array_length(v_import_ids, 1) > 0 THEN
        DELETE FROM comm_items
        WHERE import_id = ANY(v_import_ids);
        
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        RAISE NOTICE '✓ [1/13] comm_items eliminados: %', v_deleted_count;
    ELSE
        RAISE NOTICE '✓ [1/13] No hay comm_items (sin imports)';
    END IF;

    -- ==========================================
    -- PASO 2: LIMPIAR DRAFT_UNIDENTIFIED_ITEMS
    -- ==========================================
    DELETE FROM draft_unidentified_items
    WHERE fortnight_id = v_fortnight_id;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '✓ [2/13] draft_unidentified_items eliminados: %', v_deleted_count;

    -- ==========================================
    -- PASO 3: LIMPIAR TEMP_CLIENT_IMPORT (PRELIMINAR)
    -- ==========================================
    DELETE FROM temp_client_import
    WHERE source = 'draft_identified'
      AND notes LIKE '%Nueva Quincena%';
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '✓ [3/13] temp_client_import (preliminar) eliminados: %', v_deleted_count;

    -- ==========================================
    -- PASO 4: LIMPIAR ADVANCE_LOGS DE LA QUINCENA
    -- ==========================================
    DELETE FROM advance_logs
    WHERE fortnight_id = v_fortnight_id;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '✓ [4/13] advance_logs eliminados: %', v_deleted_count;

    -- ==========================================
    -- PASO 5: LIMPIAR RETAINED_COMMISSIONS
    -- ==========================================
    DELETE FROM retained_commissions
    WHERE fortnight_id = v_fortnight_id;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '✓ [5/13] retained_commissions eliminados: %', v_deleted_count;

    -- ==========================================
    -- PASO 6: RESETEAR BANK_TRANSFERS_COMM
    -- ==========================================
    IF v_import_ids IS NOT NULL AND array_length(v_import_ids, 1) > 0 THEN
        -- Obtener IDs de transfers vinculadas a esta quincena
        UPDATE bank_transfers_comm
        SET status = 'pending'
        WHERE id IN (
            SELECT DISTINCT transfer_id 
            FROM bank_transfer_imports
            WHERE import_id = ANY(v_import_ids)
               OR fortnight_paid_id = v_fortnight_id
        );
        
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        RAISE NOTICE '✓ [6/13] bank_transfers_comm reseteadas a pending: %', v_deleted_count;
    ELSE
        RAISE NOTICE '✓ [6/13] No hay transfers para resetear';
    END IF;

    -- ==========================================
    -- PASO 7: RESETEAR BANK_GROUPS
    -- ==========================================
    UPDATE bank_groups
    SET status = 'pending', 
        fortnight_paid_id = NULL
    WHERE fortnight_paid_id = v_fortnight_id;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '✓ [7/13] bank_groups reseteados: %', v_deleted_count;

    -- ==========================================
    -- PASO 8: ELIMINAR BANK_TRANSFER_IMPORTS
    -- ==========================================
    IF v_import_ids IS NOT NULL AND array_length(v_import_ids, 1) > 0 THEN
        DELETE FROM bank_transfer_imports
        WHERE import_id = ANY(v_import_ids)
           OR fortnight_paid_id = v_fortnight_id;
        
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        RAISE NOTICE '✓ [8/13] bank_transfer_imports eliminados: %', v_deleted_count;
    ELSE
        RAISE NOTICE '✓ [8/13] No hay bank_transfer_imports';
    END IF;

    -- ==========================================
    -- PASO 9: ELIMINAR BANK_GROUP_IMPORTS
    -- ==========================================
    IF v_import_ids IS NOT NULL AND array_length(v_import_ids, 1) > 0 THEN
        DELETE FROM bank_group_imports
        WHERE import_id = ANY(v_import_ids)
           OR fortnight_paid_id = v_fortnight_id;
        
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        RAISE NOTICE '✓ [9/13] bank_group_imports eliminados: %', v_deleted_count;
    ELSE
        RAISE NOTICE '✓ [9/13] No hay bank_group_imports';
    END IF;

    -- ==========================================
    -- PASO 10: ELIMINAR FORTNIGHT_BROKER_TOTALS
    -- ==========================================
    DELETE FROM fortnight_broker_totals
    WHERE fortnight_id = v_fortnight_id;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '✓ [10/13] fortnight_broker_totals eliminados: %', v_deleted_count;

    -- ==========================================
    -- PASO 11: ELIMINAR FORTNIGHT_DETAILS
    -- ==========================================
    DELETE FROM fortnight_details
    WHERE fortnight_id = v_fortnight_id;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '✓ [11/13] fortnight_details eliminados: %', v_deleted_count;

    -- ==========================================
    -- PASO 12: ELIMINAR COMM_IMPORTS
    -- ==========================================
    IF v_import_ids IS NOT NULL AND array_length(v_import_ids, 1) > 0 THEN
        DELETE FROM comm_imports
        WHERE id = ANY(v_import_ids);
        
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        RAISE NOTICE '✓ [12/13] comm_imports eliminados: %', v_deleted_count;
    ELSE
        RAISE NOTICE '✓ [12/13] No hay comm_imports';
    END IF;

    -- ==========================================
    -- PASO 13: VERIFICACIÓN FINAL
    -- ==========================================
    RAISE NOTICE '✓ [13/13] Verificación final...';
    
    -- Contar lo que queda vinculado a esta quincena
    DECLARE
        v_remaining_items INT;
        v_remaining_draft INT;
        v_remaining_totals INT;
    BEGIN
        SELECT COUNT(*) INTO v_remaining_items
        FROM comm_items
        WHERE import_id IN (
            SELECT id FROM comm_imports WHERE period_label = v_fortnight_id::text
        );

        SELECT COUNT(*) INTO v_remaining_draft
        FROM draft_unidentified_items
        WHERE fortnight_id = v_fortnight_id;

        SELECT COUNT(*) INTO v_remaining_totals
        FROM fortnight_broker_totals
        WHERE fortnight_id = v_fortnight_id;

        RAISE NOTICE '   - comm_items restantes: %', v_remaining_items;
        RAISE NOTICE '   - draft_unidentified_items restantes: %', v_remaining_draft;
        RAISE NOTICE '   - fortnight_broker_totals restantes: %', v_remaining_totals;

        IF v_remaining_items = 0 AND v_remaining_draft = 0 AND v_remaining_totals = 0 THEN
            RAISE NOTICE '   ✅ LIMPIEZA COMPLETA - Todo eliminado correctamente';
        ELSE
            RAISE NOTICE '   ⚠️ Quedan algunos registros (revisar)';
        END IF;
    END;

    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ RESET TOTAL COMPLETADO';
    RAISE NOTICE 'Quincena % lista para empezar de 0', v_fortnight_id;
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '📋 PRÓXIMOS PASOS:';
    RAISE NOTICE '1. Recarga la página (F5)';
    RAISE NOTICE '2. Verifica que Nueva Quincena esté vacía';
    RAISE NOTICE '3. Importa reportes de aseguradoras';
    RAISE NOTICE '4. Vincula transferencias bancarias';
    RAISE NOTICE '5. Documenta cada paso';
    RAISE NOTICE '';

END $$;
