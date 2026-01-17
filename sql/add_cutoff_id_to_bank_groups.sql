-- Agregar columna cutoff_id a bank_groups para asociar grupos con cortes bancarios
-- Esta columna permite identificar a qué corte pertenece un grupo de transferencias

ALTER TABLE bank_groups 
ADD COLUMN cutoff_id UUID REFERENCES bank_cutoffs(id) ON DELETE SET NULL;

-- Crear índice para mejorar performance en queries que filtran por cutoff_id
CREATE INDEX idx_bank_groups_cutoff_id ON bank_groups(cutoff_id);

-- Comentario explicativo
COMMENT ON COLUMN bank_groups.cutoff_id IS 'Corte bancario al que pertenece este grupo. Permite filtrar grupos por período de corte.';
