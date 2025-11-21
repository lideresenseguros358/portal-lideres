-- =====================================================
-- FUNCIÓN SQL PARA NORMALIZAR NOMBRES
-- Replica la función toUpperNoAccents de TypeScript
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
  
  -- Reemplazar acentos y ñ
  normalized := TRANSLATE(normalized,
    'ÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÂÊÎÔÛÑ',
    'AEIOUAEIOUAEIOUAEIOUN'
  );
  
  -- Eliminar caracteres especiales (solo permitir A-Z, 0-9 y espacios)
  normalized := REGEXP_REPLACE(normalized, '[^A-Z0-9 ]', '', 'g');
  
  -- Comprimir espacios múltiples a uno solo
  normalized := REGEXP_REPLACE(normalized, '\s+', ' ', 'g');
  
  RETURN TRIM(normalized);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- EJEMPLOS DE USO:
-- SELECT normalize_name('ALVARO AURELIO ARCIA NUÑEZ');
-- Resultado: ALVARO AURELIO ARCIA NUNEZ

-- SELECT normalize_name('MATEO PATIÑO MARTINEZ');
-- Resultado: MATEO PATINO MARTINEZ

-- SELECT normalize_name('José María González-López');
-- Resultado: JOSE MARIA GONZALEZLOPEZ

-- =====================================================
-- SCRIPT PARA ACTUALIZAR NOMBRES EXISTENTES
-- =====================================================

-- Ver clientes con caracteres especiales
SELECT 
  id,
  name as nombre_original,
  normalize_name(name) as nombre_normalizado
FROM clients
WHERE name != normalize_name(name)
ORDER BY name;

-- Actualizar todos los nombres de clientes (EJECUTAR CON CUIDADO)
-- UPDATE clients 
-- SET name = normalize_name(name)
-- WHERE name != normalize_name(name);

-- Verificar después de actualizar
-- SELECT COUNT(*) as total_actualizados
-- FROM clients
-- WHERE name != normalize_name(name);
-- Debe retornar 0
