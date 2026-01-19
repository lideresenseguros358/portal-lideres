-- =====================================================
-- MIGRATION: Ticketing System - Catalogs and Infrastructure
-- Date: 2026-01-19
-- Description: Creates configurable catalogs for ramos, aseguradoras, tramites
--              and infrastructure for 12-digit positional ticket generation
-- =====================================================

-- =====================================================
-- 1. CATÁLOGO DE RAMOS (Policy Types)
-- =====================================================
CREATE TABLE IF NOT EXISTS ramos_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(2) NOT NULL UNIQUE, -- 01, 02, 03, etc. (max 99)
  name VARCHAR(100) NOT NULL,
  description TEXT,
  sla_days_default INT DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ramos_catalog_active ON ramos_catalog(is_active);
CREATE INDEX idx_ramos_catalog_code ON ramos_catalog(code) WHERE is_active = true;

COMMENT ON TABLE ramos_catalog IS 'Catálogo configurable de ramos/tipos de póliza para generación de tickets';
COMMENT ON COLUMN ramos_catalog.code IS 'Código de 2 dígitos usado en ticket (01-99)';
COMMENT ON COLUMN ramos_catalog.sla_days_default IS 'SLA base en días para este ramo';

-- =====================================================
-- 2. CATÁLOGO DE ASEGURADORAS (Insurers)
-- =====================================================
CREATE TABLE IF NOT EXISTS aseguradoras_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(2) NOT NULL UNIQUE, -- 01, 02, 03, etc. (max 99)
  name VARCHAR(100) NOT NULL,
  short_name VARCHAR(50),
  insurer_id UUID REFERENCES insurers(id) ON DELETE SET NULL, -- Link to existing insurers table
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_aseguradoras_catalog_active ON aseguradoras_catalog(is_active);
CREATE INDEX idx_aseguradoras_catalog_code ON aseguradoras_catalog(code) WHERE is_active = true;
CREATE INDEX idx_aseguradoras_catalog_insurer ON aseguradoras_catalog(insurer_id);

COMMENT ON TABLE aseguradoras_catalog IS 'Catálogo configurable de aseguradoras para generación de tickets';
COMMENT ON COLUMN aseguradoras_catalog.code IS 'Código de 2 dígitos usado en ticket (01-99)';
COMMENT ON COLUMN aseguradoras_catalog.insurer_id IS 'Referencia a tabla insurers existente (opcional)';

-- =====================================================
-- 3. CATÁLOGO DE TIPOS DE TRÁMITE
-- =====================================================
CREATE TABLE IF NOT EXISTS tramites_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(2) NOT NULL UNIQUE, -- 1, 2, 3, etc. (1-99)
  name VARCHAR(100) NOT NULL,
  description TEXT,
  requires_policy_number BOOLEAN DEFAULT false,
  sla_modifier INT DEFAULT 0, -- Ajuste al SLA base (+/- días)
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tramites_catalog_active ON tramites_catalog(is_active);
CREATE INDEX idx_tramites_catalog_code ON tramites_catalog(code) WHERE is_active = true;

COMMENT ON TABLE tramites_catalog IS 'Catálogo configurable de tipos de trámite para generación de tickets';
COMMENT ON COLUMN tramites_catalog.code IS 'Código de 1-2 dígitos usado en ticket (1-99)';
COMMENT ON COLUMN tramites_catalog.sla_modifier IS 'Modificador del SLA base (ejemplo: +2 días, -3 días)';

-- =====================================================
-- 4. SECUENCIAS DE TICKETS (Correlativo Tracking)
-- =====================================================
CREATE TABLE IF NOT EXISTS ticket_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month CHAR(4) NOT NULL, -- AAMM (ejemplo: 2601)
  ramo_code VARCHAR(2) NOT NULL,
  aseguradora_code VARCHAR(2) NOT NULL,
  tramite_code VARCHAR(2) NOT NULL,
  last_correlative INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(year_month, ramo_code, aseguradora_code, tramite_code)
);

