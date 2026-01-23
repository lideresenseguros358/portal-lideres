-- TABLA TEMPORAL DE DEBUG PARA AUTODEPURACIÓN IMAP
-- Esta tabla almacena logs estructurados del flujo IMAP → Case Engine
-- PUEDE SER ELIMINADA después de resolver el problema

CREATE TABLE IF NOT EXISTS imap_debug_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  
  -- Identificadores
  test_id text, -- ID del test autotest (si aplica)
  message_id text, -- Message-ID del correo
  inbound_email_id uuid, -- FK a inbound_emails
  case_id uuid, -- FK a cases (si se creó)
  
  -- Etapa del flujo
  stage text NOT NULL, -- 'imap_connect', 'imap_fetch', 'db_insert', 'ai_classify', 'case_create', 'ui_visible'
  status text NOT NULL, -- 'success', 'error', 'warning'
  
  -- Detalles
  message text,
  payload jsonb, -- Datos estructurados del paso
  error_detail text,
  
  -- Metadata
  duration_ms integer,
  timestamp_ms bigint DEFAULT extract(epoch from now()) * 1000
);

-- Index para búsquedas rápidas
CREATE INDEX IF NOT EXISTS imap_debug_logs_test_id_idx ON imap_debug_logs(test_id);
CREATE INDEX IF NOT EXISTS imap_debug_logs_message_id_idx ON imap_debug_logs(message_id);
CREATE INDEX IF NOT EXISTS imap_debug_logs_created_at_idx ON imap_debug_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS imap_debug_logs_stage_idx ON imap_debug_logs(stage);

COMMENT ON TABLE imap_debug_logs IS 'Logs de debug temporal para autodepuración del flujo IMAP';
