-- =====================================================
-- DATOS DE BROKERS PARA ACTUALIZACIÓN MASIVA
-- Fecha: 2025-11-11
-- =====================================================
-- INSTRUCCIONES:
-- 1. Ejecutar primero: 20251111_remove_beneficiary_id.sql
-- 2. Ejecutar primero: 20251111_fix_tipo_cuenta_constraint.sql  
-- 3. Luego ejecutar este archivo
-- =====================================================

-- Función helper para formatear número de cuenta
CREATE OR REPLACE FUNCTION format_account_number(account_no TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Eliminar espacios, guiones, puntos
    account_no := TRIM(REGEXP_REPLACE(account_no, '[^0-9]', '', 'g'));
    
    -- Si empieza con 3 o 4 (un solo dígito) y tiene longitud <= 16, agregar 0
    IF LENGTH(account_no) > 0 AND account_no ~ '^[34]' AND LENGTH(account_no) <= 16 THEN
        account_no := '0' || account_no;
    END IF;
    
    RETURN NULLIF(account_no, '');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Función helper para obtener código de banco
CREATE OR REPLACE FUNCTION get_bank_code(bank_name TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN CASE 
        WHEN bank_name ILIKE '%GENERAL%' THEN '71'
        WHEN bank_name ILIKE '%BANISTMO%' THEN '22'
        WHEN bank_name ILIKE '%BAC%' THEN '45'
        WHEN bank_name ILIKE '%GLOBAL%' THEN '41'
        WHEN bank_name ILIKE '%NACIONAL%' THEN '01'
        WHEN bank_name ILIKE '%CAJA%' THEN '06'
        WHEN bank_name ILIKE '%BANESCO%' THEN '52'
        WHEN bank_name ILIKE '%MULTIBANK%' THEN '53'
        WHEN bank_name ILIKE '%CREDICORP%' THEN '47'
        WHEN bank_name ILIKE '%SCOTI%' THEN '50'
        WHEN bank_name ILIKE '%LAFISE%' THEN '54'
        WHEN bank_name ILIKE '%CANAL%' THEN '46'
        WHEN bank_name ILIKE '%GEORGES%' THEN '55'
        WHEN bank_name ILIKE '%MERCANTIL%' THEN '48'
        ELSE NULL
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Función helper para tipo de cuenta
CREATE OR REPLACE FUNCTION get_account_type(tipo TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN CASE 
        WHEN tipo ILIKE '%corriente%' THEN '03'
        WHEN tipo ILIKE '%ahorro%' THEN '04'
        ELSE '04'
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- ACTUALIZACIÓN MASIVA
-- =====================================================
-- FORMATO DE DATOS: 
-- (email, cedula_broker, banco, tipo_cuenta_texto, numero_cuenta, titular)
-- =====================================================

DO $$
DECLARE
    updated_count INTEGER := 0;
    not_found_count INTEGER := 0;
    error_count INTEGER := 0;
    broker_data RECORD;
BEGIN
    -- REEMPLAZAR ESTOS DATOS CON LOS REALES DE TU EXCEL
    FOR broker_data IN 
        SELECT * FROM (VALUES
            -- EJEMPLO (BORRAR Y REEMPLAZAR CON TUS DATOS):
            ('email1@example.com', '8-123-456', 'BANCO GENERAL', 'Ahorro', '4-49-98-751023-5', 'NOMBRE TITULAR 1'),
            ('email2@example.com', '8-789-012', 'BANISTMO', 'Corriente', '3-72-40-016782-0', 'NOMBRE TITULAR 2')
            -- ... agregar más filas aquí ...
        ) AS data(email, cedula, banco, tipo_cuenta_texto, numero_cuenta, titular)
    LOOP
        BEGIN
            -- Buscar y actualizar broker por email del perfil
            UPDATE public.brokers b
            SET 
                national_id = broker_data.cedula,
                bank_route = get_bank_code(broker_data.banco),
                tipo_cuenta = get_account_type(broker_data.tipo_cuenta_texto),
                bank_account_no = format_account_number(broker_data.numero_cuenta),
                nombre_completo = UPPER(UNACCENT(LEFT(broker_data.titular, 22)))
            FROM public.profiles p
            WHERE b.p_id = p.id
              AND LOWER(TRIM(p.email)) = LOWER(TRIM(broker_data.email));
            
            IF FOUND THEN
                updated_count := updated_count + 1;
                RAISE NOTICE '✅ Actualizado: % (%)', broker_data.email, broker_data.titular;
            ELSE
                not_found_count := not_found_count + 1;
                RAISE NOTICE '⚠️  No encontrado: %', broker_data.email;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            RAISE NOTICE '❌ Error con %: %', broker_data.email, SQLERRM;
        END;
    END LOOP;
    
    -- Reporte final
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'RESUMEN DE ACTUALIZACIÓN:';
    RAISE NOTICE '✅ Actualizados: %', updated_count;
    RAISE NOTICE '⚠️  No encontrados: %', not_found_count;
    RAISE NOTICE '❌ Errores: %', error_count;
    RAISE NOTICE '==========================================';
END $$;

-- Verificar resultados
SELECT 
    b.name as nombre_broker,
    p.email,
    b.national_id as cedula,
    b.bank_route as codigo_banco,
    ab.bank_name,
    b.tipo_cuenta,
    act.name as tipo_nombre,
    b.bank_account_no as cuenta,
    b.nombre_completo as titular,
    CASE 
        WHEN b.bank_route IS NOT NULL 
         AND b.bank_account_no IS NOT NULL 
         AND b.tipo_cuenta IS NOT NULL 
         AND b.nombre_completo IS NOT NULL 
        THEN '✅'
        ELSE '❌'
    END as ach_completo
FROM public.brokers b
JOIN public.profiles p ON b.p_id = p.id
LEFT JOIN public.ach_banks ab ON b.bank_route = ab.route_code
LEFT JOIN public.ach_account_types act ON b.tipo_cuenta = act.code
WHERE b.active = true
ORDER BY b.name;

-- =====================================================
-- LIMPIEZA (opcional, ejecutar al final)
-- =====================================================
-- DROP FUNCTION IF EXISTS format_account_number(TEXT);
-- DROP FUNCTION IF EXISTS get_bank_code(TEXT);
-- DROP FUNCTION IF EXISTS get_account_type(TEXT);
