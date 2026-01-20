-- SOLUCIÓN FINAL: Agregar cero inicial al mes en la fecha
-- El servidor busca: 12/17/2025 - 01/03/2026 (con 01 no 1)

UPDATE bank_transfers_comm
SET notes_internal = '🔗 Incluida en corte: 12/17/2025 - 01/03/2026 (20/01/2026) | Pagado manualmente - 20-01-26 - Marcado desde transferencias incluidas'
WHERE id = 'b7e00d39-5aaa-4454-9008-10b01c360d0b';

-- Verificar
SELECT 
  id,
  reference_number,
  amount,
  notes_internal
FROM bank_transfers_comm
WHERE id = 'b7e00d39-5aaa-4454-9008-10b01c360d0b';
