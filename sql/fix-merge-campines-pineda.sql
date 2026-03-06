-- ============================================================================
-- FIX: Fusionar duplicado de GABRIEL ANTONIO CAMPINES PINEDA
-- ============================================================================
-- Cliente REAL (conservar): tiene cédula 8-813-1947 y pólizas
-- Cliente DUPLICADO (eliminar): mismo nombre, SIN cédula, 0 pólizas
--
-- Ejecutar en Supabase SQL Editor paso a paso.
-- ============================================================================

-- PASO 0: Identificar ambos registros
-- El cliente REAL tiene national_id = '8-813-1947'
-- El duplicado tiene el mismo nombre pero national_id IS NULL y 0 pólizas

-- Verificar antes de ejecutar:
SELECT 
  c.id,
  c.name,
  c.national_id,
  (SELECT count(*) FROM policies p WHERE p.client_id = c.id) AS policy_count,
  (SELECT count(*) FROM fortnight_details fd WHERE fd.client_id = c.id) AS commission_count,
  (SELECT count(*) FROM chat_threads ct WHERE ct.client_id = c.id) AS chat_thread_count,
  (SELECT count(*) FROM cases cs WHERE cs.client_id = c.id) AS case_count,
  (SELECT count(*) FROM expediente_documents ed WHERE ed.client_id = c.id) AS expediente_count,
  (SELECT count(*) FROM temp_client_import tci WHERE tci.client_id = c.id) AS temp_import_count
FROM clients c
WHERE c.name ILIKE '%CAMPINES PINEDA%'
ORDER BY c.national_id NULLS LAST;

-- ============================================================================
-- PASO 1: Transferir TODAS las referencias del duplicado al real
-- Reemplazar los UUIDs después de verificar el PASO 0
-- ============================================================================

-- Usar un bloque DO para hacerlo dinámicamente por nombre/cédula:
DO $$
DECLARE
  v_real_id uuid;
  v_dup_id uuid;
  v_real_name text;
  v_dup_name text;
BEGIN
  -- Encontrar el cliente REAL (tiene cédula)
  SELECT id, name INTO v_real_id, v_real_name
  FROM clients
  WHERE national_id = '8-813-1947'
    AND name ILIKE '%CAMPINES PINEDA%'
  LIMIT 1;

  IF v_real_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró cliente REAL con cédula 8-813-1947 y nombre CAMPINES PINEDA';
  END IF;

  -- Encontrar el duplicado (mismo nombre, sin cédula, 0 pólizas)
  SELECT id, name INTO v_dup_id, v_dup_name
  FROM clients
  WHERE name ILIKE '%CAMPINES PINEDA%'
    AND (national_id IS NULL OR national_id = '')
    AND id != v_real_id
    AND NOT EXISTS (SELECT 1 FROM policies p WHERE p.client_id = clients.id)
  LIMIT 1;

  IF v_dup_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró cliente DUPLICADO sin cédula y 0 pólizas con nombre CAMPINES PINEDA';
  END IF;

  RAISE NOTICE 'Cliente REAL: % (%) — id: %', v_real_name, '8-813-1947', v_real_id;
  RAISE NOTICE 'Cliente DUPLICADO: % (sin cédula) — id: %', v_dup_name, v_dup_id;

  -- 1. Transferir pólizas (debería ser 0, pero por seguridad)
  UPDATE policies SET client_id = v_real_id WHERE client_id = v_dup_id;
  RAISE NOTICE 'Pólizas transferidas: %', (SELECT count(*) FROM policies WHERE client_id = v_real_id) - 0;

  -- 2. Transferir historial de comisiones (fortnight_details)
  UPDATE fortnight_details SET client_id = v_real_id WHERE client_id = v_dup_id;
  RAISE NOTICE 'fortnight_details transferidos';

  -- 3. Transferir cases
  UPDATE cases SET client_id = v_real_id WHERE client_id = v_dup_id;
  UPDATE cases SET created_client_id = v_real_id WHERE created_client_id = v_dup_id;
  RAISE NOTICE 'cases transferidos';

  -- 4. Transferir expediente_documents
  UPDATE expediente_documents SET client_id = v_real_id WHERE client_id = v_dup_id;
  RAISE NOTICE 'expediente_documents transferidos';

  -- 5. Transferir temp_client_import
  UPDATE temp_client_import SET client_id = v_real_id WHERE client_id = v_dup_id;
  RAISE NOTICE 'temp_client_import transferidos';

  -- 6. Transferir chat_threads
  UPDATE chat_threads SET client_id = v_real_id WHERE client_id = v_dup_id;
  RAISE NOTICE 'chat_threads transferidos';

  -- 7. Transferir chat_interactions
  UPDATE chat_interactions SET client_id = v_real_id WHERE client_id = v_dup_id;
  RAISE NOTICE 'chat_interactions transferidos';

  -- 8. Eliminar el duplicado
  DELETE FROM clients WHERE id = v_dup_id;
  RAISE NOTICE 'Cliente duplicado eliminado: %', v_dup_id;

  RAISE NOTICE '✅ Fusión completada exitosamente';
END $$;

-- ============================================================================
-- PASO 2: Verificar resultado
-- ============================================================================
SELECT 
  c.id,
  c.name,
  c.national_id,
  (SELECT count(*) FROM policies p WHERE p.client_id = c.id) AS policy_count,
  (SELECT count(*) FROM fortnight_details fd WHERE fd.client_id = c.id) AS commission_count
FROM clients c
WHERE c.name ILIKE '%CAMPINES PINEDA%';
