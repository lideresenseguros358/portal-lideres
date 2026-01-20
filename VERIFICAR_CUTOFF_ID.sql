-- VERIFICAR QUE EL cutoff_id DE ASSISTCARD NO SEA EL DEL CORTE DONDE FUE INCLUIDA

-- 1. Ver qué cutoff_id tiene ASSISTCARD actualmente
SELECT 
  id,
  reference_number,
  amount,
  cutoff_id,
  notes_internal
FROM bank_transfers_comm
WHERE id = 'b7e00d39-5aaa-4454-9008-10b01c360d0b';

-- 2. Ver qué ID tiene el corte del 17/12/2025 - 03/01/2026
SELECT 
  id,
  start_date,
  end_date
FROM bank_cutoffs
WHERE start_date = '2025-12-17' AND end_date = '2026-01-03';

-- 3. Simular exactamente lo que hace la búsqueda del servidor
-- Reemplaza 'CUTOFF_ID_AQUI' con el ID del corte que obtuviste arriba
/*
SELECT 
  id,
  reference_number,
  amount,
  description_raw,
  cutoff_id
FROM bank_transfers_comm
WHERE notes_internal LIKE '%Incluida en corte: 12/17/2025 - 1/3/2026%'
  AND cutoff_id != 'CUTOFF_ID_AQUI'
  AND id = 'b7e00d39-5aaa-4454-9008-10b01c360d0b';
*/
