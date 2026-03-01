-- ═══════════════════════════════════════════════════════════════════
-- MIGRATION: OPS CONFIG V2
-- Seeds missing ops_config keys, creates ops_email_templates,
-- ensures cron_runs table exists.
-- Safe to re-run (all INSERT ON CONFLICT DO NOTHING).
-- ═══════════════════════════════════════════════════════════════════

-- ── 1) Ensure cron_runs table ──
CREATE TABLE IF NOT EXISTS cron_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',  -- running | success | failed
  processed_count INT DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cron_runs_job_name ON cron_runs(job_name);
CREATE INDEX IF NOT EXISTS idx_cron_runs_started_at ON cron_runs(started_at DESC);

-- ── 2) Ensure ops_email_templates table ──
CREATE TABLE IF NOT EXISTS ops_email_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  body_html TEXT NOT NULL DEFAULT '',
  body_text TEXT NOT NULL DEFAULT '',
  merge_vars TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Seed default email templates
INSERT INTO ops_email_templates (template_key, label, subject, body_html, body_text, merge_vars) VALUES
(
  'renew_inquiry',
  'Consulta de Renovación',
  'Renovación de su póliza {{poliza_numero}}',
  '<p>Estimado/a {{cliente_nombre}},</p><p>Su póliza {{poliza_numero}} está próxima a vencer el {{fecha_vencimiento}}.</p><p>¿Desea renovarla? Responda a este correo o contáctenos.</p><p>Saludos,<br/>Líderes en Seguros</p>',
  'Estimado/a {{cliente_nombre}},\n\nSu póliza {{poliza_numero}} está próxima a vencer el {{fecha_vencimiento}}.\n\n¿Desea renovarla? Responda a este correo o contáctenos.\n\nSaludos,\nLíderes en Seguros',
  ARRAY['{{cliente_nombre}}','{{poliza_numero}}','{{fecha_vencimiento}}','{{ramo}}','{{aseguradora}}']
),
(
  'payment_link',
  'Link de Pago',
  'Link de pago - Póliza {{poliza_numero}}',
  '<p>Estimado/a {{cliente_nombre}},</p><p>Adjuntamos el link de pago para su póliza {{poliza_numero}}:</p><p><a href="{{link_pago}}">{{link_pago}}</a></p><p>Monto: {{monto}}</p><p>Saludos,<br/>Líderes en Seguros</p>',
  'Estimado/a {{cliente_nombre}},\n\nLink de pago para su póliza {{poliza_numero}}:\n{{link_pago}}\n\nMonto: {{monto}}\n\nSaludos,\nLíderes en Seguros',
  ARRAY['{{cliente_nombre}}','{{poliza_numero}}','{{link_pago}}','{{monto}}']
),
(
  'renewal_delivery',
  'Carátula Renovada',
  'Carátula renovada - Póliza {{poliza_numero}}',
  '<p>Estimado/a {{cliente_nombre}},</p><p>Adjuntamos la carátula de su póliza renovada {{poliza_numero}}.</p><p>Vigencia: {{fecha_inicio}} al {{fecha_fin}}</p><p>Saludos,<br/>Líderes en Seguros</p>',
  'Estimado/a {{cliente_nombre}},\n\nAdjuntamos la carátula de su póliza renovada {{poliza_numero}}.\n\nVigencia: {{fecha_inicio}} al {{fecha_fin}}\n\nSaludos,\nLíderes en Seguros',
  ARRAY['{{cliente_nombre}}','{{poliza_numero}}','{{fecha_inicio}}','{{fecha_fin}}','{{ramo}}']
),
(
  'morosidad_notice',
  'Aviso de Morosidad',
  'Aviso de morosidad - {{poliza_numero}}',
  '<p>Estimado/a {{cliente_nombre}},</p><p>Le informamos que su póliza {{poliza_numero}} correspondiente al ramo {{ramo}} presenta un saldo pendiente de {{monto_adeudado}} con {{dias_atraso}} días de atraso.</p><p>Le agradecemos realizar su pago a la mayor brevedad posible.</p><p>Saludos,<br/>Líderes en Seguros</p>',
  'Estimado/a {{cliente_nombre}},\n\nLe informamos que su póliza {{poliza_numero}} correspondiente al ramo {{ramo}} presenta un saldo pendiente de {{monto_adeudado}} con {{dias_atraso}} días de atraso.\n\nLe agradecemos realizar su pago a la mayor brevedad posible.\n\nSaludos,\nLíderes en Seguros',
  ARRAY['{{cliente_nombre}}','{{poliza_numero}}','{{ramo}}','{{monto_adeudado}}','{{dias_atraso}}','{{fecha_vencimiento}}']
)
ON CONFLICT (template_key) DO NOTHING;

