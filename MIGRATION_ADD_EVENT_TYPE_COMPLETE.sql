-- ================================================================
-- MIGRACIÓN: Agregar campo event_type a tabla events
-- Incluye: normal, oficina_cerrada, oficina_virtual
-- ================================================================

-- 1. Crear tipo enum con TODOS los valores
DO $$ BEGIN
    CREATE TYPE event_type_enum AS ENUM ('normal', 'oficina_cerrada', 'oficina_virtual');
EXCEPTION
    WHEN duplicate_object THEN 
        -- Si el enum ya existe, agregar el valor faltante
        ALTER TYPE event_type_enum ADD VALUE IF NOT EXISTS 'oficina_virtual';
END $$;

-- 2. Agregar columna event_type con valor por defecto 'normal'
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS event_type event_type_enum DEFAULT 'normal' NOT NULL;

-- 3. Actualizar eventos existentes para que sean tipo 'normal' si es NULL
UPDATE events 
SET event_type = 'normal' 
WHERE event_type IS NULL;

-- 4. Crear índice para mejorar performance de queries filtradas por tipo
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);

-- ================================================================
-- VERIFICACIÓN: Ver estructura de la columna creada
-- ================================================================

SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'events' 
AND column_name = 'event_type';

-- Ver valores permitidos en el enum
SELECT 
    enumlabel 
FROM pg_enum 
WHERE enumtypid = 'event_type_enum'::regtype
ORDER BY enumsortorder;
