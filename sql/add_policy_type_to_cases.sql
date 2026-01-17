-- Migración completa para casos (Pendientes/Trámites)
-- Agrega columnas necesarias para el wizard modal de nuevos casos

-- Crear tipo ENUM para policy_type
DO $$ BEGIN
  CREATE TYPE policy_type_enum AS ENUM (
    'AUTO',
    'VIDA',
    'SALUD',
    'INCENDIO',
    'TODO_RIESGO',
    'RESPONSABILIDAD_CIVIL',
    'ACCIDENTES_PERSONALES',
    'OTROS'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Agregar columna policy_type a cases (nullable para casos existentes)
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS policy_type policy_type_enum;

-- Agregar columna seen_by_broker (indica si el broker ha visto el caso)
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS seen_by_broker BOOLEAN DEFAULT false;

-- Agregar columna payment_method si no existe
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- Crear índice para mejorar performance en búsquedas por tipo de póliza
CREATE INDEX IF NOT EXISTS idx_cases_policy_type ON cases(policy_type);

-- Crear índice para casos no vistos por broker
CREATE INDEX IF NOT EXISTS idx_cases_seen_by_broker ON cases(broker_id, seen_by_broker) WHERE seen_by_broker = false;

-- Comentarios para documentación
COMMENT ON COLUMN cases.policy_type IS 'Tipo de póliza del caso - determina documentos requeridos en el checklist';
COMMENT ON COLUMN cases.seen_by_broker IS 'Indica si el broker ha visualizado el caso (para notificaciones)';
COMMENT ON COLUMN cases.payment_method IS 'Forma de pago de la póliza (efectivo, transferencia, tarjeta, etc.)';

-- Actualizar casos existentes para marcarlos como vistos
UPDATE cases 
SET seen_by_broker = true 
WHERE seen_by_broker IS NULL;
