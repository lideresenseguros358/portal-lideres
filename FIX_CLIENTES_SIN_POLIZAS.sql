-- =====================================================
-- LIMPIEZA: Clientes sin Pólizas
-- =====================================================
-- Problema: Clientes creados sin ninguna póliza asociada
-- Causa: Bulk imports antiguos que crearon clientes sin validación
-- Solución: Eliminar clientes huérfanos (sin pólizas)
-- =====================================================

-- PASO 1: INSPECCIÓN - Ver cuántos clientes sin pólizas hay
SELECT 
  'Clientes sin pólizas' as tipo,
  COUNT(*) as cantidad
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = c.id
);

-- Ver algunos ejemplos de clientes sin pólizas
SELECT 
  c.id,
  c.name,
  c.national_id,
  c.created_at,
  (SELECT COUNT(*) FROM policies WHERE client_id = c.id) as policy_count
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = c.id
)
ORDER BY c.created_at DESC
LIMIT 20;

-- =====================================================
-- PASO 2: VERIFICAR QUE NO HAYA REFERENCIAS
-- =====================================================

-- Verificar si alguno de estos clientes tiene referencias en otras tablas
-- NOTA: comm_items no tiene client_id directo, se relaciona por policy_number
SELECT 
  'Referencias en comm_items' as tabla,
  COUNT(DISTINCT ci.policy_number) as polizas_referenciadas
FROM comm_items ci
WHERE ci.policy_number IN (
  SELECT p.policy_number FROM policies p
  WHERE p.client_id IN (
    SELECT c.id FROM clients c
    WHERE NOT EXISTS (
      SELECT 1 FROM policies p2 WHERE p2.client_id = c.id
    )
  )
);

-- Verificar referencias en fortnight_details
SELECT 
  'Referencias en fortnight_details' as tabla,
  COUNT(DISTINCT fd.client_id) as clientes_referenciados
FROM fortnight_details fd
WHERE fd.client_id IN (
  SELECT c.id FROM clients c
  WHERE NOT EXISTS (
    SELECT 1 FROM policies p WHERE p.client_id = c.id
  )
);

-- =====================================================
-- PASO 3: LIMPIEZA SEGURA
-- =====================================================

-- OPCIÓN A: Eliminar SOLO clientes sin pólizas Y sin referencias
-- (MÁS SEGURO - Recomendado)
DELETE FROM clients
WHERE id IN (
  SELECT c.id 
  FROM clients c
  WHERE NOT EXISTS (
    SELECT 1 FROM policies p WHERE p.client_id = c.id
  )
  -- comm_items no tiene client_id, se verifica por policy_number
  AND NOT EXISTS (
    SELECT 1 FROM comm_items ci
    JOIN policies p ON p.policy_number = ci.policy_number
    WHERE p.client_id = c.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM fortnight_details fd WHERE fd.client_id = c.id
  )
);

-- Verificar resultado
SELECT 
  'Clientes restantes sin pólizas' as resultado,
  COUNT(*) as cantidad
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = c.id
);

-- =====================================================
-- PASO 4: REPORTE FINAL
-- =====================================================

SELECT 
  'Total de clientes' as metrica,
  COUNT(*) as cantidad
FROM clients
UNION ALL
SELECT 
  'Clientes con pólizas' as metrica,
  COUNT(DISTINCT p.client_id) as cantidad
FROM policies p
UNION ALL
SELECT 
  'Clientes sin pólizas' as metrica,
  COUNT(*) as cantidad
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = c.id
);

-- =====================================================
-- VERIFICACIÓN ADICIONAL: Pólizas huérfanas
-- =====================================================

-- Ver si hay pólizas sin cliente (no debería haber)
SELECT 
  COUNT(*) as polizas_sin_cliente
FROM policies p
WHERE p.client_id IS NULL
   OR NOT EXISTS (
     SELECT 1 FROM clients c WHERE c.id = p.client_id
   );

-- =====================================================
-- COMENTARIOS Y NOTAS
-- =====================================================

-- Este script:
-- ✅ Identifica clientes sin pólizas
-- ✅ Verifica que no tengan referencias en otras tablas
-- ✅ Elimina solo clientes seguros de eliminar
-- ✅ No toca quincenas cerradas
-- ✅ No afecta datos de comisiones existentes

-- Para ejecutar:
-- 1. Ejecutar PASO 1 primero (inspección)
-- 2. Revisar los resultados
-- 3. Ejecutar PASO 2 (verificar referencias)
-- 4. Si todo está bien, ejecutar PASO 3 (limpieza)
-- 5. Verificar con PASO 4 (reporte final)
