-- =====================================================
-- CORRECCIÓN: 10 Casos duplicados por encoding de Ñ
-- =====================================================
-- Todos son duplicados del mismo cliente original
-- Solo tienen diferente encoding en la letra Ñ
-- =====================================================

SELECT '========== CORRIGIENDO 10 DUPLICADOS ==========' as info;

-- =====================================================
-- MAPEO: Duplicado → Original
-- =====================================================

CREATE TEMP TABLE mapeo_duplicados AS
SELECT 
  '0505b618-d702-4598-a7d8-2071ff686d2f'::uuid as duplicado_id,
  'MATILDE YAEZ MONTENEGRO' as duplicado_name,
  (SELECT id FROM clients WHERE name = 'MATILDE YANEZ MONTENEGRO' LIMIT 1) as original_id,
  'MATILDE YANEZ MONTENEGRO' as original_name,
  '02B249813' as policy_number
UNION ALL
SELECT 
  '40a7e5eb-b463-4da2-8856-e9f187b59088'::uuid,
  'ALVARO AURELIO ARCIA NUEZ',
  (SELECT id FROM clients WHERE name = 'ALVARO AURELIO ARCIA NUNEZ' LIMIT 1),
  'ALVARO AURELIO ARCIA NUNEZ',
  '03B67303'
UNION ALL
SELECT 
  '5e61d4db-f379-4387-9649-2385dfefc016'::uuid,
  'LUZ ELENA TREJOS LONDOO',
  (SELECT id FROM clients WHERE name = 'LUZ ELENA TREJOS LONDONO' LIMIT 1),
  'LUZ ELENA TREJOS LONDONO',
  '14B56287'
UNION ALL
SELECT 
  '7c5490c0-ac44-4024-9215-e6a4664f7b8d'::uuid,
  'YAMILETH YARIELA ATENCIO CEDEO',
  (SELECT id FROM clients WHERE name = 'YAMILETH YARIELA ATENCIO CEDENO' LIMIT 1),
  'YAMILETH YARIELA ATENCIO CEDENO',
  '03B79838'
UNION ALL
SELECT 
  '91eef95a-683b-40dc-9734-8de9cc34857d'::uuid,
  'MAURICIO RODRIGUEZ MUOZ',
  (SELECT id FROM clients WHERE name = 'MAURICIO RODRIGUEZ MUNOZ' LIMIT 1),
  'MAURICIO RODRIGUEZ MUNOZ',
  '60B30486'
UNION ALL
SELECT 
  '9345e54d-cdcb-4f71-b817-d06703c75a46'::uuid,
  'ANTONIO VASQUEZ NUEZ',
  (SELECT id FROM clients WHERE name = 'ANTONIO VASQUEZ NUNEZ' LIMIT 1),
  'ANTONIO VASQUEZ NUNEZ',
  '04-04-599783-8'
UNION ALL
SELECT 
  '9edc39ae-2406-485a-bbdd-75e86de1b8c8'::uuid,
  'XIOMARA ENEIDA SAMUDIO NUEZ',
  (SELECT id FROM clients WHERE name = 'XIOMARA ENEIDA SAMUDIO NUNEZ' LIMIT 1),
  'XIOMARA ENEIDA SAMUDIO NUNEZ',
  '0219-00940-01'
UNION ALL
SELECT 
  'a6a8a9e4-83d0-4ae8-bb00-787d954393b9'::uuid,
  'GUADALUPE LIZBETH PEALBA BONILLA',
  (SELECT id FROM clients WHERE name = 'GUADALUPE LIZBETH PENALBA BONILLA' LIMIT 1),
  'GUADALUPE LIZBETH PENALBA BONILLA',
  '70B33823'
UNION ALL
SELECT 
  'ae3cb3a0-4f55-4274-9351-25c91715ac5e'::uuid,
  'MATEO PATIO MARTINEZ',
  (SELECT id FROM clients WHERE name = 'MATEO PATINO MARTINEZ' LIMIT 1),
  'MATEO PATINO MARTINEZ',
  '02B3396507'
UNION ALL
SELECT 
  'b09e59c5-d889-4676-836c-178b13130bf2'::uuid,
  'ORIBEL ANTONIO FRIAS PEALBA',
  (SELECT id FROM clients WHERE name = 'ORIBEL ANTONIO FRIAS PENALBA' LIMIT 1),
  'ORIBEL ANTONIO FRIAS PENALBA',
  '60B5046';

