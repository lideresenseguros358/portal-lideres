-- ============================================
-- REVERTIR TRANSFERENCIAS PAGADAS A PENDIENTE
-- Para transferencias huérfanas sin import/grupo
-- Portal Líderes
-- ============================================

DO $$
DECLARE
    v_reverted_count INT;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '🔄 REVIRTIENDO TRANSFERENCIAS PAGADAS';
    RAISE NOTICE '========================================';

    -- Revertir todas las transfers PAGADO a PENDIENTE
    UPDATE bank_transfers_comm
    SET status = 'PENDIENTE'
    WHERE status = 'PAGADO';
    
    GET DIAGNOSTICS v_reverted_count = ROW_COUNT;
    
    RAISE NOTICE '✓ Transferencias revertidas a PENDIENTE: %', v_reverted_count;
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ REVERTIDO COMPLETADO';
    RAISE NOTICE '';
    RAISE NOTICE '📋 PRÓXIMO PASO:';
    RAISE NOTICE 'Ejecuta RESET_TOTAL_QUINCENA.sql para limpieza completa';
    RAISE NOTICE '';

END $$;
