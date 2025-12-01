-- ================================================
-- SCRIPT SIMPLE - CREAR SOLO CLIENTE Y PÓLIZA
-- ================================================
-- Pending item: 1324aa2d-42ed-428d-8306-c2cb608eb376
-- Broker: 2991c12f-5a84-457d-bf9c-d71e09d398af
-- ================================================

DO $$
DECLARE
  v_pending_id UUID := '1324aa2d-42ed-428d-8306-c2cb608eb376';
  v_broker_id UUID := '2991c12f-5a84-457d-bf9c-d71e09d398af';
  v_client_id UUID;
  v_policy_id UUID;
  v_policy_number TEXT;
  v_insured_name TEXT;
  v_insurer_id UUID;
  v_generated_email TEXT;
BEGIN
  -- Obtener datos del pending_item
  SELECT 
    policy_number,
    insured_name,
    insurer_id
  INTO 
    v_policy_number,
    v_insured_name,
    v_insurer_id
  FROM pending_items
  WHERE id = v_pending_id;

  -- Generar email
  v_generated_email := 'cliente-' || REPLACE(LOWER(v_policy_number), ' ', '-') || '@temp.com';

  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Póliza: %', v_policy_number;
  RAISE NOTICE 'Cliente: %', v_insured_name;
  RAISE NOTICE 'Email: %', v_generated_email;
  RAISE NOTICE '===========================================';

  -- 1. Crear cliente
  INSERT INTO clients (
    name,
    email,
    broker_id,
    active
  ) VALUES (
    v_insured_name,
    v_generated_email,
    v_broker_id,
    true
  )
  RETURNING id INTO v_client_id;

  RAISE NOTICE '✅ Cliente creado: %', v_client_id;

  -- 2. Crear póliza
  INSERT INTO policies (
    policy_number,
    client_id,
    insurer_id,
    broker_id
  ) VALUES (
    v_policy_number,
    v_client_id,
    v_insurer_id,
    v_broker_id
  )
  ON CONFLICT (policy_number) DO UPDATE
    SET client_id = EXCLUDED.client_id,
        broker_id = EXCLUDED.broker_id
  RETURNING id INTO v_policy_id;

  RAISE NOTICE '✅ Póliza creada: %', v_policy_id;

  -- 3. Asignar pending_item al broker
  UPDATE pending_items
  SET assigned_broker_id = v_broker_id
  WHERE id = v_pending_id;

  RAISE NOTICE '✅ Pending item asignado al broker';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '✅ COMPLETADO';
  RAISE NOTICE 'Ahora el broker puede crear un reporte de ajuste';
  RAISE NOTICE '===========================================';
END $$;

-- Verificar
SELECT 
  'CLIENTE' as tipo,
  c.id::text,
  c.name,
  c.email,
  b.name as broker
FROM clients c
INNER JOIN brokers b ON c.broker_id = b.id
WHERE c.email LIKE '%' || (SELECT policy_number FROM pending_items WHERE id = '1324aa2d-42ed-428d-8306-c2cb608eb376') || '%'
ORDER BY c.created_at DESC LIMIT 1;

SELECT 
  'POLIZA' as tipo,
  p.id::text,
  p.policy_number,
  c.name as cliente
FROM policies p
INNER JOIN clients c ON p.client_id = c.id
WHERE p.policy_number = (SELECT policy_number FROM pending_items WHERE id = '1324aa2d-42ed-428d-8306-c2cb608eb376');

SELECT 
  'PENDING_ITEM' as tipo,
  id::text,
  policy_number,
  assigned_broker_id::text,
  status
FROM pending_items
WHERE id = '1324aa2d-42ed-428d-8306-c2cb608eb376';
