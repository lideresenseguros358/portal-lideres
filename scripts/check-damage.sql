-- Ver todos los adelantos y sus logs
SELECT 
  a.id,
  a.reason,
  a.amount,
  a.status,
  a.is_recurring,
  a.recurrence_id,
  a.created_at,
  b.name as broker_name,
  (SELECT COUNT(*) FROM advance_logs WHERE advance_id = a.id) as log_count,
  (SELECT SUM(amount) FROM advance_logs WHERE advance_id = a.id) as total_pagado
FROM advances a
LEFT JOIN brokers b ON a.broker_id = b.id
ORDER BY a.created_at DESC;

-- Ver TODOS los logs de pagos (no eliminar estos)
SELECT 
  al.id,
  al.advance_id,
  al.amount,
  al.payment_type,
  al.created_at,
  a.reason as advance_reason,
  b.name as broker_name
FROM advance_logs al
LEFT JOIN advances a ON al.advance_id = a.id
LEFT JOIN brokers b ON a.broker_id = b.id
ORDER BY al.created_at DESC;
