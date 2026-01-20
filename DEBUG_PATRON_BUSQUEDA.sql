-- VERIFICAR QUÉ PATRÓN EXACTO ESTÁ BUSCANDO EL CÓDIGO

-- El corte donde se incluyó ASSISTCARD es: 17/12/2025 - 03/01/2026
-- Verificar qué formato de fecha tiene ASSISTCARD actualmente

SELECT 
  id,
  reference_number,
  amount,
  description_raw,
  notes_internal,
  LENGTH(notes_internal) as nota_length
FROM bank_transfers_comm
WHERE id = 'b7e00d39-5aaa-4454-9008-10b01c360d0b';

-- Verificar qué tienen MAPFRE y UNIVVIR que SÍ aparecen
SELECT 
  id,
  reference_number,
  amount,
  description_raw,
  SUBSTRING(notes_internal, 1, 100) as primeros_100_chars
FROM bank_transfers_comm
WHERE reference_number IN ('294481858', '274982956')
ORDER BY reference_number;

-- Buscar TODAS las transferencias que tengan "Incluida en corte" en sus notas
-- sin importar el formato exacto
SELECT 
  id,
  reference_number,
  amount,
  description_raw,
  cutoff_id,
  SUBSTRING(notes_internal, 1, 150) as nota_inicio
FROM bank_transfers_comm
WHERE notes_internal LIKE '%Incluida en corte%'
  AND cutoff_id != (SELECT id FROM bank_cutoffs WHERE start_date = '2025-12-17' AND end_date = '2026-01-03')
ORDER BY date DESC
LIMIT 10;
