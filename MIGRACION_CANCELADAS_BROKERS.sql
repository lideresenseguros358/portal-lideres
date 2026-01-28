-- ========================================
-- MIGRACIÓN: Mover canceladas_ytd a tabla brokers
-- ========================================
-- Fecha: 2025-01-28
-- Razón: Canceladas es un valor ANUAL por broker, no mensual
--        Debe estar en brokers, no en production
-- ========================================

-- 1. Agregar columna canceladas_ytd a tabla brokers
ALTER TABLE brokers 
ADD COLUMN IF NOT EXISTS canceladas_ytd NUMERIC(10,2) DEFAULT 0 NOT NULL;

COMMENT ON COLUMN brokers.canceladas_ytd IS 'Total anual de canceladas (pólizas canceladas en el año). Se resta del bruto YTD para calcular neto YTD.';

-- 2. Migrar datos existentes de production.canceladas (mes 12) a brokers.canceladas_ytd
-- Solo para el año actual
UPDATE brokers b
SET canceladas_ytd = COALESCE(
  (
    SELECT p.canceladas
    FROM production p
    WHERE p.broker_id = b.id
      AND p.year = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
      AND p.month = 12
      AND p.canceladas IS NOT NULL
      AND p.canceladas > 0
    LIMIT 1
  ),
  0
);

-- 3. Limpiar canceladas mensuales en production (ya no se usan)
-- Esto previene confusión - canceladas ahora es solo anual
UPDATE production
SET canceladas = 0
WHERE year = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;

-- 4. Verificar migración
SELECT 
  b.name as broker_name,
  b.canceladas_ytd,
  (SELECT SUM(p.bruto) FROM production p WHERE p.broker_id = b.id AND p.year = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER) as bruto_ytd,
  (SELECT SUM(p.bruto) FROM production p WHERE p.broker_id = b.id AND p.year = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER) - b.canceladas_ytd as neto_ytd
FROM brokers b
WHERE b.active = true
ORDER BY b.name;

-- ========================================
-- NOTAS:
-- - Canceladas es ahora un campo en brokers (anual)
-- - production.canceladas se mantiene pero siempre en 0 (puede usarse para canceladas mensuales futuras si se requiere)
-- - El cálculo es simple: Bruto YTD (suma meses) - canceladas_ytd (campo broker) = Neto YTD
-- ========================================
