-- =====================================================
-- TRIGGERS PARA ACTUALIZACIÓN AUTOMÁTICA DE CLIENTS/POLICIES
-- =====================================================
-- Cuando se procesan comisiones, actualiza automáticamente:
-- 1. clients.broker_id si el cliente no tiene corredor asignado
-- 2. policies.broker_id si la póliza no tiene corredor asignado
-- =====================================================

-- Función: Actualizar broker_id en clients y policies desde comm_items
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
    
    -- 1. Actualizar broker_id en policies si no tiene uno asignado
    UPDATE policies
    SET broker_id = v_broker_id,
        updated_at = NOW()
    WHERE id = v_policy_id
      AND (broker_id IS NULL OR broker_id != v_broker_id);

    -- 2. Actualizar broker_id en clients si no tiene uno asignado
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

-- Trigger: Ejecutar después de INSERT en comm_items
DROP TRIGGER IF EXISTS trg_update_clients_policies_from_comm ON comm_items;
CREATE TRIGGER trg_update_clients_policies_from_comm
  AFTER INSERT ON comm_items
  FOR EACH ROW
  EXECUTE FUNCTION update_clients_policies_from_commissions();

-- =====================================================
-- FUNCIÓN BATCH: Actualizar todos los clientes/pólizas existentes
-- =====================================================
-- Esta función se puede ejecutar manualmente para actualizar
-- todos los registros históricos basándose en las comisiones
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
  v_record RECORD;
BEGIN
  -- Actualizar pólizas sin broker asignado
  WITH updates AS (
    UPDATE policies p
    SET broker_id = ci.broker_id,
        updated_at = NOW()
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

  -- Actualizar clientes sin broker asignado
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
-- COMENTARIOS Y DOCUMENTACIÓN
-- =====================================================
COMMENT ON FUNCTION update_clients_policies_from_commissions() IS 
'Trigger function: Actualiza automáticamente broker_id en clients y policies cuando se inserta un comm_item con broker asignado';

COMMENT ON FUNCTION batch_update_clients_policies_from_commissions() IS 
'Función manual: Actualiza todos los clients/policies existentes basándose en el historial de comm_items. Retorna conteo de registros actualizados';

-- =====================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_comm_items_policy_number_broker 
  ON comm_items(policy_number, broker_id) 
  WHERE broker_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_policies_policy_number 
  ON policies(policy_number);

CREATE INDEX IF NOT EXISTS idx_policies_broker_id 
  ON policies(broker_id) 
  WHERE broker_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_broker_id 
  ON clients(broker_id) 
  WHERE broker_id IS NOT NULL;
