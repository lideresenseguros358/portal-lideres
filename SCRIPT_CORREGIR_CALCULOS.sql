-- ================================================
-- SCRIPT PARA CORREGIR CÁLCULOS EN REPORTES EXISTENTES
-- ================================================
-- EJECUTAR EN SUPABASE SQL EDITOR
-- Solo corrige los cálculos SIN borrar datos
-- ================================================

-- ========================================
-- OPCIÓN 1: CORREGIR TODO AUTOMÁTICAMENTE
-- ========================================
-- Este script recalcula todo basándose en percent_default de brokers

BEGIN;

-- 1. Recalcular broker_commission en adjustment_report_items
UPDATE adjustment_report_items AS ari
SET broker_commission = ari.commission_raw * b.percent_default
FROM adjustment_reports AS ar
INNER JOIN brokers AS b ON ar.broker_id = b.id
WHERE ari.report_id = ar.id;

-- 2. Recalcular total_amount en adjustment_reports
UPDATE adjustment_reports AS ar
SET total_amount = (
  SELECT COALESCE(SUM(broker_commission), 0)
  FROM adjustment_report_items
  WHERE report_id = ar.id
);

COMMIT;

-- ========================================
-- OPCIÓN 2: VER CÁLCULOS ANTES DE CORREGIR
-- ========================================
-- Ejecuta esto para ver qué se va a cambiar:

/*
SELECT 
  ar.id as report_id,
  b.name as broker_name,
  b.percent_default,
  ari.id as item_id,
  ari.commission_raw,
  ari.broker_commission as broker_commission_actual,
  (ari.commission_raw * b.percent_default) as broker_commission_correcto,
  ar.total_amount as total_actual,
  (
    SELECT COALESCE(SUM(commission_raw * b.percent_default), 0)
    FROM adjustment_report_items
    WHERE report_id = ar.id
  ) as total_correcto
FROM adjustment_report_items AS ari
INNER JOIN adjustment_reports AS ar ON ari.report_id = ar.id
INNER JOIN brokers AS b ON ar.broker_id = b.id
ORDER BY ar.created_at DESC;
*/

-- ========================================
-- OPCIÓN 3: CORREGIR SOLO UN REPORTE ESPECÍFICO
-- ========================================
-- Reemplaza 'REPORT_ID_AQUI' con el ID del reporte que quieres corregir

/*
-- Primero obtén el broker_id y percent_default del reporte
WITH report_broker AS (
  SELECT 
    ar.id,
    ar.broker_id,
    b.percent_default
  FROM adjustment_reports ar
  INNER JOIN brokers b ON ar.broker_id = b.id
  WHERE ar.id = 'REPORT_ID_AQUI'
)
-- Actualizar items del reporte
UPDATE adjustment_report_items AS ari
SET broker_commission = ari.commission_raw * rb.percent_default
FROM report_broker rb
WHERE ari.report_id = rb.id;

-- Actualizar total del reporte
UPDATE adjustment_reports
SET total_amount = (
  SELECT COALESCE(SUM(broker_commission), 0)
  FROM adjustment_report_items
  WHERE report_id = 'REPORT_ID_AQUI'
)
WHERE id = 'REPORT_ID_AQUI';
*/

-- ========================================
-- VERIFICACIÓN
-- ========================================
-- Después de corregir, verifica que los cálculos son correctos:

SELECT 
  ar.id,
  b.name as broker,
  b.percent_default as porcentaje,
  ar.total_amount as total_reporte,
  (
    SELECT COALESCE(SUM(broker_commission), 0)
    FROM adjustment_report_items
    WHERE report_id = ar.id
  ) as suma_items,
  CASE 
    WHEN ar.total_amount = (
      SELECT COALESCE(SUM(broker_commission), 0)
      FROM adjustment_report_items
      WHERE report_id = ar.id
    ) THEN '✅ CORRECTO'
    ELSE '❌ DESCUADRADO'
  END as estado
FROM adjustment_reports ar
INNER JOIN brokers b ON ar.broker_id = b.id
ORDER BY ar.created_at DESC;

-- ========================================
-- EJEMPLO DE CÁLCULO CORRECTO:
-- ========================================
/*
commission_raw = $10.00
percent_default = 0.82 (82%)
broker_commission = $10.00 × 0.82 = $8.20 ✅

Si muestra $0.08, significa que se dividió por 100 incorrectamente
$10.00 × 0.82 ÷ 100 = $0.082 ≈ $0.08 ❌
*/
