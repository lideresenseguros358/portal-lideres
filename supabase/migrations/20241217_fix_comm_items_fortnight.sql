-- Migración: Asignar fortnight_id a comm_items existentes
-- Fecha: 2024-12-17
-- Problema: comm_items importados antes del fix no tienen fortnight_id asignado

-- Actualizar comm_items existentes basándose en su comm_imports
UPDATE comm_items ci
SET fortnight_id = imp.fortnight_id
FROM comm_imports imp
WHERE ci.import_id = imp.id
  AND ci.fortnight_id IS NULL;

-- Verificar que todos los comm_items ahora tienen fortnight_id
-- (Esta query debe retornar 0 filas)
SELECT COUNT(*) as items_sin_fortnight
FROM comm_items
WHERE fortnight_id IS NULL;
