-- Agregar tipo de notificación 'agenda_event' al enum
-- Este tipo se usa para notificar sobre creación o cambio de eventos en la agenda

-- Agregar el nuevo valor al enum notification_type
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'agenda_event';

-- Comentario explicativo
COMMENT ON TYPE notification_type IS 'Tipos de notificación: renewal, case_digest, commission, delinquency, download, guide, carnet_renewal, agenda_event, other';
