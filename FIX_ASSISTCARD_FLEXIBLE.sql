-- SOLUCIÓN FLEXIBLE: Actualizar nota de ASSISTCARD con TODOS los formatos posibles
-- Para que funcione sin importar el formato de fecha que busque el código

UPDATE bank_transfers_comm
SET notes_internal = '🔗 Incluida en corte: 17/12/2025 - 3/1/2026 (20/01/2026) | Pagado manualmente - 20-01-26 - Marcado desde transferencias incluidas'
WHERE id = 'b7e00d39-5aaa-4454-9008-10b01c360d0b';

-- Verificar
SELECT 
  id,
  reference_number,
  amount,
  notes_internal
FROM bank_transfers_comm
WHERE id = 'b7e00d39-5aaa-4454-9008-10b01c360d0b';

-- Ahora verificar si el patrón de búsqueda la encuentra
-- (Simular lo que hace el código en el servidor)
SELECT 
  id,
  reference_number,
  amount,
  description_raw
FROM bank_transfers_comm
WHERE notes_internal LIKE '%Incluida en corte: 17/12/2025 - 3/1/2026%'
  AND id = 'b7e00d39-5aaa-4454-9008-10b01c360d0b';
