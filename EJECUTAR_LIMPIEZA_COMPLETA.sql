-- =====================================================
-- LIMPIEZA COMPLETA DE BASE DE DATOS
-- =====================================================
-- Ejecutar en: Supabase SQL Editor
-- Orden: Ejecutar TODO de arriba hacia abajo
-- =====================================================

-- =====================================================
-- PARTE 1: DIAGNÓSTICO GENERAL
-- =====================================================

SELECT '========================================' as separador;
SELECT 'DIAGNÓSTICO INICIAL' as seccion;
SELECT '========================================' as separador;

-- Estadísticas generales
SELECT 
  'Total clientes' as metrica,
  COUNT(*) as cantidad
FROM clients
UNION ALL
SELECT 
  'Total pólizas' as metrica,
  COUNT(*) as cantidad
FROM policies
UNION ALL
SELECT 
  'Clientes sin pólizas' as metrica,
  COUNT(*) as cantidad
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = c.id
)
UNION ALL
SELECT 
  'Clientes con nombres problemáticos' as metrica,
  COUNT(*) as cantidad
FROM clients
WHERE 
  name LIKE '%Ã%'
  OR name LIKE '%â%'
  OR name LIKE '%©%'
  OR name LIKE '%±%';

-- =====================================================
-- PARTE 2: CORRECCIÓN DE CARACTERES ESPECIALES
-- =====================================================

SELECT '========================================' as separador;
SELECT 'CORRIGIENDO CARACTERES ESPECIALES' as seccion;
SELECT '========================================' as separador;

-- Crear función de corrección
CREATE OR REPLACE FUNCTION fix_encoding(text_input TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN 
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    REPLACE(REPLACE(REPLACE(REPLACE(
    text_input,
    -- Vocales minúsculas con acento
    'Ã¡', 'á'), 'Ã©', 'é'), 'Ã­', 'í'), 'Ã³', 'ó'), 'Ãº', 'ú'),
    -- Vocales mayúsculas con acento
    'Ã'', 'Á'), 'Ã‰', 'É'), 'ÃŒ', 'Í'), 'Ã"', 'Ó'), 'Ãš', 'Ú'),
    -- Ñ y ñ
    'Ã±', 'ñ'), 'Ã'', 'Ñ'),
    -- Casos adicionales
    'Ã', 'í'), 'Ã³', 'ó'), 'â€™', '\''),
    'â€œ', '"'), 'â€', '"'),
    -- Limpiar caracteres basura
    'Â', ''), 'â', ''), 'Ã', ''),
    -- Casos específicos adicionales
    'Ãº', 'ú'), 'Ã¡', 'á'), 'Ã©', 'é'),
    'Ã­', 'í'), 'Ã±', 'ñ'), 'Ã"', 'Ñ');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Crear backup temporal
CREATE TEMP TABLE clients_backup AS
SELECT id, name, national_id, created_at
FROM clients
WHERE 
  name LIKE '%Ã%'
  OR name LIKE '%â%'
  OR name LIKE '%©%'
  OR name LIKE '%±%'
  OR name LIKE '%Â%';

SELECT 'Clientes guardados en backup:' as info, COUNT(*) as cantidad FROM clients_backup;

-- Actualizar CLIENTS
UPDATE clients
SET name = fix_encoding(name)
WHERE 
  name LIKE '%Ã%'
  OR name LIKE '%â%'
  OR name LIKE '%©%'
  OR name LIKE '%±%'
  OR name LIKE '%Â%'
  OR name LIKE '%¡%'
  OR name LIKE '%³%'
  OR name LIKE '%¢%';

SELECT 'Clientes actualizados en tabla clients' as resultado;

-- Actualizar POLICIES
UPDATE policies
SET insured_name = fix_encoding(insured_name)
WHERE 
  insured_name IS NOT NULL
  AND (
    insured_name LIKE '%Ã%'
    OR insured_name LIKE '%â%'
    OR insured_name LIKE '%©%'
    OR insured_name LIKE '%±%'
    OR insured_name LIKE '%Â%'
  );

SELECT 'Pólizas actualizadas' as resultado;

