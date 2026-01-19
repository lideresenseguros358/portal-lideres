-- =====================================================
-- MIGRATION: Update Cases Table for New Ticketing System
-- Date: 2026-01-19
-- Description: Updates cases table with new simplified states,
--              ticket tracking fields, and SLA pause/resume logic
-- =====================================================

-- =====================================================
-- 1. ADD NEW COLUMNS TO CASES TABLE
-- =====================================================

-- Campos para catálogos
ALTER TABLE cases ADD COLUMN IF NOT EXISTS ramo_code VARCHAR(2);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS aseguradora_code VARCHAR(2);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS tramite_code VARCHAR(2);

-- Campos para generación de ticket
ALTER TABLE cases ADD COLUMN IF NOT EXISTS ticket_generated_at TIMESTAMPTZ;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS ticket_can_regenerate BOOLEAN DEFAULT false;

-- Campos para SLA pausado
ALTER TABLE cases ADD COLUMN IF NOT EXISTS sla_paused BOOLEAN DEFAULT false;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS sla_paused_at TIMESTAMPTZ;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS sla_paused_reason VARCHAR(100);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS sla_accumulated_pause_days INT DEFAULT 0;

-- Campos para aplazado mejorado
ALTER TABLE cases ADD COLUMN IF NOT EXISTS aplazar_months INT; -- 1, 2, 3, 4, 5, 6
ALTER TABLE cases ADD COLUMN IF NOT EXISTS aplazar_notify_at TIMESTAMPTZ; -- Cuando notificar

-- Campo para tracking de reapertura
ALTER TABLE cases ADD COLUMN IF NOT EXISTS reopened_from_ticket VARCHAR(12);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS reopen_count INT DEFAULT 0;

-- Campo para tracking de cambios de clasificación
ALTER TABLE cases ADD COLUMN IF NOT EXISTS classification_changed_count INT DEFAULT 0;

-- Campos para estado "sin clasificar"
ALTER TABLE cases ADD COLUMN IF NOT EXISTS is_classified BOOLEAN DEFAULT false;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS classified_at TIMESTAMPTZ;

-- Campo para número de póliza al cerrar aprobado
ALTER TABLE cases ADD COLUMN IF NOT EXISTS final_policy_number VARCHAR(100);

-- =====================================================
-- 2. CREAR NUEVO ENUM PARA ESTADOS SIMPLIFICADOS
-- =====================================================

-- Crear nuevo tipo de estado simplificado
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'case_status_simplified') THEN
    CREATE TYPE case_status_simplified AS ENUM (
      'NUEVO',                -- Recién creado, sin procesar
      'EN_PROCESO',          -- En trabajo activo
      'PENDIENTE_CLIENTE',   -- Esperando respuesta del cliente (SLA pausado)
      'PENDIENTE_BROKER',    -- Esperando acción del broker (SLA pausado)
      'ENVIADO',             -- Enviado a aseguradora, esperando respuesta
      'APLAZADO',            -- Temporalmente cerrado con fecha de reapertura
      'CERRADO_APROBADO',    -- Cerrado exitosamente (emitido/aprobado)
      'CERRADO_RECHAZADO'    -- Cerrado sin éxito (rechazado/cancelado)
    );
  END IF;
END $$;

-- Agregar columna para nuevo estado (mantenemos el antiguo por compatibilidad temporal)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS status_v2 case_status_simplified DEFAULT 'NUEVO';

-- =====================================================
-- 3. ÍNDICES PARA OPTIMIZACIÓN
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_cases_ramo_code ON cases(ramo_code) WHERE ramo_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cases_aseguradora_code ON cases(aseguradora_code) WHERE aseguradora_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cases_tramite_code ON cases(tramite_code) WHERE tramite_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cases_status_v2 ON cases(status_v2);
CREATE INDEX IF NOT EXISTS idx_cases_is_classified ON cases(is_classified, section);
CREATE INDEX IF NOT EXISTS idx_cases_ticket_ref ON cases(ticket_ref) WHERE ticket_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cases_sla_paused ON cases(sla_paused) WHERE sla_paused = true;
CREATE INDEX IF NOT EXISTS idx_cases_aplazar_notify ON cases(aplazar_notify_at) WHERE aplazar_notify_at IS NOT NULL AND status_v2 = 'APLAZADO';

-- =====================================================
-- 4. MIGRACIÓN DE DATOS EXISTENTES
-- =====================================================

-- Mapear estados antiguos a nuevos estados simplificados
UPDATE cases SET status_v2 = 
  CASE 
    WHEN status = 'PENDIENTE_REVISION' THEN 'NUEVO'::case_status_simplified
    WHEN status = 'EN_PROCESO' THEN 'EN_PROCESO'::case_status_simplified
    WHEN status = 'FALTA_DOC' THEN 'PENDIENTE_CLIENTE'::case_status_simplified
    WHEN status = 'APLAZADO' THEN 'APLAZADO'::case_status_simplified
    WHEN status = 'RECHAZADO' THEN 'CERRADO_RECHAZADO'::case_status_simplified
    WHEN status = 'EMITIDO' THEN 'CERRADO_APROBADO'::case_status_simplified
    WHEN status = 'APROBADO_PEND_PAGO' THEN 'ENVIADO'::case_status_simplified
    WHEN status = 'CERRADO' THEN 'CERRADO_APROBADO'::case_status_simplified
    ELSE 'NUEVO'::case_status_simplified
  END
