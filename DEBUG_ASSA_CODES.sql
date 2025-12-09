-- SCRIPT DE DIAGNÓSTICO PARA CÓDIGOS ASSA
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar código ASSA de Javier Samudio en tabla brokers
SELECT 
  id,
  name,
  assa_code,
  LENGTH(assa_code) as longitud_assa_code,
  assa_code = 'PJ750-54' as es_exacto_PJ750_54
FROM brokers
WHERE name ILIKE '%javier%samudio%';

-- 2. Ver todos los policy_numbers que empiezan con PJ750-54
SELECT DISTINCT
  policy_number,
  insured_name,
  broker_id
FROM comm_items
WHERE policy_number LIKE 'PJ750-54%'
ORDER BY policy_number;

-- 3. Ver qué está guardado en fortnight_details para códigos ASSA
SELECT 
  fd.id,
  fd.policy_number,
  fd.client_name,
  fd.commission_calculated,
  fd.is_assa_code,
  fd.assa_code,
  fd.assa_code = 'PJ750-54' as es_exacto_PJ750_54,
  LENGTH(fd.assa_code) as longitud_assa_code,
  b.name as broker_name,
  b.assa_code as broker_assa_code_real,
  f.period_end as quincena
FROM fortnight_details fd
LEFT JOIN brokers b ON fd.broker_id = b.id
LEFT JOIN fortnights f ON fd.fortnight_id = f.id
WHERE fd.policy_number LIKE 'PJ750-54%'
  AND f.status = 'paid'
ORDER BY f.period_end DESC
LIMIT 20;

-- 4. Verificar si hay códigos ASSA que NO matchean con el broker correcto
SELECT 
  fd.policy_number,
  fd.assa_code as guardado_en_fd,
  b.assa_code as assa_code_del_broker,
  fd.assa_code = b.assa_code as coinciden,
  b.name as broker_name
FROM fortnight_details fd
LEFT JOIN brokers b ON fd.broker_id = b.id
WHERE fd.is_assa_code = true
  AND fd.assa_code IS NOT NULL
  AND fd.assa_code != b.assa_code
LIMIT 50;

-- 5. Ver resumen de códigos ASSA por broker
SELECT 
  b.name,
  b.assa_code,
  COUNT(fd.id) as total_registros,
  SUM(fd.commission_calculated) as total_comision
FROM brokers b
LEFT JOIN fortnight_details fd ON (fd.broker_id = b.id OR fd.assa_code = b.assa_code)
WHERE b.assa_code IS NOT NULL
  AND fd.is_assa_code = true
GROUP BY b.id, b.name, b.assa_code
ORDER BY b.name;
