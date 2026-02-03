-- Migración: Mover canceladas_ytd de tabla brokers a production (por año)
-- Problema: canceladas_ytd en brokers es global y aparece en todos los años
-- Solución: Agregar canceladas_ytd a production asociado a year específico

-- 1. Agregar columna canceladas_ytd a tabla production
ALTER TABLE production 
ADD COLUMN IF NOT EXISTS canceladas_ytd NUMERIC(12,2) DEFAULT 0 NOT NULL;

-- 2. Migrar datos existentes de brokers a production del año actual (2025)
-- IMPORTANTE: canceladas_ytd se replica en TODOS los meses (1-12)
-- Esto permite que el cálculo YTD sea: SUM(bruto) - canceladas_ytd (una sola vez)
UPDATE production p
SET canceladas_ytd = b.canceladas_ytd
FROM brokers b
WHERE p.broker_id = b.id 
  AND p.year = 2025 
  AND b.canceladas_ytd > 0;
  -- Se actualiza en TODOS los meses, no solo enero

-- 3. Para meses que no tienen registro, insertar con canceladas_ytd
-- Genera registros para todos los meses (1-12) del año 2025
INSERT INTO production (broker_id, year, month, bruto, num_polizas, canceladas, persistencia, canceladas_ytd, created_at, updated_at)
SELECT 
  b.id as broker_id,
  2025 as year,
  m.month,
  0 as bruto,
  0 as num_polizas,
  0 as canceladas,
  NULL as persistencia,
  b.canceladas_ytd,
  NOW() as created_at,
  NOW() as updated_at
FROM brokers b
CROSS JOIN (SELECT generate_series(1, 12) as month) m
WHERE b.canceladas_ytd > 0
  AND NOT EXISTS (
    SELECT 1 FROM production p 
    WHERE p.broker_id = b.id 
      AND p.year = 2025 
      AND p.month = m.month
  )
ON CONFLICT (broker_id, year, month) DO NOTHING;

-- 4. Crear índice para performance
CREATE INDEX IF NOT EXISTS idx_production_broker_year ON production(broker_id, year);

-- 5. Comentar (NO eliminar aún) el campo de brokers para backward compatibility
COMMENT ON COLUMN brokers.canceladas_ytd IS 'DEPRECADO: Usar production.canceladas_ytd por año';

-- Verificación
SELECT 
  b.name as broker_name,
  p.year,
  p.canceladas_ytd as canceladas_en_production,
  b.canceladas_ytd as canceladas_en_brokers_deprecado
FROM production p
JOIN brokers b ON b.id = p.broker_id
WHERE p.canceladas_ytd > 0 OR b.canceladas_ytd > 0
ORDER BY b.name, p.year;
