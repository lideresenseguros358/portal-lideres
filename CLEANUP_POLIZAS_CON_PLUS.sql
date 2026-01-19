-- ============================================
-- LIMPIEZA DE PÓLIZAS CON "+" EN EL NÚMERO
-- ============================================
-- Este script elimina pólizas que tienen el símbolo "+" 
-- en su número de póliza (policy_number)
-- 
-- IMPORTANTE: Ejecutar paso por paso, revisando cada resultado
-- ============================================

-- PASO 1: Ver cuántas pólizas tienen "+" en el número
SELECT COUNT(*) as total_polizas_con_plus
FROM policies
WHERE policy_number LIKE '%+%';

-- PASO 2: Ver el listado completo de pólizas con "+" (con información del cliente)
SELECT 
    p.id as policy_id,
    p.policy_number,
    p.ramo,
    p.status,
    p.start_date,
    c.name as client_name,
    c.national_id as client_national_id,
    i.name as insurer_name
FROM policies p
LEFT JOIN clients c ON p.client_id = c.id
LEFT JOIN insurers i ON p.insurer_id = i.id
WHERE p.policy_number LIKE '%+%'
ORDER BY c.name, p.policy_number;

-- PASO 3: Verificar si estos clientes tienen otras pólizas válidas
-- (Para asegurarnos que no estamos dejando clientes sin pólizas)
SELECT 
    c.id as client_id,
    c.name as client_name,
    COUNT(p.id) as total_policies,
    SUM(CASE WHEN p.policy_number LIKE '%+%' THEN 1 ELSE 0 END) as policies_with_plus,
    SUM(CASE WHEN p.policy_number NOT LIKE '%+%' THEN 1 ELSE 0 END) as policies_valid
FROM clients c
INNER JOIN policies p ON p.client_id = c.id
WHERE c.id IN (
    SELECT DISTINCT client_id 
    FROM policies 
    WHERE policy_number LIKE '%+%'
)
GROUP BY c.id, c.name
ORDER BY c.name;

-- ============================================
-- PASO 4: ELIMINAR PÓLIZAS CON "+"
-- ============================================
-- ⚠️ ADVERTENCIA: Esta acción es IRREVERSIBLE
-- Asegúrate de haber revisado los pasos anteriores
-- ============================================

-- Descomentar la siguiente línea para ejecutar el DELETE
-- DELETE FROM policies WHERE policy_number LIKE '%+%';

-- ============================================
-- VERIFICACIÓN DESPUÉS DEL DELETE
-- ============================================

-- Verificar que ya no existen pólizas con "+"
SELECT COUNT(*) as total_polizas_con_plus_restantes
FROM policies
WHERE policy_number LIKE '%+%';

-- Ver clientes que quedaron sin pólizas después de la limpieza
-- (Estos deberían eliminarse también si están como PRELIMINAR)
SELECT 
    c.id,
    c.name,
    c.national_id,
    c.email,
    c.active
FROM clients c
LEFT JOIN policies p ON p.client_id = c.id
WHERE p.id IS NULL
ORDER BY c.name;

-- ============================================
-- OPCIONAL: Eliminar clientes que quedaron sin pólizas
-- ============================================
-- Solo si son clientes preliminares (active = false)
-- Descomentar para ejecutar:

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
    (SELECT COUNT(*) FROM policies) as total_policies_remaining,
    (SELECT COUNT(*) FROM clients) as total_clients_remaining,
    (SELECT COUNT(*) FROM clients WHERE active = false) as preliminary_clients_remaining;
