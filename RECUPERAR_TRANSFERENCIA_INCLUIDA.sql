-- SCRIPT PARA RECUPERAR TRANSFERENCIA INCLUIDA QUE PERDIÓ SU MARCADOR
-- Ejecuta esto en Supabase SQL Editor para encontrar la transferencia

-- 1. Listar transferencias PAGADAS recientemente que NO tienen marcador de inclusión
SELECT 
  t.id,
  t.reference_number,
  t.date,
  t.amount,
  t.description_raw,
  t.status,
  t.notes_internal,
  t.cutoff_id,
  bc.start_date as cutoff_start,
  bc.end_date as cutoff_end,
  i.name as insurer_name
FROM bank_transfers_comm t
LEFT JOIN bank_cutoffs bc ON t.cutoff_id = bc.id
LEFT JOIN insurers i ON t.insurer_assigned_id = i.id
WHERE t.status = 'PAGADO'
  AND t.notes_internal LIKE '%Pagado manualmente%'
  AND t.notes_internal NOT LIKE '%Incluida en corte:%'
  AND t.updated_at >= (NOW() - INTERVAL '7 days') -- Últimos 7 días
ORDER BY t.updated_at DESC;

-- 2. Una vez identifiques la transferencia, REEMPLAZA los valores y ejecuta esto:
-- IMPORTANTE: Reemplaza 'TRANSFER_ID_AQUI' con el ID real de la transferencia
--            Reemplaza 'FECHA_INICIO' y 'FECHA_FIN' con las fechas del corte donde fue incluida

/*
UPDATE bank_transfers_comm
SET notes_internal = notes_internal || E'\n📌 Incluida en corte: FECHA_INICIO - FECHA_FIN (' || TO_CHAR(NOW(), 'DD/MM/YYYY') || ')'
WHERE id = 'TRANSFER_ID_AQUI';
*/

-- Ejemplo de cómo debe quedar:
-- UPDATE bank_transfers_comm
-- SET notes_internal = notes_internal || E'\n📌 Incluida en corte: 12/04/2025 - 12/17/2025 (20/01/2026)'
-- WHERE id = '123e4567-e89b-12d3-a456-426614174000';
