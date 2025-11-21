-- Ver pagos del 20 y 21 de noviembre 2025
SELECT 
  id,
  advance_id,
  amount,
  payment_type,
  created_at,
  substring(created_at::text, 1, 10) as date_only
FROM advance_logs
WHERE created_at >= '2025-11-20' 
  AND created_at < '2025-11-22'
ORDER BY created_at DESC;

-- Si encuentras un pago que debería ser del 20 pero tiene fecha 21:
-- Reemplaza 'ID_DEL_LOG' con el ID real del log incorrecto
-- UPDATE advance_logs 
-- SET created_at = '2025-11-20 21:00:00'
-- WHERE id = 'ID_DEL_LOG';
