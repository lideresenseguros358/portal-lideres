-- ============================================================================
-- DIAGNÓSTICO COMPLETO DE DESCUENTOS
-- ============================================================================
-- Verificar dónde están los descuentos que se aplicaron
-- ============================================================================

-- 1. VER ADVANCE_LOGS CON ESTE FORTNIGHT_ID
SELECT 
    'ADVANCE_LOGS' as tabla,
    COUNT(*) as cantidad,
    SUM(al.amount) as total_aplicado
FROM advance_logs al
WHERE al.fortnight_id = 'b3836d79-d63d-474e-a9fe-fdffe43fc37e'
  AND al.payment_type = 'fortnight';

-- Si da 0, significa que los logs NO tienen el fortnight_id correcto

-- 2. VER TODOS LOS ADVANCE_LOGS DE LOS 5 BROKERS
SELECT 
    b.name as broker_name,
    al.id as log_id,
    al.amount,
    al.payment_type,
    al.fortnight_id,
    al.created_at,
    a.reason
FROM advance_logs al
JOIN advances a ON al.advance_id = a.id
JOIN brokers b ON a.broker_id = b.id
WHERE b.name IN ('LUIS QUIROS', 'CARLOS FOOT', 'CORALIA AVILA', 'EDIS CASTILLO', 'HERICKA GONZALEZ')
  AND al.created_at >= '2026-02-01'
ORDER BY b.name, al.created_at DESC;

-- 3. VER ADVANCES DE LOS 5 BROKERS (ESTADO ACTUAL)
SELECT 
    b.name as broker_name,
    a.id as advance_id,
    a.amount as saldo_actual,
    a.status,
    a.reason,
    a.created_at
FROM advances a
JOIN brokers b ON a.broker_id = b.id
WHERE b.name IN ('LUIS QUIROS', 'CARLOS FOOT', 'CORALIA AVILA', 'EDIS CASTILLO', 'HERICKA GONZALEZ')
  AND (a.status = 'PAID' OR a.created_at >= '2026-02-01')
ORDER BY b.name, a.created_at DESC;

-- 4. VER FORTNIGHT_BROKER_TOTALS DE LA QUINCENA
SELECT 
    b.name as broker_name,
    fbt.gross_amount,
    fbt.net_amount,
    (fbt.gross_amount - fbt.net_amount) as diferencia_calculada,
    (fbt.discounts_json->>'total')::numeric as discounts_json_total,
    jsonb_pretty(fbt.discounts_json) as discounts_json
FROM fortnight_broker_totals fbt
JOIN brokers b ON fbt.broker_id = b.id
WHERE fbt.fortnight_id = 'b3836d79-d63d-474e-a9fe-fdffe43fc37e'
  AND b.name IN ('LUIS QUIROS', 'CARLOS FOOT', 'CORALIA AVILA', 'EDIS CASTILLO', 'HERICKA GONZALEZ')
ORDER BY b.name;

-- 5. VER COMM_ITEMS DE LUIS QUIROS EN ESA QUINCENA
SELECT 
    ci.policy_number,
    ci.insured_name,
    ci.commission_raw,
    ci.commission_calculated,
    ci.broker_percent_applied
FROM comm_items ci
JOIN comm_imports cim ON ci.import_id = cim.id
WHERE cim.period_label = 'b3836d79-d63d-474e-a9fe-fdffe43fc37e'
  AND ci.broker_id = (SELECT id FROM brokers WHERE name = 'LUIS QUIROS')
ORDER BY ci.commission_calculated DESC;

-- 6. SUMA TOTAL DE COMM_ITEMS PARA LUIS QUIROS
SELECT 
    b.name,
    COUNT(*) as num_polizas,
    SUM(ci.commission_calculated) as total_comision_calculada
FROM comm_items ci
JOIN comm_imports cim ON ci.import_id = cim.id
JOIN brokers b ON ci.broker_id = b.id
WHERE cim.period_label = 'b3836d79-d63d-474e-a9fe-fdffe43fc37e'
  AND b.name = 'LUIS QUIROS'
GROUP BY b.name;

-- ============================================================================
-- RESULTADOS ESPERADOS:
-- ============================================================================
-- Si los descuentos se aplicaron correctamente:
-- - ADVANCE_LOGS: Debería mostrar 5 logs con fortnight_id correcto
-- - ADVANCES: Los 5 adelantos deberían estar en status PAID con saldo 0 o reducido
-- - FORTNIGHT_BROKER_TOTALS: gross_amount - net_amount = descuento aplicado
-- - COMM_ITEMS: La suma debe coincidir con gross_amount ANTES de descuentos
-- ============================================================================
