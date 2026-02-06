-- ============================================================================
-- FIX: ACTUALIZAR NET_AMOUNTS EN FORTNIGHT_BROKER_TOTALS
-- ============================================================================
-- Problema: Los net_amount no reflejan los descuentos aplicados
-- Esta quincena fue procesada antes de que la lógica de descuentos funcionara
-- ============================================================================

-- PASO 1: VER ESTADO ACTUAL
-- Verificar que net_amount NO refleja los descuentos
SELECT 
    b.name as broker_name,
    fbt.gross_amount,
    fbt.net_amount,
    (fbt.discounts_json->>'total')::numeric as descuentos,
    (fbt.gross_amount - fbt.net_amount) as diferencia_actual,
    (fbt.gross_amount - (fbt.discounts_json->>'total')::numeric) as net_correcto
FROM fortnight_broker_totals fbt
JOIN brokers b ON fbt.broker_id = b.id
WHERE fbt.fortnight_id = 'b3836d79-d63d-474e-a9fe-fdffe43fc37e'
  AND (fbt.discounts_json->>'total')::numeric > 0
ORDER BY b.name;

-- Esperado: Ver que net_amount = gross_amount (diferencia_actual = 0)
-- Pero debería ser: net_amount = gross_amount - descuentos

-- Ver totales
SELECT 
    SUM(fbt.gross_amount) as total_bruto,
    SUM(fbt.net_amount) as total_neto_actual,
    SUM((fbt.discounts_json->>'total')::numeric) as total_descuentos,
    SUM(fbt.gross_amount) - SUM((fbt.discounts_json->>'total')::numeric) as total_neto_correcto
FROM fortnight_broker_totals fbt
WHERE fbt.fortnight_id = 'b3836d79-d63d-474e-a9fe-fdffe43fc37e';

-- Esperado:
-- total_bruto: 10,165.79
-- total_neto_actual: 10,165.79 (MALO - no restó descuentos)
-- total_descuentos: 431.54
-- total_neto_correcto: 9,734.25 (CORRECTO)

-- ============================================================================
-- PASO 2: ACTUALIZAR NET_AMOUNTS
-- ============================================================================

BEGIN;

-- Actualizar TODOS los brokers que tienen descuentos en esta quincena
UPDATE fortnight_broker_totals fbt
SET net_amount = fbt.gross_amount - (fbt.discounts_json->>'total')::numeric
WHERE fbt.fortnight_id = 'b3836d79-d63d-474e-a9fe-fdffe43fc37e'
  AND (fbt.discounts_json->>'total')::numeric > 0;

-- Verificar cuántos se actualizaron
SELECT 'Brokers actualizados: ' || COUNT(*) as resultado
FROM fortnight_broker_totals fbt
WHERE fbt.fortnight_id = 'b3836d79-d63d-474e-a9fe-fdffe43fc37e'
  AND (fbt.discounts_json->>'total')::numeric > 0;

COMMIT;

-- ============================================================================
-- PASO 3: VERIFICAR RESULTADO
-- ============================================================================

-- Ver brokers actualizados
SELECT 
    b.name as broker_name,
    fbt.gross_amount as bruto,
    (fbt.discounts_json->>'total')::numeric as descuentos,
    fbt.net_amount as neto,
    (fbt.gross_amount - fbt.net_amount) as diferencia
FROM fortnight_broker_totals fbt
JOIN brokers b ON fbt.broker_id = b.id
WHERE fbt.fortnight_id = 'b3836d79-d63d-474e-a9fe-fdffe43fc37e'
  AND (fbt.discounts_json->>'total')::numeric > 0
ORDER BY b.name;

-- Esperado para LUIS QUIROS:
-- bruto: 1994.91
-- descuentos: 200.00
-- neto: 1794.91
-- diferencia: 200.00 ✅

-- Ver totales finales
SELECT 
    SUM(fbt.gross_amount) as total_bruto,
    SUM(fbt.net_amount) as total_neto,
    SUM((fbt.discounts_json->>'total')::numeric) as total_descuentos,
    SUM(fbt.gross_amount) - SUM(fbt.net_amount) as diferencia
FROM fortnight_broker_totals fbt
WHERE fbt.fortnight_id = 'b3836d79-d63d-474e-a9fe-fdffe43fc37e';

-- Esperado:
-- total_bruto: 10,165.79
-- total_neto: 9,734.25 ✅ (antes era 10,165.79)
-- total_descuentos: 431.54
-- diferencia: 431.54 ✅

-- ============================================================================
-- PASO 4: VERIFICAR EN TODA LA TABLA
-- ============================================================================

-- Ver todos los brokers de esta quincena con sus valores finales
SELECT 
    b.name,
    fbt.gross_amount,
    fbt.net_amount,
    (fbt.discounts_json->>'total')::numeric as descuentos,
    CASE 
        WHEN (fbt.discounts_json->>'total')::numeric > 0 
        THEN 'CON DESCUENTO'
        ELSE 'SIN DESCUENTO'
    END as tiene_descuento
FROM fortnight_broker_totals fbt
JOIN brokers b ON fbt.broker_id = b.id
WHERE fbt.fortnight_id = 'b3836d79-d63d-474e-a9fe-fdffe43fc37e'
ORDER BY b.name;

-- ============================================================================
-- NOTAS:
-- ============================================================================
-- 1. Este SQL actualiza SOLO la quincena b3836d79-d63d-474e-a9fe-fdffe43fc37e
-- 2. Solo afecta brokers con descuentos (discounts_json.total > 0)
-- 3. Corrige: net_amount = gross_amount - descuentos
-- 4. Los brokers sin descuentos NO se modifican (net_amount = gross_amount)
-- 5. Después de ejecutar, refrescar navegador para ver cambios
-- ============================================================================