WHERE status_v2 IS NULL OR status_v2 = 'NUEVO';

-- Marcar como clasificados los que tienen aseguradora y tipo de gestión
UPDATE cases 
SET is_classified = true,
    classified_at = COALESCE(updated_at, created_at)
WHERE insurer_id IS NOT NULL 
  AND management_type IS NOT NULL
  AND section != 'SIN_CLASIFICAR'
  AND is_classified = false;

-- =====================================================
-- 5. CONSTRAINTS Y VALIDACIONES
-- =====================================================

-- Constraint: Si tiene ticket, debe tener los códigos de catálogo
ALTER TABLE cases ADD CONSTRAINT check_ticket_requires_codes
  CHECK (
    (ticket_ref IS NULL) OR 
    (ticket_ref IS NOT NULL AND ramo_code IS NOT NULL AND aseguradora_code IS NOT NULL AND tramite_code IS NOT NULL)
  );

-- Constraint: Aplazado debe tener fecha y meses
ALTER TABLE cases ADD CONSTRAINT check_aplazado_requires_date
  CHECK (
    (status_v2 != 'APLAZADO') OR 
    (status_v2 = 'APLAZADO' AND postponed_until IS NOT NULL AND aplazar_months IS NOT NULL)
  );

-- Constraint: Cerrado aprobado con emisión debe tener número de póliza
-- (Esto se validará en la aplicación, no como constraint DB por flexibilidad)

