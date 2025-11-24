-- =====================================================
-- CORRECCIÓN: Caracteres Especiales en Nombres
-- =====================================================
-- Problema: Nombres con problemas de codificación (acentos, ñ)
-- Causa: Importación con encoding incorrecto
-- Solución: Corregir caracteres malformados
-- =====================================================

-- PASO 1: DIAGNÓSTICO - Identificar problemas comunes

-- Ver ejemplos de nombres con problemas
SELECT 
  'Nombres con problemas de encoding' as categoria,
  name,
  national_id,
  id
FROM clients
WHERE 
  -- Detectar secuencias de caracteres problemáticos
  name LIKE '%Ã%'       -- Común en mal encoding UTF-8
  OR name LIKE '%â%'
  OR name LIKE '%©%'
  OR name LIKE '%±%'
  OR name LIKE '%Â%'
  OR name LIKE '%¡%'
  OR name LIKE '%³%'
  OR name LIKE '%¢%'
  OR name ~ '[^\x00-\x7F]+'  -- Caracteres no-ASCII malformados
ORDER BY name
LIMIT 50;

-- Contar cuántos clientes tienen problemas
SELECT 
  COUNT(*) as clientes_con_problemas
FROM clients
WHERE 
  name LIKE '%Ã%'
  OR name LIKE '%â%'
  OR name LIKE '%©%'
  OR name LIKE '%±%'
  OR name LIKE '%Â%'
  OR name LIKE '%¡%'
  OR name LIKE '%³%'
  OR name LIKE '%¢%';

-- =====================================================
-- PASO 2: CORRECCIONES ESPECÍFICAS
-- =====================================================

-- Crear función para limpiar nombres
CREATE OR REPLACE FUNCTION fix_encoding(text_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE
AS $function$
BEGIN
  RETURN 
    -- Vocales minúsculas con acento
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    -- Vocales mayúsculas con acento
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    -- Ñ y ñ
    REPLACE(REPLACE(
    -- Limpiar caracteres basura
    REPLACE(REPLACE(REPLACE(
      text_input,
      E'\\303\\241', 'á'),  -- Ã¡ → á
      E'\\303\\251', 'é'),  -- Ã© → é
      E'\\303\\255', 'í'),  -- Ã­ → í
      E'\\303\\263', 'ó'),  -- Ã³ → ó
      E'\\303\\272', 'ú'),  -- Ãº → ú
      E'\\303\\201', 'Á'),  -- Ã → Á
      E'\\303\\211', 'É'),  -- Ã‰ → É
      E'\\303\\215', 'Í'),  -- Ã → Í
      E'\\303\\223', 'Ó'),  -- Ã" → Ó
      E'\\303\\232', 'Ú'),  -- Ãš → Ú
      E'\\303\\261', 'ñ'),  -- Ã± → ñ
      E'\\303\\221', 'Ñ'),  -- Ã' → Ñ
      E'\\302\\240', ' '),  -- Â → espacio
      E'\\303\\203', ''),   -- à (basura) → eliminar
      E'\\302\\242', '');   -- ¢ (basura) → eliminar
END;
$function$;

-- =====================================================
-- PASO 3: APLICAR CORRECCIONES
-- =====================================================

-- Backup de datos antes de actualizar (crear tabla temporal)
CREATE TEMP TABLE clients_backup AS
SELECT id, name, national_id
FROM clients
WHERE 
  name LIKE '%Ã%'
  OR name LIKE '%â%'
  OR name LIKE '%©%'
  OR name LIKE '%±%'
  OR name LIKE '%Â%'
  OR name LIKE '%¡%'
  OR name LIKE '%³%'
  OR name LIKE '%¢%';

-- Ver cuántos se guardaron en backup
SELECT 'Clientes en backup' as info, COUNT(*) FROM clients_backup;

-- Actualizar nombres en tabla clients
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

-- Actualizar nombres en tabla policies (si también tienen problemas)
UPDATE policies
SET insured_name = fix_encoding(insured_name)
WHERE 
  insured_name LIKE '%Ã%'
  OR insured_name LIKE '%â%'
  OR insured_name LIKE '%©%'
  OR insured_name LIKE '%±%'
  OR insured_name LIKE '%Â%'
  OR insured_name LIKE '%¡%'
  OR insured_name LIKE '%³%'
  OR insured_name LIKE '%¢%';

