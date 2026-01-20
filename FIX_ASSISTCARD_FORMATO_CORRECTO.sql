-- CORREGIR ASSISTCARD CON FORMATO AMERICANO MM/DD/YYYY
-- El código usa toLocaleDateString('es-PA') que produce formato americano

-- Corte donde se incluyó: 17/12/2025 - 03/01/2026
-- En formato americano: 12/17/2025 - 1/3/2026 (sin ceros iniciales)

UPDATE bank_transfers_comm
SET notes_internal = '🔗 Incluida en corte: 12/17/2025 - 1/3/2026 (20/01/2026) | Pagado manualmente - 20-01-26 - Marcado desde transferencias incluidas'
WHERE id = 'b7e00d39-5aaa-4454-9008-10b01c360d0b';

-- Verificar
SELECT 
  id,
  reference_number,
  amount,
  description_raw,
  notes_internal
FROM bank_transfers_comm
WHERE id = 'b7e00d39-5aaa-4454-9008-10b01c360d0b';
