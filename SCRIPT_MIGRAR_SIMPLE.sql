-- ================================================
-- SCRIPT SIMPLE - MIGRAR PENDING_ITEM A QUINCENA
-- ================================================
-- Item: 1324aa2d-42ed-428d-8306-c2cb608eb376
-- Broker: 2991c12f-5a84-457d-bf9c-d71e09d398af
-- Quincena: I de Noviembre (cerrada)
-- ================================================

-- ========================================
-- EJECUTAR PRIMERO: VER DATOS
-- ========================================

-- Ver el pending_item
SELECT 
  pi.id,
  pi.policy_number,
  pi.insured_name,
  pi.commission_raw,
  pi.insurer_id,
  i.name as insurer_name
FROM pending_items pi
LEFT JOIN insurers i ON pi.insurer_id = i.id
WHERE pi.id = '1324aa2d-42ed-428d-8306-c2cb608eb376';

-- Ver el broker
SELECT 
  id,
  name,
  percent_default
FROM brokers
WHERE id = '2991c12f-5a84-457d-bf9c-d71e09d398af';

-- Ver la quincena
SELECT 
  id,
  name,
  status
FROM fortnights
WHERE name ILIKE '%I%noviembre%'
  AND status = 'closed'
ORDER BY created_at DESC
LIMIT 1;

-- ========================================
-- EJECUTAR SEGUNDO: MIGRACIÓN COMPLETA
-- ========================================

DO $$
DECLARE
  v_pending_id UUID := '1324aa2d-42ed-428d-8306-c2cb608eb376';
  v_broker_id UUID := '2991c12f-5a84-457d-bf9c-d71e09d398af';
  v_fortnight_id UUID;
  v_client_id UUID;
  v_policy_id UUID;
  v_comm_item_id UUID;
  v_policy_number TEXT;
  v_insured_name TEXT;
  v_commission_raw NUMERIC;
  v_insurer_id UUID;
  v_insured_email TEXT;
  v_percent_default NUMERIC;
  v_broker_commission NUMERIC;
BEGIN
  -- Obtener datos del pending_item (solo columnas que existen)
  SELECT 
    policy_number,
    insured_name,
    commission_raw,
    insurer_id
  INTO 
    v_policy_number,
    v_insured_name,
    v_commission_raw,
    v_insurer_id
  FROM pending_items
  WHERE id = v_pending_id;

  -- Generar email temporal basado en policy_number
  v_insured_email := 'cliente-' || REPLACE(LOWER(v_policy_number), ' ', '-') || '@temp.com';

  -- Obtener fortnight_id de "I de Noviembre"
  SELECT id INTO v_fortnight_id
  FROM fortnights
  WHERE name ILIKE '%I%noviembre%'
    AND status = 'closed'
  ORDER BY created_at DESC
  LIMIT 1;

  -- Obtener percent_default del broker
  SELECT percent_default INTO v_percent_default
  FROM brokers
  WHERE id = v_broker_id;

  -- Calcular comisión del broker
  v_broker_commission := v_commission_raw * v_percent_default;

  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Datos obtenidos:';
  RAISE NOTICE 'Póliza: %', v_policy_number;
  RAISE NOTICE 'Cliente: %', v_insured_name;
  RAISE NOTICE 'Comisión bruta: %', v_commission_raw;
  RAISE NOTICE 'Porcentaje broker: %', v_percent_default;
  RAISE NOTICE 'Comisión broker: %', v_broker_commission;
  RAISE NOTICE 'Quincena ID: %', v_fortnight_id;
  RAISE NOTICE '===========================================';

  -- Crear o actualizar cliente
  INSERT INTO clients (
    name,
    email,
    broker_id,
    status
  ) VALUES (
    v_insured_name,
    v_insured_email,
    v_broker_id,
    'active'
  )
  ON CONFLICT (email) DO UPDATE
    SET name = EXCLUDED.name,
        broker_id = EXCLUDED.broker_id
  RETURNING id INTO v_client_id;

  RAISE NOTICE 'Cliente creado/actualizado: %', v_client_id;

  -- Crear o actualizar póliza
  INSERT INTO policy (
    policy_number,
    client_id,
    insurer_id,
    broker_id,
    status
  ) VALUES (
    v_policy_number,
    v_client_id,
    v_insurer_id,
    v_broker_id,
    'active'
  )
  ON CONFLICT (policy_number) DO UPDATE
    SET client_id = EXCLUDED.client_id,
        broker_id = EXCLUDED.broker_id,
        insurer_id = EXCLUDED.insurer_id
  RETURNING id INTO v_policy_id;

  RAISE NOTICE 'Póliza creada/actualizada: %', v_policy_id;

  -- Crear comisión en comm_items (tabla de quincena)
  INSERT INTO comm_items (
    policy_number,
    insured_name,
    gross_amount,
    broker_id,
    insurer_id,
    fortnight_id,
    status,
    policy_id,
    client_id
  ) VALUES (
    v_policy_number,
    v_insured_name,
    v_broker_commission,
    v_broker_id,
    v_insurer_id,
    v_fortnight_id,
    'paid',
    v_policy_id,
    v_client_id
  )
  RETURNING id INTO v_comm_item_id;

  RAISE NOTICE 'Comisión creada en quincena: %', v_comm_item_id;

  -- Marcar pending_item como migrado
  UPDATE pending_items
  SET 
    status = 'migrated',
    assigned_broker_id = v_broker_id
  WHERE id = v_pending_id;

  RAISE NOTICE 'Pending item marcado como migrado';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'MIGRACIÓN COMPLETADA EXITOSAMENTE';
  RAISE NOTICE '===========================================';
