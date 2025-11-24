-- =====================================================
-- DIAGNÓSTICO: Clientes duplicados por mismo policy_number
-- =====================================================
-- Teoría: El bulk import intentó crear un cliente por cada
-- comisión del mismo policy_number, creando duplicados
-- =====================================================

SELECT '========== DIAGNÓSTICO ==========' as info;

-- =====================================================
-- PASO 1: Verificar clientes duplicados por nombre
-- =====================================================

-- Ver si hay clientes sin póliza con nombres similares a clientes CON póliza
SELECT 
  'Clientes sin póliza vs clientes con póliza (mismo nombre)' as categoria,
  c_sin.id as cliente_sin_poliza_id,
  c_sin.name as nombre_sin_poliza,
  c_con.id as cliente_con_poliza_id,
  c_con.name as nombre_con_poliza,
  (SELECT COUNT(*) FROM policies WHERE client_id = c_con.id) as polizas_del_con_poliza,
  (SELECT COUNT(*) FROM fortnight_details WHERE client_id = c_sin.id) as historial_sin_poliza
FROM clients c_sin
JOIN clients c_con ON c_sin.name = c_con.name AND c_sin.id != c_con.id
WHERE NOT EXISTS (
  SELECT 1 FROM policies WHERE client_id = c_sin.id
)
AND EXISTS (
  SELECT 1 FROM policies WHERE client_id = c_con.id
)
ORDER BY c_sin.name
LIMIT 20;

-- =====================================================
-- PASO 2: Verificar policy_numbers en fortnight_details
-- =====================================================

-- Ver si el mismo policy_number está asociado a DIFERENTES client_ids
SELECT 
  'Policy numbers con múltiples clientes en fortnight_details' as problema,
  fd.policy_number,
  COUNT(DISTINCT fd.client_id) as clientes_diferentes,
  STRING_AGG(DISTINCT c.name, ' | ') as nombres_clientes
FROM fortnight_details fd
JOIN clients c ON c.id = fd.client_id
WHERE fd.client_id IS NOT NULL
GROUP BY fd.policy_number
HAVING COUNT(DISTINCT fd.client_id) > 1
ORDER BY COUNT(DISTINCT fd.client_id) DESC
LIMIT 20;

-- =====================================================
-- PASO 3: Ver detalles específicos de duplicación
-- =====================================================

-- Para cada cliente sin póliza, ver si su policy_number ya existe
-- en otra póliza de otro cliente
SELECT 
  'Clientes sin póliza pero su policy_number ya existe' as caso,
  c.id as cliente_sin_poliza,
  c.name as nombre_sin_poliza,
  fd.policy_number,
  p.client_id as cliente_con_poliza,
  c2.name as nombre_con_poliza
FROM clients c
JOIN fortnight_details fd ON fd.client_id = c.id
JOIN policies p ON p.policy_number = fd.policy_number
JOIN clients c2 ON c2.id = p.client_id
WHERE NOT EXISTS (
  SELECT 1 FROM policies WHERE client_id = c.id
)
AND c.id != p.client_id
ORDER BY fd.policy_number
LIMIT 20;

-- =====================================================
-- PASO 4: Verificar si son DUPLICADOS exactos
-- =====================================================

-- Ver clientes sin póliza que tienen el MISMO nombre que el dueño real de la póliza
SELECT 
  'Duplicados confirmados (mismo nombre y policy_number)' as confirmacion,
  c_sin.id as duplicado_id,
  c_sin.name as nombre_duplicado,
  c_sin.created_at as creado_duplicado,
  c_con.id as original_id,
  c_con.name as nombre_original,
  c_con.created_at as creado_original,
  fd.policy_number as poliza_compartida,
  (SELECT COUNT(*) FROM fortnight_details WHERE client_id = c_sin.id) as registros_duplicado,
  (SELECT COUNT(*) FROM fortnight_details WHERE client_id = c_con.id) as registros_original
FROM clients c_sin
JOIN fortnight_details fd ON fd.client_id = c_sin.id
JOIN policies p ON p.policy_number = fd.policy_number
JOIN clients c_con ON c_con.id = p.client_id
WHERE NOT EXISTS (
  SELECT 1 FROM policies WHERE client_id = c_sin.id
)
AND c_sin.name = c_con.name  -- MISMO NOMBRE
AND c_sin.id != c_con.id
ORDER BY fd.policy_number;

-- =====================================================
-- RESUMEN DEL DIAGNÓSTICO
-- =====================================================

SELECT '========================================' as separador;
SELECT 'RESUMEN' as titulo;
SELECT '========================================' as separador;

-- Contar cuántos clientes sin póliza son duplicados
SELECT 
  'Clientes sin póliza que son DUPLICADOS' as metrica,
  COUNT(DISTINCT c_sin.id) as cantidad
FROM clients c_sin
JOIN fortnight_details fd ON fd.client_id = c_sin.id
JOIN policies p ON p.policy_number = fd.policy_number
JOIN clients c_con ON c_con.id = p.client_id
WHERE NOT EXISTS (
  SELECT 1 FROM policies WHERE client_id = c_sin.id
)
AND c_sin.name = c_con.name
AND c_sin.id != c_con.id;

-- Contar cuántos clientes sin póliza NO son duplicados
SELECT 
  'Clientes sin póliza que NO son duplicados' as metrica,
  COUNT(*) as cantidad
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM policies WHERE client_id = c.id
)
AND NOT EXISTS (
  SELECT 1 FROM fortnight_details fd
  JOIN policies p ON p.policy_number = fd.policy_number
  WHERE fd.client_id = c.id
  AND p.client_id != c.id
);

-- =====================================================
-- CONCLUSIÓN
-- =====================================================

SELECT '========================================' as separador;
SELECT 'CONCLUSIÓN' as titulo;
SELECT '========================================' as separador;

SELECT 
  'Si hay duplicados confirmados:' as info
UNION ALL
SELECT 
  '1. Son clientes creados erróneamente por el bulk' as info
UNION ALL
SELECT 
  '2. Su historial debe re-asignarse al cliente original' as info
UNION ALL
SELECT 
  '3. Los duplicados deben eliminarse' as info
UNION ALL
SELECT 
  '' as info
UNION ALL
SELECT 
  'Proceder con: CORREGIR_CLIENTES_DUPLICADOS.sql' as info;
