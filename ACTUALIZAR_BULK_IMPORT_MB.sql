-- =====================================================
-- ACTUALIZACIÓN: BÚSQUEDA FLEXIBLE DE ASEGURADORAS
-- Permite que "MB SEGUROS" encuentre "MB" en la BD
-- =====================================================

-- Eliminar función existente
DROP FUNCTION IF EXISTS bulk_import_clients_policies(JSONB);

-- Recrear función con búsqueda flexible
CREATE OR REPLACE FUNCTION bulk_import_clients_policies(
  import_data JSONB
)
RETURNS TABLE(
  success BOOLEAN,
  row_number INTEGER,
  client_name TEXT,
  policy_number TEXT,
  message TEXT,
  client_id UUID,
  policy_id UUID
) 
SECURITY DEFINER  -- BYPASS RLS
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  row_data JSONB;
  row_idx INTEGER := 0;
  v_broker_id UUID;
  v_insurer_id UUID;
  v_client_id UUID;
  v_policy_id UUID;
  v_existing_client_id UUID;
  v_client_name TEXT;
  v_policy_number TEXT;
  v_broker_email TEXT;
  v_insurer_name TEXT;
  v_ramo TEXT;
  v_start_date DATE;
  v_renewal_date DATE;
  v_national_id TEXT;
  v_email TEXT;
  v_phone TEXT;
