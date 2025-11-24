-- =====================================================
-- AUTOMATIZACIÓN: Corrección de Encoding en Imports
-- =====================================================

-- =====================================================
-- PARTE 1: Función de corrección (ya existe)
-- =====================================================

-- Reusar la función creada anteriormente
-- Ya está en la BD si ejecutaste LIMPIEZA_DB_CORREGIDA.sql

-- =====================================================
-- PARTE 2: Trigger para clients
-- =====================================================

-- Trigger para corregir automáticamente al insertar/actualizar
CREATE OR REPLACE FUNCTION trigger_fix_client_encoding()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Corregir el nombre automáticamente
  IF NEW.name IS NOT NULL AND NEW.name LIKE '%Ã%' THEN
    NEW.name := fix_text_encoding(NEW.name);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Aplicar trigger a tabla clients
DROP TRIGGER IF EXISTS before_insert_update_client_encoding ON clients;
CREATE TRIGGER before_insert_update_client_encoding
  BEFORE INSERT OR UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION trigger_fix_client_encoding();

SELECT '✅ Trigger creado para clients' as resultado;

-- =====================================================
-- PARTE 3: Trigger para comm_items
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_fix_comm_items_encoding()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Corregir el nombre del asegurado automáticamente
  IF NEW.insured_name IS NOT NULL AND NEW.insured_name LIKE '%Ã%' THEN
    NEW.insured_name := fix_text_encoding(NEW.insured_name);
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_insert_update_comm_items_encoding ON comm_items;
CREATE TRIGGER before_insert_update_comm_items_encoding
  BEFORE INSERT OR UPDATE ON comm_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_fix_comm_items_encoding();

SELECT '✅ Trigger creado para comm_items' as resultado;

-- =====================================================
-- PARTE 4: Trigger para pending_items
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_fix_pending_items_encoding()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Corregir el nombre del asegurado automáticamente
  IF NEW.insured_name IS NOT NULL AND NEW.insured_name LIKE '%Ã%' THEN
    NEW.insured_name := fix_text_encoding(NEW.insured_name);
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_insert_update_pending_items_encoding ON pending_items;
CREATE TRIGGER before_insert_update_pending_items_encoding
  BEFORE INSERT OR UPDATE ON pending_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_fix_pending_items_encoding();

SELECT '✅ Trigger creado para pending_items' as resultado;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Ver triggers activos
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name LIKE '%encoding%'
ORDER BY event_object_table;

-- =====================================================
-- PRUEBA
-- =====================================================

-- Probar que funciona (opcional)
-- Descomentar para probar:

/*
-- Crear cliente de prueba con encoding malo
INSERT INTO clients (broker_id, name, national_id)
VALUES (
  (SELECT id FROM brokers LIMIT 1),
  'José García',  -- Debería auto-corregirse
  'TEST-123'
)
RETURNING id, name;

-- Verificar que se corrigió
SELECT name FROM clients WHERE national_id = 'TEST-123';

-- Limpiar prueba
DELETE FROM clients WHERE national_id = 'TEST-123';
*/

-- =====================================================
-- RESUMEN
-- =====================================================

SELECT '========================================' as info;
SELECT 'AUTOMATIZACIÓN COMPLETADA' as resultado;
SELECT '========================================' as info;

SELECT 'Triggers creados para:' as info
UNION ALL
SELECT '  ✅ clients.name' as info
UNION ALL
SELECT '  ✅ comm_items.insured_name' as info
UNION ALL
SELECT '  ✅ pending_items.insured_name' as info
UNION ALL
SELECT '' as info
UNION ALL
SELECT 'Desde ahora, todos los imports se corregirán automáticamente' as info;

-- =====================================================
-- NOTAS IMPORTANTES
-- =====================================================

-- ✅ Los triggers se ejecutan ANTES de insertar/actualizar
-- ✅ La corrección es automática e invisible
-- ✅ No afecta el rendimiento significativamente
-- ✅ Funciona para bulk imports y inserts individuales
-- ✅ La función fix_text_encoding debe existir (ya creada)

-- ⚠️ Si la función fix_text_encoding no existe, ejecutar primero:
-- LIMPIEZA_DB_CORREGIDA.sql (contiene la función)
