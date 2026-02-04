-- =====================================================
-- CORRECCIÓN DE PÓLIZAS CON BROKER_ID DISTINTO AL CLIENTE
-- =====================================================
-- Este script corrige las pólizas que tienen un broker_id
-- diferente al broker_id del cliente al que pertenecen.
-- La lógica es: duplicar el cliente para cada broker distinto
-- y reasignar las pólizas al cliente duplicado correspondiente.
-- =====================================================

DO $$
DECLARE
  r RECORD;
  v_new_client_id UUID;
  v_affected_policies INT := 0;
  v_duplicated_clients INT := 0;
BEGIN
  RAISE NOTICE '=== INICIANDO CORRECCIÓN DE BROKER_ID EN PÓLIZAS ===';
  
  -- Buscar todas las pólizas con broker_id distinto al del cliente
  FOR r IN 
    SELECT 
      p.id AS policy_id,
      p.policy_number,
      p.broker_id AS policy_broker_id,
      p.client_id AS old_client_id,
      c.broker_id AS client_broker_id,
      c.name AS client_name,
      c.national_id,
      c.email,
      c.phone,
      c.birth_date,
      c.active,
      c.created_at,
      pb.name AS policy_broker_name,
      cb.name AS client_broker_name
    FROM policies p
    INNER JOIN clients c ON p.client_id = c.id
    LEFT JOIN brokers pb ON p.broker_id = pb.id
    LEFT JOIN brokers cb ON c.broker_id = cb.id
    WHERE p.broker_id IS NOT NULL 
      AND c.broker_id IS NOT NULL
      AND p.broker_id != c.broker_id
    ORDER BY c.national_id, p.created_at
  LOOP
    RAISE NOTICE '';
    RAISE NOTICE '--- Póliza: % (ID: %)', r.policy_number, r.policy_id;
    RAISE NOTICE '    Cliente: % (Cédula: %)', r.client_name, r.national_id;
    RAISE NOTICE '    Broker de Cliente: % (ID: %)', r.client_broker_name, r.client_broker_id;
    RAISE NOTICE '    Broker de Póliza: % (ID: %)', r.policy_broker_name, r.policy_broker_id;
    RAISE NOTICE '    ACCIÓN: Duplicando cliente y reasignando póliza...';
    
    -- Verificar si ya existe un duplicado de este cliente con el broker de la póliza
    SELECT id INTO v_new_client_id
    FROM clients
    WHERE national_id = r.national_id
      AND broker_id = r.policy_broker_id
      AND id != r.old_client_id
    LIMIT 1;
    
    IF v_new_client_id IS NOT NULL THEN
      -- Ya existe un duplicado, solo reasignar la póliza
      RAISE NOTICE '    ✓ Cliente duplicado ya existe (ID: %), reasignando póliza...', v_new_client_id;
      
      UPDATE policies
      SET client_id = v_new_client_id
      WHERE id = r.policy_id;
      
      v_affected_policies := v_affected_policies + 1;
      
    ELSE
      -- No existe duplicado, crear uno nuevo
      RAISE NOTICE '    ✓ Creando nuevo cliente duplicado...';
      
      INSERT INTO clients (
        broker_id,
        name,
        national_id,
        email,
        phone,
        birth_date,
        active,
        created_at
      )
      VALUES (
        r.policy_broker_id,  -- Broker de la póliza
        r.client_name,
        r.national_id,
        r.email,
        r.phone,
        r.birth_date,
        r.active,
        r.created_at
      )
      RETURNING id INTO v_new_client_id;
      
      RAISE NOTICE '    ✓ Cliente duplicado creado (ID: %)', v_new_client_id;
      
      -- Reasignar la póliza al nuevo cliente
      UPDATE policies
      SET client_id = v_new_client_id
      WHERE id = r.policy_id;
      
      v_affected_policies := v_affected_policies + 1;
      v_duplicated_clients := v_duplicated_clients + 1;
      
      RAISE NOTICE '    ✓ Póliza reasignada al cliente duplicado';
    END IF;
    
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '=== CORRECCIÓN COMPLETADA ===';
  RAISE NOTICE 'Clientes duplicados creados: %', v_duplicated_clients;
  RAISE NOTICE 'Pólizas reasignadas: %', v_affected_policies;
  RAISE NOTICE '';
  
  IF v_affected_policies = 0 THEN
    RAISE NOTICE '✓ No se encontraron pólizas con broker_id distinto al cliente';
  END IF;
  
END $$;

-- Verificar resultados
SELECT 
  COUNT(*) AS total_mismatches,
  'ADVERTENCIA: Aún existen pólizas con broker_id distinto al cliente' AS message
FROM policies p
INNER JOIN clients c ON p.client_id = c.id
WHERE p.broker_id IS NOT NULL 
  AND c.broker_id IS NOT NULL
  AND p.broker_id != c.broker_id
HAVING COUNT(*) > 0
UNION ALL
SELECT 
  0 AS total_mismatches,
  '✓ Todas las pólizas tienen broker_id consistente con su cliente' AS message
WHERE NOT EXISTS (
  SELECT 1
  FROM policies p
  INNER JOIN clients c ON p.client_id = c.id
  WHERE p.broker_id IS NOT NULL 
    AND c.broker_id IS NOT NULL
    AND p.broker_id != c.broker_id
);
