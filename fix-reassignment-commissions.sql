-- ============================================================
-- FIX: Corregir datos de reasignación de broker con cálculo errado
-- 
-- PROBLEMA: percent_default es DECIMAL (0.80 = 80%) pero el código
-- dividía por 100 otra vez: 7.82 * (0.8/100) = 0.06 en vez de 7.82 * 0.8 = 6.26
--
-- Este script corrige TODOS los registros de reasignación afectados.
-- ============================================================

-- ============================================================
-- PASO 0: DIAGNÓSTICO — Ver qué hay que corregir
-- ============================================================

-- 0a. Ver adjustment_reports de reasignación
SELECT 
  ar.id as report_id,
  ar.broker_id,
  b.name as broker_name,
  b.percent_default,
  ar.total_amount as total_actual_malo,
  ar.admin_notes,
  ar.status,
  ar.created_at
FROM adjustment_reports ar
INNER JOIN brokers b ON b.id = ar.broker_id
WHERE ar.admin_notes LIKE '%Reasignación de broker%';

-- 0b. Ver items con valores errados vs correctos
SELECT 
  ari.id as item_id,
  ari.report_id,
  ari.commission_raw,
  ari.broker_commission as comision_actual_mala,
  ROUND(ari.commission_raw * b.percent_default, 2) as comision_correcta,
  b.percent_default
FROM adjustment_report_items ari
INNER JOIN adjustment_reports ar ON ar.id = ari.report_id
INNER JOIN brokers b ON b.id = ar.broker_id
WHERE ar.admin_notes LIKE '%Reasignación de broker%';

-- 0c. Ver advances (deudas) de reasignación
SELECT 
  a.id,
  a.broker_id,
  a.amount as monto_actual_malo,
  a.reason,
  a.status,
  a.created_at
FROM advances a
WHERE a.reason LIKE '%DEUDA por reasignación%';

-- ============================================================
-- PASO 1: Corregir adjustment_report_items.broker_commission
-- Fórmula correcta: commission_raw * percent_default (sin /100)
-- ============================================================
UPDATE adjustment_report_items ari
SET broker_commission = ROUND(ari.commission_raw * b.percent_default, 2)
FROM adjustment_reports ar
INNER JOIN brokers b ON b.id = ar.broker_id
WHERE ari.report_id = ar.id
  AND ar.admin_notes LIKE '%Reasignación de broker%';

-- ============================================================
-- PASO 2: Corregir adjustment_reports.total_amount
-- Recalcular sumando broker_commission ya corregidas
-- ============================================================
UPDATE adjustment_reports ar
SET total_amount = sub.new_total
FROM (
  SELECT ari.report_id, ROUND(SUM(ari.broker_commission), 2) as new_total
  FROM adjustment_report_items ari
  INNER JOIN adjustment_reports ar2 ON ar2.id = ari.report_id
  WHERE ar2.admin_notes LIKE '%Reasignación de broker%'
  GROUP BY ari.report_id
) sub
WHERE ar.id = sub.report_id;

-- ============================================================
-- PASO 3: Corregir advances (deudas del broker antiguo)
-- Buscar por cada advance de reasignación y recalcular
-- La deuda = sum de (commission_raw * percent_default del broker ANTIGUO)
-- Pero como check-commissions ahora calcula bien, la deuda debe ser
-- lo que se le pagó al broker antiguo = gross_amount * percentOld
-- ============================================================

-- Para el caso específico del screenshot:
-- Broker antiguo: f681a123-0786-4d7e-89a6-a16be2a00f8d
-- gross_amount = 7.82, percent_default = 0.80
-- Deuda correcta = 7.82 * 0.80 = 6.26

-- Corregir advances de reasignación creados hoy (con el bug)
UPDATE advances a
SET amount = sub.correct_amount
FROM (
  -- Para cada advance de reasignación, buscar el adjustment_report correspondiente
  -- y sumar las broker_commission corregidas (que ahora representan la deuda real)
  SELECT 
    a2.id as advance_id,
    a2.broker_id,
    COALESCE(
      (SELECT ROUND(SUM(ari.commission_raw * b_old.percent_default), 2)
       FROM adjustment_reports ar
       INNER JOIN adjustment_report_items ari ON ari.report_id = ar.id
       INNER JOIN brokers b_old ON b_old.id = a2.broker_id
       WHERE ar.admin_notes LIKE '%Broker anterior: ' || a2.broker_id || '%'
      ),
      a2.amount  -- fallback: mantener el valor actual si no se encuentra match
    ) as correct_amount
  FROM advances a2
  WHERE a2.reason LIKE '%DEUDA por reasignación%'
) sub
WHERE a.id = sub.advance_id
  AND a.amount != sub.correct_amount;

