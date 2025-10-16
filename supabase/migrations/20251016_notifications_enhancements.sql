-- =====================================================
-- NOTIFICACIONES - MEJORAS COMPLETAS
-- Created: 2025-10-16
-- Description: Agregar metadata, tipos, idempotencia y toggle de renovaciones
-- =====================================================

-- 1. Crear ENUM para tipos de notificación
CREATE TYPE notification_type AS ENUM (
  'renewal',
  'case_digest',
  'commission',
  'delinquency',
  'download',
  'guide',
  'other'
);

-- 2. Agregar columnas a tabla notifications
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notification_type notification_type DEFAULT 'other';

-- Crear índices para performance
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_email_sent ON notifications(email_sent);
CREATE INDEX IF NOT EXISTS idx_notifications_meta ON notifications USING GIN(meta);

-- 3. Crear tabla para idempotencia (evitar duplicados)
CREATE TABLE IF NOT EXISTS notification_uniques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hash TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_notif_uniques_hash ON notification_uniques(hash);
CREATE INDEX IF NOT EXISTS idx_notif_uniques_created ON notification_uniques(created_at);

-- Comentarios para documentación
COMMENT ON TABLE notification_uniques IS 'Tabla para prevenir notificaciones duplicadas usando hashes únicos';
COMMENT ON COLUMN notification_uniques.hash IS 'Hash único por notificación (tipo-entity-condición-fecha)';

-- 4. Agregar columna para toggle de notificaciones de renovación en profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS notify_broker_renewals BOOLEAN DEFAULT false;

-- Índice si necesitamos filtrar por este campo
CREATE INDEX IF NOT EXISTS idx_profiles_notify_renewals ON profiles(notify_broker_renewals);

-- Comentario
COMMENT ON COLUMN profiles.notify_broker_renewals IS 'Si true, el Master recibe notificaciones de renovaciones de este broker';

-- 5. Función para limpiar hashes antiguos (opcional, ejecutar periódicamente)
-- Mantener solo últimos 90 días para evitar que crezca indefinidamente
CREATE OR REPLACE FUNCTION cleanup_old_notification_hashes()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM notification_uniques
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

COMMENT ON FUNCTION cleanup_old_notification_hashes IS 'Elimina hashes de notificaciones más antiguos de 90 días';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
