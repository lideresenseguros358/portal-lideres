-- REORGANIZAR NOTAS DE ASSISTCARD PARA QUE EL MARCADOR ESTÉ AL PRINCIPIO
-- Como MAPFRE que funciona correctamente

-- La transferencia ASSISTCARD tiene las notas en orden incorrecto:
-- ❌ "Pagado manualmente - 20-01-26 - Marcado desde transferencias incluidas 🔗 Incluida en corte: 17/12/2025 - 03/01/2026 (20/01/2026)"
-- 
-- Debe ser:
-- ✅ "🔗 Incluida en corte: 17/12/2025 - 03/01/2026 (20/01/2026) | Pagado manualmente - 20-01-26 - Marcado desde transferencias incluidas"

UPDATE bank_transfers_comm
SET notes_internal = '🔗 Incluida en corte: 17/12/2025 - 03/01/2026 (20/01/2026) | Pagado manualmente - 20-01-26 - Marcado desde transferencias incluidas'
WHERE id = 'b7e00d39-5aaa-4454-9008-10b01c360d0b';

-- Verificar que se corrigió
SELECT 
  id,
  reference_number,
  amount,
  description_raw,
  status,
  notes_internal
FROM bank_transfers_comm
WHERE id = 'b7e00d39-5aaa-4454-9008-10b01c360d0b';