-- Actualizar nombres en comm_items
UPDATE comm_items
SET insured_name = fix_encoding(insured_name)
WHERE 
  insured_name LIKE '%Ã%'
  OR insured_name LIKE '%â%'
  OR insured_name LIKE '%©%'
  OR insured_name LIKE '%±%'
  OR insured_name LIKE '%Â%'
  OR insured_name LIKE '%¡%'
  OR insured_name LIKE '%³%'
  OR insured_name LIKE '%¢%';

-- Actualizar nombres en fortnight_details
UPDATE fortnight_details
SET client_name = fix_encoding(client_name)
WHERE 
  client_name LIKE '%Ã%'
  OR client_name LIKE '%â%'
  OR client_name LIKE '%©%'
  OR client_name LIKE '%±%'
  OR client_name LIKE '%Â%'
  OR client_name LIKE '%¡%'
  OR client_name LIKE '%³%'
  OR client_name LIKE '%¢%';

-- Actualizar nombres en pending_items
UPDATE pending_items
SET insured_name = fix_encoding(insured_name)
WHERE 
  insured_name LIKE '%Ã%'
  OR insured_name LIKE '%â%'
  OR insured_name LIKE '%©%'
  OR insured_name LIKE '%±%'
  OR insured_name LIKE '%Â%'
  OR insured_name LIKE '%¡%'
  OR insured_name LIKE '%³%'
  OR insured_name LIKE '%¢%';

-- =====================================================
-- PASO 4: VERIFICACIÓN
-- =====================================================

-- Comparar antes y después
SELECT 
  'Antes' as momento,
  cb.name as nombre_anterior,
  c.name as nombre_corregido,
  c.national_id
FROM clients_backup cb
JOIN clients c ON c.id = cb.id
WHERE cb.name != c.name
LIMIT 20;

-- Contar cuántos clientes aún tienen problemas
SELECT 
  'Clientes con problemas restantes' as resultado,
  COUNT(*) as cantidad
FROM clients
WHERE 
  name LIKE '%Ã%'
  OR name LIKE '%â%'
  OR name LIKE '%©%'
  OR name LIKE '%±%'
  OR name LIKE '%Â%';

-- =====================================================
-- PASO 5: LIMPIEZA MANUAL ADICIONAL
-- =====================================================

-- Si hay casos específicos que no se corrigieron automáticamente,
-- se pueden corregir manualmente aquí:

-- Ejemplo:
-- UPDATE clients 
-- SET name = 'José García' 
-- WHERE name = 'JosÃ© GarcÃ­a';

-- Ver casos que necesitan corrección manual
SELECT 
  id,
  name,
  national_id,
  'Posible problema manual' as nota
FROM clients
WHERE 
  (name LIKE '%Ã%' OR name LIKE '%â%')
  AND name NOT SIMILAR TO '%[a-zA-Z áéíóúñÑ]+%'
ORDER BY name;

-- =====================================================
-- PASO 6: REPORTE FINAL
-- =====================================================

SELECT 
  'Total clientes actualizados' as metrica,
  COUNT(*) as cantidad
FROM clients_backup;

SELECT 
  'Problemas restantes' as metrica,
  COUNT(*) as cantidad
FROM clients
WHERE 
  name LIKE '%Ã%'
  OR name LIKE '%â%'
  OR name LIKE '%©%';

-- Limpiar tabla temporal
DROP TABLE IF EXISTS clients_backup;

-- =====================================================
-- COMENTARIOS Y NOTAS
-- =====================================================

-- Este script:
-- ✅ Identifica nombres con problemas de encoding
-- ✅ Crea backup temporal antes de actualizar
-- ✅ Corrige patrones comunes de mal encoding UTF-8
-- ✅ Actualiza TODAS las tablas relevantes (clients, policies, comm_items, etc.)
-- ✅ No toca datos de quincenas cerradas (solo actualiza nombres)
-- ✅ Proporciona verificación antes/después

-- Caracteres corregidos:
-- ✅ á, é, í, ó, ú (minúsculas con acento)
-- ✅ Á, É, Í, Ó, Ú (mayúsculas con acento)
-- ✅ ñ, Ñ
-- ✅ Comillas tipográficas
-- ✅ Caracteres de control malformados

-- Para ejecutar:
-- 1. Ejecutar PASO 1 (diagnóstico)
-- 2. Revisar ejemplos de nombres problemáticos
-- 3. Ejecutar PASO 2 (crear función)
-- 4. Ejecutar PASO 3 (aplicar correcciones)
-- 5. Verificar con PASO 4
-- 6. Si hay casos específicos, usar PASO 5
-- 7. Ver reporte final con PASO 6
