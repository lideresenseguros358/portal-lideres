-- Verificar adelantos pagados con monto 0 o NULL
SELECT 
    id,
    broker_id,
    amount,
    reason,
    status,
    created_at
FROM advances
WHERE status = 'PAID'
ORDER BY created_at DESC;

-- Si necesitas corregirlos, primero identifica cuál debería ser el monto correcto
-- y luego ejecuta:
-- UPDATE advances 
-- SET amount = [MONTO_CORRECTO]
-- WHERE id = '[ID_DEL_ADELANTO]';
