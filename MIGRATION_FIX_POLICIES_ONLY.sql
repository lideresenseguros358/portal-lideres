-- =====================================================
-- CORREGIR SOLO POLICIES SEGÚN CLIENTS
-- =====================================================
-- clients.broker_id es CORRECTO (ya reasignado)
-- policies.broker_id es INCORRECTO (broker viejo)
-- SOLUCIÓN: Actualizar policies.broker_id = clients.broker_id
-- =====================================================

DO $$
DECLARE
  v_updated_policies INT := 0;
BEGIN
  RAISE NOTICE '=== CORRIGIENDO POLICIES SEGÚN CLIENTS ===';
  
  -- Actualizar TODAS las pólizas para que tengan el mismo broker_id que su cliente
  UPDATE policies p
  SET broker_id = c.broker_id
  FROM clients c
  WHERE p.client_id = c.id
    AND (p.broker_id IS NULL OR p.broker_id != c.broker_id);
  
  GET DIAGNOSTICS v_updated_policies = ROW_COUNT;
  
  RAISE NOTICE '';
  RAISE NOTICE '=== CORRECCIÓN COMPLETADA ===';
  RAISE NOTICE 'Pólizas actualizadas: %', v_updated_policies;
  RAISE NOTICE '';
  
END $$;

-- Verificación final
SELECT 
  COUNT(*) AS mismatches,
  'ADVERTENCIA: Aún hay pólizas con broker distinto al cliente' AS message
FROM policies p
INNER JOIN clients c ON p.client_id = c.id
WHERE p.broker_id != c.broker_id
HAVING COUNT(*) > 0
UNION ALL
SELECT 
  0 AS count,
  '✓ Todas las pólizas tienen el broker correcto' AS message
WHERE NOT EXISTS (
  SELECT 1 FROM policies p
  INNER JOIN clients c ON p.client_id = c.id
  WHERE p.broker_id != c.broker_id
);
