-- =====================================================
-- FUNCIÓN CORREGIDA PARA NORMALIZAR NOMBRES
-- Guiones (-) se convierten en ESPACIOS (no se eliminan)
-- =====================================================

CREATE OR REPLACE FUNCTION normalize_name(text_input TEXT)
RETURNS TEXT AS $$
DECLARE
  normalized TEXT;
BEGIN
  IF text_input IS NULL OR TRIM(text_input) = '' THEN
    RETURN '';
  END IF;
  
  normalized := UPPER(TRIM(text_input));
  
  -- 1. Reemplazar acentos y ñ
  normalized := TRANSLATE(normalized,
    'ÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÂÊÎÔÛÑ',
    'AEIOUAEIOUAEIOUAEIOUN'
  );
  
  -- 2. Convertir guiones en ESPACIOS (IMPORTANTE)
  normalized := REPLACE(normalized, '-', ' ');
  
  -- 3. Eliminar otros caracteres especiales (punto, coma, etc.)
  -- PERO mantener espacios, A-Z, 0-9
  normalized := REGEXP_REPLACE(normalized, '[^A-Z0-9 ]', '', 'g');
  
  -- 4. Comprimir espacios múltiples a uno solo
  normalized := REGEXP_REPLACE(normalized, '\s+', ' ', 'g');
  
  RETURN TRIM(normalized);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- PRUEBAS DE LA FUNCIÓN
-- =====================================================

-- Ejemplo 1: Acentos y ñ
SELECT normalize_name('MATEO PATIÑO MARTINEZ');
-- Resultado esperado: MATEO PATINO MARTINEZ

-- Ejemplo 2: Guiones (IMPORTANTE: deben convertirse en espacios)
SELECT normalize_name('González-López');
-- Resultado esperado: GONZALEZ LOPEZ

-- Ejemplo 3: Múltiples guiones
SELECT normalize_name('JUAN-CARLOS-DE-LA-CRUZ');
-- Resultado esperado: JUAN CARLOS DE LA CRUZ

-- Ejemplo 4: Caracteres especiales mixtos
SELECT normalize_name('José María González-López (hijo)');
-- Resultado esperado: JOSE MARIA GONZALEZ LOPEZ HIJO

-- Ejemplo 5: Con números
SELECT normalize_name('Pedro Pérez-123');
-- Resultado esperado: PEDRO PEREZ 123

-- =====================================================
-- VER CUÁNTOS CLIENTES NECESITAN CORRECCIÓN
-- =====================================================

SELECT 
  COUNT(*) as total_con_caracteres_especiales
FROM clients
WHERE name != normalize_name(name);

-- =====================================================
-- VER EJEMPLOS DE NOMBRES QUE CAMBIARÁN
-- =====================================================

SELECT 
  id,
  name as nombre_actual,
  normalize_name(name) as nombre_normalizado,
  CASE 
    WHEN name ~ '-' THEN '✓ Tiene guiones'
    WHEN name ~ '[ÁÉÍÓÚÑ]' THEN '✓ Tiene acentos/ñ'
    ELSE '✓ Otros caracteres'
  END as tipo_cambio
FROM clients
WHERE name != normalize_name(name)
ORDER BY name
LIMIT 30;

-- =====================================================
-- BACKUP Y ACTUALIZACIÓN (EJECUTAR CON CUIDADO)
-- =====================================================

-- Paso 1: Crear backup
DROP TABLE IF EXISTS clients_backup_names;
CREATE TABLE clients_backup_names AS 
SELECT id, name, created_at, NOW() as backup_date
FROM clients;

-- Paso 2: Ver cuántos se actualizarán
SELECT COUNT(*) as total_a_actualizar
FROM clients
WHERE name != normalize_name(name);

-- Paso 3: Actualizar (dentro de transacción)
BEGIN;

UPDATE clients 
SET name = normalize_name(name)
WHERE name != normalize_name(name);

-- Ver resultado
SELECT COUNT(*) as actualizados
FROM clients c
INNER JOIN clients_backup_names cb ON c.id = cb.id
WHERE c.name != cb.name;

-- Si todo está bien: COMMIT;
-- Si algo está mal: ROLLBACK;

COMMIT;

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================

-- Debe retornar 0
SELECT COUNT(*) as pendientes_normalizar
FROM clients
WHERE name != normalize_name(name);

-- Ver ejemplos de cambios realizados
SELECT 
  cb.name as antes,
  c.name as despues,
  CASE 
    WHEN cb.name ~ '-' AND c.name ~ ' ' THEN '✓ Guión → Espacio'
    WHEN cb.name ~ '[áéíóúñ]' AND cb.name != c.name THEN '✓ Acentos normalizados'
    ELSE '✓ Otros'
  END as tipo_cambio
FROM clients_backup_names cb
JOIN clients c ON c.id = cb.id
WHERE cb.name != c.name
ORDER BY c.name
LIMIT 20;
