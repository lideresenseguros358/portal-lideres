-- ============================================
-- DEBUG: Grupos Bancarios con Errores
-- Portal Líderes
-- ============================================

-- 1. BUSCAR GRUPOS CON MONTO $0.00 o NULL
SELECT 
    id,
    created_at,
    total_amount,
    status,
    confirmed_paid_at,
    fortnight_paid_id,
    notes
FROM bank_groups
WHERE total_amount = 0 OR total_amount IS NULL
ORDER BY created_at DESC;

-- 2. BUSCAR GRUPO ASSA CON 32 TRANSFERENCIAS
WITH group_counts AS (
    SELECT 
        group_id,
        COUNT(*) as transfer_count
    FROM bank_group_transfers
    GROUP BY group_id
)
SELECT 
    bg.id,
    bg.created_at,
    bg.total_amount,
    bg.status,
    bg.confirmed_paid_at,
    bg.fortnight_paid_id,
    bg.notes,
    gc.transfer_count
FROM bank_groups bg
INNER JOIN group_counts gc ON bg.id = gc.group_id
WHERE gc.transfer_count = 32
ORDER BY bg.created_at DESC;

-- 3. VER TODAS LAS TRANSFERENCIAS DEL GRUPO DE 32
WITH assa_group AS (
    SELECT 
        group_id
    FROM bank_group_transfers
    GROUP BY group_id
    HAVING COUNT(*) = 32
    LIMIT 1
)
SELECT 
    bt.id,
    bt.reference_number,
    bt.amount,
    bt.status,
    bt.description,
    bgt.group_id
FROM bank_transfers_comm bt
INNER JOIN bank_group_transfers bgt ON bt.id = bgt.transfer_id
WHERE bgt.group_id IN (SELECT group_id FROM assa_group)
ORDER BY bt.amount DESC;

-- 4. VER SI HAY VÍNCULOS TEMPORALES PARA GRUPO ASSA
WITH assa_group AS (
    SELECT 
        group_id
    FROM bank_group_transfers
    GROUP BY group_id
    HAVING COUNT(*) = 32
    LIMIT 1
)
SELECT 
    bgi.group_id,
    bgi.import_id,
    bgi.amount_assigned,
    bgi.is_temporary,
    bgi.fortnight_paid_id,
    bgi.notes,
    ci.period_label as fortnight_id
FROM bank_group_imports bgi
LEFT JOIN comm_imports ci ON bgi.import_id = ci.id
WHERE bgi.group_id IN (SELECT group_id FROM assa_group)
ORDER BY bgi.created_at DESC;

-- 5. BUSCAR TODOS LOS GRUPOS CON CÓDIGOS ASSA
SELECT 
    bg.id,
    bg.total_amount,
    bg.status,
    bg.notes,
    COUNT(bgt.transfer_id) as transfer_count
FROM bank_groups bg
INNER JOIN bank_group_transfers bgt ON bg.id = bgt.group_id
WHERE UPPER(bg.notes) LIKE '%ASSA%'
GROUP BY bg.id
ORDER BY transfer_count DESC, bg.created_at DESC;
