-- ================================================================
-- SQL DE PRUEBA: REPORTE DE AJUSTE APROBADO
-- Broker: javiersamudio@lideresenseguros.com
-- Aseguradora: ANCON
-- ================================================================

-- PASO 1: Obtener IDs necesarios
-- (Ejecuta estas queries primero para verificar que existen)

-- Verificar broker ID
SELECT 
    b.id as broker_id, 
    p.email, 
    b.name as broker_name,
    b.percent_default
FROM brokers b
INNER JOIN profiles p ON p.id = b.p_id
WHERE p.email = 'javiersamudio@lideresenseguros.com';

-- Verificar insurer ID de ANCON
SELECT id, name FROM insurers WHERE name ILIKE '%ANCON%';

-- ================================================================
-- PASO 2: INSERTAR DATOS DE PRUEBA
-- ================================================================

-- Crear variables temporales para los IDs (usando gen_random_uuid())
DO $$
DECLARE
    v_pending_item_id uuid := gen_random_uuid();
    v_report_id uuid := gen_random_uuid();
    v_report_item_id uuid := gen_random_uuid();
    v_broker_id uuid;
    v_insurer_id uuid;
BEGIN
    -- Obtener broker ID
    SELECT b.id INTO v_broker_id
    FROM brokers b
    INNER JOIN profiles p ON p.id = b.p_id
    WHERE p.email = 'javiersamudio@lideresenseguros.com'
    LIMIT 1;
    
    -- Obtener insurer ID de ANCON
    SELECT id INTO v_insurer_id
    FROM insurers
    WHERE name ILIKE '%ANCON%'
    LIMIT 1;
    
    -- Insertar pending_item (ajuste sin identificar)
    INSERT INTO pending_items (
        id,
        policy_number,
        insured_name,
        commission_raw,
        insurer_id,
        status,
        assigned_broker_id,
        created_at
    )
    VALUES (
        v_pending_item_id,
        'TEST-ANCON-2024-001',
        'CLIENTE PRUEBA AJUSTE APROBADO',
        500.00,  -- Comisión cruda (monto bruto)
        v_insurer_id,
        'in_review',  -- Status cuando está en un reporte
        v_broker_id,
        NOW()
    );
    
    -- Insertar adjustment_report (reporte aprobado)
    INSERT INTO adjustment_reports (
        id,
        broker_id,
        status,
        total_amount,
        broker_notes,
        admin_notes,
        created_at,
        updated_at
    )
    VALUES (
        v_report_id,
        v_broker_id,
        'approved',  -- ← ESTATUS APROBADO
        410.00,  -- Total broker commission (500 * 0.82 = 410)
        'Reporte de prueba - ajuste ANCON cliente ficticio',
        'APROBADO POR MASTER - Datos de prueba para verificar visualización',
        NOW(),
        NOW()
    );
    
    -- Insertar adjustment_report_items (vincula reporte con pending_item)
    INSERT INTO adjustment_report_items (
        id,
        report_id,
        pending_item_id,
        commission_raw,
        broker_commission
    )
    VALUES (
        v_report_item_id,
        v_report_id,
        v_pending_item_id,
        500.00,  -- Monto bruto
        410.00   -- Comisión broker (500 * 0.82 = 410)
    );
    
    -- Mostrar IDs generados para referencia
    RAISE NOTICE 'Pending Item ID: %', v_pending_item_id;
    RAISE NOTICE 'Report ID: %', v_report_id;
    RAISE NOTICE 'Report Item ID: %', v_report_item_id;
END $$;

-- ================================================================
-- VERIFICACIÓN: Ver el reporte creado
-- ================================================================

-- Ver el reporte de prueba (buscar por nota única)
SELECT 
    ar.id,
    ar.status,
    ar.total_amount,
    ar.broker_notes,
    ar.admin_notes,
    ar.created_at,
    b.name as broker_name,
    (SELECT COUNT(*) FROM adjustment_report_items WHERE report_id = ar.id) as item_count
FROM adjustment_reports ar
INNER JOIN brokers b ON b.id = ar.broker_id
WHERE ar.broker_notes ILIKE '%Reporte de prueba - ajuste ANCON cliente ficticio%';

-- Ver items del reporte (buscar por policy_number del pending_item)
SELECT 
    ari.id,
    ari.report_id,
    ari.commission_raw,
    ari.broker_commission,
    pi.policy_number,
    pi.insured_name,
    pi.commission_raw as pending_item_amount,
    i.name as insurer_name
FROM adjustment_report_items ari
INNER JOIN pending_items pi ON pi.id = ari.pending_item_id
LEFT JOIN insurers i ON i.id = pi.insurer_id
WHERE pi.policy_number = 'TEST-ANCON-2024-001';

-- ================================================================
-- NOTAS IMPORTANTES:
-- ================================================================
-- 
-- 1. Este reporte tiene status='approved' y debería aparecer en 
--    la sección "Reportados" del broker con badge verde "Aprobado"
--
-- 2. El monto total es $410 (comisión del broker al 82%)
--
-- 3. El reporte NO debe aparecer en "Pagados" hasta que master
--    confirme el pago (cambio a status='paid')
--
-- 4. Para eliminar estos datos de prueba, ejecuta el archivo:
--    DELETE_TEST_REPORTE_APROBADO.sql
--
-- ================================================================
