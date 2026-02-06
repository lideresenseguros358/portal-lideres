-- ============================================================================
-- FIX FINAL: AGREGAR CAMPO DETAILS A DISCOUNTS_JSON
-- ============================================================================
-- Actualización directa basada en los advance_logs reales encontrados
-- ============================================================================

-- PASO 1: VER ESTADO ACTUAL DE LOS 5 BROKERS
SELECT 
    b.name as broker_name,
    fbt.gross_amount,
    fbt.net_amount,
    (fbt.gross_amount - fbt.net_amount) as descuento_aplicado,
    (fbt.discounts_json->>'total')::numeric as discounts_json_total,
    CASE 
        WHEN fbt.discounts_json ? 'details' THEN 'SÍ'
        ELSE 'NO'
    END as tiene_details,
    jsonb_pretty(fbt.discounts_json) as discounts_json_actual
FROM fortnight_broker_totals fbt
JOIN brokers b ON fbt.broker_id = b.id
WHERE fbt.fortnight_id = 'b3836d79-d63d-474e-a9fe-fdffe43fc37e'
  AND b.name IN ('CARLOS FOOT', 'CORALIA AVILA', 'EDIS CASTILLO', 'HERICKA GONZALEZ', 'LUIS QUIROS')
ORDER BY b.name;

-- ============================================================================
-- PASO 2: ACTUALIZAR CADA BROKER CON SU CAMPO DETAILS
-- ============================================================================

BEGIN;

-- 1. CARLOS FOOT - $50.00
UPDATE fortnight_broker_totals
SET discounts_json = jsonb_build_object(
    'total', 50.00,
    'adelantos', jsonb_build_array(
        jsonb_build_object(
            'advance_id', '077a9e01-b769-479b-add8-c5ba84c36f66',
            'amount', 50.00,
            'description', 'Adelanto de comisio '
        )
    ),
    'details', jsonb_build_array(
        jsonb_build_object(
            'reason', 'Adelanto de comisio ',
            'amount', 50.00
        )
    )
)
WHERE fortnight_id = 'b3836d79-d63d-474e-a9fe-fdffe43fc37e'
  AND broker_id = '36d1aa4c-bff0-482a-a35f-db88fdb0f8cc';

-- 2. CORALIA AVILA - $1.52
UPDATE fortnight_broker_totals
SET discounts_json = jsonb_build_object(
    'total', 1.52,
    'adelantos', jsonb_build_array(
        jsonb_build_object(
            'advance_id', 'bc1b5e01-248d-4a92-a90f-da62625e0d17',
            'amount', 1.52,
            'description', 'deuda a noviembre'
        )
    ),
    'details', jsonb_build_array(
        jsonb_build_object(
            'reason', 'deuda a noviembre',
            'amount', 1.52
        )
    )
)
WHERE fortnight_id = 'b3836d79-d63d-474e-a9fe-fdffe43fc37e'
  AND broker_id = 'd7456e8d-7bc6-45c5-92e8-ad7be41b6ce5';

-- 3. EDIS CASTILLO - $85.22
UPDATE fortnight_broker_totals
SET discounts_json = jsonb_build_object(
    'total', 85.22,
    'adelantos', jsonb_build_array(
        jsonb_build_object(
            'advance_id', '499d9bc1-f7ae-4959-a67b-c39570a35486',
            'amount', 85.22,
            'description', 'css (Recurrente Q2)'
        )
    ),
    'details', jsonb_build_array(
        jsonb_build_object(
            'reason', 'css (Recurrente Q2)',
            'amount', 85.22
        )
    )
)
WHERE fortnight_id = 'b3836d79-d63d-474e-a9fe-fdffe43fc37e'
  AND broker_id = '7a9be191-4338-4140-bdac-ec48552fba1c';

-- 4. HERICKA GONZALEZ - $94.73
UPDATE fortnight_broker_totals
SET discounts_json = jsonb_build_object(
    'total', 94.73,
    'adelantos', jsonb_build_array(
        jsonb_build_object(
            'advance_id', '1c342bf9-20c8-4dfd-b542-99ad6fa9409a',
            'amount', 94.73,
            'description', 'resolucion superintendencia'
        )
    ),
    'details', jsonb_build_array(
        jsonb_build_object(
            'reason', 'resolucion superintendencia',
            'amount', 94.73
        )
    )
)
WHERE fortnight_id = 'b3836d79-d63d-474e-a9fe-fdffe43fc37e'
  AND broker_id = 'e5907455-f794-412e-94ec-be5def057daf';

-- 5. LUIS QUIROS - $200.00
UPDATE fortnight_broker_totals
SET discounts_json = jsonb_build_object(
    'total', 200.00,
    'adelantos', jsonb_build_array(
        jsonb_build_object(
            'advance_id', '7233b054-d30e-42ba-919c-d21050bb9fce',
            'amount', 200.00,
            'description', 'abono auto (Recurrente Q2)'
        )
    ),
    'details', jsonb_build_array(
        jsonb_build_object(
            'reason', 'abono auto (Recurrente Q2)',
            'amount', 200.00
        )
    )
)
WHERE fortnight_id = 'b3836d79-d63d-474e-a9fe-fdffe43fc37e'
  AND broker_id = 'f681a123-0786-4d7e-89a6-a16be2a00f8d';

