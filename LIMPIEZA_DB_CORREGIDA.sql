-- =====================================================
-- LIMPIEZA DE BASE DE DATOS - VERSIÓN CORREGIDA
-- =====================================================
-- TODAS LAS COLUMNAS VERIFICADAS EN database.types.ts
-- =====================================================

-- =====================================================
-- PARTE 1: DIAGNÓSTICO
-- =====================================================

SELECT '========== DIAGNÓSTICO INICIAL ==========' as info;

-- Estadísticas
SELECT 
  'Total clientes' as metrica,
  COUNT(*) as cantidad
FROM clients
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
  'Clientes con encoding malo' as metrica,
  COUNT(*) as cantidad
FROM clients
WHERE name LIKE '%Ã%';

-- =====================================================
-- PARTE 2: FUNCIÓN DE CORRECCIÓN DE ENCODING
-- =====================================================

SELECT '========== CREANDO FUNCIÓN ==========' as info;

-- Función simple y efectiva
CREATE OR REPLACE FUNCTION fix_text_encoding(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result TEXT;
BEGIN
  result := input_text;
  
  -- Vocales minúsculas con acento
  result := REPLACE(result, E'Ã¡', 'á');
  result := REPLACE(result, E'Ã©', 'é');
  result := REPLACE(result, E'Ã­', 'í');
  result := REPLACE(result, E'Ã³', 'ó');
  result := REPLACE(result, E'Ãº', 'ú');
  
  -- Vocales mayúsculas con acento
  result := REPLACE(result, E'Á', 'Á');
  result := REPLACE(result, E'É', 'É');
  result := REPLACE(result, E'Í', 'Í');
  result := REPLACE(result, E'Ó', 'Ó');
  result := REPLACE(result, E'Ú', 'Ú');
  
  -- Letra Ñ
  result := REPLACE(result, E'Ã±', 'ñ');
  result := REPLACE(result, E'Ñ', 'Ñ');
  
  -- Limpiar caracteres basura comunes
  result := REPLACE(result, E'Â', '');
  result := REPLACE(result, E'â', '');
  
  RETURN result;
END;
$$;

SELECT '========== FUNCIÓN CREADA ==========' as info;

-- =====================================================
-- PARTE 3: CORREGIR CARACTERES ESPECIALES
-- =====================================================

SELECT '========== CORRIGIENDO ENCODING ==========' as info;

-- Backup temporal
CREATE TEMP TABLE IF NOT EXISTS clients_backup AS
SELECT id, name
FROM clients
WHERE name LIKE '%Ã%';

SELECT 'Backup creado:' as info, COUNT(*) as registros FROM clients_backup;

-- TABLA 1: clients.name
UPDATE clients
SET name = fix_text_encoding(name)
WHERE name LIKE '%Ã%';

SELECT '✅ clients.name actualizado' as resultado;

-- TABLA 2: comm_items.insured_name
-- VERIFICADO: comm_items SÍ tiene columna insured_name
UPDATE comm_items
SET insured_name = fix_text_encoding(insured_name)
WHERE insured_name IS NOT NULL
  AND insured_name LIKE '%Ã%';

SELECT '✅ comm_items.insured_name actualizado' as resultado;

-- TABLA 3: pending_items.insured_name
-- VERIFICADO: pending_items SÍ tiene columna insured_name
UPDATE pending_items
SET insured_name = fix_text_encoding(insured_name)
WHERE insured_name IS NOT NULL
  AND insured_name LIKE '%Ã%';

SELECT '✅ pending_items.insured_name actualizado' as resultado;

-- NOTA: policies NO tiene columna insured_name, se omite

-- =====================================================
-- PARTE 4: ELIMINAR CLIENTES SIN PÓLIZAS
-- =====================================================

SELECT '========== ELIMINANDO CLIENTES HUÉRFANOS ==========' as info;

-- Ver cuántos hay
SELECT 
  'Clientes sin pólizas (antes):' as estado,
  COUNT(*) as cantidad
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = c.id
);

-- Eliminar clientes sin pólizas y sin referencias
DELETE FROM clients
WHERE id IN (
  SELECT c.id 
  FROM clients c
  WHERE NOT EXISTS (
    -- Sin pólizas
    SELECT 1 FROM policies p WHERE p.client_id = c.id
  )
  AND NOT EXISTS (
    -- Sin referencias en comm_items (via policy_number)
    SELECT 1 FROM comm_items ci
    JOIN policies p2 ON p2.policy_number = ci.policy_number
    WHERE p2.client_id = c.id
  )
  AND NOT EXISTS (
    -- Sin referencias en pending_items
    -- NOTA: pending_items NO tiene client_id
    SELECT 1 FROM pending_items pi
    WHERE pi.policy_number IN (
      SELECT policy_number FROM policies WHERE client_id = c.id
    )
  )
  AND NOT EXISTS (
    -- Sin referencias en fortnight_details
    -- VERIFICADO: fortnight_details tiene client_id
    SELECT 1 FROM fortnight_details fd WHERE fd.client_id = c.id
  )
);

-- Ver resultado
SELECT 
  'Clientes sin pólizas (después):' as estado,
  COUNT(*) as cantidad
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = c.id
);

SELECT '✅ Clientes huérfanos eliminados' as resultado;

-- =====================================================
-- PARTE 5: REPORTE FINAL
-- =====================================================

SELECT '========== REPORTE FINAL ==========' as info;

-- Comparar antes/después
SELECT 
  'Ejemplos de correcciones:' as seccion;

SELECT 
  cb.name as antes,
  c.name as despues
FROM clients_backup cb
JOIN clients c ON c.id = cb.id
WHERE cb.name != c.name
LIMIT 10;

-- Estadísticas finales
SELECT 
  'Total clientes' as metrica,
  COUNT(*) as cantidad
FROM clients
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
  'Nombres con Ã restantes' as metrica,
  COUNT(*) as cantidad
FROM clients
WHERE name LIKE '%Ã%';

SELECT '========== LIMPIEZA COMPLETADA ==========' as info;

-- Limpiar
DROP TABLE IF EXISTS clients_backup;

-- =====================================================
-- RESUMEN
-- =====================================================
-- ✅ Se corrigió encoding en: clients, comm_items, pending_items
-- ✅ NO se tocó policies (no tiene insured_name)
-- ✅ Se eliminaron clientes sin pólizas
-- ✅ Se verificaron referencias antes de eliminar:
--    - policies
--    - comm_items (via policy_number)
--    - pending_items (via policy_number)
--    - fortnight_details (client_id directo)
-- =====================================================