BEGIN
  -- Iterar sobre cada fila del JSON
  FOR row_data IN SELECT * FROM jsonb_array_elements(import_data)
  LOOP
    row_idx := row_idx + 1;
    
    BEGIN
      -- Extraer datos del JSON
      v_client_name := UPPER(TRIM(row_data->>'client_name'));
      v_policy_number := UPPER(TRIM(row_data->>'policy_number'));
      v_broker_email := LOWER(TRIM(row_data->>'broker_email'));
      v_insurer_name := UPPER(TRIM(row_data->>'insurer_name'));
      v_ramo := UPPER(TRIM(row_data->>'ramo'));
      v_start_date := (row_data->>'start_date')::DATE;
      v_renewal_date := (row_data->>'renewal_date')::DATE;
      v_national_id := NULLIF(UPPER(TRIM(row_data->>'national_id')), '');
      v_email := NULLIF(LOWER(TRIM(row_data->>'email')), '');
      v_phone := NULLIF(TRIM(row_data->>'phone'), '');
      
      -- Validar campos obligatorios
      IF v_client_name IS NULL OR v_client_name = '' THEN
        RETURN QUERY SELECT false, row_idx, v_client_name, v_policy_number, 'ERROR: Nombre del cliente requerido', NULL::UUID, NULL::UUID;
        CONTINUE;
      END IF;
      
      IF v_policy_number IS NULL OR v_policy_number = '' THEN
        RETURN QUERY SELECT false, row_idx, v_client_name, v_policy_number, 'ERROR: Número de póliza requerido', NULL::UUID, NULL::UUID;
        CONTINUE;
      END IF;
      
      IF v_broker_email IS NULL OR v_broker_email = '' THEN
        RETURN QUERY SELECT false, row_idx, v_client_name, v_policy_number, 'ERROR: Email del broker requerido', NULL::UUID, NULL::UUID;
        CONTINUE;
      END IF;
      
      IF v_insurer_name IS NULL OR v_insurer_name = '' THEN
        RETURN QUERY SELECT false, row_idx, v_client_name, v_policy_number, 'ERROR: Nombre de aseguradora requerido', NULL::UUID, NULL::UUID;
        CONTINUE;
      END IF;
      
      IF v_start_date IS NULL THEN
        RETURN QUERY SELECT false, row_idx, v_client_name, v_policy_number, 'ERROR: Fecha de inicio requerida', NULL::UUID, NULL::UUID;
        CONTINUE;
      END IF;
      
      IF v_renewal_date IS NULL THEN
        RETURN QUERY SELECT false, row_idx, v_client_name, v_policy_number, 'ERROR: Fecha de renovación requerida', NULL::UUID, NULL::UUID;
        CONTINUE;
      END IF;
      
      -- 1. Obtener broker_id desde el email
      SELECT b.id INTO v_broker_id
      FROM brokers b
      INNER JOIN profiles p ON b.p_id = p.id
      WHERE LOWER(p.email) = v_broker_email
      LIMIT 1;
      
      IF v_broker_id IS NULL THEN
        RETURN QUERY SELECT false, row_idx, v_client_name, v_policy_number, 
          'ERROR: Broker no encontrado con email: ' || v_broker_email, NULL::UUID, NULL::UUID;
        CONTINUE;
      END IF;
      
      -- 2. Obtener insurer_id desde el nombre
      -- ✅ BÚSQUEDA MEJORADA: Primero exacta, luego parcial
      SELECT id INTO v_insurer_id
      FROM insurers
      WHERE UPPER(name) = v_insurer_name
      LIMIT 1;
      
      -- Si no encuentra exacto, buscar coincidencia parcial
      IF v_insurer_id IS NULL THEN
        SELECT id INTO v_insurer_id
        FROM insurers
        WHERE UPPER(name) LIKE '%' || v_insurer_name || '%'
           OR v_insurer_name LIKE '%' || UPPER(name) || '%'
        LIMIT 1;
      END IF;
      
      IF v_insurer_id IS NULL THEN
        RETURN QUERY SELECT false, row_idx, v_client_name, v_policy_number, 
          'ERROR: Aseguradora no encontrada: ' || v_insurer_name, NULL::UUID, NULL::UUID;
        CONTINUE;
      END IF;
      
      -- 3. Verificar si la póliza ya existe
      IF EXISTS (SELECT 1 FROM policies pol WHERE pol.policy_number = v_policy_number) THEN
        RETURN QUERY SELECT false, row_idx, v_client_name, v_policy_number, 
          'ERROR: Póliza ya existe: ' || v_policy_number, NULL::UUID, NULL::UUID;
        CONTINUE;
      END IF;
      
      -- 4. Buscar cliente existente (por cédula o nombre)
      SELECT id INTO v_existing_client_id
      FROM clients
      WHERE (v_national_id IS NOT NULL AND national_id = v_national_id)
         OR (UPPER(name) = v_client_name)
      LIMIT 1;
      
      -- 5. Si el cliente existe, usar ese ID y actualizar datos opcionales
      IF v_existing_client_id IS NOT NULL THEN
        v_client_id := v_existing_client_id;
        
        -- Actualizar datos del cliente si vienen en el import
        UPDATE clients
        SET 
          national_id = COALESCE(clients.national_id, v_national_id),
          email = COALESCE(clients.email, v_email),
          phone = COALESCE(clients.phone, v_phone),
          broker_id = COALESCE(clients.broker_id, v_broker_id)
        WHERE id = v_existing_client_id;
      ELSE
        -- 6. Crear nuevo cliente
        INSERT INTO clients (
          name,
          national_id,
          email,
          phone,
          broker_id,
          active,
          created_at
        ) VALUES (
          v_client_name,
          v_national_id,
          v_email,
          v_phone,
          v_broker_id,
          true,
          now()
        )
        RETURNING id INTO v_client_id;
      END IF;
      
      -- 7. Crear póliza
      INSERT INTO policies (
        client_id,
        broker_id,
        policy_number,
        insurer_id,
        ramo,
        start_date,
        renewal_date,
        status,
        created_at
      ) VALUES (
        v_client_id,
        v_broker_id,
        v_policy_number,
        v_insurer_id,
        v_ramo,
        v_start_date,
        v_renewal_date,
        'ACTIVA',
        now()
      )
      RETURNING id INTO v_policy_id;
      
      -- Retornar éxito
      RETURN QUERY SELECT true, row_idx, v_client_name, v_policy_number, 
        'SUCCESS: Cliente y póliza creados', v_client_id, v_policy_id;
      
    EXCEPTION WHEN OTHERS THEN
      -- Capturar cualquier error y continuar con la siguiente fila
      RETURN QUERY SELECT false, row_idx, v_client_name, v_policy_number, 
        'ERROR: ' || SQLERRM, NULL::UUID, NULL::UUID;
    END;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION bulk_import_clients_policies IS 
'Función SECURITY DEFINER para importación masiva de clientes y pólizas. 
Bypass RLS. Solo ejecutar como Master.
ACTUALIZADO: Búsqueda flexible de aseguradoras (permite "MB SEGUROS" → "MB")';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Ver cómo está registrada MB en la BD
SELECT id, name, active 
FROM insurers 
WHERE UPPER(name) LIKE '%MB%'
ORDER BY name;

-- Verificar que la función se actualizó correctamente
SELECT 
  proname as function_name,
  prosecdef as is_security_definer,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'bulk_import_clients_policies';