-- Verificar cuántos registros se actualizaron
SELECT 'Registros actualizados: ' || COUNT(*) as resultado
FROM fortnight_broker_totals fbt
WHERE fbt.fortnight_id = 'b3836d79-d63d-474e-a9fe-fdffe43fc37e'
  AND fbt.broker_id IN (
    '36d1aa4c-bff0-482a-a35f-db88fdb0f8cc', -- CARLOS FOOT
    'd7456e8d-7bc6-45c5-92e8-ad7be41b6ce5', -- CORALIA AVILA
    '7a9be191-4338-4140-bdac-ec48552fba1c', -- EDIS CASTILLO
    'e5907455-f794-412e-94ec-be5def057daf', -- HERICKA GONZALEZ
    'f681a123-0786-4d7e-89a6-a16be2a00f8d'  -- LUIS QUIROS
  );

COMMIT;

-- ============================================================================
-- PASO 3: VERIFICAR RESULTADO FINAL
-- ============================================================================

-- Ver los 5 brokers actualizados
SELECT 
    b.name as broker_name,
    fbt.gross_amount as bruto,
    (fbt.discounts_json->>'total')::numeric as descuentos,
    fbt.net_amount as neto,
    jsonb_array_length(fbt.discounts_json->'details') as details_count,
    fbt.discounts_json->'details' as details
FROM fortnight_broker_totals fbt
JOIN brokers b ON fbt.broker_id = b.id
WHERE fbt.fortnight_id = 'b3836d79-d63d-474e-a9fe-fdffe43fc37e'
  AND b.name IN ('CARLOS FOOT', 'CORALIA AVILA', 'EDIS CASTILLO', 'HERICKA GONZALEZ', 'LUIS QUIROS')
ORDER BY b.name;

-- Verificar LUIS QUIROS específicamente
SELECT 
    b.name,
    fbt.gross_amount as bruto,
    (fbt.discounts_json->>'total')::numeric as descuentos,
    fbt.net_amount as neto,
    jsonb_pretty(fbt.discounts_json) as discounts_json_completo
FROM fortnight_broker_totals fbt
JOIN brokers b ON fbt.broker_id = b.id
WHERE fbt.fortnight_id = 'b3836d79-d63d-474e-a9fe-fdffe43fc37e'
  AND b.name = 'LUIS QUIROS';

-- Resultado esperado para LUIS QUIROS:
-- bruto: 1994.91
-- descuentos: 200.00
-- neto: 1794.91
-- discounts_json_completo:
-- {
--   "total": 200.00,
--   "adelantos": [
--     {
--       "advance_id": "7233b054-d30e-42ba-919c-d21050bb9fce",
--       "amount": 200.00,
--       "description": "abono auto (Recurrente Q2)"
--     }
--   ],
--   "details": [
--     {
--       "reason": "abono auto (Recurrente Q2)",
--       "amount": 200.00
--     }
--   ]
-- }

-- ============================================================================
-- PASO 4: ACTUALIZAR TAMBIÉN GROSS Y NET AMOUNTS
-- ============================================================================
-- Si los montos bruto/neto no reflejan los descuentos, ejecutar esto:

BEGIN;

-- Actualizar net_amount restando el descuento del gross_amount
UPDATE fortnight_broker_totals fbt
SET net_amount = fbt.gross_amount - (fbt.discounts_json->>'total')::numeric
WHERE fbt.fortnight_id = 'b3836d79-d63d-474e-a9fe-fdffe43fc37e'
  AND fbt.broker_id IN (
    '36d1aa4c-bff0-482a-a35f-db88fdb0f8cc', -- CARLOS FOOT
    'd7456e8d-7bc6-45c5-92e8-ad7be41b6ce5', -- CORALIA AVILA
    '7a9be191-4338-4140-bdac-ec48552fba1c', -- EDIS CASTILLO
    'e5907455-f794-412e-94ec-be5def057daf', -- HERICKA GONZALEZ
    'f681a123-0786-4d7e-89a6-a16be2a00f8d'  -- LUIS QUIROS
  )
  AND (fbt.discounts_json->>'total')::numeric > 0;

-- Verificar
SELECT 
    b.name,
    fbt.gross_amount as bruto,
    (fbt.discounts_json->>'total')::numeric as descuentos,
    fbt.net_amount as neto,
    (fbt.gross_amount - fbt.net_amount) as diferencia
FROM fortnight_broker_totals fbt
JOIN brokers b ON fbt.broker_id = b.id
WHERE fbt.fortnight_id = 'b3836d79-d63d-474e-a9fe-fdffe43fc37e'
  AND b.name IN ('CARLOS FOOT', 'CORALIA AVILA', 'EDIS CASTILLO', 'HERICKA GONZALEZ', 'LUIS QUIROS')
ORDER BY b.name;

COMMIT;

-- ============================================================================
-- INSTRUCCIONES FINALES:
-- ============================================================================
-- 1. Ejecutar PASO 1 para ver estado actual
-- 2. Ejecutar PASO 2 (BEGIN hasta COMMIT) para agregar campo details
-- 3. Ejecutar PASO 3 para verificar que quedó correcto
-- 4. Si gross_amount - net_amount != descuentos, ejecutar PASO 4
-- 5. Refrescar navegador (Ctrl+Shift+R) y verificar en Historial de Quincenas
-- ============================================================================
