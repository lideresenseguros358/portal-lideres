-- ═══════════════════════════════════════════════════════
-- OPERACIONES MODULE — Database Tables
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- 1. Activity Log (auto-registro de jornada)
CREATE TABLE IF NOT EXISTS ops_activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  session_block_id UUID
);

CREATE INDEX IF NOT EXISTS idx_ops_activity_user ON ops_activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_activity_session ON ops_activity_log(session_block_id);
CREATE INDEX IF NOT EXISTS idx_ops_activity_action ON ops_activity_log(action_type);

-- 2. Renewals
CREATE TABLE IF NOT EXISTS ops_renewals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number TEXT NOT NULL UNIQUE,
  policy_id UUID,
  policy_number TEXT NOT NULL,
  client_id UUID,
  client_name TEXT NOT NULL,
  insurer_id UUID,
  insurer_name TEXT,
  renewal_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDIENTE',
  assigned_to UUID REFERENCES auth.users(id),
  postponed_date DATE,
  cancellation_reason TEXT,
  new_start_date DATE,
  new_end_date DATE,
  last_email_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ops_renewals_status ON ops_renewals(status);
CREATE INDEX IF NOT EXISTS idx_ops_renewals_date ON ops_renewals(renewal_date);
CREATE INDEX IF NOT EXISTS idx_ops_renewals_assigned ON ops_renewals(assigned_to);
CREATE INDEX IF NOT EXISTS idx_ops_renewals_ticket ON ops_renewals(ticket_number);

-- 3. Petitions (Vida / Incendio / Hogar)
CREATE TABLE IF NOT EXISTS ops_petitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  cedula TEXT,
  ramo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDIENTE',
  assigned_to UUID REFERENCES auth.users(id),
  source TEXT DEFAULT 'COTIZADOR',
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ops_petitions_status ON ops_petitions(status);
CREATE INDEX IF NOT EXISTS idx_ops_petitions_ramo ON ops_petitions(ramo);

-- 4. Urgencies (from AI chat escalation)
CREATE TABLE IF NOT EXISTS ops_urgencies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_thread_id UUID,
  client_name TEXT,
  severity TEXT NOT NULL DEFAULT 'medium',
  category TEXT,
  status TEXT NOT NULL DEFAULT 'ABIERTO',
  sla_deadline TIMESTAMPTZ,
  first_response_at TIMESTAMPTZ,
  resolution_sentiment TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ops_urgencies_status ON ops_urgencies(status);
CREATE INDEX IF NOT EXISTS idx_ops_urgencies_sla ON ops_urgencies(sla_deadline);

-- 5. Email Threads (inbox for renewals/petitions)
CREATE TABLE IF NOT EXISTS ops_email_threads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID,
  ticket_type TEXT,
  subject TEXT NOT NULL,
  from_email TEXT,
  to_email TEXT,
  status TEXT NOT NULL DEFAULT 'ABIERTO',
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ops_email_threads_ticket ON ops_email_threads(ticket_id, ticket_type);
CREATE INDEX IF NOT EXISTS idx_ops_email_threads_status ON ops_email_threads(status);

-- 6. Email Messages
CREATE TABLE IF NOT EXISTS ops_email_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES ops_email_threads(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  has_attachments BOOLEAN DEFAULT false,
  message_id_header TEXT,
  in_reply_to TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ops_email_messages_thread ON ops_email_messages(thread_id, created_at);

-- 7. Team Metrics (aggregated)
CREATE TABLE IF NOT EXISTS ops_team_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  user_name TEXT,
  period_type TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_hours NUMERIC(6,2) DEFAULT 0,
  avg_daily_hours NUMERIC(4,2) DEFAULT 0,
  renewals_handled INT DEFAULT 0,
  quotes_made INT DEFAULT 0,
  emissions_made INT DEFAULT 0,
  conversion_rate NUMERIC(5,2) DEFAULT 0,
  unattended_cases INT DEFAULT 0,
  urgencies_handled INT DEFAULT 0,
  urgency_effectiveness NUMERIC(5,2) DEFAULT 0,
  unproductive_days INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ops_team_metrics_user ON ops_team_metrics(user_id, period_type, period_start);

-- 8. Configuration
CREATE TABLE IF NOT EXISTS ops_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Seed default config
INSERT INTO ops_config (key, value, description) VALUES
  ('auto_assign_enabled', 'false', 'Activar/desactivar autoasignación de renovaciones'),
  ('sla_urgency_hours', '24', 'Horas para SLA de urgencias (días hábiles)'),
  ('sla_renewal_first_response_hours', '48', 'Horas para primera respuesta en renovaciones'),
  ('work_schedule', '{"start": "09:00", "end": "17:00", "timezone": "America/Panama"}', 'Horario laboral'),
  ('work_days', '["monday","tuesday","wednesday","thursday","friday"]', 'Días laborales'),
  ('inactivity_timeout_hours', '2', 'Horas de inactividad para cerrar sesión'),
  ('morosidad_alert_days', '30', 'Días de atraso para generar alerta de morosidad'),
  ('renewal_advance_days', '30', 'Días antes de vencimiento para mostrar renovación'),
  ('retention_years', '3', 'Años de retención de logs')
ON CONFLICT (key) DO NOTHING;

-- 9. Audit Log (for before/after diffs)
CREATE TABLE IF NOT EXISTS ops_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  before_data JSONB,
  after_data JSONB,
  detail JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ops_audit_log_entity ON ops_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ops_audit_log_created ON ops_audit_log(created_at DESC);

-- RLS Policies (enable for all tables)
ALTER TABLE ops_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_renewals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_petitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_urgencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_team_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_audit_log ENABLE ROW LEVEL SECURITY;

-- Service role has full access (API routes use service role key)
-- No user-facing RLS policies needed since all access is through server-side API routes