CREATE INDEX idx_ticket_sequences_lookup ON ticket_sequences(year_month, ramo_code, aseguradora_code, tramite_code);

COMMENT ON TABLE ticket_sequences IS 'Tracking de correlativos mensuales para generación de tickets';
COMMENT ON COLUMN ticket_sequences.year_month IS 'Año y mes en formato AAMM (2601 = Enero 2026)';
COMMENT ON COLUMN ticket_sequences.last_correlative IS 'Último correlativo asignado (001-999)';

-- =====================================================
-- 5. CONFIGURACIÓN DE VACACIONES (Master Backup)
-- =====================================================
CREATE TABLE IF NOT EXISTS vacation_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_email VARCHAR(255) NOT NULL UNIQUE,
  master_name VARCHAR(255) NOT NULL,
  is_on_vacation BOOLEAN DEFAULT false,
  vacation_start DATE,
  vacation_end DATE,
  backup_email VARCHAR(255), -- Email del master de respaldo
  auto_reassign BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vacation_config_email ON vacation_config(master_email);
CREATE INDEX idx_vacation_config_active ON vacation_config(is_on_vacation) WHERE is_on_vacation = true;

COMMENT ON TABLE vacation_config IS 'Configuración de vacaciones para masters con sistema de respaldo';
COMMENT ON COLUMN vacation_config.backup_email IS 'Email del master que toma los casos durante vacaciones';

-- =====================================================
-- 6. LOGS DE SEGURIDAD (Immutable Audit Trail)
-- =====================================================
CREATE TABLE IF NOT EXISTS case_security_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL, -- CREATED, UPDATED, TICKET_GENERATED, STATE_CHANGED, etc.
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_email VARCHAR(255),
  actor_role VARCHAR(50),
  field_changed VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB, -- Información adicional flexible
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- NO actualizable - solo INSERT permitido
CREATE INDEX idx_case_security_logs_case ON case_security_logs(case_id, created_at DESC);
CREATE INDEX idx_case_security_logs_actor ON case_security_logs(actor_id, created_at DESC);
CREATE INDEX idx_case_security_logs_action ON case_security_logs(action_type, created_at DESC);
CREATE INDEX idx_case_security_logs_created ON case_security_logs(created_at DESC);

COMMENT ON TABLE case_security_logs IS 'Registro inmutable de todas las acciones en casos (solo Master)';
COMMENT ON COLUMN case_security_logs.metadata IS 'JSON con contexto adicional de la acción';

-- Trigger para prevenir UPDATE y DELETE en logs
CREATE OR REPLACE FUNCTION prevent_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Los logs de seguridad son inmutables. Operación % no permitida.', TG_OP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_case_security_logs_update
  BEFORE UPDATE ON case_security_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_log_modification();

CREATE TRIGGER prevent_case_security_logs_delete
  BEFORE DELETE ON case_security_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_log_modification();

-- =====================================================
-- 7. HISTORIAL DE TICKETS (Rastreo de cambios de ticket)
-- =====================================================
CREATE TABLE IF NOT EXISTS case_ticket_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  old_ticket VARCHAR(12),
  new_ticket VARCHAR(12) NOT NULL,
  reason VARCHAR(255), -- INITIAL_GENERATION, RAMO_CHANGED, INSURER_CHANGED, TRAMITE_CHANGED, REOPENED
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_case_ticket_history_case ON case_ticket_history(case_id, created_at DESC);
CREATE INDEX idx_case_ticket_history_tickets ON case_ticket_history(new_ticket);

COMMENT ON TABLE case_ticket_history IS 'Historial de tickets generados para cada caso';
COMMENT ON COLUMN case_ticket_history.reason IS 'Razón del cambio de ticket';

