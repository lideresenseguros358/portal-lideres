-- Migration: Add carnet_renewal to notification_type enum
-- Descripción: Agrega el tipo 'carnet_renewal' al enum notification_type
-- para soportar notificaciones de renovación de carnet de corredores

-- Agregar nuevo valor al enum notification_type
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'carnet_renewal';

-- Comentario para documentar el cambio
COMMENT ON TYPE notification_type IS 'Tipos de notificación: renewal (renovación póliza), case_digest (resumen casos), commission (comisión pagada), delinquency (morosidad), download (descarga), guide (guía), carnet_renewal (renovación carnet), other (otro)';
