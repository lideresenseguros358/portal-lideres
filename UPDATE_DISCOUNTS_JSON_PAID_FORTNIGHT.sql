-- ============================================================================
-- SQL PARA ACTUALIZAR discounts_json EN QUINCENA PAGADA
-- ============================================================================
-- Este script actualiza el campo discounts_json en fortnight_broker_totals
-- agregando el campo "details" desde los advance_logs existentes.
--
-- IMPORTANTE: Solo para la quincena b3836d79-d63d-474e-a9fe-fdffe43fc37e
-- ============================================================================

-- PASO 1: VERIFICAR ESTADO ACTUAL
-- Ver qué tienen los brokers en discounts_json actualmente
SELECT 
    fbt.broker_id,
    b.name as broker_name,
    fbt.gross_amount,
    fbt.net_amount,
    fbt.discounts_json,
    (fbt.discounts_json->>'total')::numeric as discount_total,
    jsonb_array_length(COALESCE(fbt.discounts_json->'adelantos', '[]'::jsonb)) as adelantos_count,
    CASE 
        WHEN fbt.discounts_json ? 'details' THEN 'SÍ TIENE'
        ELSE 'NO TIENE'
    END as tiene_details
FROM fortnight_broker_totals fbt
JOIN brokers b ON fbt.broker_id = b.id
WHERE fbt.fortnight_id = 'b3836d79-d63d-474e-a9fe-fdffe43fc37e'
  AND (fbt.discounts_json->>'total')::numeric > 0
ORDER BY b.name;

-- Esperado: 5 brokers con discounts pero sin campo "details"

-- ============================================================================
-- PASO 2: VER ADVANCE_LOGS DE ESTA QUINCENA
-- ============================================================================
SELECT 
    al.id as log_id,
    al.advance_id,
    al.amount,
    al.payment_type,
    a.broker_id,
    b.name as broker_name,
    a.reason as advance_reason,
    a.status as advance_status
FROM advance_logs al
JOIN advances a ON al.advance_id = a.id
JOIN brokers b ON a.broker_id = b.id
WHERE al.fortnight_id = 'b3836d79-d63d-474e-a9fe-fdffe43fc37e'
  AND al.payment_type = 'fortnight'
ORDER BY b.name, al.created_at;

-- Esperado: 5 logs (uno por cada descuento aplicado)

-- ============================================================================
-- PASO 3: ACTUALIZAR discounts_json CON CAMPO details
-- ============================================================================

BEGIN;

-- Actualizar cada broker agregando el campo "details" desde sus advance_logs
DO $$
DECLARE
    v_fortnight_id uuid := 'b3836d79-d63d-474e-a9fe-fdffe43fc37e';
    broker_record RECORD;
    log_record RECORD;
    v_adelantos jsonb;
    v_details jsonb;
    v_total numeric;
