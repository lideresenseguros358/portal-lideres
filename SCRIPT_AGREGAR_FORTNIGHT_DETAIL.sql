-- ================================================
-- AGREGAR DETALLE FALTANTE EN FORTNIGHT_DETAILS
-- ================================================
-- Póliza: 02B3426737
-- Broker: 2991c12f-5a84-457d-bf9c-d71e09d398af
-- Quincena: 897749c8-50cf-40e2-995c-85925fe07c7c
-- ================================================

-- Verificar si ya existe
SELECT 
  id,
  policy_number,
  commission_calculated,
  commission_raw
FROM fortnight_details
WHERE policy_number = '02B3426737';

-- Si NO existe, ejecutar esto:
DO $$
DECLARE
  v_policy_number TEXT := '02B3426737';
  v_broker_id UUID := '2991c12f-5a84-457d-bf9c-d71e09d398af';
  v_fortnight_id UUID := '897749c8-50cf-40e2-995c-85925fe07c7c';
  v_import_id UUID := '1dcd1560-484c-4948-8ea0-39fd15de8a10';
  v_client_id UUID;
  v_policy_id UUID;
  v_insurer_id UUID;
  v_client_name TEXT;
  v_commission_raw NUMERIC := 10.00;
  v_percent_default NUMERIC;
  v_commission_calculated NUMERIC;
  v_fortnight_detail_id UUID;
BEGIN
  -- Obtener datos de la póliza
  SELECT 
    p.id,
    p.client_id,
    p.insurer_id,
    c.name
  INTO 
    v_policy_id,
    v_client_id,
    v_insurer_id,
    v_client_name
  FROM policies p
  INNER JOIN clients c ON p.client_id = c.id
  WHERE p.policy_number = v_policy_number;

  IF v_policy_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró la póliza %', v_policy_number;
  END IF;

  -- Obtener percent_default del broker
  SELECT percent_default INTO v_percent_default
  FROM brokers
  WHERE id = v_broker_id;

  -- Calcular comisión
  v_commission_calculated := v_commission_raw * v_percent_default;

  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Datos a insertar:';
  RAISE NOTICE 'Póliza: %', v_policy_number;
  RAISE NOTICE 'Cliente: %', v_client_name;
  RAISE NOTICE 'Comisión bruta: $%', v_commission_raw;
  RAISE NOTICE 'Porcentaje: % (%)', v_percent_default, (v_percent_default * 100);
  RAISE NOTICE 'Comisión calculada: $%', v_commission_calculated;
  RAISE NOTICE '===========================================';

  -- Crear detalle en fortnight_details
  INSERT INTO fortnight_details (
    broker_id,
    client_id,
    client_name,
    commission_calculated,
    commission_raw,
    fortnight_id,
    insurer_id,
    percent_applied,
    policy_id,
    policy_number,
    source_import_id
  ) VALUES (
    v_broker_id,
    v_client_id,
    v_client_name,
    v_commission_calculated,
    v_commission_raw,
    v_fortnight_id,
    v_insurer_id,
    v_percent_default,
    v_policy_id,
    v_policy_number,
    v_import_id
  )
  RETURNING id INTO v_fortnight_detail_id;

  RAISE NOTICE '✅ Detalle creado en fortnight_details: %', v_fortnight_detail_id;
  RAISE NOTICE '===========================================';
END $$;

-- Verificar que se creó
SELECT 
  fd.id,
  fd.policy_number,
  fd.client_name,
  fd.commission_calculated,
  fd.commission_raw,
  fd.percent_applied,
  f.period_start || ' a ' || f.period_end as quincena,
  b.name as broker_name
FROM fortnight_details fd
INNER JOIN brokers b ON fd.broker_id = b.id
INNER JOIN fortnights f ON fd.fortnight_id = f.id
WHERE fd.policy_number = '02B3426737';

-- También verificar en fortnight_details_full (vista)
SELECT 
  policy_number,
  client_name,
  commission_calculated,
  commission_raw,
  broker_name
FROM fortnight_details_full
WHERE policy_number = '02B3426737';
