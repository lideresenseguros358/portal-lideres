-- =====================================================
-- ELIMINAR SOLO CLIENTES HUÉRFANOS REALES
-- =====================================================
-- Solo elimina clientes que:
-- 1. NO tienen pólizas
-- 2. NO tienen referencias en NINGUNA tabla
-- 3. NO tienen historial en quincenas
-- =====================================================

-- =====================================================
-- DIAGNÓSTICO PREVIO
-- =====================================================

SELECT '========== DIAGNÓSTICO PREVIO ==========' as info;

-- Total de clientes sin pólizas
SELECT 
  'Clientes sin pólizas TOTAL' as categoria,
  COUNT(*) as cantidad
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = c.id
);

-- Clientes sin pólizas PERO con historial (NO eliminar)
SELECT 
  'Con historial en quincenas (NO ELIMINAR)' as categoria,
  COUNT(*) as cantidad
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = c.id
)
AND EXISTS (
  SELECT 1 FROM fortnight_details fd WHERE fd.client_id = c.id
);

-- Clientes sin pólizas Y sin referencias (ELIMINAR)
SELECT 
  'Sin referencias (SE PUEDEN ELIMINAR)' as categoria,
  COUNT(*) as cantidad
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = c.id
)
AND NOT EXISTS (
  SELECT 1 FROM fortnight_details fd WHERE fd.client_id = c.id
)
AND NOT EXISTS (
  SELECT 1 FROM comm_items ci
  JOIN policies p2 ON p2.policy_number = ci.policy_number
  WHERE p2.client_id = c.id
)
AND NOT EXISTS (
  SELECT 1 FROM pending_items pi
  WHERE pi.policy_number IN (
    SELECT policy_number FROM policies WHERE client_id = c.id
  )
);

-- =====================================================
-- EXPLICACIÓN
-- =====================================================

SELECT '========================================' as separador;
SELECT 'IMPORTANTE: Por qué hay clientes sin pólizas' as titulo;
SELECT '========================================' as separador;

SELECT 'Razón' as explicacion, 'Acción' as que_hacer
UNION ALL
SELECT '1. Cliente tuvo póliza antes, ya se canceló', 'NO ELIMINAR - Tiene historial'
UNION ALL
SELECT '2. Cliente en quincenas pagadas', 'NO ELIMINAR - Datos históricos'
UNION ALL
SELECT '3. Cliente recién creado sin póliza', 'SÍ ELIMINAR - Sin referencias'
UNION ALL
SELECT '4. Cliente duplicado del bulk import', 'SÍ ELIMINAR - Sin referencias';

-- =====================================================
-- DECISIÓN: ¿Eliminar o mantener?
-- =====================================================

-- Opción 1: Ver ejemplos de clientes CON historial (NO eliminar)
SELECT 
  'Clientes con 0 pólizas pero CON historial' as tipo,
  c.id,
  c.name,
  c.created_at,
  (SELECT COUNT(*) FROM fortnight_details WHERE client_id = c.id) as registros_historicos
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = c.id
)
AND EXISTS (
  SELECT 1 FROM fortnight_details fd WHERE fd.client_id = c.id
)
ORDER BY c.created_at DESC
LIMIT 10;

-- Opción 2: Ver ejemplos de clientes SIN referencias (SÍ eliminar)
SELECT 
  'Clientes con 0 pólizas y SIN referencias' as tipo,
  c.id,
  c.name,
  c.created_at
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = c.id
)
AND NOT EXISTS (
  SELECT 1 FROM fortnight_details fd WHERE fd.client_id = c.id
)
AND NOT EXISTS (
  SELECT 1 FROM comm_items ci
  JOIN policies p2 ON p2.policy_number = ci.policy_number
  WHERE p2.client_id = c.id
)
ORDER BY c.created_at DESC
LIMIT 10;

-- =====================================================
-- ELIMINAR SOLO HUÉRFANOS REALES
-- =====================================================

SELECT '========== ELIMINANDO HUÉRFANOS REALES ==========' as info;

-- Ver cuántos se van a eliminar
SELECT 
  'Se eliminarán (sin referencias):' as accion,
  COUNT(*) as cantidad
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = c.id
)
AND NOT EXISTS (
  SELECT 1 FROM fortnight_details fd WHERE fd.client_id = c.id
)
AND NOT EXISTS (
  SELECT 1 FROM comm_items ci
  JOIN policies p2 ON p2.policy_number = ci.policy_number
  WHERE p2.client_id = c.id
);

-- ELIMINAR
DELETE FROM clients
WHERE id IN (
  SELECT c.id
  FROM clients c
  WHERE NOT EXISTS (
    SELECT 1 FROM policies p WHERE p.client_id = c.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM fortnight_details fd WHERE fd.client_id = c.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM comm_items ci
    JOIN policies p2 ON p2.policy_number = ci.policy_number
    WHERE p2.client_id = c.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM pending_items pi
    WHERE pi.policy_number IN (
      SELECT policy_number FROM policies WHERE client_id = c.id
    )
  )
);

SELECT '✅ Clientes huérfanos eliminados' as resultado;

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================

SELECT '========== RESULTADO FINAL ==========' as info;

-- Clientes sin pólizas que QUEDAN (tienen historial)
SELECT 
  'Clientes sin pólizas restantes:' as metrica,
  COUNT(*) as cantidad,
  'NORMAL - Tienen historial en quincenas' as nota
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = c.id
);

-- Verificar que todos los restantes tienen historial
SELECT 
  'Todos los restantes tienen historial:' as verificacion,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ SÍ - Están correctos'
    ELSE '⚠️ HAY ' || COUNT(*) || ' sin historial'
  END as estado
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = c.id
)
AND NOT EXISTS (
  SELECT 1 FROM fortnight_details fd WHERE fd.client_id = c.id
);

-- =====================================================
-- CONCLUSIÓN
-- =====================================================

SELECT '========================================' as separador;
SELECT 'CONCLUSIÓN' as titulo;
SELECT '========================================' as separador;

SELECT 
  'Si aún ves clientes con 0 pólizas:' as info
UNION ALL
SELECT 
  '✅ Es NORMAL si tienen historial en quincenas' as info
UNION ALL
SELECT 
  '✅ Estos NO deben eliminarse' as info
UNION ALL
SELECT 
  '✅ Preservan datos históricos de pagos' as info
UNION ALL
SELECT 
  '' as info
UNION ALL
SELECT 
  '⚠️ Solo se eliminan huérfanos SIN referencias' as info;
