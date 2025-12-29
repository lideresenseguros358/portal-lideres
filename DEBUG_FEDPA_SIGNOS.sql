-- ============================================
-- DEBUG: Rastrear flujo de signos FEDPA
-- Angélica Ramos - Portal Líderes
-- ============================================

-- 1. OBTENER ÚLTIMA QUINCENA DRAFT
DO $$
DECLARE
    v_fortnight_id UUID;
    v_broker_id UUID;
BEGIN
    -- Obtener ID de la quincena DRAFT
    SELECT id INTO v_fortnight_id
    FROM fortnights
    WHERE status = 'DRAFT'
    ORDER BY created_at DESC
    LIMIT 1;

    RAISE NOTICE '========== QUINCENA DRAFT: % ==========', v_fortnight_id;

    -- Buscar broker ANGELICA RAMOS
    SELECT id INTO v_broker_id
    FROM brokers
    WHERE UPPER(name) LIKE '%ANGELICA%RAMOS%'
    LIMIT 1;

    RAISE NOTICE 'Broker Angélica Ramos ID: %', v_broker_id;

    -- 2. VER COMM_ITEMS DE FEDPA PARA ANGELICA
    RAISE NOTICE '========== COMM_ITEMS (FEDPA) ==========';
    PERFORM 
        ci.id,
        ci.policy_number,
        ci.insured_name,
        ci.gross_amount,
        ins.name as insurer_name
    FROM comm_items ci
    INNER JOIN insurers ins ON ci.insurer_id = ins.id
    WHERE ci.broker_id = v_broker_id
      AND UPPER(ins.name) LIKE '%FEDPA%'
      AND ci.import_id IN (
          SELECT id FROM comm_imports WHERE period_label = v_fortnight_id::text
      )
    ORDER BY ci.gross_amount DESC
    LIMIT 10;

    -- 3. VER DRAFT_UNIDENTIFIED_ITEMS DE FEDPA
    RAISE NOTICE '========== DRAFT_UNIDENTIFIED_ITEMS (FEDPA) ==========';
    PERFORM 
        dui.policy_number,
        dui.insured_name,
        dui.commission_raw,
        dui.temp_assigned_broker_id,
        ins.name as insurer_name
    FROM draft_unidentified_items dui
    INNER JOIN insurers ins ON dui.insurer_id = ins.id
    WHERE dui.fortnight_id = v_fortnight_id
      AND UPPER(ins.name) LIKE '%FEDPA%'
    ORDER BY dui.commission_raw DESC
    LIMIT 10;

    -- 4. VER FORTNIGHT_BROKER_TOTALS PARA ANGELICA
    RAISE NOTICE '========== FORTNIGHT_BROKER_TOTALS ==========';
    PERFORM 
        fbt.gross_amount,
        fbt.net_amount,
        fbt.discounts_json
    FROM fortnight_broker_totals fbt
    WHERE fbt.fortnight_id = v_fortnight_id
      AND fbt.broker_id = v_broker_id;

    -- 5. SI HAY QUINCENA CERRADA, VER FORTNIGHT_DETAILS
    DECLARE
        v_last_paid_fortnight UUID;
    BEGIN
        SELECT id INTO v_last_paid_fortnight
        FROM fortnights
        WHERE status = 'PAID'
        ORDER BY period_end DESC
        LIMIT 1;

        IF v_last_paid_fortnight IS NOT NULL THEN
            RAISE NOTICE '========== ÚLTIMA QUINCENA CERRADA: % ==========', v_last_paid_fortnight;
            
            -- VER FORTNIGHT_DETAILS DE FEDPA PARA ANGELICA
            RAISE NOTICE '========== FORTNIGHT_DETAILS (FEDPA) ==========';
            PERFORM 
                fd.policy_number,
                fd.client_name,
                fd.commission_raw,
                fd.percent_applied,
                fd.commission_calculated,
                ins.name as insurer_name
            FROM fortnight_details fd
            INNER JOIN insurers ins ON fd.insurer_id = ins.id
            WHERE fd.fortnight_id = v_last_paid_fortnight
              AND fd.broker_id = v_broker_id
              AND UPPER(ins.name) LIKE '%FEDPA%'
            ORDER BY fd.commission_calculated DESC
            LIMIT 10;

            -- VER TOTALES GUARDADOS
            RAISE NOTICE '========== FORTNIGHT_BROKER_TOTALS (CERRADA) ==========';
            PERFORM 
                fbt.gross_amount,
                fbt.net_amount,
                fbt.discounts_json
            FROM fortnight_broker_totals fbt
            WHERE fbt.fortnight_id = v_last_paid_fortnight
              AND fbt.broker_id = v_broker_id;
        END IF;
    END;

    -- 6. VER CONFIG DE FEDPA
    RAISE NOTICE '========== CONFIGURACIÓN FEDPA ==========';
    PERFORM 
        name,
        invert_negatives
    FROM insurers
    WHERE UPPER(name) LIKE '%FEDPA%';

END $$;
