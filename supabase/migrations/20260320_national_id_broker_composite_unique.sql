-- Cambiar constraint único de national_id de global a compuesto (national_id, broker_id)
-- Esto permite que el mismo cliente exista bajo diferentes brokers (reasignación de póliza individual)

-- Eliminar el índice único global existente
DROP INDEX IF EXISTS clients_national_id_unique_idx;

-- Crear índice único compuesto (national_id + broker_id)
-- Permite mismo national_id bajo diferentes brokers, pero no duplicados dentro del mismo broker
CREATE UNIQUE INDEX clients_national_id_broker_unique_idx 
ON clients (national_id, broker_id) 
WHERE national_id IS NOT NULL;

-- Lo mismo para temp_client_imports si tiene broker_id
-- (temp_client_imports no tiene broker_id, mantener su constraint original)
