-- =====================================================
-- SCRIPT SIMPLIFICADO PARA NORMALIZAR NOMBRES
-- Ejecutar línea por línea o sección por sección
-- =====================================================

-- =====================================================
-- SECCIÓN 1: Crear función de normalización
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

-- ✅ Verificar que la función fue creada
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'normalize_name'
  AND routine_schema = 'public';
-- Debe mostrar 1 fila

-- =====================================================
-- SECCIÓN 2: Probar la función
-- =====================================================

-- Ejemplos de prueba
SELECT normalize_name('MATEO PATIÑO MARTINEZ');
-- Resultado esperado: MATEO PATINO MARTINEZ

SELECT normalize_name('ALVARO AURELIO ARCIA NUÑEZ');
-- Resultado esperado: ALVARO AURELIO ARCIA NUNEZ

SELECT normalize_name('José María González-López');
-- Resultado esperado: JOSE MARIA GONZALEZLOPEZ

-- =====================================================
-- SECCIÓN 3: Ver cuántos clientes necesitan corrección
-- =====================================================

SELECT 
  COUNT(*) as total_con_caracteres_especiales
FROM clients
WHERE name != normalize_name(name);

-- =====================================================
-- SECCIÓN 4: Ver ejemplos de lo que se va a cambiar
-- =====================================================

SELECT 
  id,
  name as nombre_actual,
  normalize_name(name) as nombre_normalizado
FROM clients
WHERE name != normalize_name(name)
ORDER BY name
LIMIT 30;

-- ¿Se ven bien los cambios? Si SÍ, continúa con Sección 5
-- Si NO, detente y revisa

-- =====================================================
-- SECCIÓN 5: Crear BACKUP (CRÍTICO!)
-- =====================================================

-- Eliminar backup anterior si existe
DROP TABLE IF EXISTS clients_backup_names;

-- Crear nuevo backup
CREATE TABLE clients_backup_names AS 
SELECT id, name, created_at, NOW() as backup_date
FROM clients;

-- Verificar backup
SELECT 
  COUNT(*) as total_respaldados,
  MIN(backup_date) as fecha_backup
FROM clients_backup_names;

-- =====================================================
-- SECCIÓN 6: ACTUALIZAR NOMBRES (CON TRANSACCIÓN)
-- =====================================================

-- OPCIÓN A: Ver cuántos se van a actualizar (SIN MODIFICAR NADA)
SELECT COUNT(*) as total_a_actualizar
FROM clients
WHERE name != normalize_name(name);

-- OPCIÓN B: ACTUALIZAR DE VERDAD
-- Ejecuta todo el bloque BEGIN...COMMIT junto

BEGIN;

-- Actualizar nombres
UPDATE clients 
SET name = normalize_name(name)
WHERE name != normalize_name(name);

-- Ver cuántos se actualizaron
SELECT COUNT(*) as actualizados
FROM clients c
INNER JOIN clients_backup_names cb ON c.id = cb.id
WHERE c.name != cb.name;

-- ¿Todo luce bien? 
-- SI → Ejecuta: COMMIT;
-- NO → Ejecuta: ROLLBACK;

COMMIT;
-- O ejecutar ROLLBACK; para cancelar

-- =====================================================
-- SECCIÓN 7: Verificación Final
-- =====================================================

-- Debe retornar 0 si todos fueron normalizados
SELECT COUNT(*) as pendientes_normalizar
FROM clients
WHERE name != normalize_name(name);

-- Ver ejemplos de cambios realizados
SELECT 
  cb.name as antes,
  c.name as despues
FROM clients_backup_names cb
JOIN clients c ON c.id = cb.id
WHERE cb.name != c.name
ORDER BY c.name
LIMIT 20;

-- =====================================================
-- SECCIÓN 8: Verificar duplicados (OPCIONAL)
-- =====================================================

-- Buscar nombres duplicados después de normalizar
SELECT 
  name,
  COUNT(*) as cantidad,
  STRING_AGG(id::text, ', ') as ids
FROM clients
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY cantidad DESC;

-- Si hay duplicados, revisarlos manualmente
-- NO eliminar automáticamente

-- =====================================================
-- SECCIÓN 9: Estadísticas
-- =====================================================

SELECT 
  'Total clientes' as metrica,
  COUNT(*)::text as valor
FROM clients

UNION ALL

SELECT 
  'Clientes con nombres normalizados' as metrica,
  COUNT(*)::text as valor
FROM clients
WHERE name = normalize_name(name)

UNION ALL

SELECT 
  'Clientes en backup' as metrica,
  COUNT(*)::text as valor
FROM clients_backup_names

UNION ALL

SELECT 
  'Nombres que cambiaron' as metrica,
  COUNT(*)::text as valor
FROM clients c
INNER JOIN clients_backup_names cb ON c.id = cb.id
WHERE c.name != cb.name;

-- =====================================================
-- SECCIÓN 10: Revertir cambios (SOLO SI ALGO SALIÓ MAL)
-- =====================================================

-- ⚠️ SOLO ejecutar si necesitas deshacer los cambios
/*
BEGIN;

UPDATE clients c
SET name = cb.name
FROM clients_backup_names cb
WHERE c.id = cb.id AND c.name != cb.name;

-- Verificar
SELECT COUNT(*) as revertidos FROM clients;

COMMIT;
*/

-- =====================================================
-- LIMPIAR BACKUP (SOLO DESPUÉS DE VERIFICAR TODO)
-- =====================================================

-- ⚠️ SOLO ejecutar cuando estés 100% seguro
-- DROP TABLE clients_backup_names;

-- =====================================================
-- ✅ COMPLETADO
-- =====================================================
