-- ====================================================================
-- BÚSQUEDA EXHAUSTIVA DE M3M ECO-ENERGIAS, S.A. EN TODA LA BASE DE DATOS
-- Póliza: 1257097 (INTERNACIONAL)
-- ====================================================================

-- Query 1: BUSCAR EN draft_unidentified_items
SELECT 
    '1️⃣ draft_unidentified_items' as tabla,
    dui.id,
    dui.policy_number,
    dui.insured_name,
    dui.commission_raw,
    dui.insurer_id,
    ins.name as aseguradora,
    dui.import_id,
    ci.id as import_existe,
    ci.insurer_id as import_insurer_id,
    dui.fortnight_id,
    f.id as fortnight_existe,
    f.status as fortnight_status,
    dui.temp_assigned_broker_id,
    br.name as broker_temp,
    dui.created_at
FROM draft_unidentified_items dui
LEFT JOIN insurers ins ON dui.insurer_id = ins.id
LEFT JOIN comm_imports ci ON dui.import_id = ci.id
LEFT JOIN fortnights f ON dui.fortnight_id = f.id
LEFT JOIN brokers br ON dui.temp_assigned_broker_id = br.id
WHERE 
    dui.insured_name ILIKE '%M3M%'
    OR dui.policy_number = '1257097';

-- Query 2: BUSCAR EN comm_items
SELECT 
    '2️⃣ comm_items' as tabla,
    ci.id,
    ci.policy_number,
    ci.insured_name,
    ci.gross_amount,
    ci.insurer_id,
    ins.name as aseguradora,
    ci.import_id,
    imp.period_label as fortnight_id,
    f.status as fortnight_status,
    ci.broker_id,
    br.name as broker,
    ci.created_at
FROM comm_items ci
LEFT JOIN insurers ins ON ci.insurer_id = ins.id
LEFT JOIN comm_imports imp ON ci.import_id = imp.id
LEFT JOIN fortnights f ON imp.period_label::uuid = f.id
LEFT JOIN brokers br ON ci.broker_id = br.id
WHERE 
    ci.insured_name ILIKE '%M3M%'
    OR ci.policy_number = '1257097';

-- Query 3: BUSCAR EN pending_items
SELECT 
    '3️⃣ pending_items' as tabla,
    pi.id,
    pi.policy_number,
    pi.insured_name,
    pi.commission_raw,
    pi.insurer_id,
    ins.name as aseguradora,
    pi.fortnight_id,
    f.status as fortnight_status,
    pi.assigned_broker_id,
    br.name as broker,
    pi.status as item_status,
    pi.created_at
FROM pending_items pi
LEFT JOIN insurers ins ON pi.insurer_id = ins.id
LEFT JOIN fortnights f ON pi.fortnight_id = f.id
LEFT JOIN brokers br ON pi.assigned_broker_id = br.id
WHERE 
    pi.insured_name ILIKE '%M3M%'
    OR pi.policy_number = '1257097';

-- Query 4: BUSCAR EN policies (pólizas registradas)
SELECT 
    '4️⃣ policies' as tabla,
    p.id,
    p.policy_number,
    p.insurer_id,
    ins.name as aseguradora,
    p.client_id,
    c.name as cliente,
    p.broker_id,
    br.name as broker,
    p.created_at
FROM policies p
LEFT JOIN insurers ins ON p.insurer_id = ins.id
LEFT JOIN clients c ON p.client_id = c.id
LEFT JOIN brokers br ON p.broker_id = br.id
WHERE 
    c.name ILIKE '%M3M%'
    OR p.policy_number = '1257097';

-- Query 5: BUSCAR EN clients
SELECT 
    '5️⃣ clients' as tabla,
    c.id,
    c.name,
    c.email,
    c.broker_id,
    br.name as broker,
    c.created_at
FROM clients c
LEFT JOIN brokers br ON c.broker_id = br.id
WHERE 
    c.name ILIKE '%M3M%';

-- Query 6: BUSCAR EN claims (reclamos) - TABLA NO EXISTE, SKIP
-- La tabla 'claims' no existe en este schema

-- ====================================================================
-- Query 7: BUSCAR IMPORTS DE INTERNACIONAL
-- ====================================================================
SELECT 
    '7️⃣ comm_imports INTERNACIONAL' as info,
    ci.id as import_id,
    ci.total_amount,
    ci.period_label as fortnight_id,
    f.status as fortnight_status,
    f.period_start,
    f.period_end,
    ci.insurer_id,
    ins.name as aseguradora,
    ci.created_at,
    (SELECT COUNT(*) FROM comm_items WHERE import_id = ci.id) as items_identificados,
    (SELECT COUNT(*) FROM draft_unidentified_items WHERE import_id = ci.id) as items_en_draft
