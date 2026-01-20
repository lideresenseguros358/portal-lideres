-- CORREGIR FORMATO DE FECHA EN MARCADOR DE INCLUSIÓN PARA TRANSFERENCIA UNIVVIR

-- La transferencia tiene el marcador pero en formato americano (MM/DD/YYYY)
-- Necesita formato español (DD/MM/YYYY) para que la búsqueda funcione

-- Primero, buscar la transferencia por referencia y monto
SELECT 
  id,
  reference_number,
  date,
  amount,
  description_raw,
  status,
  notes_internal
FROM bank_transfers_comm
WHERE reference_number = '274982956'
  AND amount = 385.28;

-- Luego, actualizar el notes_internal corrigiendo el formato de fecha
-- REEMPLAZA 'ID_DE_LA_TRANSFERENCIA' con el ID que obtengas arriba

UPDATE bank_transfers_comm
SET notes_internal = REPLACE(
  notes_internal,
  '12/17/2025 - 01/03/2026',
  '17/12/2025 - 03/01/2026'
)
WHERE reference_number = '274982956'
  AND amount = 385.28;

-- Verificar que se corrigió
SELECT 
  id,
  reference_number,
  amount,
  notes_internal
FROM bank_transfers_comm
WHERE reference_number = '274982956'
  AND amount = 385.28;
