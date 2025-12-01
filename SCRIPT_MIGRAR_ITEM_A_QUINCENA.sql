-- ================================================
-- SCRIPT PARA MIGRAR PENDING_ITEM A QUINCENA CERRADA
-- ================================================
-- EJECUTAR EN SUPABASE SQL EDITOR
-- 
-- Item a migrar: 1324aa2d-42ed-428d-8306-c2cb608eb376
-- Broker: 2991c12f-5a84-457d-bf9c-d71e09d398af
-- Quincena: I de Noviembre (cerrada)
-- ================================================

-- ========================================
-- PASO 1: VER DATOS DEL PENDING_ITEM
-- ========================================
SELECT 
  id,
  policy_number,
  insured_name,
  commission_raw,
  insurer_id,
  insured_rfc,
  insured_email,
  insured_phone,
  coverage_start_date,
  coverage_end_date,
  created_at
FROM pending_items
WHERE id = '1324aa2d-42ed-428d-8306-c2cb608eb376';

-- ========================================
-- PASO 2: VER QUINCENA "I de Noviembre"
-- ========================================
SELECT 
  id,
  name,
  start_date,
  end_date,
  status,
  created_at
FROM fortnights
WHERE name ILIKE '%noviembre%'
  AND status = 'closed'
ORDER BY created_at DESC;

-- ========================================
-- PASO 3: VER DATOS DEL BROKER
-- ========================================
SELECT 
  id,
  name,
  email,
  percent_default,
  p_id
FROM brokers
WHERE id = '2991c12f-5a84-457d-bf9c-d71e09d398af';

-- ========================================
-- PASO 4: SCRIPT DE MIGRACIÓN COMPLETA
-- ========================================
-- IMPORTANTE: Ejecutar después de verificar los pasos 1, 2 y 3

BEGIN;

-- Variables (reemplazar con los valores reales obtenidos en pasos anteriores)
-- fortnight_id: obtener del PASO 2
-- percent_default: obtener del PASO 3

-- 4.1 Obtener datos del pending_item
WITH pending_data AS (
  SELECT 
    pi.id as pending_id,
    pi.policy_number,
    pi.insured_name,
    pi.commission_raw,
    pi.insurer_id,
    pi.insured_rfc,
    pi.insured_email,
    pi.insured_phone,
    pi.coverage_start_date,
    pi.coverage_end_date,
    b.percent_default,
    f.id as fortnight_id
  FROM pending_items pi
  CROSS JOIN brokers b
  CROSS JOIN fortnights f
  WHERE pi.id = '1324aa2d-42ed-428d-8306-c2cb608eb376'
    AND b.id = '2991c12f-5a84-457d-bf9c-d71e09d398af'
    AND f.name ILIKE '%I de Noviembre%'
    AND f.status = 'closed'
  LIMIT 1
),

-- 4.2 Crear o buscar cliente en clients
client_data AS (
  INSERT INTO clients (
    name,
    email,
    phone,
    rfc,
    broker_id,
    status
  )
  SELECT 
    pd.insured_name,
    COALESCE(pd.insured_email, 'sin-email@' || pd.policy_number || '.com'),
    pd.insured_phone,
    pd.insured_rfc,
    '2991c12f-5a84-457d-bf9c-d71e09d398af',
    'active'
  FROM pending_data pd
  ON CONFLICT (email) DO UPDATE
    SET name = EXCLUDED.name
  RETURNING id as client_id
),

-- 4.3 Crear póliza en policy
policy_data AS (
  INSERT INTO policy (
    policy_number,
    client_id,
    insurer_id,
    broker_id,
    status,
    start_date,
    end_date
  )
  SELECT 
    pd.policy_number,
    cd.client_id,
    pd.insurer_id,
    '2991c12f-5a84-457d-bf9c-d71e09d398af',
    'active',
    COALESCE(pd.coverage_start_date, CURRENT_DATE),
    pd.coverage_end_date
  FROM pending_data pd
  CROSS JOIN client_data cd
  ON CONFLICT (policy_number) DO UPDATE
    SET client_id = EXCLUDED.client_id,
        broker_id = EXCLUDED.broker_id
  RETURNING id as policy_id, policy_number
),

-- 4.4 Crear comisión en comm_items (tabla de quincena)
comm_item_data AS (
  INSERT INTO comm_items (
    policy_number,
    insured_name,
    gross_amount,
    broker_id,
    insurer_id,
    fortnight_id,
    status,
    policy_id,
    client_id
  )
  SELECT 
    pd.policy_number,
    pd.insured_name,
    pd.commission_raw * pd.percent_default, -- Comisión calculada
    '2991c12f-5a84-457d-bf9c-d71e09d398af',
    pd.insurer_id,
    pd.fortnight_id,
    'paid', -- Como es quincena cerrada, ya está pagado
    pol.policy_id,
    cd.client_id
  FROM pending_data pd
  CROSS JOIN client_data cd
  CROSS JOIN policy_data pol
  RETURNING id, gross_amount
)

-- 4.5 Actualizar pending_item para que no vuelva a aparecer
UPDATE pending_items
SET 
  status = 'migrated', -- Marcar como migrado
  assigned_broker_id = '2991c12f-5a84-457d-bf9c-d71e09d398af'
WHERE id = '1324aa2d-42ed-428d-8306-c2cb608eb376';

-- Mostrar resumen de lo creado
SELECT 
  'Cliente creado' as accion,
  cd.client_id as id
FROM client_data cd
UNION ALL
SELECT 
  'Póliza creada' as accion,
  pol.policy_id::text as id
