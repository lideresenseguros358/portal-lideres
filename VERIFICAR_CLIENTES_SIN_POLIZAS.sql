-- =====================================================
-- DIAGNÓSTICO: Por qué NO se eliminaron clientes sin pólizas
-- =====================================================

-- Ver cuántos clientes sin pólizas quedan
SELECT 
  'Clientes sin pólizas actuales' as metrica,
  COUNT(*) as cantidad
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = c.id
);

-- Ver ejemplos de clientes sin pólizas
SELECT 
  c.id,
  c.name,
  c.national_id,
  c.broker_id,
  c.created_at
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = c.id
)
ORDER BY c.created_at DESC
LIMIT 20;

-- =====================================================
-- DIAGNÓSTICO: Por qué NO se pueden eliminar
-- =====================================================

-- Ver cuántos tienen referencias en fortnight_details
SELECT 
  'Clientes sin pólizas pero EN fortnight_details' as motivo,
  COUNT(DISTINCT c.id) as cantidad
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = c.id
)
AND EXISTS (
  SELECT 1 FROM fortnight_details fd WHERE fd.client_id = c.id
);

-- Ver cuántos tienen referencias en comm_items (via policy_number)
SELECT 
  'Clientes sin pólizas pero EN comm_items' as motivo,
  COUNT(DISTINCT c.id) as cantidad
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = c.id
)
AND c.id IN (
  SELECT DISTINCT p2.client_id
  FROM policies p2
  WHERE p2.policy_number IN (
    SELECT policy_number FROM comm_items
  )
);

-- Ver cuántos tienen referencias en pending_items
SELECT 
  'Clientes sin pólizas pero EN pending_items' as motivo,
  COUNT(DISTINCT c.id) as cantidad
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = c.id
)
AND c.id IN (
  SELECT DISTINCT p2.client_id
  FROM policies p2
  WHERE p2.policy_number IN (
    SELECT policy_number FROM pending_items
  )
);

-- =====================================================
-- SOLUCIÓN: Detalles específicos
-- =====================================================

-- Ver ejemplos específicos con sus referencias
SELECT 
  c.id,
  c.name,
  c.national_id,
  (SELECT COUNT(*) FROM policies WHERE client_id = c.id) as polizas,
  (SELECT COUNT(*) FROM fortnight_details WHERE client_id = c.id) as en_fortnight_details,
  'Tiene datos históricos en quincenas - NO ELIMINAR' as razon
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = c.id
)
AND EXISTS (
  SELECT 1 FROM fortnight_details fd WHERE fd.client_id = c.id
)
LIMIT 10;

-- =====================================================
-- CONCLUSIÓN
-- =====================================================

-- Estos clientes NO DEBEN eliminarse porque:
-- 1. Tienen datos históricos en fortnight_details (quincenas cerradas)
-- 2. Están referenciados en comisiones pasadas
-- 3. Eliminarlos rompería el historial de pagos

-- RECOMENDACIÓN:
-- Dejar estos clientes con 0 pólizas si tienen historial
-- Solo son "problemáticos" si NO tienen ninguna referencia
