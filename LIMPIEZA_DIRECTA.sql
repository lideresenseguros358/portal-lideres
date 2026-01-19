-- ================================================
-- LIMPIEZA DIRECTA DE CLIENTES SIN PÓLIZAS
-- Portal Líderes en Seguros
-- ================================================
-- Este script elimina clientes huérfanos INMEDIATAMENTE
-- ================================================

-- PASO 1: Ver cuántos clientes sin pólizas hay
SELECT 
  COUNT(*) as total_sin_polizas,
  'Clientes que serán eliminados' as descripcion
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = c.id
);

-- PASO 2: Ver los últimos 20 clientes que serán eliminados
SELECT 
  c.id,
  c.name,
  c.national_id,
  c.created_at,
  'Será eliminado' as status
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = c.id
)
ORDER BY c.created_at DESC
LIMIT 20;

-- ================================================
-- PASO 3: ELIMINAR (Esta línea SÍ está activa)
-- ================================================

DELETE FROM clients
WHERE id IN (
  SELECT c.id
  FROM clients c
  WHERE NOT EXISTS (
    SELECT 1 FROM policies p WHERE p.client_id = c.id
  )
);

-- ================================================
-- PASO 4: Verificación POST-ELIMINACIÓN
-- ================================================

SELECT 
  COUNT(*) as clientes_restantes,
  'Clientes después de limpieza' as descripcion
FROM clients;

SELECT 
  COUNT(DISTINCT c.id) as clientes_con_polizas,
  'Clientes que tienen al menos 1 póliza' as descripcion
FROM clients c
INNER JOIN policies p ON p.client_id = c.id;

-- ================================================
-- RESULTADO ESPERADO:
-- clientes_restantes = clientes_con_polizas
-- (Todos los clientes deben tener al menos 1 póliza)
-- ================================================
