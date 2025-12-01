-- ================================================
-- COMPLETAR MIGRACIÓN A QUINCENA
-- ================================================
-- Usar datos que ya existen en clients y policies
-- para completar el registro en fortnight_details y actualizar totales
-- ================================================

DO $$
DECLARE
  -- IDs conocidos
  v_policy_number TEXT := '02B3426737';
  v_broker_id UUID := '2991c12f-5a84-457d-bf9c-d71e09d398af';
  v_fortnight_id UUID := '897749c8-50cf-40e2-995c-85925fe07c7c';
  v_import_id UUID := '1dcd1560-484c-4948-8ea0-39fd15de8a10';
  v_commission_raw NUMERIC := 10.00;  -- Del pending_item original
  
  -- Variables a obtener
  v_policy_id UUID;
  v_client_id UUID;
  v_insurer_id UUID;
  v_client_name TEXT;
  v_percent_default NUMERIC;
  v_commission_calculated NUMERIC;
  v_fortnight_detail_id UUID;
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'COMPLETANDO MIGRACIÓN A QUINCENA';
  RAISE NOTICE '===========================================';

  -- 1. Obtener datos desde policies y clients (que ya existen)
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
    RAISE EXCEPTION 'No se encontró la póliza %. Verifica que la primera migración se completó.', v_policy_number;
  END IF;

  RAISE NOTICE '✅ Póliza encontrada: %', v_policy_id;
  RAISE NOTICE '   Cliente: %', v_client_name;

  -- 2. Obtener percent_default del broker
  SELECT percent_default INTO v_percent_default
  FROM brokers
  WHERE id = v_broker_id;

  -- 3. Calcular comisión
  v_commission_calculated := v_commission_raw * v_percent_default;

  RAISE NOTICE '   Comisión bruta: $%', v_commission_raw;
  RAISE NOTICE '   Porcentaje broker: % (%)', v_percent_default, (v_percent_default * 100);
  RAISE NOTICE '   Comisión calculada: $%', v_commission_calculated;
  RAISE NOTICE '-------------------------------------------';

  -- 4. Verificar si ya existe en fortnight_details
  IF EXISTS (SELECT 1 FROM fortnight_details WHERE policy_number = v_policy_number) THEN
    RAISE NOTICE '⚠️  El detalle ya existe en fortnight_details';
    RAISE NOTICE '   No se insertará duplicado.';
  ELSE
    -- Insertar en fortnight_details
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
  END IF;

  -- 5. Actualizar o crear total en fortnight_broker_totals
  RAISE NOTICE '-------------------------------------------';
  IF EXISTS (
    SELECT 1 FROM fortnight_broker_totals 
    WHERE broker_id = v_broker_id AND fortnight_id = v_fortnight_id
  ) THEN
    -- Actualizar el total existente
    UPDATE fortnight_broker_totals
    SET 
      gross_amount = gross_amount + v_commission_calculated,
      net_amount = net_amount + v_commission_calculated
    WHERE broker_id = v_broker_id 
      AND fortnight_id = v_fortnight_id;
    
    RAISE NOTICE '✅ Total actualizado en fortnight_broker_totals';
    RAISE NOTICE '   Sumado: $%', v_commission_calculated;
  ELSE
    -- Crear nuevo registro
    INSERT INTO fortnight_broker_totals (
      broker_id,
      fortnight_id,
      gross_amount,
      net_amount,
      discounts_json
    ) VALUES (
      v_broker_id,
      v_fortnight_id,
      v_commission_calculated,
      v_commission_calculated,
      '[]'::jsonb
    );
    
    RAISE NOTICE '✅ Total creado en fortnight_broker_totals';
  END IF;

  -- 6. Verificar si existe en comm_items
  RAISE NOTICE '-------------------------------------------';
  IF EXISTS (SELECT 1 FROM comm_items WHERE policy_number = v_policy_number) THEN
    RAISE NOTICE '✅ Comisión ya existe en comm_items';
  ELSE
    -- Crear en comm_items también
    INSERT INTO comm_items (
      policy_number,
      insured_name,
      gross_amount,
      broker_id,
      insurer_id,
      import_id
    ) VALUES (
      v_policy_number,
      v_client_name,
      v_commission_calculated,
      v_broker_id,
      v_insurer_id,
      v_import_id
    );
    
    RAISE NOTICE '✅ Comisión creada en comm_items';
  END IF;

  RAISE NOTICE '===========================================';
  RAISE NOTICE '✅✅✅ MIGRACIÓN COMPLETADA ✅✅✅';
  RAISE NOTICE '===========================================';
END $$;

-- ========================================
-- VERIFICACIÓN COMPLETA
-- ========================================

-- Cliente
SELECT 
  'CLIENTE' as tabla,
  c.id::text,
  c.name,
  c.email,
  b.name as broker_name
FROM clients c
INNER JOIN brokers b ON c.broker_id = b.id
WHERE c.email LIKE '%02b3426737%'
ORDER BY c.created_at DESC
LIMIT 1;

-- Póliza
SELECT 
  'POLIZA' as tabla,
  p.id::text,
  p.policy_number,
  c.name as client_name,
  b.name as broker_name
FROM policies p
INNER JOIN clients c ON p.client_id = c.id
INNER JOIN brokers b ON p.broker_id = b.id
WHERE p.policy_number = '02B3426737';

-- Comisión en comm_items
SELECT 
  'COMM_ITEMS' as tabla,
  ci.id::text,
  ci.policy_number,
  ci.insured_name,
  ci.gross_amount as comision_broker,
  b.name as broker_name
FROM comm_items ci
INNER JOIN brokers b ON ci.broker_id = b.id
WHERE ci.policy_number = '02B3426737'
ORDER BY ci.created_at DESC
LIMIT 1;

-- Detalle en fortnight_details
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

-- Vista fortnight_details_full
SELECT 
  'FORTNIGHT_DETAILS_FULL' as tabla,
  policy_number,
  client_name,
  commission_calculated,
  commission_raw,
  broker_name
FROM fortnight_details_full
WHERE policy_number = '02B3426737';

-- Total del broker en la quincena
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
Este script:
1. Obtiene los datos desde policies y clients (que ya existen)
2. Completa el registro en fortnight_details
3. Actualiza el total en fortnight_broker_totals
4. Crea en comm_items si no existe

Usa los datos que quedaron guardados de la primera migración parcial
para completar correctamente la migración a las tablas de quincena.

Comisión bruta: $10.00
Porcentaje broker: 82%
Comisión calculada: $8.20
*/
