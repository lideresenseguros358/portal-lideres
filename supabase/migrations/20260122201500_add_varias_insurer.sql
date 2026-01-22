-- Migration: Add VARIAS as insurer option for multiple-insurer quotations
-- Descripción: Agrega registro VARIAS para cotizaciones con múltiples aseguradoras

-- Insertar VARIAS si no existe
INSERT INTO insurers (name, active, invert_negatives, use_multi_commission_columns)
VALUES ('VARIAS', true, false, false)
ON CONFLICT (name) DO NOTHING;

-- Comentario
COMMENT ON TABLE insurers IS 'Tabla de aseguradoras. VARIAS se usa cuando una cotización incluye múltiples aseguradoras.';
