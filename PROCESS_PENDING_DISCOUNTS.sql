-- ============================================================================
-- SQL PARA PROCESAR DESCUENTOS PENDIENTES DE fortnight_discounts
-- ============================================================================
-- Este script procesa manualmente descuentos que no fueron aplicados cuando
-- se marcó como pagada una quincena.
--
-- IMPORTANTE: Revisar el fortnight_id antes de ejecutar
-- ============================================================================

-- PASO 1: Identificar descuentos pendientes
-- Verificar cuántos descuentos hay pendientes
SELECT 
    fd.id,
    fd.fortnight_id,
    fd.broker_id,
    b.name as broker_name,
    fd.advance_id,
    fd.amount,
    fd.applied,
    fd.created_at,
    a.amount as advance_current_balance,
    a.status as advance_status,
    a.reason as advance_reason
FROM fortnight_discounts fd
JOIN advances a ON fd.advance_id = a.id
JOIN brokers b ON fd.broker_id = b.id
WHERE fd.applied = false
  -- REEMPLAZAR CON EL fortnight_id CORRECTO de la captura
  AND fd.fortnight_id = 'e6907455-f794-41b9-94ec-05de...' 
ORDER BY fd.created_at;

-- ============================================================================
-- PASO 2: PROCESAR DESCUENTOS (TRANSACCIÓN)
-- ============================================================================
-- IMPORTANTE: Ejecutar esta transacción COMPLETA o usar Rollback si algo falla
-- ============================================================================

BEGIN;

-- Variables auxiliares (reemplazar valores según tu caso)
DO $$
DECLARE
    v_fortnight_id uuid := 'e6907455-f794-41b9-94ec-05de...'; -- REEMPLAZAR
    v_user_id uuid := 'tu-user-id-aqui'; -- REEMPLAZAR con el ID del admin
    discount_record RECORD;
    v_current_advance RECORD;
    v_new_amount numeric;
    v_new_status text;
BEGIN
    -- Iterar sobre cada descuento pendiente
    FOR discount_record IN 
        SELECT id, advance_id, amount, broker_id
        FROM fortnight_discounts
        WHERE fortnight_id = v_fortnight_id
          AND applied = false
    LOOP
        RAISE NOTICE '=========================================';
        RAISE NOTICE 'Procesando discount: % (Amount: $%)', discount_record.id, discount_record.amount;
        
        -- 1. Crear advance_log
        INSERT INTO advance_logs (
            advance_id,
            amount,
            payment_type,
            fortnight_id,
            applied_by,
            created_at
        ) VALUES (
            discount_record.advance_id,
            discount_record.amount,
            'fortnight',
            v_fortnight_id,
            v_user_id,
            NOW()
        );
        RAISE NOTICE '  ✓ advance_log creado';
        
        -- 2. Obtener estado actual del advance
        SELECT amount, status INTO v_current_advance
        FROM advances
        WHERE id = discount_record.advance_id;
        
        IF NOT FOUND THEN
            RAISE WARNING '  ✗ Advance no encontrado: %', discount_record.advance_id;
            CONTINUE;
        END IF;
        
        RAISE NOTICE '  Current balance: $%, Status: %', v_current_advance.amount, v_current_advance.status;
        
        -- 3. Calcular nuevo saldo y status
        v_new_amount := GREATEST(0, v_current_advance.amount - discount_record.amount);
        
        IF v_new_amount <= 0 THEN
            v_new_status := 'paid';
        ELSIF v_current_advance.status = 'pending' THEN
            v_new_status := 'partial';
        ELSE
            v_new_status := v_current_advance.status;
        END IF;
        
        RAISE NOTICE '  New balance: $%, New status: %', v_new_amount, v_new_status;
        
        -- 4. Actualizar advance
        UPDATE advances
        SET 
            amount = v_new_amount,
            status = v_new_status
        WHERE id = discount_record.advance_id;
        RAISE NOTICE '  ✓ Advance actualizado';
        
        -- 5. Marcar discount como aplicado
        UPDATE fortnight_discounts
        SET applied = true
        WHERE id = discount_record.id;
        RAISE NOTICE '  ✓ Discount marcado como aplicado';
        
        RAISE NOTICE '=========================================';
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ PROCESO COMPLETADO';
    RAISE NOTICE 'Total de descuentos procesados: %', 
        (SELECT COUNT(*) FROM fortnight_discounts WHERE fortnight_id = v_fortnight_id AND applied = true);
END $$;

-- Si todo salió bien, confirmar cambios
COMMIT;

-- Si hubo algún error, deshacer cambios:
-- ROLLBACK;

-- ============================================================================
-- PASO 3: VERIFICACIÓN POST-PROCESAMIENTO
-- ============================================================================

-- Verificar que todos los descuentos fueron aplicados
SELECT 
    COUNT(*) as total_descuentos,
    SUM(CASE WHEN applied = true THEN 1 ELSE 0 END) as aplicados,
    SUM(CASE WHEN applied = false THEN 1 ELSE 0 END) as pendientes,
    SUM(amount) as total_amount
FROM fortnight_discounts
WHERE fortnight_id = 'e6907455-f794-41b9-94ec-05de...'; -- REEMPLAZAR

-- Verificar advance_logs creados
SELECT 
    al.id,
    al.advance_id,
    al.amount,
    al.payment_type,
    al.created_at,
    a.reason as advance_reason,
    b.name as broker_name
FROM advance_logs al
JOIN advances a ON al.advance_id = a.id
JOIN brokers b ON a.broker_id = b.id
WHERE al.fortnight_id = 'e6907455-f794-41b9-94ec-05de...' -- REEMPLAZAR
  AND al.payment_type = 'fortnight'
ORDER BY al.created_at DESC;

-- Verificar estado final de los advances afectados
SELECT 
    a.id,
    a.broker_id,
    b.name as broker_name,
    a.reason,
    a.amount as current_balance,
    a.status,
    (SELECT SUM(amount) FROM advance_logs WHERE advance_id = a.id) as total_paid
FROM advances a
JOIN brokers b ON a.broker_id = b.id
WHERE a.id IN (
    SELECT DISTINCT advance_id 
    FROM fortnight_discounts 
    WHERE fortnight_id = 'e6907455-f794-41b9-94ec-05de...' -- REEMPLAZAR
)
ORDER BY b.name, a.created_at;

-- ============================================================================
-- NOTAS IMPORTANTES:
-- ============================================================================
-- 1. Antes de ejecutar, verificar el fortnight_id correcto desde la captura
-- 2. Reemplazar v_user_id con el ID del usuario que ejecuta (admin)
-- 3. Ejecutar PASO 1 primero para revisar qué se procesará
-- 4. Ejecutar PASO 2 completo (BEGIN hasta COMMIT)
-- 5. Si hay error, ejecutar ROLLBACK en lugar de COMMIT
-- 6. Ejecutar PASO 3 para verificar que todo quedó correcto
-- ============================================================================
