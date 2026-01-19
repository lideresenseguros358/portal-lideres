-- ============================================
-- LIMPIEZA DE PÓLIZAS CON NOTACIÓN CIENTÍFICA
-- ============================================
-- Excel convierte números largos a notación científica (ej: 9.4E+12)
-- Este script elimina esas pólizas duplicadas/erróneas
-- ============================================

-- PASO 1: Contar pólizas con notación científica (E+ o e+)
SELECT COUNT(*) as total_polizas_notacion_cientifica
FROM policies
WHERE policy_number ILIKE '%E+%';  -- ILIKE es case-insensitive

-- PASO 2: Ver ejemplos reales de pólizas con notación científica
SELECT 
    p.id as policy_id,
    p.policy_number,
    p.ramo,
    p.status,
    p.start_date,
    c.name as client_name,
    c.national_id,
    i.name as insurer_name
FROM policies p
LEFT JOIN clients c ON p.client_id = c.id
LEFT JOIN insurers i ON p.insurer_id = i.id
WHERE p.policy_number ILIKE '%E+%'
ORDER BY c.name, p.policy_number
LIMIT 20;

-- PASO 3: Ver si estos clientes tienen pólizas válidas (sin E+)
SELECT 
    c.id,
    c.name as client_name,
    COUNT(p.id) as total_policies,
    SUM(CASE WHEN p.policy_number ILIKE '%E+%' THEN 1 ELSE 0 END) as policies_with_scientific_notation,
    SUM(CASE WHEN p.policy_number NOT ILIKE '%E+%' THEN 1 ELSE 0 END) as policies_valid,
    STRING_AGG(DISTINCT p.policy_number, ', ') as all_policy_numbers
FROM clients c
INNER JOIN policies p ON p.client_id = c.id
WHERE c.id IN (
    SELECT DISTINCT client_id 
    FROM policies 
    WHERE policy_number ILIKE '%E+%'
)
GROUP BY c.id, c.name
ORDER BY c.name;

-- PASO 4: Buscar pólizas con patrones específicos de Excel
-- Patrones comunes: "9.4E+12", "1.23E+10", etc.
SELECT 
    policy_number,
    COUNT(*) as cantidad
FROM policies
WHERE policy_number ~ '\d+\.?\d*[Ee]\+\d+'  -- Regex para notación científica
GROUP BY policy_number
ORDER BY policy_number;

-- ============================================
-- PASO 5: ELIMINAR PÓLIZAS CON NOTACIÓN CIENTÍFICA
-- ============================================
-- ⚠️ ADVERTENCIA: Esta acción es IRREVERSIBLE
-- Solo elimina pólizas con E+ o e+ en el número
-- ============================================

-- OPCIÓN 1: Eliminar usando ILIKE (case-insensitive)
DELETE FROM policies 
WHERE policy_number ILIKE '%E+%';

-- OPCIÓN 2: Eliminar usando REGEX (más preciso)
-- DELETE FROM policies 
-- WHERE policy_number ~ '\d+\.?\d*[Ee]\+\d+';

-- ============================================
-- VERIFICACIÓN DESPUÉS DEL DELETE
-- ============================================

-- Confirmar que ya no hay pólizas con notación científica
SELECT COUNT(*) as polizas_con_notacion_cientifica_restantes
FROM policies
WHERE policy_number ILIKE '%E+%';

-- Ver si quedaron clientes sin pólizas
SELECT 
    c.id,
    c.name,
    c.national_id,
    c.email,
    c.active,
    c.broker_id
FROM clients c
LEFT JOIN policies p ON p.client_id = c.id
WHERE p.id IS NULL
ORDER BY c.name;

-- Contar clientes sin pólizas
SELECT 
    COUNT(*) as clientes_sin_polizas,
    SUM(CASE WHEN active = true THEN 1 ELSE 0 END) as activos_sin_polizas,
    SUM(CASE WHEN active = false THEN 1 ELSE 0 END) as preliminares_sin_polizas
FROM clients c
LEFT JOIN policies p ON p.client_id = c.id
WHERE p.id IS NULL;

-- ============================================
-- PASO 6 (OPCIONAL): Eliminar clientes sin pólizas
-- ============================================
-- Solo eliminar clientes preliminares (active = false) sin pólizas

-- Ver cuántos serían eliminados
SELECT COUNT(*)
FROM clients c
LEFT JOIN policies p ON p.client_id = c.id
WHERE p.id IS NULL AND c.active = false;

-- Ejecutar eliminación (descomentar para ejecutar)
-- DELETE FROM clients 
-- WHERE id IN (
--     SELECT c.id 
--     FROM clients c
--     LEFT JOIN policies p ON p.client_id = c.id
--     WHERE p.id IS NULL AND c.active = false
-- );

-- ============================================
-- RESUMEN FINAL
-- ============================================
SELECT 
    'Pólizas totales' as descripcion,
    COUNT(*) as cantidad
FROM policies

UNION ALL

SELECT 
    'Clientes totales' as descripcion,
    COUNT(*) as cantidad
FROM clients

UNION ALL

SELECT 
    'Clientes sin pólizas' as descripcion,
    COUNT(*) as cantidad
FROM clients c
LEFT JOIN policies p ON p.client_id = c.id
WHERE p.id IS NULL

UNION ALL

SELECT 
    'Pólizas con E+ restantes' as descripcion,
    COUNT(*) as cantidad
FROM policies
WHERE policy_number ILIKE '%E+%';