-- ============================================================
-- PASO 4: VERIFICACIÓN — Confirmar que todo está correcto
-- ============================================================

SELECT '✅ REPORTS CORREGIDOS' as verificacion,
  ar.id, 
  ar.total_amount as total_corregido,
  b.name as broker,
  b.percent_default
FROM adjustment_reports ar
INNER JOIN brokers b ON b.id = ar.broker_id
WHERE ar.admin_notes LIKE '%Reasignación de broker%';

SELECT '✅ ITEMS CORREGIDOS' as verificacion,
  ari.commission_raw,
  ari.broker_commission as comision_corregida,
  ROUND(ari.commission_raw * b.percent_default, 2) as verificacion_calculo
FROM adjustment_report_items ari
INNER JOIN adjustment_reports ar ON ar.id = ari.report_id
INNER JOIN brokers b ON b.id = ar.broker_id
WHERE ar.admin_notes LIKE '%Reasignación de broker%';

SELECT '✅ ADVANCES CORREGIDOS' as verificacion,
  a.id,
  a.amount as deuda_corregida,
  a.broker_id
FROM advances a
WHERE a.reason LIKE '%DEUDA por reasignación%';

-- ============================================================
-- PASO 5: Corregir NOTAS de registros existentes
-- Las notas tenían información excesiva (IDs, porcentajes, etc.)
-- ============================================================

-- 5a. Corregir notas del advance (deuda) — caso específico del 23/02/2026
-- Obtener nombre del cliente y póliza para construir nota limpia
UPDATE advances a
SET reason = 'DEUDA por reasignación. Cliente: ' || COALESCE(c.name, 'N/A') || '. Póliza: ' || COALESCE(pi2.policy_number, 'N/A') || '. Aseguradora: ' || COALESCE(ins.name, 'N/A') || '. 1 quincena.'
FROM clients c
CROSS JOIN LATERAL (
  SELECT pi.policy_number, pi.insurer_id
  FROM pending_items pi
  INNER JOIN adjustment_report_items ari ON ari.pending_item_id = pi.id
  INNER JOIN adjustment_reports ar ON ar.id = ari.report_id
  WHERE ar.admin_notes LIKE '%Reasignación de broker%'
    AND ar.admin_notes LIKE '%' || a.broker_id || '%'
  LIMIT 1
) pi2
LEFT JOIN insurers ins ON ins.id = pi2.insurer_id
WHERE c.id = '620b9248-87af-4bbb-8c1c-7c7841bdab01'
  AND a.reason LIKE '%DEUDA por reasignación de cliente%'
  AND a.broker_id = 'f681a123-0786-4d7e-89a6-a16be2a00f8d';

-- 5b. Corregir notas del adjustment_report (broker_notes y admin_notes)
UPDATE adjustment_reports ar
SET broker_notes = 'Ajuste por reasignación de cliente.',
    admin_notes = 'Reasignación de broker. Cliente: ' || COALESCE(c.name, 'N/A') || '. Póliza: ' || COALESCE(pi2.policy_number, 'N/A') || '. Aseguradora: ' || COALESCE(ins.name, 'N/A') || '. 1 quincena. Broker anterior: ' || COALESCE(b_old.name, 'N/A') || '. Total deuda: $' || ROUND(ar.total_amount, 2)::text || '. Total nuevas comisiones: $' || ROUND(ar.total_amount, 2)::text || '.'
FROM clients c
CROSS JOIN LATERAL (
  SELECT pi.policy_number, pi.insurer_id
  FROM pending_items pi
  INNER JOIN adjustment_report_items ari ON ari.pending_item_id = pi.id
  WHERE ari.report_id = ar.id
  LIMIT 1
) pi2
LEFT JOIN insurers ins ON ins.id = pi2.insurer_id
LEFT JOIN brokers b_old ON ar.admin_notes LIKE '%Broker anterior: ' || b_old.id || '%'
WHERE c.id = '620b9248-87af-4bbb-8c1c-7c7841bdab01'
  AND ar.admin_notes LIKE '%Reasignación de broker%Cliente ID: 620b9248%';

-- 5c. Verificar notas corregidas
SELECT 'NOTAS ADVANCE' as check, a.reason FROM advances a WHERE a.broker_id = 'f681a123-0786-4d7e-89a6-a16be2a00f8d' AND a.reason LIKE '%DEUDA por reasignación%';
SELECT 'NOTAS REPORT' as check, ar.broker_notes, ar.admin_notes FROM adjustment_reports ar WHERE ar.admin_notes LIKE '%Reasignación de broker%Cliente: %';
