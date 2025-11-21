-- Verificar el adelanto asociado al pago de $200
SELECT 
  a.id,
  a.broker_id,
  a.amount,
  a.status,
  a.reason,
  a.is_recurring,
  b.name as broker_name
FROM advances a
LEFT JOIN brokers b ON a.broker_id = b.id
WHERE a.id = 'ca65033a-09ae-49f2-8d79-f25cd1696a32';

-- Ver los logs de ese adelanto
SELECT 
  id,
  advance_id,
  amount,
  payment_type,
  created_at
FROM advance_logs
WHERE advance_id = 'ca65033a-09ae-49f2-8d79-f25cd1696a32'
ORDER BY created_at DESC;
