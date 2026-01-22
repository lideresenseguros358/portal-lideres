-- ============================================
-- INBOUND EMAILS - Motor de Ingestión de Correos
-- ============================================
-- Almacena correos entrantes desde Zoho IMAP
-- con normalización, deduplicación por message_id
-- y tracking de procesamiento AI
-- ============================================

-- Crear tabla de correos entrantes
CREATE TABLE IF NOT EXISTS inbound_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificación única del email
  message_id TEXT UNIQUE NOT NULL,
  
  -- Headers principales
  from_email TEXT,
  from_name TEXT,
  to_emails JSONB, -- Array de emails
  cc_emails JSONB, -- Array de emails
  subject TEXT,
  subject_normalized TEXT,
  date_sent TIMESTAMPTZ,
  
  -- Threading
  in_reply_to TEXT NULL,
  thread_references TEXT NULL, -- Para hilos completos (renamed from 'references' - SQL keyword)
  
  -- Contenido
  body_text TEXT NULL,
  body_html TEXT NULL,
  body_text_normalized TEXT NULL, -- Limpio para AI
  
  -- Adjuntos metadata
  attachments_count INTEGER DEFAULT 0,
  attachments_total_bytes BIGINT DEFAULT 0,
  
  -- Tracking IMAP
  ingestion_source TEXT DEFAULT 'zoho-imap',
  imap_uid TEXT NULL,
  folder TEXT DEFAULT 'INBOX',
  
  -- Estado de procesamiento
  processed_status TEXT NOT NULL DEFAULT 'new',
  -- 'new' | 'classified' | 'linked' | 'ignored' | 'error'
  processed_at TIMESTAMPTZ NULL,
  
  -- Errores
  error_code TEXT NULL,
  error_detail TEXT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_inbound_emails_message_id ON inbound_emails(message_id);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_from_email ON inbound_emails(from_email);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_date_sent ON inbound_emails(date_sent DESC);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_processed_status ON inbound_emails(processed_status);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_created_at ON inbound_emails(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_in_reply_to ON inbound_emails(in_reply_to) WHERE in_reply_to IS NOT NULL;

-- Constraint para estados válidos
ALTER TABLE inbound_emails 
  ADD CONSTRAINT inbound_emails_processed_status_check 
  CHECK (processed_status IN ('new', 'classified', 'linked', 'ignored', 'error'));

-- ============================================
-- ADJUNTOS DE EMAILS
-- ============================================

CREATE TABLE IF NOT EXISTS inbound_email_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbound_email_id UUID NOT NULL REFERENCES inbound_emails(id) ON DELETE CASCADE,
  
  -- Metadata del archivo
  filename TEXT NOT NULL,
  mimetype TEXT,
  size_bytes BIGINT NOT NULL,
  
  -- Storage en Supabase
  storage_bucket TEXT DEFAULT 'inbound-email-attachments',
  storage_path TEXT NOT NULL,
  
  -- Checksum para deduplicación
  sha256 TEXT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_email_attachments_email_id ON inbound_email_attachments(inbound_email_id);
CREATE INDEX IF NOT EXISTS idx_email_attachments_sha256 ON inbound_email_attachments(sha256) WHERE sha256 IS NOT NULL;

-- ============================================
-- RLS POLICIES (Solo Master puede ver todo)
-- ============================================

ALTER TABLE inbound_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_email_attachments ENABLE ROW LEVEL SECURITY;

-- Master puede ver todo
CREATE POLICY inbound_emails_master_all ON inbound_emails
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

CREATE POLICY inbound_email_attachments_master_all ON inbound_email_attachments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- Broker puede ver solo emails vinculados a sus casos (implementar después cuando exista case_emails)

-- ============================================
-- COMENTARIOS
-- ============================================

COMMENT ON TABLE inbound_emails IS 'Correos entrantes desde Zoho IMAP con normalización y tracking de procesamiento';
COMMENT ON COLUMN inbound_emails.message_id IS 'Message-ID único del correo (RFC 5322) para deduplicación';
COMMENT ON COLUMN inbound_emails.subject_normalized IS 'Asunto limpio (sin Re:, Fwd:, etc) para agrupación';
COMMENT ON COLUMN inbound_emails.body_text_normalized IS 'Texto limpio sin firmas ni hilos largos, optimizado para AI';
COMMENT ON COLUMN inbound_emails.processed_status IS 'Estado: new|classified|linked|ignored|error';
COMMENT ON TABLE inbound_email_attachments IS 'Adjuntos de correos con storage en Supabase';
