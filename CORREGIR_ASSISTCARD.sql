-- RESTAURAR MARCADOR DE INCLUSIÓN PARA TRANSFERENCIA ASSISTCARD
-- ID: b7e00d39-5aaa-4454-9008-10b01c360d0b
-- Referencia: 228195023
-- Monto: $56.70

-- Esta transferencia perdió su marcador cuando se marcó como PAGADA antes del fix
-- Ahora solo dice "Pagado manualmente - 20-01-26 - Marcado desde transferencias incluidas"
-- Necesita agregar el marcador completo

UPDATE bank_transfers_comm
SET notes_internal = notes_internal || E'\n📌 Incluida en corte: 17/12/2025 - 03/01/2026 (20/01/2026)'
WHERE id = 'b7e00d39-5aaa-4454-9008-10b01c360d0b'
  AND notes_internal NOT LIKE '%Incluida en corte:%';

-- Verificar que se agregó correctamente
SELECT 
  id,
  reference_number,
  amount,
  description_raw,
  status,
  notes_internal
FROM bank_transfers_comm
WHERE id = 'b7e00d39-5aaa-4454-9008-10b01c360d0b';
