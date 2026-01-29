-- CORREGIR TODAS LAS PÓLIZAS CON BROKER_ID DESAJUSTADO
-- Este script sincroniza policies.broker_id con clients.broker_id

-- Actualizar todas las pólizas para que coincidan con el broker_id del cliente
UPDATE policies
SET broker_id = (
  SELECT broker_id 
  FROM clients 
  WHERE clients.id = policies.client_id
)
WHERE broker_id != (
  SELECT broker_id 
  FROM clients 
  WHERE clients.id = policies.client_id
);

-- Verificar cuántas filas se actualizaron
-- Debe retornar el número de pólizas corregidas
SELECT COUNT(*) as polizas_corregidas
FROM policies p
WHERE p.broker_id != (
  SELECT c.broker_id 
  FROM clients c 
  WHERE c.id = p.client_id
);

-- Si retorna 0, todas las pólizas están sincronizadas ✓