FROM policy_data pol
UNION ALL
SELECT 
  'Comisión creada en quincena' as accion,
  cid.id::text as id
FROM comm_item_data cid;

COMMIT;

-- ========================================
-- PASO 5: VERIFICACIÓN
-- ========================================

-- 5.1 Ver el pending_item actualizado
SELECT 
  id,
  policy_number,
  status,
  assigned_broker_id
FROM pending_items
WHERE id = '1324aa2d-42ed-428d-8306-c2cb608eb376';
-- Debe mostrar status='migrated'

-- 5.2 Ver el cliente creado
SELECT 
  c.id,
  c.name,
  c.email,
  c.broker_id,
  b.name as broker_name
FROM clients c
INNER JOIN brokers b ON c.broker_id = b.id
WHERE c.name = (
  SELECT insured_name 
  FROM pending_items 
  WHERE id = '1324aa2d-42ed-428d-8306-c2cb608eb376'
);

-- 5.3 Ver la póliza creada
SELECT 
  p.id,
  p.policy_number,
  p.client_id,
  p.broker_id,
  c.name as client_name,
  b.name as broker_name
FROM policy p
INNER JOIN clients c ON p.client_id = c.id
INNER JOIN brokers b ON p.broker_id = b.id
WHERE p.policy_number = (
  SELECT policy_number 
  FROM pending_items 
  WHERE id = '1324aa2d-42ed-428d-8306-c2cb608eb376'
);

-- 5.4 Ver la comisión creada en la quincena
SELECT 
  ci.id,
  ci.policy_number,
  ci.insured_name,
  ci.gross_amount as comision_broker,
  ci.status,
  f.name as quincena,
  b.name as broker_name
FROM comm_items ci
INNER JOIN fortnights f ON ci.fortnight_id = f.id
INNER JOIN brokers b ON ci.broker_id = b.id
WHERE ci.policy_number = (
  SELECT policy_number 
  FROM pending_items 
  WHERE id = '1324aa2d-42ed-428d-8306-c2cb608eb376'
);

-- ========================================
-- SCRIPT ALTERNATIVO (MÁS SIMPLE)
-- ========================================
-- Si el script anterior da error, usa este paso a paso:

/*
-- PASO A: Obtener IDs necesarios
SELECT 
  id as fortnight_id,
  name
FROM fortnights
WHERE name ILIKE '%I de Noviembre%'
  AND status = 'closed';
-- Copiar el fortnight_id

SELECT 
  percent_default
FROM brokers
WHERE id = '2991c12f-5a84-457d-bf9c-d71e09d398af';
-- Copiar el percent_default

SELECT 
  policy_number,
  insured_name,
  commission_raw,
  insurer_id,
  insured_email,
  insured_phone,
  insured_rfc
FROM pending_items
WHERE id = '1324aa2d-42ed-428d-8306-c2cb608eb376';
-- Copiar todos los datos


-- PASO B: Crear cliente (reemplazar valores)
INSERT INTO clients (
  name,
  email,
  phone,
  rfc,
  broker_id,
  status
) VALUES (
  'NOMBRE_DEL_CLIENTE',  -- Del pending_item
  'EMAIL_DEL_CLIENTE',   -- Del pending_item
  'TELEFONO',            -- Del pending_item
  'RFC',                 -- Del pending_item
  '2991c12f-5a84-457d-bf9c-d71e09d398af',
  'active'
)
ON CONFLICT (email) DO UPDATE
  SET name = EXCLUDED.name
RETURNING id;
-- Copiar el client_id


-- PASO C: Crear póliza (reemplazar valores)
INSERT INTO policy (
  policy_number,
  client_id,
  insurer_id,
  broker_id,
  status
) VALUES (
  'NUMERO_POLIZA',  -- Del pending_item
  'CLIENT_ID',      -- Del PASO B
  'INSURER_ID',     -- Del pending_item
  '2991c12f-5a84-457d-bf9c-d71e09d398af',
  'active'
)
ON CONFLICT (policy_number) DO UPDATE
  SET client_id = EXCLUDED.client_id
RETURNING id;
-- Copiar el policy_id


-- PASO D: Crear comisión en quincena
INSERT INTO comm_items (
  policy_number,
  insured_name,
  gross_amount,  -- commission_raw × percent_default
  broker_id,
  insurer_id,
  fortnight_id,
  status,
  policy_id,
  client_id
) VALUES (
  'NUMERO_POLIZA',
  'NOMBRE_CLIENTE',
  COMISION_RAW * PERCENT_DEFAULT,  -- Calcular manualmente
  '2991c12f-5a84-457d-bf9c-d71e09d398af',
  'INSURER_ID',
  'FORTNIGHT_ID',  -- Del PASO A
  'paid',
  'POLICY_ID',     -- Del PASO C
  'CLIENT_ID'      -- Del PASO B
);


-- PASO E: Marcar pending_item como migrado
UPDATE pending_items
SET 
  status = 'migrated',
  assigned_broker_id = '2991c12f-5a84-457d-bf9c-d71e09d398af'
WHERE id = '1324aa2d-42ed-428d-8306-c2cb608eb376';
*/

-- ========================================
-- NOTAS IMPORTANTES
-- ========================================
/*
1. El pending_item NO se elimina, solo se marca como 'migrated'
2. La comisión se calcula: commission_raw × percent_default
3. El status en comm_items es 'paid' porque la quincena ya está cerrada
4. Si el cliente ya existe (por email), se actualiza su nombre
5. Si la póliza ya existe, se actualiza el cliente asociado
6. El pending_item ya no aparecerá en "Sin Identificar" porque status != 'open'
*/
