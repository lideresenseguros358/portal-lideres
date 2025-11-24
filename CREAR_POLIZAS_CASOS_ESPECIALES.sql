-- =====================================================
-- CREAR PÓLIZAS PARA CASOS ESPECIALES
-- =====================================================
-- Este script crea pólizas solo para los 10 casos especiales
-- que NO son duplicados
-- =====================================================

-- ⚠️ EJECUTAR INVESTIGAR_CASOS_ESPECIALES.sql PRIMERO
-- para entender cada caso antes de crear pólizas

SELECT '========== CREANDO PÓLIZAS PARA CASOS ESPECIALES ==========' as info;

-- IDs de los 10 casos especiales
WITH casos_especiales AS (
  SELECT unnest(ARRAY[
    '0505b618-d702-4598-a7d8-2071ff686d2f',
    '40a7e5eb-b463-4da2-8856-e9f187b59088',
    '5e61d4db-f379-4387-9649-2385dfefc016',
    '7c5490c0-ac44-4024-9215-e6a4664f7b8d',
    '91eef95a-683b-40dc-9734-8de9cc34857d',
    '9345e54d-cdcb-4f71-b817-d06703c75a46',
    '9edc39ae-2406-485a-bbdd-75e86de1b8c8',
    'a6a8a9e4-83d0-4ae8-bb00-787d954393b9',
    'ae3cb3a0-4f55-4274-9351-25c91715ac5e',
    'b09e59c5-d889-4676-836c-178b13130bf2'
  ]::uuid[]) AS client_id
)

-- =====================================================
-- PASO 1: Ver qué pólizas se van a crear
-- =====================================================
SELECT 
  'Pólizas que se intentarán crear:' as info,
  c.name as cliente,
  fd.policy_number,
  CASE 
    WHEN p.policy_number IS NOT NULL THEN '⚠️ YA EXISTE - NO SE CREARÁ'
    ELSE '✅ SE CREARÁ'
  END as accion
FROM fortnight_details fd
JOIN casos_especiales ce ON ce.client_id = fd.client_id
JOIN clients c ON c.id = ce.client_id
LEFT JOIN policies p ON p.policy_number = fd.policy_number
GROUP BY c.name, fd.policy_number, p.policy_number
ORDER BY fd.policy_number;

-- =====================================================
-- PASO 2: CREAR LAS PÓLIZAS (solo las que NO existen)
-- =====================================================

INSERT INTO policies (
  broker_id,
  client_id,
  insurer_id,
  policy_number,
  ramo,
  status,
  percent_override,
  created_at
)
SELECT DISTINCT ON (fd.policy_number)
  fd.broker_id,
  fd.client_id,
  fd.insurer_id,
  fd.policy_number,
  fd.ramo,
  'ACTIVA',
  NULL,
  fd.created_at
FROM fortnight_details fd
JOIN casos_especiales ce ON ce.client_id = fd.client_id
WHERE fd.client_id IS NOT NULL
AND NOT EXISTS (
  -- Solo crear si NO existe
  SELECT 1 FROM policies p 
  WHERE p.policy_number = fd.policy_number
)
ORDER BY fd.policy_number, fd.created_at ASC;

SELECT '✅ Pólizas creadas para casos especiales' as resultado;

-- =====================================================
-- PASO 3: VERIFICACIÓN
-- =====================================================

SELECT '========== VERIFICACIÓN ==========' as info;

-- Ver cuántos casos quedan sin póliza
WITH casos_especiales AS (
  SELECT unnest(ARRAY[
    '0505b618-d702-4598-a7d8-2071ff686d2f',
    '40a7e5eb-b463-4da2-8856-e9f187b59088',
    '5e61d4db-f379-4387-9649-2385dfefc016',
    '7c5490c0-ac44-4024-9215-e6a4664f7b8d',
    '91eef95a-683b-40dc-9734-8de9cc34857d',
    '9345e54d-cdcb-4f71-b817-d06703c75a46',
    '9edc39ae-2406-485a-bbdd-75e86de1b8c8',
    'a6a8a9e4-83d0-4ae8-bb00-787d954393b9',
    'ae3cb3a0-4f55-4274-9351-25c91715ac5e',
    'b09e59c5-d889-4676-836c-178b13130bf2'
  ]::uuid[]) AS client_id
)
SELECT 
  'Casos especiales sin póliza (después):' as metrica,
  COUNT(*) as cantidad,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ TODOS CORREGIDOS'
    ELSE '⚠️ Revisar casos restantes'
  END as estado
