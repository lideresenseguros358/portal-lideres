-- =====================================================
-- SCRIPT PARA CORREGIR NOMBRES EXISTENTES EN LA BASE DE DATOS
-- =====================================================
-- Este script corrige nombres que ya fueron insertados con caracteres especiales
-- Debe ejecutarse DESPUÉS de crear la función normalize_name()

-- =====================================================
-- PASO 1: Verificar función existe
-- =====================================================
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'normalize_name'
  AND routine_schema = 'public';

-- Debe retornar 1 fila con routine_type = 'FUNCTION'
-- Si no existe, ejecutar primero: normalize-names-function.sql

-- =====================================================
-- PASO 2: Ver cuántos clientes tienen nombres con caracteres especiales
-- =====================================================
SELECT 
  COUNT(*) as total_con_caracteres_especiales,
  COUNT(*) FILTER (WHERE name ~ 'Ñ|ñ') as con_enie,
  COUNT(*) FILTER (WHERE name ~ '[ÁÉÍÓÚÀÈÌÒÙ]') as con_acentos,
  COUNT(*) FILTER (WHERE name ~ '[^A-Z0-9 a-z]') as con_otros_especiales
FROM clients
WHERE name != normalize_name(name);

-- =====================================================
-- PASO 3: Ver ejemplos de nombres que se van a cambiar
-- =====================================================
SELECT 
  id,
  name as nombre_actual,
  normalize_name(name) as nombre_normalizado,
  LENGTH(name) - LENGTH(normalize_name(name)) as caracteres_eliminados
FROM clients
WHERE name != normalize_name(name)
ORDER BY name
LIMIT 20;

-- =====================================================
-- PASO 4: BACKUP ANTES DE ACTUALIZAR (IMPORTANTE!)
-- =====================================================
-- Crear tabla de respaldo
CREATE TABLE IF NOT EXISTS clients_backup_names AS 
SELECT id, name, created_at, NOW() as backup_date
FROM clients;

-- Verificar backup
SELECT COUNT(*) as total_respaldados FROM clients_backup_names;

-- =====================================================
-- PASO 5: ACTUALIZAR NOMBRES (EJECUTAR SOLO SI EL PREVIEW LUCE BIEN)
-- =====================================================
BEGIN;

-- Actualizar nombres de clientes
UPDATE clients 
SET name = normalize_name(name)
WHERE name != normalize_name(name);

-- Ver cuántos se actualizaron
-- Si el número luce correcto, hacer COMMIT
-- Si algo se ve mal, hacer ROLLBACK

-- COMMIT; -- Descomentar para confirmar
-- ROLLBACK; -- Descomentar para revertir

-- =====================================================
-- PASO 6: Verificar resultados
-- =====================================================
-- Debe retornar 0 si todos los nombres fueron normalizados
SELECT COUNT(*) as nombres_pendientes_normalizar
FROM clients
WHERE name != normalize_name(name);

-- Ver algunos ejemplos de nombres actualizados
SELECT 
  cb.name as nombre_anterior,
  c.name as nombre_actual,
  cb.backup_date
FROM clients_backup_names cb
JOIN clients c ON c.id = cb.id
WHERE cb.name != c.name
ORDER BY c.name
LIMIT 20;

-- =====================================================
-- PASO 7: Limpiar tabla de backup (OPCIONAL - SOLO DESPUÉS DE VERIFICAR)
-- =====================================================
-- Una vez confirmado que todo está bien, puedes eliminar el backup:
-- DROP TABLE clients_backup_names;

-- =====================================================
-- PASO 8: Verificar que no haya duplicados después de normalizar
-- =====================================================
-- Identificar posibles duplicados por nombre
SELECT 
  name,
  COUNT(*) as cantidad,
  STRING_AGG(id::text, ', ') as ids
FROM clients
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY cantidad DESC;

-- Si hay duplicados, revisar manualmente para decidir cuál mantener
-- IMPORTANTE: No eliminar automáticamente, pueden ser clientes diferentes con nombres similares

-- =====================================================
-- TROUBLESHOOTING
-- =====================================================

-- Si necesitas revertir los cambios:
-- UPDATE clients c
-- SET name = cb.name
-- FROM clients_backup_names cb
-- WHERE c.id = cb.id AND c.name != cb.name;

-- Ver clientes creados recientemente
SELECT 
  id,
  name,
  created_at
FROM clients
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 50;

-- =====================================================
-- ESTADÍSTICAS FINALES
-- =====================================================
SELECT 
  'Total clientes' as metrica,
  COUNT(*)::text as valor
FROM clients

UNION ALL

SELECT 
  'Con nombres normalizados' as metrica,
  COUNT(*)::text as valor
FROM clients
WHERE name = normalize_name(name)

UNION ALL

SELECT 
  'Con caracteres especiales' as metrica,
  COUNT(*)::text as valor
FROM clients
WHERE name != normalize_name(name)

UNION ALL

SELECT 
  'Nombres en backup' as metrica,
  COUNT(*)::text as valor
FROM clients_backup_names;
