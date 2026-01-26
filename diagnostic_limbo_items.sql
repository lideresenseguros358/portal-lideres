-- ============================================
-- SQL DIAGNÓSTICO: Items en Limbo
-- ============================================
-- Este script identifica items que no aparecen en la UI
-- después de eliminar y reimportar reportes

-- 1. IDENTIFICAR ITEMS HUÉRFANOS EN draft_unidentified_items
-- (items que apuntan a imports que ya no existen)
SELECT 
    dui.id,
    dui.fortnight_id,
    dui.import_id,
    dui.policy_number,
    dui.insured_name,
    dui.commission_raw,
    dui.temp_assigned_broker_id,
    dui.temp_assigned_at,
    dui.created_at,
    'IMPORT ELIMINADO' as problema,
    i.id as import_existe
FROM draft_unidentified_items dui
LEFT JOIN comm_imports i ON dui.import_id = i.id
WHERE i.id IS NULL
ORDER BY dui.created_at DESC;

-- 2. VERIFICAR SI HAY DUPLICADOS POR CONSTRAINT ÚNICO
-- (múltiples registros con mismo fortnight_id, import_id, policy_number, insured_name)
SELECT 
    fortnight_id,
    import_id,
    policy_number,
    insured_name,
    COUNT(*) as cantidad_duplicados
FROM draft_unidentified_items
GROUP BY fortnight_id, import_id, policy_number, insured_name
HAVING COUNT(*) > 1
ORDER BY cantidad_duplicados DESC;

-- 3. BUSCAR ITEMS EN FORTNIGHT DRAFT ACTUAL
-- (reemplaza 'TU_FORTNIGHT_ID' con el ID de la quincena actual)
SELECT 
    f.id as fortnight_id,
    f.period_start,
    f.period_end,
    f.status,
    COUNT(DISTINCT ci.id) as items_en_comm_items,
    COUNT(DISTINCT dui.id) as items_en_draft_unidentified,
    COUNT(DISTINCT CASE WHEN dui.temp_assigned_broker_id IS NOT NULL THEN dui.id END) as items_identificados_temp,
    COUNT(DISTINCT CASE WHEN dui.temp_assigned_broker_id IS NULL THEN dui.id END) as items_sin_identificar
FROM fortnights f
LEFT JOIN comm_imports ci_imp ON ci_imp.period_label::uuid = f.id
LEFT JOIN comm_items ci ON ci.import_id = ci_imp.id
LEFT JOIN draft_unidentified_items dui ON dui.fortnight_id = f.id
WHERE f.status = 'DRAFT'
GROUP BY f.id, f.period_start, f.period_end, f.status
ORDER BY f.created_at DESC
LIMIT 1;

-- 4. DETALLES DE ITEMS EN DRAFT_UNIDENTIFIED_ITEMS DEL FORTNIGHT ACTUAL
-- Muestra todos los items con su estado
SELECT 
    dui.id,
    dui.policy_number,
    dui.insured_name,
    dui.commission_raw,
    ins.name as aseguradora,
    br.name as broker_asignado_temp,
    dui.temp_assigned_at,
    ci.id as import_existe,
    ci.total_amount as import_total,
    dui.created_at,
    dui.updated_at
FROM draft_unidentified_items dui
INNER JOIN fortnights f ON dui.fortnight_id = f.id
LEFT JOIN insurers ins ON dui.insurer_id = ins.id
LEFT JOIN brokers br ON dui.temp_assigned_broker_id = br.id
LEFT JOIN comm_imports ci ON dui.import_id = ci.id
WHERE f.status = 'DRAFT'
ORDER BY dui.created_at DESC;

-- 5. ITEMS EN COMM_ITEMS ASOCIADOS A LA QUINCENA DRAFT ACTUAL
SELECT 
    ci.id,
    ci.policy_number,
    ci.insured_name,
    ci.gross_amount,
    ci.broker_id,
    br.name as broker_name,
    ins.name as aseguradora,
    imp.id as import_id,
    imp.total_amount as import_total,
    ci.created_at
