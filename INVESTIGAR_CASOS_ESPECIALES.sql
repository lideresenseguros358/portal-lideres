-- =====================================================
-- INVESTIGACIÓN: 10 Casos especiales que quedan
-- =====================================================
-- Clientes sin póliza que NO son duplicados
-- Necesitamos saber por qué no tienen póliza
-- =====================================================

-- =====================================================
-- INVESTIGACIÓN 1: Ver sus datos completos
-- =====================================================
SELECT 
  '========== DATOS DE LOS CLIENTES ==========' as seccion;

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
  c.id,
  c.name,
  c.broker_id,
  c.national_id,
  c.created_at,
  b.name as broker_name
FROM clients c
JOIN casos_especiales ce ON ce.client_id = c.id
LEFT JOIN brokers b ON b.id = c.broker_id
ORDER BY c.name;

-- =====================================================
-- INVESTIGACIÓN 2: Ver sus registros en fortnight_details
-- =====================================================
SELECT 
  '========== REGISTROS EN FORTNIGHT_DETAILS ==========' as seccion;

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
  fd.id,
  fd.policy_number,
  fd.client_name,
  fd.broker_id,
  fd.insurer_id,
  i.name as insurer_name,
  fd.ramo,
  fd.commission_raw,
  fd.commission_calculated,
  fd.fortnight_id,
  f.period_start,
  f.period_end
FROM fortnight_details fd
JOIN casos_especiales ce ON ce.client_id = fd.client_id
LEFT JOIN insurers i ON i.id = fd.insurer_id
LEFT JOIN fortnights f ON f.id = fd.fortnight_id
ORDER BY fd.policy_number, fd.created_at;

-- =====================================================
-- INVESTIGACIÓN 3: ¿Existen sus policy_numbers en tabla policies?
-- =====================================================
SELECT 
  '========== ¿SUS POLICY_NUMBERS EXISTEN? ==========' as seccion;

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
  fd.policy_number,
  c.name as cliente_sin_poliza,
  CASE 
    WHEN p.policy_number IS NOT NULL THEN '✅ SÍ EXISTE'
    ELSE '❌ NO EXISTE'
  END as existe_poliza,
  CASE 
    WHEN p.policy_number IS NOT NULL THEN p.client_id
    ELSE NULL
  END as dueño_actual_id,
  CASE 
    WHEN p.policy_number IS NOT NULL THEN c2.name
    ELSE NULL
  END as dueño_actual_nombre
FROM fortnight_details fd
JOIN casos_especiales ce ON ce.client_id = fd.client_id
JOIN clients c ON c.id = ce.client_id
LEFT JOIN policies p ON p.policy_number = fd.policy_number
LEFT JOIN clients c2 ON c2.id = p.client_id
GROUP BY fd.policy_number, c.name, p.policy_number, p.client_id, c2.name
ORDER BY fd.policy_number;

-- =====================================================
-- INVESTIGACIÓN 4: Comparar nombres con posibles dueños
-- =====================================================
SELECT 
  '========== COMPARACIÓN DE NOMBRES ==========' as seccion;

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
  fd.policy_number,
  c.name as nombre_sin_poliza,
  CASE 
    WHEN p.policy_number IS NOT NULL THEN c2.name
    ELSE 'N/A - Póliza no existe'
  END as nombre_con_poliza,
  CASE 
    WHEN p.policy_number IS NOT NULL AND c.name = c2.name THEN '⚠️ MISMO NOMBRE'
    WHEN p.policy_number IS NOT NULL THEN '❌ NOMBRES DIFERENTES'
    ELSE '❌ PÓLIZA NO EXISTE'
  END as comparacion
FROM fortnight_details fd
JOIN casos_especiales ce ON ce.client_id = fd.client_id
JOIN clients c ON c.id = ce.client_id
LEFT JOIN policies p ON p.policy_number = fd.policy_number
LEFT JOIN clients c2 ON c2.id = p.client_id
GROUP BY fd.policy_number, c.name, p.policy_number, c2.name
ORDER BY fd.policy_number;

-- =====================================================
-- DIAGNÓSTICO FINAL
-- =====================================================
SELECT 
  '========== DIAGNÓSTICO ==========' as seccion;

-- Caso A: Policy_number NO existe en tabla policies
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
  'Caso A: Policy_numbers que NO existen' as categoria,
  COUNT(DISTINCT fd.policy_number) as cantidad
FROM fortnight_details fd
JOIN casos_especiales ce ON ce.client_id = fd.client_id
WHERE NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.policy_number = fd.policy_number
);

-- Caso B: Policy_number existe pero con diferente cliente
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
  'Caso B: Policy_numbers que existen pero con otro cliente' as categoria,
  COUNT(DISTINCT fd.policy_number) as cantidad
FROM fortnight_details fd
JOIN casos_especiales ce ON ce.client_id = fd.client_id
JOIN policies p ON p.policy_number = fd.policy_number
WHERE p.client_id != ce.client_id;

-- =====================================================
-- SOLUCIONES PROPUESTAS
-- =====================================================
SELECT 
  '========== SOLUCIONES ==========' as seccion;

SELECT 
  '📋 Resumen de casos:' as tipo
UNION ALL
SELECT 
  '' as tipo
UNION ALL
SELECT 
  'CASO A: Policy_number NO existe en policies' as tipo
UNION ALL
SELECT 
  '  → Solución: Crear la póliza para este cliente' as tipo
UNION ALL
SELECT 
  '  → Script: CREAR_POLIZAS_CASOS_ESPECIALES.sql' as tipo
UNION ALL
SELECT 
  '' as tipo
UNION ALL
SELECT 
  'CASO B: Policy_number existe pero con diferente cliente' as tipo
UNION ALL
SELECT 
  '  → Posibilidad 1: Nombres similares pero personas distintas' as tipo
UNION ALL
SELECT 
  '  → Posibilidad 2: Error del bulk, re-asignar historial' as tipo
UNION ALL
SELECT 
  '  → Decisión: Manual según cada caso' as tipo;

-- =====================================================
-- DETALLE POR CASO
-- =====================================================
SELECT 
  '========== DETALLE POR CASO ==========' as seccion;

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
  ROW_NUMBER() OVER (ORDER BY fd.policy_number) as caso_num,
  c.name as cliente,
  fd.policy_number,
  CASE 
    WHEN p.policy_number IS NULL THEN 'A: Crear póliza'
    WHEN p.client_id != c.id THEN 'B: Ya existe con otro cliente'
    ELSE 'Verificar'
  END as solucion_propuesta,
  CASE 
    WHEN p.policy_number IS NOT NULL THEN c2.name
    ELSE NULL
  END as cliente_actual_poliza
FROM fortnight_details fd
JOIN casos_especiales ce ON ce.client_id = fd.client_id
JOIN clients c ON c.id = ce.client_id
LEFT JOIN policies p ON p.policy_number = fd.policy_number
LEFT JOIN clients c2 ON c2.id = p.client_id
GROUP BY c.id, c.name, fd.policy_number, p.policy_number, p.client_id, c2.name
ORDER BY fd.policy_number;
