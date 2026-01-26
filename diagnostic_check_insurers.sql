-- VERIFICAR SI LOS ITEMS TIENEN INSURER_ID VÁLIDO
-- Los 220 items tienen imports válidos, pero puede que tengan insurer_id NULL o inválido

-- Query 1: Ver detalles de los items para identificar el problema
SELECT 
    dui.id,
    dui.policy_number,
    dui.insured_name,
    dui.commission_raw,
    dui.insurer_id,
    ins.id as insurer_existe,
    ins.name as aseguradora_nombre,
    dui.temp_assigned_broker_id,
    br.name as broker_nombre,
    dui.import_id,
    ci.id as import_existe,
    ci.insurer_id as import_insurer_id,
    f.id as fortnight_id,
    f.status as fortnight_status,
    CASE 
        WHEN dui.insurer_id IS NULL THEN '❌ insurer_id es NULL'
        WHEN ins.id IS NULL THEN '❌ insurer_id apunta a aseguradora inexistente'
        ELSE '✓ Insurer válido'
    END as problema_insurer
FROM draft_unidentified_items dui
INNER JOIN fortnights f ON dui.fortnight_id = f.id
LEFT JOIN insurers ins ON dui.insurer_id = ins.id
LEFT JOIN brokers br ON dui.temp_assigned_broker_id = br.id
LEFT JOIN comm_imports ci ON dui.import_id = ci.id
WHERE f.status = 'DRAFT'
ORDER BY dui.created_at DESC
LIMIT 20;

-- Query 2: Contar por problema de insurer
SELECT 
    CASE 
        WHEN dui.insurer_id IS NULL THEN '❌ insurer_id es NULL'
        WHEN ins.id IS NULL THEN '❌ insurer_id apunta a aseguradora inexistente'
        ELSE '✓ Insurer válido'
    END as problema_insurer,
    COUNT(*) as cantidad
FROM draft_unidentified_items dui
INNER JOIN fortnights f ON dui.fortnight_id = f.id
LEFT JOIN insurers ins ON dui.insurer_id = ins.id
WHERE f.status = 'DRAFT'
GROUP BY problema_insurer;

-- Query 3: Ver las aseguradoras involucradas
SELECT DISTINCT
    ins.id,
    ins.name,
    COUNT(dui.id) as items_count
FROM draft_unidentified_items dui
INNER JOIN fortnights f ON dui.fortnight_id = f.id
LEFT JOIN insurers ins ON dui.insurer_id = ins.id
WHERE f.status = 'DRAFT'
GROUP BY ins.id, ins.name
ORDER BY items_count DESC;

-- Query 4: Comparar con lo que retornaría la query de la aplicación
-- Esta simula exactamente lo que hace actionGetDraftUnidentified
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
ORDER BY dui.created_at ASC
LIMIT 10;
