-- BUSCAR CLIENTES ESPECÍFICOS: MSM ECO-ENERGIAS, S.A. - Póliza 1257097
-- Estos clientes no aparecen en ninguna parte de la UI

-- ====================================================================
-- BÚSQUEDA EN DRAFT_UNIDENTIFIED_ITEMS (Zona de trabajo)
-- ====================================================================
SELECT 
    '📋 draft_unidentified_items' as ubicacion,
    dui.id,
    dui.policy_number,
    dui.insured_name,
    dui.commission_raw,
    dui.insurer_id,
    ins.name as aseguradora,
    dui.temp_assigned_broker_id,
    br.name as broker_asignado,
    dui.import_id,
    ci.id as import_existe,
    ci.insurer_id as import_insurer_id,
    f.id as fortnight_id,
    f.status as fortnight_status,
    dui.created_at,
    dui.updated_at
FROM draft_unidentified_items dui
LEFT JOIN insurers ins ON dui.insurer_id = ins.id
LEFT JOIN brokers br ON dui.temp_assigned_broker_id = br.id
LEFT JOIN comm_imports ci ON dui.import_id = ci.id
LEFT JOIN fortnights f ON dui.fortnight_id = f.id
WHERE 
    dui.insured_name ILIKE '%MSM ECO-ENERGIAS%'
    OR dui.insured_name ILIKE '%MSM%ECO%'
    OR dui.policy_number = '1257097'
ORDER BY dui.created_at DESC;

-- ====================================================================
-- BÚSQUEDA EN COMM_ITEMS (Items identificados/pagados)
-- ====================================================================
SELECT 
    '✓ comm_items' as ubicacion,
    ci.id,
    ci.policy_number,
    ci.insured_name,
    ci.gross_amount,
    ci.insurer_id,
    ins.name as aseguradora,
    ci.broker_id,
    br.name as broker_asignado,
    ci.import_id,
    imp.period_label as fortnight_id,
    f.status as fortnight_status,
    ci.created_at
FROM comm_items ci
LEFT JOIN insurers ins ON ci.insurer_id = ins.id
LEFT JOIN brokers br ON ci.broker_id = br.id
LEFT JOIN comm_imports imp ON ci.import_id = imp.id
LEFT JOIN fortnights f ON imp.period_label::uuid = f.id
WHERE 
    ci.insured_name ILIKE '%MSM ECO-ENERGIAS%'
    OR ci.insured_name ILIKE '%MSM%ECO%'
    OR ci.policy_number = '1257097'
ORDER BY ci.created_at DESC;

-- ====================================================================
-- BÚSQUEDA EN PENDING_ITEMS (Items pendientes legacy)
-- ====================================================================
SELECT 
    '⏳ pending_items' as ubicacion,
    pi.id,
    pi.policy_number,
    pi.insured_name,
    pi.commission_raw,
    pi.insurer_id,
    ins.name as aseguradora,
    pi.assigned_broker_id,
    br.name as broker_asignado,
    pi.fortnight_id,
    f.status as fortnight_status,
    pi.status as item_status,
    pi.created_at
FROM pending_items pi
LEFT JOIN insurers ins ON pi.insurer_id = ins.id
LEFT JOIN brokers br ON pi.assigned_broker_id = br.id
LEFT JOIN fortnights f ON pi.fortnight_id = f.id
WHERE 
    pi.insured_name ILIKE '%MSM ECO-ENERGIAS%'
    OR pi.insured_name ILIKE '%MSM%ECO%'
    OR pi.policy_number = '1257097'
ORDER BY pi.created_at DESC;

-- ====================================================================
-- BÚSQUEDA GLOBAL - TODAS LAS TABLAS EN UNA SOLA QUERY
-- ====================================================================
(
    SELECT 
        'draft_unidentified_items' as tabla,
        id::text as item_id,
        policy_number,
        insured_name,
        commission_raw::numeric as amount,
        insurer_id::text,
        temp_assigned_broker_id::text as broker_id,
        import_id::text,
        fortnight_id::text,
        created_at,
        'DRAFT ZONE' as status_general
    FROM draft_unidentified_items
    WHERE 
        insured_name ILIKE '%MSM ECO-ENERGIAS%'
        OR insured_name ILIKE '%MSM%ECO%'
        OR policy_number = '1257097'
)
UNION ALL
(
    SELECT 
        'comm_items' as tabla,
        ci.id::text as item_id,
        ci.policy_number,
        ci.insured_name,
        ci.gross_amount as amount,
        ci.insurer_id::text,
        ci.broker_id::text,
        ci.import_id::text,
        imp.period_label as fortnight_id,
        ci.created_at,
        'IDENTIFIED/PAID' as status_general
    FROM comm_items ci
    LEFT JOIN comm_imports imp ON ci.import_id = imp.id
    WHERE 
        ci.insured_name ILIKE '%MSM ECO-ENERGIAS%'
        OR ci.insured_name ILIKE '%MSM%ECO%'
        OR ci.policy_number = '1257097'
)
UNION ALL
(
    SELECT 
        'pending_items' as tabla,
        id::text as item_id,
        policy_number,
        insured_name,
        commission_raw::numeric as amount,
        insurer_id::text,
        assigned_broker_id::text as broker_id,
        NULL as import_id,
        fortnight_id::text,
        created_at,
        status as status_general
    FROM pending_items
    WHERE 
        insured_name ILIKE '%MSM ECO-ENERGIAS%'
        OR insured_name ILIKE '%MSM%ECO%'
        OR policy_number = '1257097'
)
ORDER BY created_at DESC;

-- ====================================================================
-- VERIFICAR ASEGURADORA "INTERNACIONAL"
-- ====================================================================
SELECT 
    id,
    name,
    invert_negatives,
    created_at
FROM insurers
WHERE name ILIKE '%INTERNACIONAL%';

-- ====================================================================
-- BUSCAR TODOS LOS ITEMS DE INTERNACIONAL EN DRAFT
-- ====================================================================
SELECT 
    dui.id,
    dui.policy_number,
    dui.insured_name,
    dui.commission_raw,
    ins.name as aseguradora,
    dui.temp_assigned_broker_id,
    br.name as broker_temp,
    dui.created_at
FROM draft_unidentified_items dui
LEFT JOIN insurers ins ON dui.insurer_id = ins.id
LEFT JOIN brokers br ON dui.temp_assigned_broker_id = br.id
INNER JOIN fortnights f ON dui.fortnight_id = f.id
WHERE 
    f.status = 'DRAFT'
    AND ins.name ILIKE '%INTERNACIONAL%'
ORDER BY dui.created_at DESC
LIMIT 50;