-- =====================================================
-- 6. FUNCIÓN PARA CALCULAR SLA EFECTIVO
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_effective_sla_date(
  p_case_id UUID
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
AS $$
DECLARE
  v_sla_date TIMESTAMPTZ;
  v_accumulated_pause_days INT;
BEGIN
  SELECT sla_date, COALESCE(sla_accumulated_pause_days, 0)
  INTO v_sla_date, v_accumulated_pause_days
  FROM cases
  WHERE id = p_case_id;
  
  IF v_sla_date IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Ajustar SLA sumando los días pausados
  RETURN v_sla_date + (v_accumulated_pause_days || ' days')::INTERVAL;
END;
$$;

COMMENT ON FUNCTION calculate_effective_sla_date IS 'Calcula la fecha SLA efectiva considerando días pausados';

-- =====================================================
-- 7. FUNCIÓN PARA PAUSAR/REANUDAR SLA
-- =====================================================

CREATE OR REPLACE FUNCTION toggle_case_sla_pause(
  p_case_id UUID,
  p_pause BOOLEAN,
  p_reason VARCHAR(100) DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_pause BOOLEAN;
  v_paused_at TIMESTAMPTZ;
  v_days_paused INT;
BEGIN
  SELECT sla_paused, sla_paused_at
  INTO v_current_pause, v_paused_at
  FROM cases
  WHERE id = p_case_id;
  
  IF p_pause AND NOT v_current_pause THEN
    -- PAUSAR SLA
    UPDATE cases
    SET sla_paused = true,
        sla_paused_at = NOW(),
        sla_paused_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_case_id;
    
  ELSIF NOT p_pause AND v_current_pause THEN
    -- REANUDAR SLA
    -- Calcular días transcurridos mientras estuvo pausado
    v_days_paused := EXTRACT(DAY FROM NOW() - v_paused_at)::INT;
    
    UPDATE cases
    SET sla_paused = false,
        sla_paused_at = NULL,
        sla_paused_reason = NULL,
        sla_accumulated_pause_days = COALESCE(sla_accumulated_pause_days, 0) + v_days_paused,
        updated_at = NOW()
    WHERE id = p_case_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION toggle_case_sla_pause IS 'Pausa o reanuda el SLA de un caso, acumulando días pausados';

-- =====================================================
-- 8. TRIGGER PARA AUTO-PAUSAR SLA SEGÚN ESTADO
-- =====================================================

CREATE OR REPLACE FUNCTION auto_manage_sla_pause()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-pausar cuando cambia a PENDIENTE_CLIENTE o PENDIENTE_BROKER
  IF NEW.status_v2 IN ('PENDIENTE_CLIENTE', 'PENDIENTE_BROKER') AND 
     (OLD.status_v2 IS NULL OR OLD.status_v2 NOT IN ('PENDIENTE_CLIENTE', 'PENDIENTE_BROKER')) THEN
    
    NEW.sla_paused := true;
    NEW.sla_paused_at := NOW();
    NEW.sla_paused_reason := CASE 
      WHEN NEW.status_v2 = 'PENDIENTE_CLIENTE' THEN 'Esperando respuesta del cliente'
      WHEN NEW.status_v2 = 'PENDIENTE_BROKER' THEN 'Esperando acción del broker'
    END;
    
  -- Auto-reanudar cuando sale de estados de pendiente
  ELSIF OLD.status_v2 IN ('PENDIENTE_CLIENTE', 'PENDIENTE_BROKER') AND 
        NEW.status_v2 NOT IN ('PENDIENTE_CLIENTE', 'PENDIENTE_BROKER') AND
        NEW.sla_paused = true THEN
    
    -- Acumular días pausados
    NEW.sla_accumulated_pause_days := COALESCE(NEW.sla_accumulated_pause_days, 0) + 
      EXTRACT(DAY FROM NOW() - NEW.sla_paused_at)::INT;
    NEW.sla_paused := false;
    NEW.sla_paused_at := NULL;
    NEW.sla_paused_reason := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_manage_sla_pause_trigger ON cases;
CREATE TRIGGER auto_manage_sla_pause_trigger
  BEFORE UPDATE ON cases
  FOR EACH ROW 
  WHEN (OLD.status_v2 IS DISTINCT FROM NEW.status_v2)
  EXECUTE FUNCTION auto_manage_sla_pause();

-- =====================================================
-- 9. FUNCIÓN PARA REAPERTURA DE CASOS APLAZADOS
-- =====================================================

CREATE OR REPLACE FUNCTION reopen_aplazado_case(
  p_case_id UUID,
  p_create_new_ticket BOOLEAN DEFAULT true
)
RETURNS VARCHAR(12) -- Retorna el nuevo ticket generado
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_ticket VARCHAR(12);
  v_new_ticket VARCHAR(12);
  v_ramo_code VARCHAR(2);
  v_aseguradora_code VARCHAR(2);
  v_tramite_code VARCHAR(2);
BEGIN
  -- Obtener códigos y ticket actual
  SELECT ticket_ref, ramo_code, aseguradora_code, tramite_code
  INTO v_old_ticket, v_ramo_code, v_aseguradora_code, v_tramite_code
  FROM cases
  WHERE id = p_case_id;
  
  IF p_create_new_ticket THEN
    -- Generar nuevo ticket
    v_new_ticket := generate_ticket_number(v_ramo_code, v_aseguradora_code, v_tramite_code);
    
    -- Registrar en historial de tickets
    INSERT INTO case_ticket_history (case_id, old_ticket, new_ticket, reason, metadata)
    VALUES (p_case_id, v_old_ticket, v_new_ticket, 'REOPENED', 
      jsonb_build_object('reopen_count', (SELECT reopen_count FROM cases WHERE id = p_case_id)));
  ELSE
    v_new_ticket := v_old_ticket;
  END IF;
  
  -- Actualizar caso
  UPDATE cases
  SET status_v2 = 'NUEVO',
      ticket_ref = v_new_ticket,
      reopened_from_ticket = v_old_ticket,
      reopen_count = COALESCE(reopen_count, 0) + 1,
      postponed_until = NULL,
      aplazar_months = NULL,
      aplazar_notify_at = NULL,
      aplazar_reason = NULL,
      sla_date = NOW() + INTERVAL '10 days', -- Reset SLA
      sla_accumulated_pause_days = 0,
      sla_paused = false,
      updated_at = NOW()
  WHERE id = p_case_id;
  
  RETURN v_new_ticket;
END;
$$;

COMMENT ON FUNCTION reopen_aplazado_case IS 'Reabre un caso aplazado, opcionalmente generando nuevo ticket';

-- =====================================================
-- 10. COMENTARIOS Y DOCUMENTACIÓN
-- =====================================================

COMMENT ON COLUMN cases.ramo_code IS 'Código del ramo desde ramos_catalog (01-99)';
COMMENT ON COLUMN cases.aseguradora_code IS 'Código de la aseguradora desde aseguradoras_catalog (01-99)';
COMMENT ON COLUMN cases.tramite_code IS 'Código del tipo de trámite desde tramites_catalog (1-99)';
COMMENT ON COLUMN cases.status_v2 IS 'Estado simplificado del caso (nuevo sistema)';
COMMENT ON COLUMN cases.sla_paused IS 'Indica si el SLA está pausado (por pendiente cliente/broker)';
COMMENT ON COLUMN cases.sla_accumulated_pause_days IS 'Días totales que el SLA ha estado pausado';
COMMENT ON COLUMN cases.aplazar_months IS 'Meses de aplazamiento (1-6)';
COMMENT ON COLUMN cases.aplazar_notify_at IS 'Fecha en que se debe notificar para reapertura';
COMMENT ON COLUMN cases.reopened_from_ticket IS 'Ticket del caso original del que fue reabierto';
COMMENT ON COLUMN cases.reopen_count IS 'Número de veces que este caso ha sido reabierto';
COMMENT ON COLUMN cases.is_classified IS 'Indica si el caso ya fue clasificado (tiene aseguradora + trámite)';
COMMENT ON COLUMN cases.final_policy_number IS 'Número de póliza final al cerrar aprobado (emisión)';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
