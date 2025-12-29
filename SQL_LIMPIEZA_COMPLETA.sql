-- ============================================
-- SQL LIMPIEZA COMPLETA - Portal Líderes
-- Elimina TODO de la quincena actual EXCEPTO los imports
-- ============================================

-- 1. IDENTIFICAR LA QUINCENA DRAFT ACTUAL
DO $$
DECLARE
    v_fortnight_id UUID;
BEGIN
    -- Obtener ID de la quincena DRAFT
    SELECT id INTO v_fortnight_id
    FROM fortnights
    WHERE status = 'DRAFT'
    ORDER BY created_at DESC
    LIMIT 1;

    RAISE NOTICE 'Limpiando quincena: %', v_fortnight_id;

    -- 2. ELIMINAR COMISIONES RETENIDAS DUPLICADAS
    DELETE FROM retained_commissions
    WHERE fortnight_id = v_fortnight_id;
    RAISE NOTICE '✓ Comisiones retenidas eliminadas';

    -- 3. ELIMINAR ADVANCE LOGS DE LA QUINCENA
    DELETE FROM advance_logs
    WHERE fortnight_id = v_fortnight_id;
    RAISE NOTICE '✓ Advance logs eliminados';

    -- 4. ELIMINAR VÍNCULOS BANCARIOS TEMPORALES
    DELETE FROM bank_transfer_imports
    WHERE import_id IN (
        SELECT id FROM comm_imports WHERE period_label = v_fortnight_id
    );
    RAISE NOTICE '✓ Vínculos bancarios temporales eliminados';

    -- 5. RESETEAR TRANSFERENCIAS A ESTADO ORIGINAL
    -- (Solo las que estaban vinculadas a esta quincena)
    UPDATE bank_transfers_comm
    SET status = 'pending', confirmed_paid_at = NULL
    WHERE id IN (
        SELECT DISTINCT transfer_id 
        FROM bank_transfer_imports
        WHERE fortnight_paid_id = v_fortnight_id
    );
    RAISE NOTICE '✓ Transferencias bancarias reseteadas';

    -- 6. RESETEAR GRUPOS BANCARIOS
    UPDATE bank_groups
    SET status = 'pending', confirmed_paid_at = NULL, fortnight_paid_id = NULL
    WHERE fortnight_paid_id = v_fortnight_id;
    RAISE NOTICE '✓ Grupos bancarios reseteados';

    -- 7. ELIMINAR FORTNIGHT_BROKER_TOTALS
    DELETE FROM fortnight_broker_totals
    WHERE fortnight_id = v_fortnight_id;
    RAISE NOTICE '✓ Totales de brokers eliminados';

    -- 8. ELIMINAR FORTNIGHT_DETAILS
    DELETE FROM fortnight_details
    WHERE fortnight_id = v_fortnight_id;
    RAISE NOTICE '✓ Detalles de quincena eliminados';

    -- 9. ELIMINAR DRAFT_UNIDENTIFIED_ITEMS
    DELETE FROM draft_unidentified_items
    WHERE fortnight_id = v_fortnight_id;
    RAISE NOTICE '✓ Draft unidentified items eliminados';

    -- 10. RECALCULAR TOTALES (esto lo hará el sistema al cargar)
    RAISE NOTICE '============================================';
    RAISE NOTICE 'LIMPIEZA COMPLETA EXITOSA';
    RAISE NOTICE 'Ahora recarga la página (F5) y los totales se recalcularán automáticamente';
    RAISE NOTICE '============================================';
END $$;
