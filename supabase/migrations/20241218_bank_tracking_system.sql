-- Migración: Sistema de tracking para transferencias bancarias entre quincenas
-- Fecha: 2024-12-18
-- Objetivo: Rastrear origen de transferencia y quincena donde se pagó

-- 1. Agregar campos de tracking a bank_transfer_imports
ALTER TABLE bank_transfer_imports
  ADD COLUMN IF NOT EXISTS cutoff_origin_id UUID REFERENCES bank_cutoffs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fortnight_paid_id UUID REFERENCES fortnights(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN DEFAULT false;

-- 2. Agregar campos de tracking a bank_group_imports  
ALTER TABLE bank_group_imports
  ADD COLUMN IF NOT EXISTS cutoff_origin_id UUID REFERENCES bank_cutoffs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fortnight_paid_id UUID REFERENCES fortnights(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN DEFAULT false;

-- 3. Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_bank_transfer_imports_cutoff_origin ON bank_transfer_imports(cutoff_origin_id);
CREATE INDEX IF NOT EXISTS idx_bank_transfer_imports_fortnight_paid ON bank_transfer_imports(fortnight_paid_id);
CREATE INDEX IF NOT EXISTS idx_bank_transfer_imports_temporary ON bank_transfer_imports(is_temporary);

CREATE INDEX IF NOT EXISTS idx_bank_group_imports_cutoff_origin ON bank_group_imports(cutoff_origin_id);
CREATE INDEX IF NOT EXISTS idx_bank_group_imports_fortnight_paid ON bank_group_imports(fortnight_paid_id);
CREATE INDEX IF NOT EXISTS idx_bank_group_imports_temporary ON bank_group_imports(is_temporary);

-- 4. Comentarios
COMMENT ON COLUMN bank_transfer_imports.cutoff_origin_id IS 'ID del corte bancario de donde proviene la transferencia';
COMMENT ON COLUMN bank_transfer_imports.fortnight_paid_id IS 'ID de la quincena donde se pagó/confirmó definitivamente';
COMMENT ON COLUMN bank_transfer_imports.notes IS 'Anotaciones sobre origen y destino de la transferencia';
COMMENT ON COLUMN bank_transfer_imports.is_temporary IS 'True si el vínculo es temporal (quincena no confirmada)';

COMMENT ON COLUMN bank_group_imports.cutoff_origin_id IS 'ID del corte bancario de donde proviene el grupo';
COMMENT ON COLUMN bank_group_imports.fortnight_paid_id IS 'ID de la quincena donde se pagó/confirmó definitivamente';
COMMENT ON COLUMN bank_group_imports.notes IS 'Anotaciones sobre origen y destino del grupo';
COMMENT ON COLUMN bank_group_imports.is_temporary IS 'True si el vínculo es temporal (quincena no confirmada)';

-- 5. Función helper: Obtener transferencias pendientes (sin importar corte)
CREATE OR REPLACE FUNCTION get_pending_transfers()
RETURNS TABLE (
  transfer_id UUID,
  cutoff_id UUID,
  cutoff_name TEXT,
  amount NUMERIC,
  date DATE,
  description TEXT,
  reference_number TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bt.id as transfer_id,
    bt.cutoff_id,
    'Corte ' || TO_CHAR(bc.start_date, 'DD/MM/YYYY') || ' - ' || TO_CHAR(bc.end_date, 'DD/MM/YYYY') as cutoff_name,
    bt.amount,
    bt.date,
    bt.description_raw as description,
    bt.reference_number
  FROM bank_transfers_comm bt
  JOIN bank_cutoffs bc ON bt.cutoff_id = bc.id
  WHERE bt.status IN ('PENDIENTE', 'OK_CONCILIADO')
    AND NOT EXISTS (
      SELECT 1 FROM bank_transfer_imports bti
      WHERE bti.transfer_id = bt.id AND bti.is_temporary = false
    )
  ORDER BY bt.date DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_pending_transfers IS 'Obtiene todas las transferencias PENDIENTES u OK_CONCILIADO que no han sido usadas (pagadas) definitivamente';

-- 6. Función helper: Obtener grupos pendientes (sin importar estado)
CREATE OR REPLACE FUNCTION get_pending_groups()
RETURNS TABLE (
  group_id UUID,
  group_name TEXT,
  total_amount NUMERIC,
  status TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bg.id as group_id,
    bg.name as group_name,
    bg.total_amount,
    bg.status,
    bg.created_at
  FROM bank_groups bg
  WHERE bg.status IN ('EN_PROCESO', 'OK_CONCILIADO')
    AND NOT EXISTS (
      SELECT 1 FROM bank_group_imports bgi
      WHERE bgi.group_id = bg.id AND bgi.is_temporary = false
    )
  ORDER BY bg.created_at DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_pending_groups IS 'Obtiene todos los grupos EN_PROCESO u OK_CONCILIADO que no han sido usados (pagados) definitivamente';
