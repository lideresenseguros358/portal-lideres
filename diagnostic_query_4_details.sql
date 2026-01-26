-- QUERY 4: Ver detalles específicos de los 220 items en draft_unidentified_items
-- Esta query muestra si hay items con import_id inválido o problemas de relación

SELECT 
    dui.id,
    dui.policy_number,
    dui.insured_name,
    dui.commission_raw,
    ins.name as aseguradora,
    br.name as broker_asignado_temp,
    dui.temp_assigned_at,
    dui.import_id,
    ci.id as import_existe,
    ci.total_amount as import_total,
    ci.created_at as import_created_at,
    CASE 
        WHEN ci.id IS NULL THEN '❌ IMPORT NO EXISTE (HUÉRFANO)'
        WHEN dui.temp_assigned_broker_id IS NOT NULL THEN '✓ Identificado temporalmente'
        ELSE '⚠️ Sin identificar'
    END as status_detallado,
    dui.created_at,
    dui.updated_at
FROM draft_unidentified_items dui
INNER JOIN fortnights f ON dui.fortnight_id = f.id
LEFT JOIN insurers ins ON dui.insurer_id = ins.id
LEFT JOIN brokers br ON dui.temp_assigned_broker_id = br.id
LEFT JOIN comm_imports ci ON dui.import_id = ci.id
WHERE f.status = 'DRAFT'
ORDER BY 
    CASE WHEN ci.id IS NULL THEN 0 ELSE 1 END,  -- Huérfanos primero
    dui.created_at DESC
LIMIT 50;

-- QUERY COMPLEMENTARIA: Contar items por estado de import
SELECT 
    CASE 
        WHEN ci.id IS NULL THEN '❌ Import NO existe (huérfanos)'
        ELSE '✓ Import existe'
    END as estado_import,
    COUNT(*) as cantidad
FROM draft_unidentified_items dui
INNER JOIN fortnights f ON dui.fortnight_id = f.id
LEFT JOIN comm_imports ci ON dui.import_id = ci.id
WHERE f.status = 'DRAFT'
GROUP BY CASE WHEN ci.id IS NULL THEN '❌ Import NO existe (huérfanos)' ELSE '✓ Import existe' END;

-- QUERY DE LIMPIEZA: Eliminar items huérfanos (EJECUTAR SOLO SI HAY ITEMS CON IMPORT INVÁLIDO)
/*
-- Esta query elimina items que apuntan a imports que ya no existen
DELETE FROM draft_unidentified_items
WHERE id IN (
    SELECT dui.id
    FROM draft_unidentified_items dui
    LEFT JOIN comm_imports ci ON dui.import_id = ci.id
    WHERE ci.id IS NULL
);
*/
