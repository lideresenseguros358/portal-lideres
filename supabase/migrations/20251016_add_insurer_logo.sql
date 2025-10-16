-- Migration: Add logo_url to insurers table
-- Descripción: Agrega campo para almacenar la URL del logo de cada aseguradora

-- Agregar columna logo_url a la tabla insurers
ALTER TABLE insurers 
ADD COLUMN logo_url TEXT NULL;

-- Comentario para documentar el campo
COMMENT ON COLUMN insurers.logo_url IS 'URL del logo de la aseguradora almacenado en Supabase Storage (bucket: insurer-logos)';

-- Índice para búsquedas
CREATE INDEX IF NOT EXISTS idx_insurers_logo_url ON insurers(logo_url) WHERE logo_url IS NOT NULL;
