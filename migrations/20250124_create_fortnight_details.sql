-- ============================================================================
-- MIGRACIÓN: Crear tabla fortnight_details
-- FECHA: 2025-01-24
-- PROPÓSITO: Guardar el detalle completo de cada cliente/póliza pagada en cada quincena
-- ============================================================================

-- 1. Crear tabla fortnight_details
CREATE TABLE IF NOT EXISTS fortnight_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fortnight_id UUID NOT NULL REFERENCES fortnights(id) ON DELETE CASCADE,
  broker_id UUID NOT NULL REFERENCES brokers(id),
  insurer_id UUID NOT NULL REFERENCES insurers(id),
  policy_id UUID REFERENCES policies(id),
  client_id UUID REFERENCES clients(id),
  
  -- Datos del cliente/póliza
  policy_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  ramo TEXT,
  
  -- Montos y cálculos
  commission_raw NUMERIC NOT NULL,  -- Monto original del reporte (sin % aplicado)
  percent_applied NUMERIC NOT NULL,  -- Porcentaje aplicado (0.85, 1.0, etc.)
  commission_calculated NUMERIC NOT NULL,  -- commission_raw * percent_applied
  
  -- Metadata
  is_assa_code BOOLEAN DEFAULT FALSE,  -- TRUE si es código ASSA (PJ750-XX)
  assa_code TEXT,  -- Código ASSA si aplica
  source_import_id UUID REFERENCES comm_imports(id),
  
  -- Auditoría
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraint para evitar duplicados
  CONSTRAINT unique_fortnight_policy_broker UNIQUE(fortnight_id, policy_number, broker_id)
);

-- 2. Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_fortnight_details_fortnight ON fortnight_details(fortnight_id);
CREATE INDEX IF NOT EXISTS idx_fortnight_details_broker ON fortnight_details(broker_id);
CREATE INDEX IF NOT EXISTS idx_fortnight_details_insurer ON fortnight_details(insurer_id);
CREATE INDEX IF NOT EXISTS idx_fortnight_details_policy ON fortnight_details(policy_id);
CREATE INDEX IF NOT EXISTS idx_fortnight_details_client ON fortnight_details(client_id);

-- 3. Comentarios para documentación
COMMENT ON TABLE fortnight_details IS 'Detalle completo de cada cliente/póliza pagada en cada quincena cerrada';
COMMENT ON COLUMN fortnight_details.commission_raw IS 'Monto original del reporte antes de aplicar porcentaje de comisión';
COMMENT ON COLUMN fortnight_details.percent_applied IS 'Porcentaje aplicado al broker (ej: 0.85 para 85%, 1.0 para 100%)';
COMMENT ON COLUMN fortnight_details.commission_calculated IS 'Comisión final calculada (raw * percent_applied)';
COMMENT ON COLUMN fortnight_details.is_assa_code IS 'TRUE si este detalle corresponde a un código ASSA (no una póliza regular)';
COMMENT ON COLUMN fortnight_details.assa_code IS 'Código ASSA (ej: PJ750-10) si is_assa_code = TRUE';

-- 4. Habilitar RLS (Row Level Security)
ALTER TABLE fortnight_details ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS

-- Master puede ver TODO
CREATE POLICY "Master puede ver todos los detalles"
ON fortnight_details
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'master'
  )
);

-- Broker solo ve SUS detalles
CREATE POLICY "Broker solo ve sus propios detalles"
ON fortnight_details
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM brokers
    WHERE brokers.id = fortnight_details.broker_id
    AND brokers.p_id = auth.uid()
  )
);

-- Solo master puede insertar
CREATE POLICY "Solo master puede insertar detalles"
ON fortnight_details
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'master'
  )
);

-- Solo master puede actualizar
CREATE POLICY "Solo master puede actualizar detalles"
ON fortnight_details
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'master'
  )
);

-- Solo master puede eliminar
CREATE POLICY "Solo master puede eliminar detalles"
ON fortnight_details
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'master'
  )
);

