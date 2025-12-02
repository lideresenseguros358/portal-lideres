-- =====================================================
-- DESHABILITAR: Trigger que crea clients/policies automáticamente
-- =====================================================
-- Este trigger causaba creación prematura de clients/policies
-- al insertar en comm_items ANTES de completar datos preliminares
-- =====================================================

-- OPCIÓN 1: Deshabilitar completamente el trigger
DROP TRIGGER IF EXISTS trg_update_clients_policies_from_comm ON comm_items;

-- OPCIÓN 2: Modificar la función para que NO cree, solo actualice SI YA EXISTEN
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

  -- ⚠️ CAMBIO CRÍTICO: Solo ACTUALIZAR si la póliza YA EXISTE
  -- NO crear nuevos registros en clients o policies
  IF v_policy_id IS NOT NULL THEN
    
    -- Actualizar broker_id en policies solo si no tiene uno o es diferente
    UPDATE policies
    SET broker_id = v_broker_id
    WHERE id = v_policy_id
      AND (broker_id IS NULL OR broker_id != v_broker_id);

    -- Actualizar broker_id en clients solo si no tiene uno o es diferente
    IF v_client_id IS NOT NULL THEN
      UPDATE clients
      SET broker_id = v_broker_id
      WHERE id = v_client_id
        AND (broker_id IS NULL OR broker_id != v_broker_id);
    END IF;

  END IF;
  -- Si la póliza NO existe, NO hacer nada (esperar a que se complete preliminar)

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recrear trigger (ahora con función modificada)
CREATE TRIGGER trg_update_clients_policies_from_comm
  AFTER INSERT ON comm_items
  FOR EACH ROW
  EXECUTE FUNCTION update_clients_policies_from_commissions();


-- =====================================================
-- COMENTARIOS
-- =====================================================
COMMENT ON FUNCTION update_clients_policies_from_commissions() IS 
'MODIFICADO: Solo ACTUALIZA broker_id en clients/policies SI YA EXISTEN. NO crea nuevos registros. Los registros se crean únicamente después de completar datos preliminares en temp_client_imports.';
