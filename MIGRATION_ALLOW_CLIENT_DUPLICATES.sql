-- =====================================================
-- PERMITIR CLIENTES DUPLICADOS POR BROKER
-- =====================================================
-- Este script modifica el constraint único de clients
-- para permitir múltiples clientes con la misma cédula
-- SOLO si tienen broker_id diferente.
-- =====================================================

-- 1. Eliminar el índice único actual en national_id
DROP INDEX IF EXISTS clients_national_id_unique_idx;

-- 2. Crear nuevo índice único compuesto: (national_id, broker_id)
-- Esto permite la misma cédula con diferente broker, pero NO permite duplicados exactos
CREATE UNIQUE INDEX IF NOT EXISTS clients_national_id_broker_id_unique_idx 
ON clients (national_id, broker_id)
WHERE national_id IS NOT NULL;

-- Verificación
SELECT 
  indexname, 
  indexdef 
FROM pg_indexes 
WHERE tablename = 'clients' 
  AND indexname LIKE '%national_id%';
