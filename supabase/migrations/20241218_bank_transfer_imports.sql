-- Migración: Permitir vincular transfers individuales con imports (dividir)
-- Fecha: 2024-12-18
-- Problema: No existe tabla para vincular transfers individuales con imports
-- Solución: Crear bank_transfer_imports similar a bank_group_imports

-- 1. TABLA: bank_transfer_imports
-- Vincula transferencias bancarias individuales con imports de comisiones
-- Permite que UNA transferencia pueda dividirse en MÚLTIPLES reportes
CREATE TABLE IF NOT EXISTS public.bank_transfer_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES bank_transfers_comm(id) ON DELETE CASCADE,
  import_id UUID NOT NULL REFERENCES comm_imports(id) ON DELETE CASCADE,
  amount_assigned NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- NO unique constraint en transfer_id para permitir múltiples imports por transfer
  CONSTRAINT unique_transfer_import UNIQUE(transfer_id, import_id)
);

-- 2. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_bank_transfer_imports_transfer ON bank_transfer_imports(transfer_id);
CREATE INDEX IF NOT EXISTS idx_bank_transfer_imports_import ON bank_transfer_imports(import_id);

-- 3. RLS (Row Level Security) - Solo MASTER
ALTER TABLE bank_transfer_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only MASTER can access bank_transfer_imports"
  ON bank_transfer_imports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'master'
    )
  );

-- 4. COMENTARIOS
COMMENT ON TABLE bank_transfer_imports IS 'Vincula transferencias individuales con imports de comisiones - permite dividir una transfer en múltiples reportes';
COMMENT ON COLUMN bank_transfer_imports.amount_assigned IS 'Monto asignado a este import específico';

-- 5. FUNCIÓN HELPER: Calcular total usado de una transferencia
CREATE OR REPLACE FUNCTION get_transfer_total_used(p_transfer_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_total NUMERIC := 0;
BEGIN
  -- Sumar todos los imports vinculados directamente a esta transfer
  SELECT COALESCE(SUM(amount_assigned), 0)
  INTO v_total
  FROM bank_transfer_imports
  WHERE transfer_id = p_transfer_id;
  
  RETURN v_total;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_transfer_total_used IS 'Calcula el total usado de una transferencia sumando todos los imports vinculados';
