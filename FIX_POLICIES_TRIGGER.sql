-- =====================================================
-- FIX: Remover updated_at de triggers de policies
-- =====================================================
-- PROBLEMA: La tabla policies NO tiene columna updated_at
-- El trigger intenta actualizar updated_at causando error 42703
-- =====================================================

-- Función corregida: Sin updated_at en policies
CREATE OR REPLACE FUNCTION update_clients_policies_from_commissions()
RETURNS TRIGGER AS $$
DECLARE
  v_policy_id UUID;
  v_client_id UUID;
  v_broker_id UUID;
  v_policy_number TEXT;
BEGIN
  -- Solo procesar si el comm_item tiene broker_id
  IF NEW.broker_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_broker_id := NEW.broker_id;
  v_policy_number := NEW.policy_number;

  -- Buscar la póliza por policy_number
  SELECT id, client_id INTO v_policy_id, v_client_id
  FROM policies
  WHERE policy_number = v_policy_number
  LIMIT 1;

  -- Si encontramos la póliza
  IF v_policy_id IS NOT NULL THEN
    
    -- 1. Actualizar broker_id en policies (SIN updated_at)
    UPDATE policies
    SET broker_id = v_broker_id
    WHERE id = v_policy_id
      AND (broker_id IS NULL OR broker_id != v_broker_id);

    -- 2. Actualizar broker_id en clients (CON updated_at porque clients SÍ tiene esa columna)
    IF v_client_id IS NOT NULL THEN
      UPDATE clients
      SET broker_id = v_broker_id,
          updated_at = NOW()
      WHERE id = v_client_id
        AND (broker_id IS NULL OR broker_id != v_broker_id);
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Función batch corregida también
-- =====================================================

CREATE OR REPLACE FUNCTION batch_update_clients_policies_from_commissions()
RETURNS TABLE(
  updated_policies INT,
  updated_clients INT,
  errors TEXT[]
) AS $$
DECLARE
  v_updated_policies INT := 0;
  v_updated_clients INT := 0;
  v_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Actualizar pólizas sin broker asignado (SIN updated_at)
  WITH updates AS (
    UPDATE policies p
    SET broker_id = ci.broker_id
    FROM (
      SELECT DISTINCT ON (policy_number) 
        policy_number, 
        broker_id
      FROM comm_items
      WHERE broker_id IS NOT NULL
      ORDER BY policy_number, created_at DESC
    ) ci
    WHERE p.policy_number = ci.policy_number
      AND (p.broker_id IS NULL OR p.broker_id != ci.broker_id)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_updated_policies FROM updates;

  -- Actualizar clientes sin broker asignado (CON updated_at)
  WITH updates AS (
    UPDATE clients c
    SET broker_id = p.broker_id,
        updated_at = NOW()
    FROM policies p
    WHERE c.id = p.client_id
      AND p.broker_id IS NOT NULL
      AND (c.broker_id IS NULL OR c.broker_id != p.broker_id)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_updated_clients FROM updates;

  RETURN QUERY SELECT v_updated_policies, v_updated_clients, v_errors;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Ver estructura de policies (debe tener created_at pero NO updated_at)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'policies'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Ver estructura de clients (debe tener updated_at)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'clients'
  AND table_schema = 'public'
  AND column_name IN ('created_at', 'updated_at')
ORDER BY ordinal_position;

-- =====================================================
-- RESUMEN
-- =====================================================

/*
✅ TRIGGER CORREGIDO: update_clients_policies_from_commissions()
✅ FUNCIÓN BATCH CORREGIDA: batch_update_clients_policies_from_commissions()

CAMBIOS:
- policies: Ya NO intenta actualizar updated_at (no existe)
- clients: SÍ actualiza updated_at (existe)

EJECUTAR EN SUPABASE SQL EDITOR:
1. Copiar todo este archivo
2. Pegar en SQL Editor
3. Run (F5)
4. Verificar queries al final muestran columnas correctas
5. Probar import de nueva quincena nuevamente
*/