BEGIN
    -- Iterar sobre cada broker con descuentos en esta quincena
    FOR broker_record IN 
        SELECT DISTINCT
            fbt.broker_id,
            fbt.id as fbt_id,
            b.name as broker_name,
            fbt.discounts_json
        FROM fortnight_broker_totals fbt
        JOIN brokers b ON fbt.broker_id = b.id
        WHERE fbt.fortnight_id = v_fortnight_id
          AND (fbt.discounts_json->>'total')::numeric > 0
    LOOP
        RAISE NOTICE '========================================';
        RAISE NOTICE 'Procesando: %', broker_record.broker_name;
        
        -- Obtener adelantos desde advance_logs
        v_adelantos := '[]'::jsonb;
        v_details := '[]'::jsonb;
        v_total := 0;
        
        FOR log_record IN
            SELECT 
                al.advance_id,
                al.amount,
                a.reason
            FROM advance_logs al
            JOIN advances a ON al.advance_id = a.id
            WHERE al.fortnight_id = v_fortnight_id
              AND al.payment_type = 'fortnight'
              AND a.broker_id = broker_record.broker_id
        LOOP
            -- Agregar a adelantos (formato antiguo)
            v_adelantos := v_adelantos || jsonb_build_object(
                'advance_id', log_record.advance_id,
                'amount', log_record.amount,
                'description', log_record.reason
            );
            
            -- Agregar a details (formato para exportables)
            v_details := v_details || jsonb_build_object(
                'reason', log_record.reason,
                'amount', log_record.amount
            );
            
            v_total := v_total + log_record.amount;
            
            RAISE NOTICE '  + Adelanto: % - $%', log_record.reason, log_record.amount;
        END LOOP;
        
        -- Construir nuevo discounts_json completo
        DECLARE
            v_new_discounts_json jsonb;
        BEGIN
            v_new_discounts_json := jsonb_build_object(
                'adelantos', v_adelantos,
                'total', v_total,
                'details', v_details
            );
            
            -- Actualizar fortnight_broker_totals
            UPDATE fortnight_broker_totals
            SET discounts_json = v_new_discounts_json
            WHERE id = broker_record.fbt_id;
            
            RAISE NOTICE '  ✓ Actualizado discounts_json';
            RAISE NOTICE '    - Total: $%', v_total;
            RAISE NOTICE '    - Adelantos: %', jsonb_array_length(v_adelantos);
            RAISE NOTICE '    - Details: %', jsonb_array_length(v_details);
        END;
        
        RAISE NOTICE '========================================';
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ PROCESO COMPLETADO';
END $$;

-- Si todo salió bien, confirmar cambios
COMMIT;

-- Si hubo algún error, deshacer cambios:
-- ROLLBACK;

-- ============================================================================
-- PASO 4: VERIFICAR RESULTADO
-- ============================================================================

-- Ver discounts_json actualizado
SELECT 
    b.name as broker_name,
    fbt.gross_amount,
    (fbt.discounts_json->>'total')::numeric as discount_total,
    fbt.net_amount,
    jsonb_array_length(fbt.discounts_json->'adelantos') as adelantos_count,
    jsonb_array_length(fbt.discounts_json->'details') as details_count,
    fbt.discounts_json->'details' as details_completo
FROM fortnight_broker_totals fbt
JOIN brokers b ON fbt.broker_id = b.id
WHERE fbt.fortnight_id = 'b3836d79-d63d-474e-a9fe-fdffe43fc37e'
  AND (fbt.discounts_json->>'total')::numeric > 0
ORDER BY b.name;

-- Esperado para LUIS QUIROS:
-- {
--   "adelantos": [...],
--   "total": 200,
--   "details": [
--     {"reason": "abono auto (Recurrente Q2)", "amount": 200}
--   ]
-- }

-- Ver detalle completo de LUIS QUIROS
SELECT 
    b.name,
    fbt.gross_amount as bruto,
    (fbt.discounts_json->>'total')::numeric as descuentos,
    fbt.net_amount as neto,
    jsonb_pretty(fbt.discounts_json) as discounts_json_pretty
FROM fortnight_broker_totals fbt
JOIN brokers b ON fbt.broker_id = b.id
WHERE fbt.fortnight_id = 'b3836d79-d63d-474e-a9fe-fdffe43fc37e'
  AND b.name = 'LUIS QUIROS';

-- Esperado:
-- bruto: 1994.91
-- descuentos: 200.00
-- neto: 1794.91
-- details: [{"reason": "abono auto (Recurrente Q2)", "amount": 200}]

-- ============================================================================
-- NOTAS IMPORTANTES:
-- ============================================================================
-- 1. Este SQL solo afecta la quincena b3836d79-d63d-474e-a9fe-fdffe43fc37e
-- 2. Reconstruye discounts_json desde advance_logs (fuente de verdad)
-- 3. Agrega campo "details" necesario para exportables PDF/Excel
-- 4. No modifica advance_logs ni advances (solo fortnight_broker_totals)
-- 5. Ejecutar PASO 1 primero para verificar estado actual
-- 6. Ejecutar PASO 3 (BEGIN hasta COMMIT) para actualizar
-- 7. Ejecutar PASO 4 para verificar que quedó correcto
-- 8. Después de ejecutar, refrescar navegador para ver cambios en UI
-- ============================================================================
