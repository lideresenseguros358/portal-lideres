-- =====================================================
-- REVERTIR DUPLICADOS Y CORREGIR CORRECTAMENTE
-- =====================================================
-- PASO 1: Eliminar clientes duplicados creados por error
-- PASO 2: Actualizar policies.broker_id = clients.broker_id (SIN DUPLICAR)
-- PASO 3: Restaurar índice único en national_id
-- =====================================================

DO $$
DECLARE
  r RECORD;
  v_deleted_clients INT := 0;
  v_updated_policies INT := 0;
BEGIN
  RAISE NOTICE '=== PASO 1: ELIMINANDO CLIENTES DUPLICADOS ===';
  
  -- Encontrar y eliminar clientes duplicados (mantener el más antiguo)
  FOR r IN 
    SELECT 
      national_id,
      array_agg(id ORDER BY created_at) as client_ids,
      array_agg(name ORDER BY created_at) as client_names,
      COUNT(*) as duplicate_count
    FROM clients
    WHERE national_id IS NOT NULL
    GROUP BY national_id
    HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE '';
    RAISE NOTICE '--- Cédula: % (% duplicados)', r.national_id, r.duplicate_count;
    
    -- Mantener el primer cliente (más antiguo), eliminar los demás
    FOR i IN 2..array_length(r.client_ids, 1) LOOP
      RAISE NOTICE '    Eliminando duplicado: % (ID: %)', r.client_names[i], r.client_ids[i];
      
      -- Mover pólizas del duplicado al cliente original
      UPDATE policies 
      SET client_id = r.client_ids[1]
      WHERE client_id = r.client_ids[i];
      
      -- Eliminar cliente duplicado
      DELETE FROM clients WHERE id = r.client_ids[i];
      
      v_deleted_clients := v_deleted_clients + 1;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '=== PASO 2: CORRIGIENDO BROKER_ID EN PÓLIZAS ===';
  
  -- Actualizar TODAS las pólizas para que tengan el mismo broker_id que su cliente
  UPDATE policies p
  SET broker_id = c.broker_id
  FROM clients c
  WHERE p.client_id = c.id
    AND p.broker_id != c.broker_id;
  
  GET DIAGNOSTICS v_updated_policies = ROW_COUNT;
  
  RAISE NOTICE '';
  RAISE NOTICE '=== RESUMEN ===';
  RAISE NOTICE 'Clientes duplicados eliminados: %', v_deleted_clients;
  RAISE NOTICE 'Pólizas corregidas: %', v_updated_policies;
  RAISE NOTICE '';
  
END $$;

-- PASO 3: Restaurar índice único en national_id (sin broker_id)
DROP INDEX IF EXISTS clients_national_id_broker_id_unique_idx;

CREATE UNIQUE INDEX IF NOT EXISTS clients_national_id_unique_idx 
ON clients (national_id)
WHERE national_id IS NOT NULL;

-- Verificación final
SELECT 
  COUNT(*) AS total_duplicates,
  'ADVERTENCIA: Aún hay clientes duplicados' AS message
FROM (
  SELECT national_id
  FROM clients
  WHERE national_id IS NOT NULL
  GROUP BY national_id
  HAVING COUNT(*) > 1
) AS dups
HAVING COUNT(*) > 0
UNION ALL
SELECT 
  COUNT(*) AS mismatches,
  'ADVERTENCIA: Pólizas con broker distinto al cliente' AS message
FROM policies p
INNER JOIN clients c ON p.client_id = c.id
WHERE p.broker_id != c.broker_id
HAVING COUNT(*) > 0
UNION ALL
SELECT 
  0 AS count,
  '✓ Base de datos corregida exitosamente' AS message
WHERE NOT EXISTS (
  SELECT 1 FROM clients WHERE national_id IS NOT NULL
  GROUP BY national_id HAVING COUNT(*) > 1
)
AND NOT EXISTS (
  SELECT 1 FROM policies p
  INNER JOIN clients c ON p.client_id = c.id
  WHERE p.broker_id != c.broker_id
);
