-- ================================================
-- SCRIPT FINAL - MIGRAR PENDING_ITEM A QUINCENA
-- ================================================
-- Item: 1324aa2d-42ed-428d-8306-c2cb608eb376
-- Broker: 2991c12f-5a84-457d-bf9c-d71e09d398af
-- Quincena: I de Noviembre (cerrada)
-- ================================================

-- ========================================
-- PASO 1: VER DATOS (EJECUTAR PRIMERO)
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

-- Ver el comm_import
SELECT 
  id,
  period_label,
  created_at
FROM comm_imports
WHERE id = '1dcd1560-484c-4948-8ea0-39fd15de8a10';


-- ========================================
-- PASO 2: EJECUTAR MIGRACIÓN
-- ========================================

DO $$
DECLARE
  v_pending_id UUID := '1324aa2d-42ed-428d-8306-c2cb608eb376';
  v_broker_id UUID := '2991c12f-5a84-457d-bf9c-d71e09d398af';
  v_import_id UUID := '1dcd1560-484c-4948-8ea0-39fd15de8a10';  -- comm_import
  v_fortnight_id UUID := '897749c8-50cf-40e2-995c-85925fe07c7c';  -- I de Noviembre
  v_client_id UUID;
  v_policy_id UUID;
  v_comm_item_id UUID;
  v_fortnight_detail_id UUID;
  v_policy_number TEXT;
  v_insured_name TEXT;
  v_commission_raw NUMERIC;
  v_insurer_id UUID;
  v_generated_email TEXT;
  v_percent_default NUMERIC;
  v_broker_commission NUMERIC;
BEGIN
  -- Obtener datos del pending_item
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

  -- Verificar que el pending_item existe
  IF v_policy_number IS NULL THEN
    RAISE NOTICE '===========================================';
    RAISE NOTICE '⚠️  PENDING ITEM YA FUE MIGRADO';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'ID: %', v_pending_id;
    RAISE NOTICE 'Este pending_item ya no existe en la base de datos.';
    RAISE NOTICE 'Probablemente ya fue migrado anteriormente.';
    RAISE NOTICE '';
    RAISE NOTICE 'Verifica los datos con las queries de verificación.';
    RAISE NOTICE '===========================================';
    RETURN;
  END IF;

  -- Generar email temporal
  v_generated_email := 'cliente-' || REPLACE(LOWER(v_policy_number), ' ', '-') || '@temp.com';

  -- Obtener percent_default del broker
  SELECT percent_default INTO v_percent_default
  FROM brokers
  WHERE id = v_broker_id;

  IF v_percent_default IS NULL THEN
    RAISE EXCEPTION 'No se encontró el broker o no tiene percent_default';
  END IF;

  -- Calcular comisión
  v_broker_commission := v_commission_raw * v_percent_default;

  RAISE NOTICE '=============================================';
  RAISE NOTICE 'INICIANDO MIGRACIÓN';
  RAISE NOTICE '=============================================';
  RAISE NOTICE 'Póliza: %', v_policy_number;
  RAISE NOTICE 'Cliente: %', v_insured_name;
  RAISE NOTICE 'Email generado: %', v_generated_email;
  RAISE NOTICE 'Comisión bruta: $%', v_commission_raw;
  RAISE NOTICE 'Porcentaje broker: % (%)', v_percent_default, (v_percent_default * 100);
  RAISE NOTICE 'Comisión broker: $%', v_broker_commission;
  RAISE NOTICE 'Import ID: %', v_import_id;
  RAISE NOTICE '--------------------------------------------';
  RAISE NOTICE 'Creando registros...';
  RAISE NOTICE '=============================================';

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
        broker_id = EXCLUDED.broker_id,
        insurer_id = EXCLUDED.insurer_id
  RETURNING id INTO v_policy_id;

  RAISE NOTICE '✅ Póliza creada: %', v_policy_id;

  -- 3. Crear comisión
  INSERT INTO comm_items (
    policy_number,
    insured_name,
    gross_amount,
    broker_id,
    insurer_id,
    import_id
  ) VALUES (
    v_policy_number,
    v_insured_name,
    v_broker_commission,
    v_broker_id,
    v_insurer_id,
    v_import_id
  )
  RETURNING id INTO v_comm_item_id;

  RAISE NOTICE '✅ Comisión creada en comm_items: %', v_comm_item_id;
  RAISE NOTICE '   Monto: $%', v_broker_commission;

  -- 4. Crear detalle en fortnight_details
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
    v_insured_name,
    v_broker_commission,
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

  -- 5. Actualizar o crear total en fortnight_broker_totals
  INSERT INTO fortnight_broker_totals (
    broker_id,
    fortnight_id,
    gross_amount,
    net_amount,
    discounts_json
  ) VALUES (
    v_broker_id,
    v_fortnight_id,
    v_broker_commission,
    v_broker_commission,
    '[]'::jsonb
  )
  ON CONFLICT (broker_id, fortnight_id) DO UPDATE
    SET gross_amount = fortnight_broker_totals.gross_amount + EXCLUDED.gross_amount,
        net_amount = fortnight_broker_totals.net_amount + EXCLUDED.net_amount;

  RAISE NOTICE '✅ Total actualizado en fortnight_broker_totals';

  -- 6. Eliminar pending_item (ya fue migrado)
  DELETE FROM pending_items
  WHERE id = v_pending_id;

  RAISE NOTICE '✅ Pending item eliminado (migrado)';
  RAISE NOTICE '=============================================';
  RAISE NOTICE '✅✅✅ MIGRACIÓN COMPLETADA EXITOSAMENTE ✅✅✅';
  RAISE NOTICE '=============================================';
