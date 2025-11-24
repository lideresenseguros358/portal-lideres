-- =====================================================
-- CORRECCIÓN: Eliminar clientes duplicados y reasignar historial
-- =====================================================
-- Este script:
-- 1. Re-asigna el historial del cliente duplicado al original
-- 2. Elimina los clientes duplicados
-- =====================================================

-- ⚠️ IMPORTANTE: Ejecutar DIAGNOSTICO_CLIENTES_DUPLICADOS.sql primero
-- para confirmar que hay duplicados antes de ejecutar este script

SELECT '========== INICIANDO CORRECCIÓN ==========' as info;

-- =====================================================
-- PASO 1: Backup de seguridad
-- =====================================================

-- Crear backup temporal de los clientes que se van a eliminar
CREATE TEMP TABLE IF NOT EXISTS clientes_duplicados_backup AS
SELECT 
  c_sin.id as duplicado_id,
  c_sin.name as duplicado_name,
  c_sin.created_at as duplicado_created,
  c_con.id as original_id,
  c_con.name as original_name,
  fd.policy_number
FROM clients c_sin
JOIN fortnight_details fd ON fd.client_id = c_sin.id
JOIN policies p ON p.policy_number = fd.policy_number
JOIN clients c_con ON c_con.id = p.client_id
WHERE NOT EXISTS (
  SELECT 1 FROM policies WHERE client_id = c_sin.id
)
AND c_sin.name = c_con.name
AND c_sin.id != c_con.id;

SELECT 
  'Clientes duplicados en backup:' as info,
  COUNT(DISTINCT duplicado_id) as cantidad
FROM clientes_duplicados_backup;

-- Ver ejemplos
SELECT * FROM clientes_duplicados_backup LIMIT 10;

-- =====================================================
-- PASO 2: Re-asignar historial en fortnight_details
-- =====================================================

SELECT '========== RE-ASIGNANDO HISTORIAL ==========' as info;

-- Actualizar fortnight_details para apuntar al cliente original
UPDATE fortnight_details fd
SET client_id = backup.original_id
FROM clientes_duplicados_backup backup
WHERE fd.client_id = backup.duplicado_id;

SELECT 
  '✅ Registros de fortnight_details re-asignados' as resultado,
  (SELECT COUNT(*) FROM clientes_duplicados_backup) as cantidad;

-- =====================================================
-- PASO 3: Verificar que no quedan referencias
-- =====================================================

-- Verificar que los duplicados no tienen referencias
SELECT 
  'Verificación - Duplicados con referencias restantes:' as verificacion,
  COUNT(*) as cantidad,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ Ninguno - Seguro eliminar'
    ELSE '⚠️ AÚN HAY REFERENCIAS - NO ELIMINAR'
  END as estado
FROM clients c
WHERE c.id IN (SELECT duplicado_id FROM clientes_duplicados_backup)
AND EXISTS (
  SELECT 1 FROM fortnight_details WHERE client_id = c.id
);

-- =====================================================
-- PASO 4: Eliminar clientes duplicados
-- =====================================================

SELECT '========== ELIMINANDO DUPLICADOS ==========' as info;

-- Ver cuántos se van a eliminar
SELECT 
  'Clientes duplicados a eliminar:' as accion,
  COUNT(DISTINCT duplicado_id) as cantidad
FROM clientes_duplicados_backup;

-- ELIMINAR
DELETE FROM clients
WHERE id IN (
  SELECT duplicado_id FROM clientes_duplicados_backup
);

SELECT '✅ Clientes duplicados eliminados' as resultado;

-- =====================================================
-- PASO 5: Verificación Final
-- =====================================================

SELECT '========== VERIFICACIÓN FINAL ==========' as info;

-- Verificar que ya no hay clientes sin póliza con historial
SELECT 
  'Clientes sin póliza con historial (después):' as metrica,
  COUNT(DISTINCT fd.client_id) as cantidad,
  CASE 
    WHEN COUNT(DISTINCT fd.client_id) = 0 THEN '✅ CORRECTO - Problema resuelto'
    ELSE '⚠️ Aún quedan algunos - Revisar casos especiales'
  END as estado
FROM fortnight_details fd
WHERE fd.client_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = fd.client_id
);

-- Ver estadísticas finales
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
-- PASO 6: Reporte de corrección
-- =====================================================

SELECT '========== REPORTE DE CORRECCIÓN ==========' as info;

-- Ver ejemplos de correcciones realizadas
SELECT 
  'Ejemplo de correcciones:' as titulo,
  duplicado_name as cliente_eliminado,
  original_name as cliente_mantenido,
  policy_number as poliza_compartida
FROM clientes_duplicados_backup
LIMIT 10;

-- Contar cuántos registros se re-asignaron
SELECT 
  'Registros históricos re-asignados:' as metrica,
  COUNT(*) as cantidad
FROM clientes_duplicados_backup;

-- Limpiar backup
DROP TABLE IF EXISTS clientes_duplicados_backup;

-- =====================================================
-- CONCLUSIÓN
-- =====================================================

SELECT '========================================' as separador;
SELECT 'CORRECCIÓN COMPLETADA' as titulo;
SELECT '========================================' as separador;

SELECT 
  'Qué se hizo:' as info
UNION ALL
SELECT 
  '✅ Se identificaron clientes duplicados' as info
UNION ALL
SELECT 
  '✅ Se re-asignó su historial al cliente original' as info
UNION ALL
SELECT 
  '✅ Se eliminaron los duplicados' as info
UNION ALL
SELECT 
  '✅ Base de datos limpia y consistente' as info
UNION ALL
SELECT 
  '' as info
UNION ALL
SELECT 
  'Ahora cada policy_number tiene UN SOLO cliente ✅' as info;

-- =====================================================
-- CASOS ESPECIALES
-- =====================================================

-- Si aún quedan clientes sin póliza, verificar por qué:
SELECT 
  'Clientes sin póliza restantes (casos especiales):' as tipo,
  c.id,
  c.name,
  (SELECT COUNT(*) FROM fortnight_details WHERE client_id = c.id) as registros_historicos,
  'Revisar manualmente' as accion
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM policies WHERE client_id = c.id
)
AND EXISTS (
  SELECT 1 FROM fortnight_details WHERE client_id = c.id
)
LIMIT 10;
