-- Script para formatear nombres de corredores a Title Case (Primera letra mayúscula, demás minúsculas)
-- Fecha: 2026-01-16

-- Función para convertir a Title Case en PostgreSQL
-- Convierte cada palabra: primera letra mayúscula, resto minúscula

UPDATE brokers
SET name = INITCAP(LOWER(name))
WHERE name IS NOT NULL;

-- Verificar resultados
SELECT id, name, email 
FROM brokers 
ORDER BY name;