FROM comm_imports ci
INNER JOIN insurers ins ON ci.insurer_id = ins.id
LEFT JOIN fortnights f ON ci.period_label::uuid = f.id
WHERE ins.name ILIKE '%INTERNACIONAL%'
    AND f.status = 'DRAFT'
ORDER BY ci.created_at DESC;

-- ====================================================================
-- Query 8: VERIFICAR SI HAY CONSTRAINT VIOLATIONS O DUPLICADOS
-- ====================================================================
SELECT 
    '8️⃣ DUPLICADOS en draft_unidentified_items' as info,
    fortnight_id,
    import_id,
    policy_number,
    insured_name,
    COUNT(*) as cantidad
FROM draft_unidentified_items
WHERE 
    insured_name ILIKE '%M3M%'
    OR policy_number = '1257097'
GROUP BY fortnight_id, import_id, policy_number, insured_name
HAVING COUNT(*) > 1;

-- ====================================================================
-- Query 9: VER ESTRUCTURA COMPLETA DEL ITEM ESPECÍFICO
-- ====================================================================
SELECT 
    '9️⃣ ANÁLISIS COMPLETO MSM ECO-ENERGIAS' as seccion,
    dui.*,
    ins.name as insurer_name,
    ins.invert_negatives as insurer_invert,
    ci.total_amount as import_total,
    f.status as fortnight_status,
    f.period_start,
    f.period_end
FROM draft_unidentified_items dui
LEFT JOIN insurers ins ON dui.insurer_id = ins.id
LEFT JOIN comm_imports ci ON dui.import_id = ci.id
LEFT JOIN fortnights f ON dui.fortnight_id = f.id
WHERE 
    (dui.insured_name ILIKE '%M3M ECO-ENERGIAS%' OR dui.insured_name ILIKE '%M3M%' OR dui.policy_number = '1257097')
ORDER BY dui.created_at DESC;

-- ====================================================================
-- Query 10: VERIFICAR SI EL COMPONENTE TIENE FILTROS ADICIONALES
-- Simular EXACTAMENTE la query que usa DraftUnidentifiedTable.tsx
-- ====================================================================
SELECT 
    '🔟 QUERY EXACTA DE LA APP' as info,
    dui.id,
    dui.policy_number,
    dui.insured_name,
    dui.commission_raw,
    dui.temp_assigned_broker_id,
    dui.temp_assigned_at,
    dui.created_at,
    json_build_object(
        'id', ins.id,
        'name', ins.name,
        'invert_negatives', ins.invert_negatives
    ) as insurers_json,
    json_build_object(
        'id', br.id,
        'name', br.name
    ) as brokers_json
FROM draft_unidentified_items dui
LEFT JOIN insurers ins ON dui.insurer_id = ins.id
LEFT JOIN brokers br ON dui.temp_assigned_broker_id = br.id
WHERE dui.fortnight_id = '2e9637a7-8095-40c9-8419-d7e4a83aed7d'  -- FORTNIGHT DRAFT ACTUAL
AND ins.name ILIKE '%INTERNACIONAL%'
ORDER BY dui.created_at ASC;

-- ====================================================================
-- QUERY DE LIMPIEZA: Si encuentras duplicados o huérfanos
-- ====================================================================
/*
-- SOLO EJECUTAR SI ENCUENTRAS PROBLEMAS

-- Opción 1: Eliminar duplicados manteniendo el más reciente
WITH ranked_items AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (
            PARTITION BY fortnight_id, import_id, policy_number, insured_name
            ORDER BY created_at DESC
        ) as rn
    FROM draft_unidentified_items
    WHERE insured_name ILIKE '%M3M%' OR policy_number = '1257097'
)
DELETE FROM draft_unidentified_items
WHERE id IN (
    SELECT id FROM ranked_items WHERE rn > 1
);

-- Opción 2: Si están en fortnight incorrecto, actualizar a DRAFT actual
UPDATE draft_unidentified_items
SET fortnight_id = '2e9637a7-8095-40c9-8419-d7e4a83aed7d'
WHERE (insured_name ILIKE '%M3M%' OR policy_number = '1257097')
AND fortnight_id != '2e9637a7-8095-40c9-8419-d7e4a83aed7d';
*/