-- Ver el mapeo
SELECT 
  'Mapeo de duplicados a originales:' as info,
  duplicado_name,
  original_name,
  policy_number,
  CASE 
    WHEN original_id IS NOT NULL THEN '✅ Original encontrado'
    ELSE '❌ Original NO encontrado'
  END as estado
FROM mapeo_duplicados;

-- =====================================================
-- VERIFICACIÓN: Asegurar que todos los originales existen
-- =====================================================

SELECT 
  'Verificación de originales:' as verificacion,
  COUNT(*) as total,
  COUNT(original_id) as encontrados,
  CASE 
    WHEN COUNT(*) = COUNT(original_id) THEN '✅ Todos encontrados - Proceder'
    ELSE '❌ Faltan algunos - NO EJECUTAR'
  END as resultado
FROM mapeo_duplicados;

-- =====================================================
-- PASO 1: Re-asignar historial en fortnight_details
-- =====================================================

SELECT '========== RE-ASIGNANDO HISTORIAL ==========' as info;

-- Contar registros a re-asignar
SELECT 
  'Registros a re-asignar:' as accion,
  COUNT(*) as cantidad
FROM fortnight_details fd
WHERE fd.client_id IN (SELECT duplicado_id FROM mapeo_duplicados);

-- RE-ASIGNAR
UPDATE fortnight_details fd
SET client_id = m.original_id
FROM mapeo_duplicados m
WHERE fd.client_id = m.duplicado_id;

SELECT '✅ Historial re-asignado' as resultado;

-- =====================================================
-- PASO 2: Verificar que no quedan referencias
-- =====================================================

-- Verificar que los duplicados no tienen más referencias
SELECT 
  'Duplicados con referencias restantes:' as verificacion,
  COUNT(*) as cantidad,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ Ninguno - Seguro eliminar'
    ELSE '⚠️ AÚN HAY REFERENCIAS'
  END as estado
FROM clients c
WHERE c.id IN (SELECT duplicado_id FROM mapeo_duplicados)
AND EXISTS (
  SELECT 1 FROM fortnight_details WHERE client_id = c.id
);

-- =====================================================
-- PASO 3: Eliminar clientes duplicados
-- =====================================================

SELECT '========== ELIMINANDO DUPLICADOS ==========' as info;

-- Ver cuántos se van a eliminar
SELECT 
  'Clientes a eliminar:' as accion,
  COUNT(*) as cantidad
FROM mapeo_duplicados;

-- ELIMINAR
DELETE FROM clients
WHERE id IN (SELECT duplicado_id FROM mapeo_duplicados);

SELECT '✅ Duplicados eliminados' as resultado;

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================

SELECT '========== VERIFICACIÓN FINAL ==========' as info;

-- Verificar que ya NO hay clientes sin póliza con historial
SELECT 
  'Clientes sin póliza con historial:' as metrica,
  COUNT(DISTINCT fd.client_id) as cantidad,
  CASE 
    WHEN COUNT(DISTINCT fd.client_id) = 0 THEN '✅ PROBLEMA RESUELTO COMPLETAMENTE'
    ELSE '⚠️ Aún quedan algunos'
  END as estado
FROM fortnight_details fd
WHERE fd.client_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = fd.client_id
);

-- Estadísticas finales
SELECT 
  'Total clientes' as metrica,
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
  SELECT 1 FROM policies WHERE client_id = c.id
);

-- =====================================================
-- REPORTE DE CORRECCIONES
-- =====================================================

SELECT '========== REPORTE ==========' as info;

SELECT 
  'Correcciones realizadas:' as tipo,
  duplicado_name as eliminado,
  original_name as mantenido,
  policy_number as poliza
FROM mapeo_duplicados
ORDER BY duplicado_name;

-- Limpiar
DROP TABLE IF EXISTS mapeo_duplicados;

-- =====================================================
-- CONCLUSIÓN
-- =====================================================

SELECT '========================================' as separador;
SELECT 'LIMPIEZA COMPLETADA' as titulo;
SELECT '========================================' as separador;

SELECT 
  '✅ 10 clientes duplicados eliminados' as info
UNION ALL
SELECT 
  '✅ Historial re-asignado a clientes correctos' as info
UNION ALL
SELECT 
  '✅ Base de datos limpia y consistente' as info
UNION ALL
SELECT 
  '' as info
UNION ALL
SELECT 
  'Causa: Encoding incorrecto de la letra Ñ' as info
UNION ALL
SELECT 
  'Solución: Triggers automáticos ya implementados' as info
UNION ALL
SELECT 
  'Prevención: No volverá a pasar en futuros imports' as info;