END $$;


-- ========================================
-- PASO 3: VERIFICACIÓN
-- ========================================

-- Ver cliente creado
SELECT 
  'CLIENTE' as tabla,
  c.id::text,
  c.name,
  c.email,
  c.active,
  b.name as broker_name
FROM clients c
INNER JOIN brokers b ON c.broker_id = b.id
WHERE c.email LIKE '%02b3426737%'
ORDER BY c.created_at DESC
LIMIT 1;

-- Ver póliza creada
SELECT 
  'POLIZA' as tabla,
  p.id::text,
  p.policy_number,
  p.status,
  c.name as client_name,
  b.name as broker_name,
  i.name as insurer_name
FROM policies p
INNER JOIN clients c ON p.client_id = c.id
INNER JOIN brokers b ON p.broker_id = b.id
LEFT JOIN insurers i ON p.insurer_id = i.id
WHERE p.policy_number = '02B3426737';

-- Ver comisión en comm_items
SELECT 
  'COMM_ITEMS' as tabla,
  ci.id::text,
  ci.policy_number,
  ci.insured_name,
  ci.gross_amount as comision_broker,
  ci.import_id::text,
  b.name as broker_name
FROM comm_items ci
INNER JOIN brokers b ON ci.broker_id = b.id
WHERE ci.policy_number = '02B3426737'
ORDER BY ci.created_at DESC
LIMIT 1;

-- Ver detalle en fortnight_details
SELECT 
  'FORTNIGHT_DETAILS' as tabla,
  fd.id::text,
  fd.policy_number,
  fd.client_name,
  fd.commission_calculated as comision_broker,
  fd.commission_raw as comision_bruta,
  fd.percent_applied,
  f.period_start || ' a ' || f.period_end as quincena,
  b.name as broker_name
FROM fortnight_details fd
INNER JOIN brokers b ON fd.broker_id = b.id
INNER JOIN fortnights f ON fd.fortnight_id = f.id
WHERE fd.policy_number = '02B3426737'
ORDER BY fd.created_at DESC
LIMIT 1;

-- Ver total en fortnight_broker_totals
SELECT 
  'FORTNIGHT_BROKER_TOTALS' as tabla,
  fbt.id::text,
  fbt.gross_amount,
  fbt.net_amount,
  f.period_start || ' a ' || f.period_end as quincena,
  b.name as broker_name
FROM fortnight_broker_totals fbt
INNER JOIN brokers b ON fbt.broker_id = b.id
INNER JOIN fortnights f ON fbt.fortnight_id = f.id
WHERE fbt.broker_id = '2991c12f-5a84-457d-bf9c-d71e09d398af'
  AND fbt.fortnight_id = '897749c8-50cf-40e2-995c-85925fe07c7c';


-- ========================================
-- RESUMEN
-- ========================================
/*
✅ MIGRACIÓN COMPLETADA

Este script:
1. Crea cliente en 'clients' con broker asignado
2. Crea póliza en 'policies' vinculada al cliente y broker
3. Calcula comisión: commission_raw × percent_default
4. Crea registro en 'comm_items' asociado al import_id correcto
5. Crea detalle en 'fortnight_details' para la quincena I de Noviembre
6. Actualiza total en 'fortnight_broker_totals' (suma al acumulado del broker)
7. ELIMINA el pending_item (ya fue migrado completamente)

El pending_item fue eliminado y toda la data está registrada en:
- clients
- policies
- comm_items
- fortnight_details (aparecerá en fortnight_details_full automáticamente)
- fortnight_broker_totals

La comisión ahora aparecerá correctamente en los detalles de la quincena.
*/
