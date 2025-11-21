-- Corregir el pago de $200 que apareció en el día 21 cuando debería ser 20
UPDATE advance_logs 
SET created_at = '2025-11-20 20:32:09'
WHERE id = '7355979a-6a37-4638-93c8-1bde33f1941e';

-- Verificar corrección
SELECT 
  id,
  advance_id,
  amount,
  created_at,
  substring(created_at::text, 1, 10) as date_only
FROM advance_logs
WHERE id = '7355979a-6a37-4638-93c8-1bde33f1941e';