-- =====================================================
-- 8. EMAILS SIN CLASIFICAR (24h Auto-grouping)
-- =====================================================
CREATE TABLE IF NOT EXISTS unclassified_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id VARCHAR(255),
  thread_id VARCHAR(255),
  from_email VARCHAR(255) NOT NULL,
  from_name VARCHAR(255),
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  received_at TIMESTAMPTZ NOT NULL,
  grouped_until TIMESTAMPTZ, -- Auto-group window (received_at + 24h)
  assigned_to_case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, GROUPED, ASSIGNED, DISCARDED
  confidence_score DECIMAL(3,2), -- 0.00 to 1.00 (AI confidence)
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_unclassified_emails_status ON unclassified_emails(status, received_at DESC);
CREATE INDEX idx_unclassified_emails_grouped_until ON unclassified_emails(grouped_until) WHERE status = 'PENDING';
CREATE INDEX idx_unclassified_emails_from ON unclassified_emails(from_email);
CREATE INDEX idx_unclassified_emails_thread ON unclassified_emails(thread_id);

COMMENT ON TABLE unclassified_emails IS 'Emails sin clasificar automáticamente - agrupación 24h antes de asignación manual';
COMMENT ON COLUMN unclassified_emails.grouped_until IS 'Ventana de auto-agrupación (24h)';
COMMENT ON COLUMN unclassified_emails.confidence_score IS 'Nivel de confianza de clasificación automática';

-- =====================================================
-- 9. DATOS INICIALES - RAMOS
-- =====================================================
INSERT INTO ramos_catalog (code, name, description, sla_days_default, display_order) VALUES
  ('01', 'Autos', 'Seguros de vehículos', 10, 1),
  ('02', 'Incendio', 'Seguros contra incendio', 12, 2),
  ('03', 'Vida', 'Seguros de vida', 8, 3),
  ('04', 'Multiriesgo', 'Pólizas multiriesgo', 10, 4),
  ('05', 'Responsabilidad Civil', 'Seguros de RC', 12, 5),
  ('06', 'Salud', 'Seguros médicos y de salud', 10, 6),
  ('07', 'Accidentes Personales', 'Seguros de AP', 10, 7),
  ('08', 'Transporte', 'Seguros de carga y transporte', 12, 8),
  ('09', 'Hogar', 'Seguros de vivienda', 10, 9),
  ('99', 'Otros', 'Otros tipos de seguro', 10, 99)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- 10. DATOS INICIALES - ASEGURADORAS
-- =====================================================
-- Estos se poblarán desde la UI de configuración al vincular con insurers existentes
-- Ejemplo de estructura:
INSERT INTO aseguradoras_catalog (code, name, short_name, display_order) VALUES
  ('01', 'ASSA Compañía de Seguros', 'ASSA', 1),
  ('02', 'SURA Panamá', 'SURA', 2),
  ('03', 'Ancón Seguros', 'ANCON', 3),
  ('04', 'FEDPA', 'FEDPA', 4),
  ('05', 'MAPFRE Panamá', 'MAPFRE', 5)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- 11. DATOS INICIALES - TIPOS DE TRÁMITE
-- =====================================================
INSERT INTO tramites_catalog (code, name, description, requires_policy_number, sla_modifier, display_order) VALUES
  ('1', 'Emisión', 'Nueva emisión de póliza', false, 0, 1),
  ('2', 'Renovación', 'Renovación de póliza existente', true, -2, 2),
  ('3', 'Siniestro', 'Reclamo por siniestro', true, 5, 3),
  ('4', 'Endoso', 'Modificación/endoso de póliza', true, 0, 4),
  ('5', 'Cobro', 'Gestión de cobro', true, 0, 5),
  ('6', 'Cotización', 'Solicitud de cotización', false, -3, 6),
  ('7', 'Cancelación', 'Cancelación de póliza', true, 0, 7),
  ('8', 'Rehabilitación', 'Rehabilitación de póliza', true, 0, 8),
  ('9', 'Cambio de Corredor', 'Transferencia entre corredores', true, 0, 9)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- 12. DATOS INICIALES - MASTERS PARA VACACIONES
