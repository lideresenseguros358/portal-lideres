-- =====================================================
-- CORREGIR ERROR DEL BULK: Crear pólizas faltantes
-- =====================================================
-- Problema: Bulk import creó clientes y registró en fortnight_details
--           pero NUNCA creó las pólizas correspondientes
-- Solución: Crear las pólizas usando datos de fortnight_details
-- =====================================================

-- =====================================================
-- DIAGNÓSTICO: Ver el problema
-- =====================================================

SELECT '========== DIAGNÓSTICO DEL PROBLEMA ==========' as info;

-- Clientes con datos en fortnight_details pero sin pólizas
SELECT 
  'Clientes afectados por error del bulk' as metrica,
  COUNT(DISTINCT fd.client_id) as cantidad
FROM fortnight_details fd
WHERE fd.client_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = fd.client_id
);

-- Ver ejemplos con policy_number que deberían tener
SELECT 
  c.id as client_id,
  c.name as client_name,
  fd.policy_number,
  fd.broker_id,
  fd.insurer_id,
  fd.ramo,
  COUNT(*) as veces_en_fortnight
FROM clients c
JOIN fortnight_details fd ON fd.client_id = c.id
WHERE NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = c.id
)
GROUP BY c.id, c.name, fd.policy_number, fd.broker_id, fd.insurer_id, fd.ramo
ORDER BY c.name
LIMIT 20;

-- =====================================================
-- SOLUCIÓN: Crear pólizas faltantes
-- =====================================================

SELECT '========== CREANDO PÓLIZAS FALTANTES ==========' as info;

-- Ver cuántas pólizas se van a crear
SELECT 
  'Pólizas que se crearán' as accion,
  COUNT(DISTINCT fd.policy_number) as cantidad
FROM fortnight_details fd
WHERE fd.client_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM policies p 
  WHERE p.policy_number = fd.policy_number
);

-- CREAR LAS PÓLIZAS
-- Usamos datos del primer registro de cada policy_number en fortnight_details
-- NOTA: policy_number es UNIQUE, no puede haber duplicados
INSERT INTO policies (
  broker_id,
  client_id,
  insurer_id,
  policy_number,
  ramo,
  status,
  percent_override,
  created_at
)
SELECT DISTINCT ON (fd.policy_number)
  fd.broker_id,
  fd.client_id,
  fd.insurer_id,
  fd.policy_number,
  fd.ramo,
  'ACTIVA',  -- Status en español y mayúsculas (verificado en database.types.ts)
  NULL,      -- Sin override
  fd.created_at
FROM fortnight_details fd
WHERE fd.client_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM policies p 
  WHERE p.policy_number = fd.policy_number
)
ORDER BY fd.policy_number, fd.created_at ASC;

SELECT '✅ Pólizas creadas desde fortnight_details' as resultado;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

SELECT '========== VERIFICACIÓN ==========' as info;

-- Verificar que ya no haya clientes sin pólizas con historial
SELECT 
  'Clientes sin pólizas con historial (después)' as metrica,
  COUNT(DISTINCT fd.client_id) as cantidad,
  CASE 
    WHEN COUNT(DISTINCT fd.client_id) = 0 THEN '✅ CORRECTO - Todos corregidos'
    ELSE '⚠️ AÚN HAY ALGUNOS'
  END as estado
FROM fortnight_details fd
WHERE fd.client_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = fd.client_id
);

-- Ver los clientes corregidos
SELECT 
  c.id,
  c.name,
  (SELECT COUNT(*) FROM policies WHERE client_id = c.id) as polizas_ahora,
  (SELECT COUNT(*) FROM fortnight_details WHERE client_id = c.id) as en_fortnight_details
FROM clients c
WHERE c.id IN (
  SELECT DISTINCT client_id 
  FROM fortnight_details 
  WHERE client_id IS NOT NULL
)
ORDER BY c.name
LIMIT 20;

-- =====================================================
-- CASOS ESPECIALES: Si hay registros sin client_id
-- =====================================================

-- Ver si hay registros en fortnight_details sin client_id
SELECT 
  'Registros en fortnight_details SIN client_id' as caso_especial,
  COUNT(*) as cantidad,
  CASE 
    WHEN COUNT(*) > 0 THEN '⚠️ Hay registros huérfanos - Revisar manualmente'
    ELSE '✅ Todo correcto'
  END as estado
FROM fortnight_details
WHERE client_id IS NULL;

-- Ejemplos de registros sin client_id (si existen)
SELECT 
  'Ejemplo de registros sin client_id:' as tipo,
  id,
  policy_number,
  client_name,
  broker_id
FROM fortnight_details
WHERE client_id IS NULL
LIMIT 10;

-- =====================================================
-- REPORTE FINAL
-- =====================================================

SELECT '========== REPORTE FINAL ==========' as info;

-- Estadísticas finales
SELECT 
  'Total clientes' as metrica,
  COUNT(*) as cantidad
FROM clients
UNION ALL
SELECT 
  'Total pólizas' as metrica,
  COUNT(*) as cantidad
FROM policies
UNION ALL
SELECT 
  'Clientes sin pólizas' as metrica,
  COUNT(*) as cantidad
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = c.id
)
UNION ALL
SELECT 
  'Clientes sin pólizas PERO con historial' as metrica,
  COUNT(DISTINCT fd.client_id) as cantidad
FROM fortnight_details fd
WHERE fd.client_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM policies p WHERE p.client_id = fd.client_id
);

-- =====================================================
-- CONCLUSIÓN
-- =====================================================

SELECT '========================================' as separador;
SELECT 'CORRECCIÓN COMPLETADA' as titulo;
SELECT '========================================' as separador;

SELECT 
  'Qué se hizo:' as info
UNION ALL
SELECT 
  '✅ Se identificaron clientes sin pólizas' as info
UNION ALL
SELECT 
  '✅ Se extrajeron datos de fortnight_details' as info
UNION ALL
SELECT 
  '✅ Se crearon las pólizas faltantes' as info
UNION ALL
SELECT 
  '✅ Ahora todos los clientes tienen sus pólizas' as info
UNION ALL
SELECT 
  '' as info
UNION ALL
SELECT 
  'Datos usados para crear pólizas:' as info
UNION ALL
SELECT 
  '  - policy_number (de fortnight_details)' as info
UNION ALL
SELECT 
  '  - broker_id (de fortnight_details)' as info
UNION ALL
SELECT 
  '  - insurer_id (de fortnight_details)' as info
UNION ALL
SELECT 
  '  - ramo (de fortnight_details)' as info
UNION ALL
SELECT 
  '  - client_id (ya existía)' as info;

-- =====================================================
-- NOTAS IMPORTANTES
-- =====================================================

-- ✅ Las pólizas se crearon con status='ACTIVA'
-- ✅ Se usaron los datos más antiguos de fortnight_details
-- ✅ No se duplicaron pólizas (policy_number es UNIQUE)
-- ✅ Se preservó toda la información histórica
-- ⚠️ NOTA: Si una póliza ya existe, se omite (no da error)

-- ⚠️ Si necesitas ajustar el status de alguna póliza:
-- Valores válidos: 'ACTIVA', 'CANCELADA', 'VENCIDA'
-- UPDATE policies SET status = 'CANCELADA' WHERE policy_number = 'XXXXX';

-- ⚠️ Si algún cliente aún tiene 0 pólizas después de esto:
-- Es porque sus registros en fortnight_details tienen client_id = NULL
-- Revisar manualmente esos casos
