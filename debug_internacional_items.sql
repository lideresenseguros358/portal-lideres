-- DEBUG: Por qué los items de INTERNACIONAL no aparecen en UI
-- Los items EXISTEN en draft_unidentified_items pero NO se ven

-- ====================================================================
-- Query 1: DETALLES COMPLETOS de un item específico
-- ====================================================================
SELECT 
    '🔍 ITEM COMPLETO' as seccion,
    dui.id,
    dui.policy_number,
    dui.insured_name,
    dui.commission_raw,
    dui.insurer_id,
    dui.import_id,
    dui.fortnight_id,
    dui.temp_assigned_broker_id,
    dui.created_at,
    dui.updated_at,
    '---' as separador,
    ins.id as insurer_exists,
    ins.name as insurer_name,
    '---' as separador2,
    ci.id as import_exists,
    ci.total_amount as import_total,
    ci.period_label as import_fortnight_id,
    ci.created_at as import_created,
    '---' as separador3,
    f.id as fortnight_exists,
    f.status as fortnight_status,
    f.period_start,
    f.period_end
FROM draft_unidentified_items dui
LEFT JOIN insurers ins ON dui.insurer_id = ins.id
LEFT JOIN comm_imports ci ON dui.import_id = ci.id
LEFT JOIN fortnights f ON dui.fortnight_id = f.id
WHERE dui.id = '03ade133-9597-41a6-8731-84f6093921fa'  -- Primer item de la lista
LIMIT 1;

-- ====================================================================
-- Query 2: VALIDAR RELACIONES de todos los items INTERNACIONAL
-- ====================================================================
SELECT 
    COUNT(*) as total_items,
    COUNT(DISTINCT dui.insurer_id) as distinct_insurers,
    COUNT(DISTINCT dui.import_id) as distinct_imports,
    COUNT(DISTINCT dui.fortnight_id) as distinct_fortnights,
    COUNT(CASE WHEN ins.id IS NULL THEN 1 END) as insurer_null_or_invalid,
    COUNT(CASE WHEN ci.id IS NULL THEN 1 END) as import_not_exists,
    COUNT(CASE WHEN f.id IS NULL THEN 1 END) as fortnight_not_exists,
    COUNT(CASE WHEN f.status != 'DRAFT' THEN 1 END) as fortnight_not_draft
FROM draft_unidentified_items dui
LEFT JOIN insurers ins ON dui.insurer_id = ins.id
LEFT JOIN comm_imports ci ON dui.import_id = ci.id
LEFT JOIN fortnights f ON dui.fortnight_id = f.id
WHERE ins.name ILIKE '%INTERNACIONAL%';

-- ====================================================================
-- Query 3: VER IMPORTS de INTERNACIONAL
-- ====================================================================
SELECT DISTINCT
    ci.id as import_id,
    ci.total_amount,
    ci.period_label as fortnight_id,
    ci.insurer_id,
    ins.name as insurer_name,
    ci.created_at,
    f.status as fortnight_status,
    COUNT(dui.id) as items_en_draft
FROM comm_imports ci
INNER JOIN insurers ins ON ci.insurer_id = ins.id
LEFT JOIN fortnights f ON ci.period_label::uuid = f.id
LEFT JOIN draft_unidentified_items dui ON dui.import_id = ci.id
WHERE ins.name ILIKE '%INTERNACIONAL%'
    AND f.status = 'DRAFT'
GROUP BY ci.id, ci.total_amount, ci.period_label, ci.insurer_id, ins.name, ci.created_at, f.status
ORDER BY ci.created_at DESC;

-- ====================================================================
-- Query 4: SIMULAR QUERY DE LA APP (actionGetDraftUnidentified)
-- ====================================================================
-- Esta query es EXACTAMENTE lo que hace la app para obtener los items
SELECT 
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
    ) as insurers,
    json_build_object(
        'id', br.id,
        'name', br.name
    ) as brokers
FROM draft_unidentified_items dui
LEFT JOIN insurers ins ON dui.insurer_id = ins.id
LEFT JOIN brokers br ON dui.temp_assigned_broker_id = br.id
WHERE dui.fortnight_id = (
    SELECT id FROM fortnights WHERE status = 'DRAFT' ORDER BY created_at DESC LIMIT 1
)
AND ins.name ILIKE '%INTERNACIONAL%'
ORDER BY dui.created_at ASC
LIMIT 20;

-- ====================================================================
-- Query 5: VER FORTNIGHT ACTUAL
-- ====================================================================
SELECT 
    id,
    period_start,
    period_end,
    status,
    created_at,
    notify_brokers
FROM fortnights
WHERE status = 'DRAFT'
ORDER BY created_at DESC
LIMIT 1;

-- ====================================================================
-- Query 6: CONTAR ITEMS POR FORTNIGHT_ID
-- ====================================================================
SELECT 
    dui.fortnight_id,
    f.status as fortnight_status,
    f.period_start,
    f.period_end,
    COUNT(*) as total_items,
    COUNT(CASE WHEN ins.name ILIKE '%INTERNACIONAL%' THEN 1 END) as items_internacional
FROM draft_unidentified_items dui
LEFT JOIN fortnights f ON dui.fortnight_id = f.id
LEFT JOIN insurers ins ON dui.insurer_id = ins.id
GROUP BY dui.fortnight_id, f.status, f.period_start, f.period_end
ORDER BY total_items DESC;