FROM clients c
JOIN casos_especiales ce ON ce.client_id = c.id
WHERE NOT EXISTS (
  SELECT 1 FROM policies WHERE client_id = c.id
);

-- Ver estado final de cada caso
WITH casos_especiales AS (
  SELECT unnest(ARRAY[
    '0505b618-d702-4598-a7d8-2071ff686d2f',
    '40a7e5eb-b463-4da2-8856-e9f187b59088',
    '5e61d4db-f379-4387-9649-2385dfefc016',
    '7c5490c0-ac44-4024-9215-e6a4664f7b8d',
    '91eef95a-683b-40dc-9734-8de9cc34857d',
    '9345e54d-cdcb-4f71-b817-d06703c75a46',
    '9edc39ae-2406-485a-bbdd-75e86de1b8c8',
    'a6a8a9e4-83d0-4ae8-bb00-787d954393b9',
    'ae3cb3a0-4f55-4274-9351-25c91715ac5e',
    'b09e59c5-d889-4676-836c-178b13130bf2'
  ]::uuid[]) AS client_id
)
SELECT 
  c.name as cliente,
  (SELECT COUNT(*) FROM policies WHERE client_id = c.id) as polizas,
  (SELECT COUNT(*) FROM fortnight_details WHERE client_id = c.id) as historial,
  CASE 
    WHEN (SELECT COUNT(*) FROM policies WHERE client_id = c.id) > 0 
    THEN '✅ CORREGIDO'
    ELSE '⚠️ SIN PÓLIZA'
  END as estado
FROM clients c
JOIN casos_especiales ce ON ce.client_id = c.id
ORDER BY c.name;

-- =====================================================
-- CASOS QUE SIGUEN SIN PÓLIZA
-- =====================================================

-- Si aún quedan casos sin póliza, es porque su policy_number
-- ya existe con otro cliente
WITH casos_especiales AS (
  SELECT unnest(ARRAY[
    '0505b618-d702-4598-a7d8-2071ff686d2f',
    '40a7e5eb-b463-4da2-8856-e9f187b59088',
    '5e61d4db-f379-4387-9649-2385dfefc016',
    '7c5490c0-ac44-4024-9215-e6a4664f7b8d',
    '91eef95a-683b-40dc-9734-8de9cc34857d',
    '9345e54d-cdcb-4f71-b817-d06703c75a46',
    '9edc39ae-2406-485a-bbdd-75e86de1b8c8',
    'a6a8a9e4-83d0-4ae8-bb00-787d954393b9',
    'ae3cb3a0-4f55-4274-9351-25c91715ac5e',
    'b09e59c5-d889-4676-836c-178b13130bf2'
  ]::uuid[]) AS client_id
)
SELECT 
  'Casos sin póliza porque ya existe con otro cliente:' as tipo,
  c.id as cliente_sin_poliza_id,
  c.name as cliente_sin_poliza,
  fd.policy_number,
  p.client_id as cliente_con_poliza_id,
  c2.name as cliente_con_poliza,
  CASE 
    WHEN c.name = c2.name THEN '⚠️ MISMO NOMBRE - Posible duplicado'
    ELSE '❌ NOMBRES DIFERENTES - Conflicto real'
  END as observacion
FROM clients c
JOIN casos_especiales ce ON ce.client_id = c.id
JOIN fortnight_details fd ON fd.client_id = c.id
JOIN policies p ON p.policy_number = fd.policy_number
JOIN clients c2 ON c2.id = p.client_id
WHERE NOT EXISTS (
  SELECT 1 FROM policies WHERE client_id = c.id
)
AND p.client_id != c.id
ORDER BY fd.policy_number;

-- =====================================================
-- CONCLUSIÓN
-- =====================================================

SELECT '========================================' as separador;
SELECT 'CONCLUSIÓN' as titulo;
SELECT '========================================' as separador;

SELECT 
  'Si todos tienen póliza ahora:' as info
UNION ALL
SELECT 
  '  ✅ Problema resuelto' as info
UNION ALL
SELECT 
  '' as info
UNION ALL
SELECT 
  'Si aún quedan sin póliza:' as info
UNION ALL
SELECT 
  '  ⚠️ Su policy_number ya existe con otro cliente' as info
UNION ALL
SELECT 
  '  → Verificar si son duplicados (mismo nombre)' as info
UNION ALL
SELECT 
  '  → O si son personas diferentes (conflicto real)' as info
UNION ALL
SELECT 
  '  → Decisión manual requerida' as info;
