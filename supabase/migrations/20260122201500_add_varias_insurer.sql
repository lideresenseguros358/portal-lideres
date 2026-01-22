-- Migration: Add VARIAS as insurer option for multiple-insurer quotations
-- Descripción: Agrega registro VARIAS para cotizaciones con múltiples aseguradoras

-- Insertar VARIAS si no existe (usando WHERE NOT EXISTS)
INSERT INTO insurers (name, active, invert_negatives, use_multi_commission_columns)
SELECT 'VARIAS', true, false, false
WHERE NOT EXISTS (
  SELECT 1 FROM insurers WHERE name = 'VARIAS'
);

-- Comentario
COMMENT ON TABLE insurers IS 'Tabla de aseguradoras. VARIAS se usa cuando una cotización incluye múltiples aseguradoras.';
