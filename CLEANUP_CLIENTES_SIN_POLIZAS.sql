-- ========================================
-- LIMPIAR CLIENTES SIN PÓLIZAS
-- Portal Líderes en Seguros
-- ========================================

-- Este script elimina clientes que no tienen ninguna póliza asociada
-- Útil después de una importación fallida donde se crearon clientes pero no sus pólizas

-- PASO 1: Ver cuántos clientes sin pólizas existen
SELECT 
  COUNT(*) as total_clientes_sin_polizas
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = c.id
);

-- PASO 2: Ver detalles de clientes sin pólizas (últimos 50)
SELECT 
  c.id,
  c.name,
  c.national_id,
  c.email,
  c.phone,
  c.created_at,
  b.name as broker_name
FROM clients c
LEFT JOIN brokers b ON c.broker_id = b.id
WHERE NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = c.id
)
ORDER BY c.created_at DESC
LIMIT 50;

-- PASO 3: ELIMINAR clientes sin pólizas (PRECAUCIÓN: Acción irreversible)
-- Descomenta la siguiente línea SOLO cuando estés seguro de eliminar

-- DELETE FROM clients
-- WHERE id IN (
--   SELECT c.id
--   FROM clients c
--   WHERE NOT EXISTS (
--     SELECT 1 FROM policies p WHERE p.client_id = c.id
--   )
-- );

-- VERIFICACIÓN POST-ELIMINACIÓN:
-- SELECT 
--   COUNT(*) as clientes_restantes,
--   COUNT(DISTINCT client_id) as clientes_con_polizas
-- FROM clients c
-- LEFT JOIN policies p ON p.client_id = c.id;

-- ========================================
-- ALTERNATIVA: Eliminar solo clientes sin pólizas creados hoy
-- ========================================

-- Ver clientes sin pólizas creados hoy
SELECT 
  c.id,
  c.name,
  c.created_at
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = c.id
)
AND c.created_at::date = CURRENT_DATE
ORDER BY c.created_at DESC;

-- Eliminar solo clientes sin pólizas creados hoy (descomenta para ejecutar)
-- DELETE FROM clients
-- WHERE id IN (
--   SELECT c.id
--   FROM clients c
--   WHERE NOT EXISTS (
--     SELECT 1 FROM policies p WHERE p.client_id = c.id
--   )
--   AND c.created_at::date = CURRENT_DATE
-- );

-- ========================================
-- INFORMACIÓN: Por qué ocurre este problema
-- ========================================

-- Los clientes sin pólizas pueden crearse cuando:
-- 1. La importación crea el cliente exitosamente
-- 2. Pero falla al crear la póliza (aseguradora no encontrada, póliza duplicada, etc.)
-- 3. El cliente queda "huérfano" sin pólizas

-- Este script permite limpiar esos clientes huérfanos de manera segura.
