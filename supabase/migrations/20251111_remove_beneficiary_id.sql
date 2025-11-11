-- =====================================================
-- ELIMINAR beneficiary_id - NO REQUERIDO POR BANCO GENERAL
-- Fecha: 2025-11-11
-- Motivo: Banco General no requiere cédula del titular en archivos ACH .TXT
-- =====================================================

-- PASO 1: Eliminar columna beneficiary_id de brokers
-- =====================================================
ALTER TABLE public.brokers DROP COLUMN IF EXISTS beneficiary_id CASCADE;

COMMENT ON TABLE public.brokers IS 
'Tabla de corredores. Campo beneficiary_id eliminado - Banco General ACH solo requiere: bank_route, bank_account_no, tipo_cuenta, nombre_completo.';

-- PASO 2: Actualizar comentarios de columnas ACH relevantes
-- =====================================================
COMMENT ON COLUMN public.brokers.national_id IS 
'Cédula o pasaporte del corredor (para identificación interna). NO se usa en archivos ACH.';

COMMENT ON COLUMN public.brokers.nombre_completo IS 
'Nombre completo del titular de la cuenta bancaria. MAYÚSCULAS sin tildes, máx 22 caracteres. Usado en archivos ACH Banco General.';

COMMENT ON COLUMN public.brokers.bank_account_no IS 
'Número de cuenta bancaria (sin espacios, guiones). Máx 17 dígitos. Formato ejemplo: 040012345678. Usado en archivos ACH.';

COMMENT ON COLUMN public.brokers.bank_route IS 
'Código de ruta del banco ACH. Referencia a ach_banks.route_code. Ejemplo: 71=Banco General. Usado en archivos ACH.';

COMMENT ON COLUMN public.brokers.tipo_cuenta IS 
'Código ACH del tipo de cuenta: 03=Corriente, 04=Ahorro. Referencia a ach_account_types.code. Usado en archivos ACH.';

-- PASO 3: Verificar estructura actualizada
-- =====================================================
DO $$
BEGIN
    -- Verificar que beneficiary_id fue eliminado
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'brokers' 
          AND column_name = 'beneficiary_id'
    ) THEN
        RAISE NOTICE '✅ beneficiary_id eliminado correctamente de brokers';
    ELSE
        RAISE EXCEPTION '❌ ERROR: beneficiary_id todavía existe en brokers';
    END IF;
    
    -- Verificar que los campos ACH requeridos existen
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'brokers' 
          AND column_name IN ('bank_route', 'bank_account_no', 'tipo_cuenta', 'nombre_completo')
        HAVING COUNT(*) = 4
    ) THEN
        RAISE NOTICE '✅ Todos los campos ACH requeridos están presentes';
    ELSE
        RAISE WARNING '⚠️  Falta algún campo ACH requerido';
    END IF;
END $$;

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