-- 6. Trigger para validar datos antes de insertar
CREATE OR REPLACE FUNCTION validate_fortnight_detail()
RETURNS TRIGGER AS $$
BEGIN
  -- Validar que commission_calculated = commission_raw * percent_applied
  IF ABS(NEW.commission_calculated - (NEW.commission_raw * NEW.percent_applied)) > 0.01 THEN
    RAISE EXCEPTION 'Cálculo de comisión incorrecto: % * % != %', 
      NEW.commission_raw, NEW.percent_applied, NEW.commission_calculated;
  END IF;
  
  -- Validar que percent_applied esté entre 0 y 1
  IF NEW.percent_applied < 0 OR NEW.percent_applied > 1 THEN
    RAISE EXCEPTION 'Porcentaje aplicado debe estar entre 0 y 1, recibido: %', NEW.percent_applied;
  END IF;
  
  -- Si es código ASSA, debe tener assa_code
  IF NEW.is_assa_code = TRUE AND (NEW.assa_code IS NULL OR NEW.assa_code = '') THEN
    RAISE EXCEPTION 'is_assa_code es TRUE pero assa_code está vacío';
  END IF;
  
  -- Si NO es código ASSA, assa_code debe ser NULL
  IF NEW.is_assa_code = FALSE AND NEW.assa_code IS NOT NULL THEN
    NEW.assa_code := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_fortnight_detail
BEFORE INSERT OR UPDATE ON fortnight_details
FOR EACH ROW
EXECUTE FUNCTION validate_fortnight_detail();

-- 7. Vista para obtener detalles con nombres completos
CREATE OR REPLACE VIEW fortnight_details_full AS
SELECT 
  fd.*,
  f.period_start,
  f.period_end,
  f.status AS fortnight_status,
  b.name AS broker_name,
  b.email AS broker_email,
  i.name AS insurer_name,
  c.national_id AS client_national_id,
  c.email AS client_email,
  ci.period_label AS import_period_label,
  ci.total_amount AS import_total_amount
FROM fortnight_details fd
LEFT JOIN fortnights f ON fd.fortnight_id = f.id
LEFT JOIN brokers b ON fd.broker_id = b.id
LEFT JOIN insurers i ON fd.insurer_id = i.id
LEFT JOIN clients c ON fd.client_id = c.id
LEFT JOIN comm_imports ci ON fd.source_import_id = ci.id;

-- RLS para la vista (hereda de la tabla base)
ALTER VIEW fortnight_details_full SET (security_invoker = true);

-- 8. Función para obtener resumen de quincena
CREATE OR REPLACE FUNCTION get_fortnight_summary(p_fortnight_id UUID)
RETURNS TABLE (
  total_brokers BIGINT,
  total_policies BIGINT,
  total_assa_codes BIGINT,
  total_commission_raw NUMERIC,
  total_commission_calculated NUMERIC,
  total_by_insurer JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH insurer_totals AS (
    SELECT 
      i.name AS insurer_name,
      COUNT(fd.id) AS count,
      SUM(fd.commission_calculated) AS total
    FROM fortnight_details fd
    JOIN insurers i ON fd.insurer_id = i.id
    WHERE fd.fortnight_id = p_fortnight_id
    GROUP BY i.name
  )
  SELECT 
    COUNT(DISTINCT fd.broker_id)::BIGINT AS total_brokers,
    COUNT(CASE WHEN fd.is_assa_code = FALSE THEN 1 END)::BIGINT AS total_policies,
    COUNT(CASE WHEN fd.is_assa_code = TRUE THEN 1 END)::BIGINT AS total_assa_codes,
    SUM(fd.commission_raw)::NUMERIC AS total_commission_raw,
    SUM(fd.commission_calculated)::NUMERIC AS total_commission_calculated,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'insurer', it.insurer_name,
          'count', it.count,
          'total', it.total
        )
      ),
      '[]'::jsonb
    ) AS total_by_insurer
  FROM fortnight_details fd
  CROSS JOIN insurer_totals it
  WHERE fd.fortnight_id = p_fortnight_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- MIGRACIÓN COMPLETADA
-- ============================================================================
-- Para ejecutar:
-- 1. Copiar todo este contenido
-- 2. Ejecutar en Supabase SQL Editor
-- 3. Verificar: SELECT * FROM fortnight_details LIMIT 1;
-- 4. Regenerar types: npx supabase gen types typescript --local > src/lib/database.types.ts
-- ============================================================================