FROM comm_items ci
INNER JOIN comm_imports imp ON ci.import_id = imp.id
INNER JOIN fortnights f ON imp.period_label::uuid = f.id
LEFT JOIN brokers br ON ci.broker_id = br.id
LEFT JOIN insurers ins ON ci.insurer_id = ins.id
WHERE f.status = 'DRAFT'
ORDER BY ci.created_at DESC;

-- 6. BUSCAR ITEMS ESPECÍFICOS POR NOMBRE O PÓLIZA
-- (reemplaza 'NOMBRE_CLIENTE' o 'NUMERO_POLIZA' con los datos específicos)
-- Ejemplo: WHERE dui.insured_name ILIKE '%JUAN%' OR dui.policy_number = '12345'
SELECT 
    'draft_unidentified_items' as tabla,
    dui.id,
    dui.policy_number,
    dui.insured_name,
    dui.commission_raw,
    ins.name as aseguradora,
    br.name as broker_temp,
    f.status as fortnight_status,
    ci.id as import_existe,
    dui.created_at
FROM draft_unidentified_items dui
LEFT JOIN fortnights f ON dui.fortnight_id = f.id
LEFT JOIN insurers ins ON dui.insurer_id = ins.id
LEFT JOIN brokers br ON dui.temp_assigned_broker_id = br.id
LEFT JOIN comm_imports ci ON dui.import_id = ci.id
-- WHERE dui.insured_name ILIKE '%NOMBRE%' OR dui.policy_number = 'POLIZA'
ORDER BY dui.created_at DESC;

-- ============================================
-- QUERIES DE LIMPIEZA (EJECUTAR CON CUIDADO)
-- ============================================

-- LIMPIEZA 1: Eliminar items huérfanos en draft_unidentified_items
-- (items que apuntan a imports que ya no existen)
-- ADVERTENCIA: Esto eliminará permanentemente los registros huérfanos
/*
DELETE FROM draft_unidentified_items
WHERE import_id NOT IN (SELECT id FROM comm_imports);
*/

-- LIMPIEZA 2: Eliminar draft_unidentified_items de fortnights cerrados
-- (solo deberían existir en DRAFT)
/*
DELETE FROM draft_unidentified_items
WHERE fortnight_id IN (
    SELECT id FROM fortnights WHERE status != 'DRAFT'
);
*/

-- LIMPIEZA 3: Eliminar duplicados manteniendo el más reciente
-- (si existen duplicados por algún error en el constraint)
/*
WITH duplicates AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY fortnight_id, import_id, policy_number, insured_name
               ORDER BY created_at DESC
           ) as row_num
    FROM draft_unidentified_items
)
DELETE FROM draft_unidentified_items
WHERE id IN (
    SELECT id FROM duplicates WHERE row_num > 1
);
*/

-- VERIFICACIÓN FINAL: Contar items por tabla
SELECT 
    'draft_unidentified_items' as tabla,
    COUNT(*) as total_items,
    COUNT(CASE WHEN temp_assigned_broker_id IS NOT NULL THEN 1 END) as identificados_temp,
    COUNT(CASE WHEN temp_assigned_broker_id IS NULL THEN 1 END) as sin_identificar
FROM draft_unidentified_items dui
INNER JOIN fortnights f ON dui.fortnight_id = f.id
WHERE f.status = 'DRAFT'

UNION ALL

SELECT 
    'comm_items' as tabla,
    COUNT(*) as total_items,
    COUNT(CASE WHEN ci.broker_id IS NOT NULL THEN 1 END) as con_broker,
    COUNT(CASE WHEN ci.broker_id IS NULL THEN 1 END) as sin_broker
FROM comm_items ci
INNER JOIN comm_imports imp ON ci.import_id = imp.id
INNER JOIN fortnights f ON imp.period_label::uuid = f.id
WHERE f.status = 'DRAFT';
