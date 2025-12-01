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
  v_generated_email TEXT;
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
  v_generated_email := 'cliente-' || REPLACE(LOWER(v_policy_number), ' ', '-') || '@temp.com';

  -- Obtener fortnight_id de "I de Noviembre"
  SELECT id INTO v_fortnight_id
  FROM fortnights
  WHERE name ILIKE '%I%noviembre%'
    AND status = 'closed'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_fortnight_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró la quincena "I de Noviembre" cerrada';
  END IF;

  -- Obtener percent_default del broker
  SELECT percent_default INTO v_percent_default
  FROM brokers
  WHERE id = v_broker_id;

  IF v_percent_default IS NULL THEN
    RAISE EXCEPTION 'No se encontró el broker o no tiene percent_default';
  END IF;

  -- Calcular comisión del broker
  v_broker_commission := v_commission_raw * v_percent_default;

  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Datos obtenidos:';
  RAISE NOTICE 'Póliza: %', v_policy_number;
  RAISE NOTICE 'Cliente: %', v_insured_name;
  RAISE NOTICE 'Email generado: %', v_generated_email;
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
    v_generated_email,
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
  insured_name,
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
-- RESUMEN COMPLETO
-- ========================================
SELECT 
  'Pending Item' as tipo,
  pi.id::text as id,
  pi.policy_number,
  pi.insured_name,
  pi.status
FROM pending_items pi
WHERE pi.id = '1324aa2d-42ed-428d-8306-c2cb608eb376'

UNION ALL

SELECT 
  'Cliente' as tipo,
  c.id::text as id,
  NULL as policy_number,
  c.name,
  c.status
FROM clients c
WHERE c.name = (
  SELECT insured_name FROM pending_items 
  WHERE id = '1324aa2d-42ed-428d-8306-c2cb608eb376'
  LIMIT 1
)
ORDER BY c.created_at DESC LIMIT 1

UNION ALL

SELECT 
  'Póliza' as tipo,
  p.id::text as id,
  p.policy_number,
  NULL as insured_name,
  p.status
FROM policy p
WHERE p.policy_number = (
  SELECT policy_number FROM pending_items 
  WHERE id = '1324aa2d-42ed-428d-8306-c2cb608eb376'
)

UNION ALL

SELECT 
  'Comisión en Quincena' as tipo,
  ci.id::text as id,
  ci.policy_number,
  ci.insured_name,
  ci.status
FROM comm_items ci
WHERE ci.policy_number = (
  SELECT policy_number FROM pending_items 
  WHERE id = '1324aa2d-42ed-428d-8306-c2cb608eb376'
  LIMIT 1
)
ORDER BY ci.created_at DESC LIMIT 1;

-- ========================================
-- NOTAS IMPORTANTES
-- ========================================
/*
Este script hace:

1. ✅ Crea el cliente en 'clients' con:
   - name: del pending_item.insured_name
   - email: generado como 'cliente-[policy_number]@temp.com'
   - broker_id asignado

2. ✅ Crea la póliza en 'policy' con:
   - policy_number del pending_item
   - client_id y broker_id asignados

3. ✅ Crea la comisión en 'comm_items' con:
   - gross_amount = commission_raw × percent_default
   - Asignada a quincena "I de Noviembre" (cerrada)
   - Status 'paid' (quincena cerrada)

4. ✅ Marca pending_item como 'migrated'

CAMPOS USADOS de pending_items:
- id
- policy_number
- insured_name
- commission_raw
- insurer_id

NO se usan (no existen en pending_items):
- insured_email (se genera)
- insured_phone (no disponible)
- insured_rfc (no disponible)
- coverage_dates (no disponible)
*/