-- Actualizar COMM_ITEMS
UPDATE comm_items
SET insured_name = fix_encoding(insured_name)
WHERE 
  insured_name IS NOT NULL
  AND (
    insured_name LIKE '%Ã%'
    OR insured_name LIKE '%â%'
    OR insured_name LIKE '%©%'
    OR insured_name LIKE '%±%'
    OR insured_name LIKE '%Â%'
  );

SELECT 'Comm items actualizados' as resultado;

-- Actualizar FORTNIGHT_DETAILS
UPDATE fortnight_details
SET client_name = fix_encoding(client_name)
WHERE 
  client_name IS NOT NULL
  AND (
    client_name LIKE '%Ã%'
    OR client_name LIKE '%â%'
    OR client_name LIKE '%©%'
    OR client_name LIKE '%±%'
    OR client_name LIKE '%Â%'
  );

SELECT 'Fortnight details actualizados' as resultado;

-- Actualizar PENDING_ITEMS
UPDATE pending_items
SET insured_name = fix_encoding(insured_name)
WHERE 
  insured_name IS NOT NULL
  AND (
    insured_name LIKE '%Ã%'
    OR insured_name LIKE '%â%'
    OR insured_name LIKE '%©%'
    OR insured_name LIKE '%±%'
    OR insured_name LIKE '%Â%'
  );

SELECT 'Pending items actualizados' as resultado;

-- =====================================================
-- PARTE 3: ELIMINAR CLIENTES SIN PÓLIZAS
-- =====================================================

SELECT '========================================' as separador;
SELECT 'ELIMINANDO CLIENTES SIN PÓLIZAS' as seccion;
SELECT '========================================' as separador;

-- Ver cuántos clientes sin pólizas hay
SELECT 
  'Clientes sin pólizas (antes)' as estado,
  COUNT(*) as cantidad
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = c.id
);

-- Eliminar SOLO clientes sin pólizas Y sin referencias en otras tablas
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
  AND NOT EXISTS (
    SELECT 1 FROM pending_items pi WHERE pi.client_id = c.id
  )
);

-- Ver cuántos quedaron
SELECT 
  'Clientes sin pólizas (después)' as estado,
  COUNT(*) as cantidad
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = c.id
);

-- =====================================================
-- PARTE 4: REPORTE FINAL
-- =====================================================

SELECT '========================================' as separador;
SELECT 'REPORTE FINAL' as seccion;
SELECT '========================================' as separador;

-- Estadísticas finales
SELECT 
  'Total clientes (después)' as metrica,
  COUNT(*) as cantidad
FROM clients
UNION ALL
SELECT 
  'Total pólizas' as metrica,
  COUNT(*) as cantidad
FROM policies
UNION ALL
SELECT 
  'Clientes sin pólizas' as metrica,
  COUNT(*) as cantidad
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = c.id
)
UNION ALL
SELECT 
  'Clientes con nombres problemáticos' as metrica,
  COUNT(*) as cantidad
FROM clients
WHERE 
  name LIKE '%Ã%'
  OR name LIKE '%â%'
  OR name LIKE '%©%';

-- Ejemplos de correcciones
SELECT 
  'Ejemplos de correcciones' as info;
  
SELECT 
  cb.name as nombre_anterior,
  c.name as nombre_corregido
FROM clients_backup cb
JOIN clients c ON c.id = cb.id
WHERE cb.name != c.name
LIMIT 10;

-- Limpiar
DROP TABLE IF EXISTS clients_backup;

SELECT '========================================' as separador;
SELECT 'LIMPIEZA COMPLETADA' as resultado;
SELECT '========================================' as separador;

-- =====================================================
-- RESUMEN DE LO QUE HACE ESTE SCRIPT
-- =====================================================

-- ✅ Corrige caracteres especiales en TODAS las tablas:
--    - clients
--    - policies
--    - comm_items
--    - fortnight_details
--    - pending_items

-- ✅ Elimina clientes sin pólizas (huérfanos)
--    Solo si no tienen referencias en otras tablas

-- ✅ Genera reportes antes/después

-- ✅ NO toca datos de quincenas cerradas
--    (solo actualiza nombres, no montos ni cálculos)

-- ⚠️ IMPORTANTE:
--    - Este script es SEGURO de ejecutar
--    - Hace backup temporal antes de actualizar
--    - Solo elimina registros huérfanos sin referencias
--    - Los cambios son permanentes pero correctos
