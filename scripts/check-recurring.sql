-- Verificar adelantos recurrentes
SELECT 
  a.id,
  a.reason,
  a.amount,
  a.status,
  a.is_recurring,
  a.recurrence_id,
  a.created_at,
  b.name as broker_name,
  ar.amount as recurrence_amount
FROM advances a
LEFT JOIN brokers b ON a.broker_id = b.id
LEFT JOIN advance_recurrences ar ON a.recurrence_id = ar.id
WHERE a.recurrence_id IS NOT NULL
ORDER BY a.created_at DESC;

-- Ver configuraciones de recurrencia
SELECT 
  ar.id,
  ar.reason,
  ar.amount,
  ar.is_active,
  ar.frequency,
  b.name as broker_name
FROM advance_recurrences ar
LEFT JOIN brokers b ON ar.broker_id = b.id
WHERE ar.is_active = true;
