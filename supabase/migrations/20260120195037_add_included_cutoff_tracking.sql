-- Agregar campo para rastrear transferencias incluidas en otros cortes
-- Esto permite buscar transferencias incluidas de manera confiable sin depender de notes_internal

ALTER TABLE bank_transfers_comm
ADD COLUMN included_in_cutoff_id UUID REFERENCES bank_cutoffs(id);

-- Comentario explicativo
COMMENT ON COLUMN bank_transfers_comm.included_in_cutoff_id IS 'ID del corte bancario en el cual esta transferencia fue incluida (si fue incluida desde otro corte)';

-- Crear índice para mejorar performance de búsquedas
CREATE INDEX idx_bank_transfers_included_in_cutoff ON bank_transfers_comm(included_in_cutoff_id) WHERE included_in_cutoff_id IS NOT NULL;

-- Migrar datos existentes: intentar recuperar included_in_cutoff_id desde notes_internal
UPDATE bank_transfers_comm
SET included_in_cutoff_id = (
  SELECT bc.id
  FROM bank_cutoffs bc
  WHERE bank_transfers_comm.notes_internal LIKE '%Incluida en corte: ' || 
    TO_CHAR(bc.start_date, 'DD/MM/YYYY') || ' - ' || 
    TO_CHAR(bc.end_date, 'DD/MM/YYYY') || '%'
  LIMIT 1
)
WHERE notes_internal LIKE '%Incluida en corte:%'
  AND included_in_cutoff_id IS NULL;