-- ── 3) Seed missing ops_config keys ──

-- Autoasignación
INSERT INTO ops_config (key, value, description) VALUES
  ('auto_assignment_enabled', 'false', 'Toggle global de autoasignación')
ON CONFLICT (key) DO NOTHING;

INSERT INTO ops_config (key, value, description) VALUES
  ('auto_assignment_modules', '{"renovaciones":true,"peticiones":true,"urgencias":true}', 'Módulos con autoasignación habilitada')
ON CONFLICT (key) DO NOTHING;

INSERT INTO ops_config (key, value, description) VALUES
  ('auto_assignment_strategy', '"equilibrado"', 'Estrategia de autoasignación: equilibrado')
ON CONFLICT (key) DO NOTHING;

-- SLA
INSERT INTO ops_config (key, value, description) VALUES
  ('sla_hours_renewals_petitions', '48', 'Horas SLA para renovaciones y peticiones')
ON CONFLICT (key) DO NOTHING;

INSERT INTO ops_config (key, value, description) VALUES
  ('sla_business_hours_urgencies', '24', 'Horas hábiles SLA para urgencias')
ON CONFLICT (key) DO NOTHING;

INSERT INTO ops_config (key, value, description) VALUES
  ('sla_warning_thresholds', '{"renewals":24,"urgencies":12}', 'Horas para warning antes de breach')
ON CONFLICT (key) DO NOTHING;

-- Horario laboral
INSERT INTO ops_config (key, value, description) VALUES
  ('business_hours', '{"timezone":"America/Panama","workdays":["Mon","Tue","Wed","Thu","Fri"],"start":"08:00","end":"18:00"}', 'Horario laboral para cálculo SLA hábil')
ON CONFLICT (key) DO NOTHING;

-- Productividad
INSERT INTO ops_config (key, value, description) VALUES
  ('low_productivity_threshold_ratio', '0.4', 'Ratio mínimo vs promedio para día productivo')
ON CONFLICT (key) DO NOTHING;

INSERT INTO ops_config (key, value, description) VALUES
  ('low_productivity_lookback_days', '30', 'Días de lookback para calcular promedio productividad')
ON CONFLICT (key) DO NOTHING;

INSERT INTO ops_config (key, value, description) VALUES
  ('inactivity_close_session_hours', '2', 'Horas de inactividad para cerrar sesión automáticamente')
ON CONFLICT (key) DO NOTHING;

-- IMAP
INSERT INTO ops_config (key, value, description) VALUES
  ('imap_sync_interval_minutes', '1', 'Intervalo de sync IMAP en minutos')
ON CONFLICT (key) DO NOTHING;

INSERT INTO ops_config (key, value, description) VALUES
  ('orphan_match_policy_number_enabled', 'true', 'Habilitar rescate de huérfanos por número de póliza')
ON CONFLICT (key) DO NOTHING;

INSERT INTO ops_config (key, value, description) VALUES
  ('unclassified_retention_days', '90', 'Días de retención de correos no clasificados')
ON CONFLICT (key) DO NOTHING;

-- IA
INSERT INTO ops_config (key, value, description) VALUES
  ('ai_provider', '"vertex"', 'Proveedor IA (vertex|openai|mock). Lectura env override.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO ops_config (key, value, description) VALUES
  ('ai_effectiveness_min', '70', 'Puntaje mínimo de efectividad IA')
ON CONFLICT (key) DO NOTHING;

INSERT INTO ops_config (key, value, description) VALUES
  ('ai_confidence_min_memory', '0.3', 'Confianza mínima para guardar en memoria IA')
ON CONFLICT (key) DO NOTHING;

INSERT INTO ops_config (key, value, description) VALUES
  ('ai_escalation_auto', 'true', 'Escalamiento automático por IA')
ON CONFLICT (key) DO NOTHING;

-- Retención / Exports
INSERT INTO ops_config (key, value, description) VALUES
  ('retention_years', '3', 'Años de retención de datos y logs')
ON CONFLICT (key) DO NOTHING;

INSERT INTO ops_config (key, value, description) VALUES
  ('exports_enabled', 'true', 'Habilitar exportaciones')
ON CONFLICT (key) DO NOTHING;
