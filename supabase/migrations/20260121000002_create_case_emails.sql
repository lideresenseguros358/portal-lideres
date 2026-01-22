-- ============================================
-- CASE EMAILS - Vinculación de Correos con Casos
-- ============================================
-- Tabla puente para vincular inbound_emails con casos
-- Permite historial completo de comunicaciones por caso
-- ============================================

CREATE TABLE IF NOT EXISTS case_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referencias
  case_id UUID NOT NULL, -- FK a tabla de casos (agregar constraint después)
  inbound_email_id UUID NOT NULL REFERENCES inbound_emails(id) ON DELETE CASCADE,
  
  -- Metadata de vinculación
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  linked_by TEXT DEFAULT 'system', -- 'system' | 'master' | user_id
  
  -- Control de visibilidad
  visible_to_broker BOOLEAN DEFAULT TRUE,
  
  -- Constraint para evitar duplicados
  UNIQUE(case_id, inbound_email_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_case_emails_case_id ON case_emails(case_id);
CREATE INDEX IF NOT EXISTS idx_case_emails_email_id ON case_emails(inbound_email_id);
CREATE INDEX IF NOT EXISTS idx_case_emails_linked_at ON case_emails(linked_at DESC);

-- ============================================
-- CASE HISTORY EVENTS - Historial de Eventos
-- ============================================
-- Eventos del caso visibles al broker (pero con flag ocultable)
-- Diferente de audit logs que son inmutables y solo master
-- ============================================

CREATE TABLE IF NOT EXISTS case_history_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Caso relacionado
  case_id UUID NOT NULL, -- FK a tabla de casos
  
  -- Tipo de evento
  event_type TEXT NOT NULL,
  -- 'status_change' | 'due_change' | 'note' | 'email_linked' | 
  -- 'attachment_added' | 'ticket_generated' | 'ticket_changed' |
  -- 'assigned_to_broker' | 'assigned_to_master' | 'created' | 
  -- 'client_created' | 'case_merged' | 'case_split' | etc
  
  -- Payload JSON flexible
  payload JSONB,
  
  -- Quién lo hizo
  created_by_user_id UUID NULL, -- NULL si es system
  created_by_role TEXT NOT NULL DEFAULT 'system', -- 'system' | 'master' | 'broker'
  
  -- Visibilidad
  visible_to_broker BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_case_history_case_id ON case_history_events(case_id);
CREATE INDEX IF NOT EXISTS idx_case_history_created_at ON case_history_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_history_event_type ON case_history_events(event_type);
CREATE INDEX IF NOT EXISTS idx_case_history_visible_broker ON case_history_events(visible_to_broker);

-- Constraint para roles válidos
ALTER TABLE case_history_events
  ADD CONSTRAINT case_history_events_created_by_role_check
  CHECK (created_by_role IN ('system', 'master', 'broker'));

-- ============================================
-- SECURITY AUDIT LOGS - Auditoría Inmutable
-- ============================================
-- Solo master puede ver, nunca se edita ni borra
-- Para compliance y trazabilidad completa
-- ============================================

CREATE TABLE IF NOT EXISTS security_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Actor
  actor_user_id UUID NULL, -- NULL si es system
  actor_type TEXT NOT NULL, -- 'system' | 'user'
  
  -- Acción
  action TEXT NOT NULL, -- 'EMAIL_LINKED' | 'CASE_CREATED' | 'TICKET_GENERATED' | etc
  
  -- Entidad afectada
  entity_type TEXT, -- 'case' | 'email' | 'attachment' | 'client' | etc
  entity_id TEXT, -- UUID o identificador
  
  -- Estado antes/después (JSON)
  before JSONB NULL,
  after JSONB NULL,
  
  -- Metadata de request
  ip TEXT NULL,
  user_agent TEXT NULL,
  
  -- Timestamp inmutable
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user ON security_audit_logs(actor_user_id) WHERE actor_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON security_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON security_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON security_audit_logs(created_at DESC);

-- Constraint para actor_type
ALTER TABLE security_audit_logs
  ADD CONSTRAINT security_audit_logs_actor_type_check
  CHECK (actor_type IN ('system', 'user'));

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE case_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_history_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Master puede ver todo
CREATE POLICY case_emails_master_all ON case_emails
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'master'
    )
  );

CREATE POLICY case_history_master_all ON case_history_events
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'master'
    )
  );

-- Audit logs: SOLO master puede SELECT, NADIE puede modificar
CREATE POLICY audit_logs_master_select ON security_audit_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'master'
    )
  );

-- System/backend puede INSERT en audit logs (via service role)
-- No hay policies de UPDATE/DELETE para garantizar inmutabilidad

-- ============================================
-- COMENTARIOS
-- ============================================

COMMENT ON TABLE case_emails IS 'Vinculación entre correos entrantes y casos del módulo Pendientes';
COMMENT ON TABLE case_history_events IS 'Historial de eventos del caso, visible a broker pero con flag ocultable';
COMMENT ON TABLE security_audit_logs IS 'Auditoría inmutable de todas las acciones del sistema, solo visible a master';
COMMENT ON COLUMN case_emails.visible_to_broker IS 'Master puede ocultar emails específicos al broker sin borrarlos';
COMMENT ON COLUMN case_history_events.visible_to_broker IS 'Master puede ocultar eventos sin borrarlos del historial';
