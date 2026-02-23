-- ============================================================
-- FIX: Limpiar duplicados en temp_client_import (preliminar)
--
-- PROBLEMA: Hay registros duplicados en preliminar:
--   1. Pólizas que ya existen en la tabla policies (BD real)
--   2. Pólizas duplicadas dentro del propio preliminar
--
-- Este script limpia ambos casos.
-- ============================================================

-- ============================================================
-- PASO 0: DIAGNÓSTICO
-- ============================================================

-- 0a. Registros en preliminar cuya póliza YA existe en BD real
SELECT 
  'EN BD REAL' as tipo,
  t.id as prelim_id,
  t.policy_number,
  t.client_name,
  t.broker_id,
  t.source,
  t.created_at,
  p.id as policy_id
FROM temp_client_import t
INNER JOIN policies p ON p.policy_number = t.policy_number
WHERE t.migrated = false;

-- 0b. Duplicados dentro del propio preliminar (mismo policy_number, más de 1 registro)
SELECT 
  'DUPLICADO PRELIM' as tipo,
  t.policy_number,
  COUNT(*) as cantidad,
  ARRAY_AGG(t.id ORDER BY t.created_at ASC) as ids,
  ARRAY_AGG(t.client_name ORDER BY t.created_at ASC) as nombres,
  ARRAY_AGG(t.source ORDER BY t.created_at ASC) as fuentes
FROM temp_client_import t
WHERE t.migrated = false
  AND t.policy_number IS NOT NULL
GROUP BY t.policy_number
HAVING COUNT(*) > 1;

-- 0c. Resumen
SELECT 
  'Total en preliminar (no migrados)' as metrica,
  COUNT(*) as cantidad
FROM temp_client_import WHERE migrated = false
UNION ALL
SELECT 
  'Ya existen en BD real (policies)',
  COUNT(*)
FROM temp_client_import t
INNER JOIN policies p ON p.policy_number = t.policy_number
WHERE t.migrated = false
UNION ALL
SELECT 
  'Duplicados internos (registros extra)',
  COUNT(*) - COUNT(DISTINCT policy_number)
FROM temp_client_import
WHERE migrated = false
  AND policy_number IS NOT NULL
  AND policy_number IN (
    SELECT policy_number FROM temp_client_import
    WHERE migrated = false AND policy_number IS NOT NULL
    GROUP BY policy_number HAVING COUNT(*) > 1
  );

-- ============================================================
-- PASO 1: Eliminar registros cuya póliza YA existe en BD real
-- Si la póliza ya está en policies, no tiene sentido en preliminar
-- ============================================================
DELETE FROM temp_client_import
WHERE migrated = false
  AND policy_number IN (
    SELECT policy_number FROM policies WHERE policy_number IS NOT NULL
  );

-- ============================================================
-- PASO 2: Eliminar duplicados internos (mantener el más antiguo)
-- Para cada policy_number con más de 1 registro, eliminar todos
-- excepto el que tiene el created_at más antiguo (el original)
-- ============================================================
DELETE FROM temp_client_import
WHERE id IN (
  SELECT id FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY policy_number 
        ORDER BY created_at ASC
      ) as rn
    FROM temp_client_import
    WHERE migrated = false
      AND policy_number IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- ============================================================
-- PASO 3: VERIFICACIÓN
-- ============================================================

-- Verificar que no quedan duplicados
SELECT 
  '✅ Verificación: duplicados restantes' as check,
  COUNT(*) as cantidad
FROM (
  SELECT policy_number
  FROM temp_client_import
  WHERE migrated = false AND policy_number IS NOT NULL
  GROUP BY policy_number
  HAVING COUNT(*) > 1
) dups;

-- Verificar que no quedan registros con póliza en BD real
SELECT 
  '✅ Verificación: en BD real restantes' as check,
  COUNT(*) as cantidad
FROM temp_client_import t
INNER JOIN policies p ON p.policy_number = t.policy_number
WHERE t.migrated = false;

-- Total restante en preliminar
SELECT 
  '✅ Total preliminar después de limpieza' as check,
  COUNT(*) as cantidad
FROM temp_client_import
WHERE migrated = false;
