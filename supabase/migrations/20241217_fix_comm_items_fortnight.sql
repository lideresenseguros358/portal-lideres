-- Migración: Agregar columna fortnight_id a comm_items y poblarla
-- Fecha: 2024-12-17
-- Problema: comm_items no tiene columna fortnight_id, necesaria para filtrar por quincena

-- 1. Agregar columna fortnight_id a comm_items
ALTER TABLE comm_items
ADD COLUMN IF NOT EXISTS fortnight_id UUID REFERENCES fortnights(id) ON DELETE CASCADE;

-- 2. Crear índice para mejor performance
CREATE INDEX IF NOT EXISTS idx_comm_items_fortnight_id ON comm_items(fortnight_id);

-- 3. Actualizar comm_items existentes basándose en su comm_imports
UPDATE comm_items ci
SET fortnight_id = imp.fortnight_id
FROM comm_imports imp
WHERE ci.import_id = imp.id
  AND ci.fortnight_id IS NULL;

-- 4. Verificar que todos los comm_items ahora tienen fortnight_id
-- (Esta query debe retornar 0 filas si todo está bien)
SELECT COUNT(*) as items_sin_fortnight
FROM comm_items
WHERE fortnight_id IS NULL;
