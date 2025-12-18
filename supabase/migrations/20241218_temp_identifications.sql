-- Tabla para identificaciones temporales en zona de trabajo de Nueva Quincena
-- Los clientes sin identificar se guardan aquí durante el draft
-- Solo se migran a pending_items o comm_items al confirmar pagado

CREATE TABLE IF NOT EXISTS draft_unidentified_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fortnight_id UUID NOT NULL REFERENCES fortnights(id) ON DELETE CASCADE,
  import_id UUID NOT NULL REFERENCES comm_imports(id) ON DELETE CASCADE,
  insurer_id UUID NOT NULL REFERENCES insurers(id),
  policy_number TEXT NOT NULL,
  insured_name TEXT,
  commission_raw NUMERIC(12,2) NOT NULL DEFAULT 0,
  raw_row TEXT,
  
  -- Identificación temporal (puede cambiar mientras está en draft)
  temp_assigned_broker_id UUID REFERENCES brokers(id),
  temp_assigned_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_draft_item UNIQUE(fortnight_id, import_id, policy_number, insured_name)
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_draft_unidentified_fortnight ON draft_unidentified_items(fortnight_id);
CREATE INDEX IF NOT EXISTS idx_draft_unidentified_import ON draft_unidentified_items(import_id);
CREATE INDEX IF NOT EXISTS idx_draft_unidentified_broker ON draft_unidentified_items(temp_assigned_broker_id);
CREATE INDEX IF NOT EXISTS idx_draft_unidentified_policy ON draft_unidentified_items(policy_number);

-- RLS: Solo MASTER puede ver/modificar
ALTER TABLE draft_unidentified_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only MASTER can view draft unidentified"
  ON draft_unidentified_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

CREATE POLICY "Only MASTER can insert draft unidentified"
  ON draft_unidentified_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

CREATE POLICY "Only MASTER can update draft unidentified"
  ON draft_unidentified_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

CREATE POLICY "Only MASTER can delete draft unidentified"
  ON draft_unidentified_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- Función para contar sin identificar por quincena
CREATE OR REPLACE FUNCTION count_draft_unidentified(p_fortnight_id UUID)
RETURNS TABLE(
  total_count BIGINT,
  identified_count BIGINT,
  unidentified_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_count,
    COUNT(temp_assigned_broker_id)::BIGINT as identified_count,
    COUNT(CASE WHEN temp_assigned_broker_id IS NULL THEN 1 END)::BIGINT as unidentified_count
  FROM draft_unidentified_items
  WHERE fortnight_id = p_fortnight_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE draft_unidentified_items IS 
'Zona de trabajo temporal para clientes sin identificar en Nueva Quincena. 
Se migran a pending_items o comm_items solo al confirmar PAGADO.';

COMMENT ON COLUMN draft_unidentified_items.temp_assigned_broker_id IS 
'Broker asignado temporalmente durante el draft. Puede cambiar o removerse.';

COMMENT ON COLUMN draft_unidentified_items.commission_raw IS 
'Comisión cruda SIN aplicar porcentaje. Se calcula al migrar a comm_items.';