END $$;

-- ========================================
-- EJECUTAR TERCERO: VERIFICACIÓN
-- ========================================

-- Ver pending_item actualizado
SELECT 
  id,
  policy_number,
  status,
  assigned_broker_id
FROM pending_items
WHERE id = '1324aa2d-42ed-428d-8306-c2cb608eb376';

-- Ver cliente creado
SELECT 
  c.id,
  c.name,
  c.email,
  b.name as broker_name
FROM clients c
INNER JOIN brokers b ON c.broker_id = b.id
WHERE c.name = (
  SELECT insured_name 
  FROM pending_items 
  WHERE id = '1324aa2d-42ed-428d-8306-c2cb608eb376'
)
ORDER BY c.created_at DESC
LIMIT 1;

-- Ver póliza creada
SELECT 
  p.id,
  p.policy_number,
  c.name as client_name,
  b.name as broker_name,
  i.name as insurer_name
FROM policy p
INNER JOIN clients c ON p.client_id = c.id
INNER JOIN brokers b ON p.broker_id = b.id
LEFT JOIN insurers i ON p.insurer_id = i.id
WHERE p.policy_number = (
  SELECT policy_number 
  FROM pending_items 
  WHERE id = '1324aa2d-42ed-428d-8306-c2cb608eb376'
);

-- Ver comisión en quincena
SELECT 
  ci.id,
  ci.policy_number,
  ci.insured_name,
  ci.gross_amount as comision_broker,
  ci.status,
  f.name as quincena,
  b.name as broker_name,
  i.name as insurer_name
FROM comm_items ci
INNER JOIN fortnights f ON ci.fortnight_id = f.id
INNER JOIN brokers b ON ci.broker_id = b.id
LEFT JOIN insurers i ON ci.insurer_id = i.id
WHERE ci.policy_number = (
  SELECT policy_number 
  FROM pending_items 
  WHERE id = '1324aa2d-42ed-428d-8306-c2cb608eb376'
)
ORDER BY ci.created_at DESC
LIMIT 1;

-- ========================================
-- RESUMEN
-- ========================================
/*
Este script hace:

1. ✅ Crea el cliente en la tabla 'clients' con broker asignado
2. ✅ Crea la póliza en la tabla 'policy' con cliente y broker asignado
3. ✅ Crea la comisión en 'comm_items' calculada correctamente:
   - gross_amount = commission_raw × percent_default
   - Asignada a la quincena "I de Noviembre" (cerrada)
   - Status 'paid' porque la quincena ya está cerrada
4. ✅ Marca el pending_item como 'migrated' para que no vuelva a aparecer

La comisión se calcula de la misma forma que si se hubiera 
importado originalmente en la quincena.

El pending_item ya NO aparecerá en "Sin Identificar" porque
status != 'open'.
*/
