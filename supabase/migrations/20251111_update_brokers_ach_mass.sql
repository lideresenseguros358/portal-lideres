-- =====================================================
-- ACTUALIZACIÓN MASIVA DE BROKERS - DATOS BANCARIOS
-- Fecha: 2025-11-11
-- =====================================================

-- PASO 1: Eliminar columna beneficiary_id (no requerida por Banco General)
-- =====================================================
ALTER TABLE public.brokers DROP COLUMN IF EXISTS beneficiary_id CASCADE;

COMMENT ON TABLE public.brokers IS 
'Tabla de corredores. beneficiary_id eliminada porque Banco General no la requiere en archivos ACH.';

-- PASO 2: Función helper para limpiar y formatear número de cuenta
-- =====================================================
CREATE OR REPLACE FUNCTION format_account_number(account_no TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Eliminar espacios, guiones
    account_no := TRIM(REGEXP_REPLACE(account_no, '[^0-9]', '', 'g'));
    
    -- Si empieza con 3 o 4 (un solo dígito), agregar 0 al inicio
    IF LENGTH(account_no) > 0 AND account_no ~ '^[34]' AND LENGTH(account_no) <= 16 THEN
        account_no := '0' || account_no;
    END IF;
    
    RETURN NULLIF(account_no, '');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- PASO 3: Función helper para normalizar nombre del banco a código
-- =====================================================
CREATE OR REPLACE FUNCTION get_bank_code_from_name(bank_name TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN CASE 
        WHEN bank_name ILIKE '%BANCO GENERAL%' THEN '71'
        WHEN bank_name ILIKE '%BANISTMO%' THEN '22'
        WHEN bank_name ILIKE '%BAC%' THEN '45'
        WHEN bank_name ILIKE '%GLOBAL BANK%' OR bank_name ILIKE '%GLOBAL%' THEN '41'
        WHEN bank_name ILIKE '%NACIONAL%' THEN '01'
        WHEN bank_name ILIKE '%CAJA%AHORRO%' THEN '06'
        WHEN bank_name ILIKE '%BANESCO%' THEN '52'
        WHEN bank_name ILIKE '%MULTIBANK%' THEN '53'
        WHEN bank_name ILIKE '%CREDICORP%' THEN '47'
        WHEN bank_name ILIKE '%SCOTIABANK%' OR bank_name ILIKE '%SCOTIA%' THEN '50'
        WHEN bank_name ILIKE '%LAFISE%' THEN '54'
        WHEN bank_name ILIKE '%CANAL BANK%' THEN '46'
        WHEN bank_name ILIKE '%ST%GEORGES%' THEN '55'
        WHEN bank_name ILIKE '%MERCANTIL%' THEN '48'
        ELSE NULL
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- PASO 4: Función helper para tipo de cuenta (texto a código)
-- =====================================================
CREATE OR REPLACE FUNCTION get_account_type_code(account_type TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN CASE 
        WHEN account_type ILIKE '%corriente%' THEN '03'
        WHEN account_type ILIKE '%ahorro%' THEN '04'
        ELSE '04' -- Default ahorro
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- PASO 5: Actualización masiva de brokers
-- =====================================================
-- IMPORTANTE: Ajusta los datos según tu Excel
-- Formato esperado: email, cedula, banco, tipo_cuenta_texto, numero_cuenta, nombre_titular

DO $$
DECLARE
    broker_record RECORD;
    updated_count INTEGER := 0;
    errors_count INTEGER := 0;
BEGIN
    -- Array de datos de tu Excel (AJUSTAR CON TUS DATOS REALES)
    -- Formato: (email, cedula, banco, tipo_cuenta, numero_cuenta, titular)
    FOR broker_record IN 
        SELECT * FROM (VALUES
            -- EJEMPLO - REEMPLAZAR CON TUS DATOS REALES:
            ('adolfo@example.com', '8-751-1023', 'BANCO GENERAL', 'Ahorro', '4-49-98-751023-5', 'ADOLFO PRESCOTT'),
            ('ana@example.com', '8-123-456', 'BANCO GENERAL', 'Ahorro', '4-72-40-016782-0', 'ANA CAROLINA SAMUDIO ROVIRA')
            -- ... más filas aquí
        ) AS data(email, cedula, banco, tipo_cuenta_texto, numero_cuenta, titular)
    LOOP
        BEGIN
            UPDATE public.brokers
            SET 
                national_id = broker_record.cedula,
                bank_route = get_bank_code_from_name(broker_record.banco),
                tipo_cuenta = get_account_type_code(broker_record.tipo_cuenta_texto),
                bank_account_no = format_account_number(broker_record.numero_cuenta),
                nombre_completo = UPPER(UNACCENT(broker_record.titular))
            WHERE p_id IN (
                SELECT id FROM public.profiles WHERE LOWER(email) = LOWER(broker_record.email)
            );
            
            IF FOUND THEN
                updated_count := updated_count + 1;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            errors_count := errors_count + 1;
            RAISE NOTICE 'Error actualizando %: %', broker_record.email, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Actualización completada: % registros actualizados, % errores', updated_count, errors_count;
END $$;

-- PASO 6: Verificar datos actualizados
-- =====================================================
SELECT 
    b.name,
    p.email,
    b.national_id as cedula,
    b.bank_route as codigo_banco,
    ab.bank_name,
    b.tipo_cuenta as tipo_codigo,
    act.name as tipo_nombre,
    b.bank_account_no as numero_cuenta,
    b.nombre_completo as titular,
    CASE 
        WHEN b.bank_route IS NOT NULL 
         AND b.bank_account_no IS NOT NULL 
         AND b.tipo_cuenta IS NOT NULL 
         AND b.nombre_completo IS NOT NULL 
        THEN '✅ COMPLETO'
        ELSE '❌ INCOMPLETO'
    END as estado_ach
FROM public.brokers b
LEFT JOIN public.profiles p ON b.p_id = p.id
LEFT JOIN public.ach_banks ab ON b.bank_route = ab.route_code
LEFT JOIN public.ach_account_types act ON b.tipo_cuenta = act.code
WHERE b.active = true
ORDER BY b.name;

-- =====================================================
-- LIMPIEZA
-- =====================================================
-- Eliminar funciones helper si ya no se necesitan
-- DROP FUNCTION IF EXISTS format_account_number(TEXT);
-- DROP FUNCTION IF EXISTS get_bank_code_from_name(TEXT);
-- DROP FUNCTION IF EXISTS get_account_type_code(TEXT);

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
