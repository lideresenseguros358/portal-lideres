-- Agregar campo event_type a tabla events para diferenciar eventos normales de días de oficina cerrada

-- 1. Crear tipo enum si no existe
DO $$ BEGIN
    CREATE TYPE event_type_enum AS ENUM ('normal', 'oficina_cerrada');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Agregar columna event_type con valor por defecto 'normal'
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS event_type event_type_enum DEFAULT 'normal' NOT NULL;

-- 3. Actualizar eventos existentes para que sean tipo 'normal'
UPDATE events 
SET event_type = 'normal' 
WHERE event_type IS NULL;

-- 4. Crear índice para mejorar performance de queries filtradas por tipo
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);

-- Verificar
SELECT 
    column_name, 
    data_type, 
    column_default 
FROM information_schema.columns 
WHERE table_name = 'events' 
AND column_name = 'event_type';