-- =====================================================
INSERT INTO vacation_config (master_email, master_name, is_on_vacation) VALUES
  ('yiraramos@lideresenseguros.com', 'Yira Ramos', false),
  ('lucianieto@lideresenseguros.com', 'Lucía Nieto', false)
ON CONFLICT (master_email) DO NOTHING;

-- =====================================================
-- 13. FUNCIÓN PARA GENERAR SIGUIENTE CORRELATIVO
-- =====================================================
CREATE OR REPLACE FUNCTION get_next_ticket_correlative(
  p_year_month VARCHAR(4),
  p_ramo_code VARCHAR(2),
  p_aseguradora_code VARCHAR(2),
  p_tramite_code VARCHAR(2)
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_next_correlative INT;
BEGIN
  -- Insertar o actualizar secuencia
  INSERT INTO ticket_sequences (year_month, ramo_code, aseguradora_code, tramite_code, last_correlative)
  VALUES (p_year_month, p_ramo_code, p_aseguradora_code, p_tramite_code, 1)
  ON CONFLICT (year_month, ramo_code, aseguradora_code, tramite_code)
  DO UPDATE SET 
    last_correlative = ticket_sequences.last_correlative + 1,
    updated_at = NOW()
  RETURNING last_correlative INTO v_next_correlative;
  
  RETURN v_next_correlative;
END;
$$;

COMMENT ON FUNCTION get_next_ticket_correlative IS 'Genera el siguiente correlativo para un ticket específico';

-- =====================================================
-- 14. FUNCIÓN PARA GENERAR TICKET COMPLETO
-- =====================================================
CREATE OR REPLACE FUNCTION generate_ticket_number(
  p_ramo_code VARCHAR(2),
  p_aseguradora_code VARCHAR(2),
  p_tramite_code VARCHAR(2)
)
RETURNS VARCHAR(12)
LANGUAGE plpgsql
AS $$
DECLARE
  v_year_month VARCHAR(4);
  v_correlative INT;
  v_ticket VARCHAR(12);
BEGIN
  -- Obtener año-mes actual en formato AAMM (últimos 2 dígitos del año + mes con 0 padding)
  v_year_month := TO_CHAR(CURRENT_DATE, 'YYMM');
  
  -- Obtener siguiente correlativo
  v_correlative := get_next_ticket_correlative(
    v_year_month,
    p_ramo_code,
    p_aseguradora_code,
    p_tramite_code
  );
  
  -- Construir ticket: [AAMM][RAMO][ASEG][TRAMITE][CORRELATIVO]
  -- Ejemplo: 2601 + 03 + 01 + 01 + 001 = 260103010001
  v_ticket := v_year_month 
    || LPAD(p_ramo_code, 2, '0')
    || LPAD(p_aseguradora_code, 2, '0')
    || LPAD(p_tramite_code, 2, '0')
    || LPAD(v_correlative::TEXT, 3, '0');
  
  RETURN v_ticket;
END;
$$;

COMMENT ON FUNCTION generate_ticket_number IS 'Genera ticket de 12 dígitos con formato [AAMM][RAMO][ASEG][TRAMITE][CORRELATIVO]';

-- =====================================================
-- 15. TRIGGER FUNCTION PARA LOG AUTOMÁTICO
-- =====================================================
CREATE OR REPLACE FUNCTION log_case_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_id UUID;
  v_actor_email VARCHAR(255);
  v_actor_role VARCHAR(50);
BEGIN
  -- Obtener info del usuario actual (si existe en sesión)
  -- Esto se puede mejorar con autenticación de Supabase
  v_actor_id := auth.uid();
  
  IF v_actor_id IS NOT NULL THEN
    SELECT email, role INTO v_actor_email, v_actor_role
    FROM profiles
    WHERE id = v_actor_id;
  END IF;
  
  -- Registrar cambios relevantes
  IF TG_OP = 'INSERT' THEN
    INSERT INTO case_security_logs (case_id, action_type, actor_id, actor_email, actor_role, new_value, metadata)
    VALUES (NEW.id, 'CASE_CREATED', v_actor_id, v_actor_email, v_actor_role, NEW.status::TEXT, 
      jsonb_build_object('section', NEW.section, 'broker_id', NEW.broker_id, 'admin_id', NEW.admin_id));
      
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO case_security_logs (case_id, action_type, actor_id, actor_email, actor_role, field_changed, old_value, new_value)
      VALUES (NEW.id, 'STATUS_CHANGED', v_actor_id, v_actor_email, v_actor_role, 'status', OLD.status::TEXT, NEW.status::TEXT);
    END IF;
    
    -- Log ticket generation
    IF OLD.ticket_ref IS NULL AND NEW.ticket_ref IS NOT NULL THEN
      INSERT INTO case_security_logs (case_id, action_type, actor_id, actor_email, actor_role, field_changed, new_value)
      VALUES (NEW.id, 'TICKET_GENERATED', v_actor_id, v_actor_email, v_actor_role, 'ticket_ref', NEW.ticket_ref);
    END IF;
    
    -- Log ticket changes
    IF OLD.ticket_ref IS DISTINCT FROM NEW.ticket_ref AND OLD.ticket_ref IS NOT NULL AND NEW.ticket_ref IS NOT NULL THEN
      INSERT INTO case_security_logs (case_id, action_type, actor_id, actor_email, actor_role, field_changed, old_value, new_value)
      VALUES (NEW.id, 'TICKET_CHANGED', v_actor_id, v_actor_email, v_actor_role, 'ticket_ref', OLD.ticket_ref, NEW.ticket_ref);
    END IF;
    
    -- Log broker assignment changes
    IF OLD.broker_id IS DISTINCT FROM NEW.broker_id THEN
      INSERT INTO case_security_logs (case_id, action_type, actor_id, actor_email, actor_role, field_changed, old_value, new_value)
      VALUES (NEW.id, 'BROKER_ASSIGNED', v_actor_id, v_actor_email, v_actor_role, 'broker_id', OLD.broker_id::TEXT, NEW.broker_id::TEXT);
    END IF;
    
    -- Log master assignment changes
    IF OLD.admin_id IS DISTINCT FROM NEW.admin_id THEN
      INSERT INTO case_security_logs (case_id, action_type, actor_id, actor_email, actor_role, field_changed, old_value, new_value)
      VALUES (NEW.id, 'MASTER_ASSIGNED', v_actor_id, v_actor_email, v_actor_role, 'admin_id', OLD.admin_id::TEXT, NEW.admin_id::TEXT);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar trigger a tabla cases
DROP TRIGGER IF EXISTS log_case_changes_trigger ON cases;
CREATE TRIGGER log_case_changes_trigger
  AFTER INSERT OR UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION log_case_changes();

-- =====================================================
-- 16. VISTAS ÚTILES
-- =====================================================

-- Vista de casos con información de catálogos
CREATE OR REPLACE VIEW cases_with_catalogs AS
SELECT 
  c.*,
  r.name as ramo_name,
  r.code as ramo_code,
  a.name as aseguradora_name,
  a.code as aseguradora_code,
  t.name as tramite_name,
  t.code as tramite_code,
  b.name as broker_name,
  b.email as broker_email,
  p.full_name as admin_name,
  p.email as admin_email
FROM cases c
LEFT JOIN ramos_catalog r ON c.ctype::TEXT = r.name OR c.management_type = r.name
LEFT JOIN aseguradoras_catalog a ON a.insurer_id = c.insurer_id
LEFT JOIN tramites_catalog t ON c.management_type = t.name
LEFT JOIN brokers b ON c.broker_id = b.id
LEFT JOIN profiles p ON c.admin_id = p.id;

COMMENT ON VIEW cases_with_catalogs IS 'Vista de casos enriquecida con datos de catálogos';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
