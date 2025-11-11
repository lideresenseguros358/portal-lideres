-- =====================================================
-- FIX: Eliminar constraint antiguo de tipo_cuenta
-- Fecha: 2025-11-11
-- Problema: Constraint permitía solo 'Ahorro'/'Corriente'
--           pero ahora usamos códigos ACH '03'/'04'
-- =====================================================

-- 1. Eliminar constraint antiguo (nombre generado por Postgres)
DO $$ 
BEGIN
    -- Buscar y eliminar el constraint antiguo
    IF EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'brokers_tipo_cuenta_check' 
          AND conrelid = 'public.brokers'::regclass
    ) THEN
        ALTER TABLE public.brokers DROP CONSTRAINT brokers_tipo_cuenta_check;
        RAISE NOTICE 'Constraint antiguo brokers_tipo_cuenta_check eliminado';
    END IF;
END $$;

-- 2. Eliminar otros posibles constraints relacionados
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.brokers'::regclass 
          AND conname LIKE '%tipo_cuenta%'
          AND contype = 'c'  -- Solo CHECK constraints
    LOOP
        EXECUTE format('ALTER TABLE public.brokers DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
        RAISE NOTICE 'Constraint % eliminado', constraint_record.conname;
    END LOOP;
END $$;

-- 3. Migrar datos existentes de formato antiguo a formato nuevo
UPDATE public.brokers 
SET tipo_cuenta = CASE 
    WHEN tipo_cuenta = 'Ahorro' THEN '04'
    WHEN tipo_cuenta = 'Corriente' THEN '03'
    ELSE tipo_cuenta  -- Mantener si ya está en formato nuevo
END
WHERE tipo_cuenta IN ('Ahorro', 'Corriente');

-- 4. Agregar nuevo CHECK constraint con códigos ACH correctos
-- Solo si no existe foreign key (que es más restrictiva)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_brokers_tipo_cuenta' 
          AND conrelid = 'public.brokers'::regclass
    ) THEN
        -- Si no hay foreign key, agregar CHECK constraint como fallback
        ALTER TABLE public.brokers 
        ADD CONSTRAINT chk_tipo_cuenta_ach_codes 
        CHECK (tipo_cuenta IS NULL OR tipo_cuenta IN ('03', '04'));
        
        RAISE NOTICE 'CHECK constraint agregado para códigos ACH';
    ELSE
        RAISE NOTICE 'Foreign key ya existe, no se necesita CHECK constraint';
    END IF;
END $$;

-- 5. Actualizar comentario
COMMENT ON COLUMN public.brokers.tipo_cuenta IS 
'Código de tipo de cuenta ACH: 03 (Corriente) o 04 (Ahorro). Referencia a ach_account_types.code';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Ver constraints actuales de la columna tipo_cuenta:
DO $$
DECLARE
    constraint_info TEXT;
BEGIN
    SELECT string_agg(conname || ' (' || contype::text || ')', ', ')
    INTO constraint_info
    FROM pg_constraint
    WHERE conrelid = 'public.brokers'::regclass
      AND conname LIKE '%tipo_cuenta%';
    
    IF constraint_info IS NOT NULL THEN
        RAISE NOTICE 'Constraints activos en tipo_cuenta: %', constraint_info;
    ELSE
        RAISE NOTICE 'No hay constraints en tipo_cuenta (OK si hay FK)';
    END IF;
END $$;

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
