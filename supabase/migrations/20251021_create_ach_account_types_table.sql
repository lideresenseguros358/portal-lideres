-- Migración: Crear tabla ach_account_types (Catálogo de tipos de cuenta ACH)
-- Fecha: 2025-10-21
-- Objetivo: Catálogo maestro con solo 2 tipos de cuenta permitidos según Banco General

-- ====================================================================
-- 1. CREAR TABLA ach_account_types
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.ach_account_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(2) UNIQUE NOT NULL,           -- Código ACH: '03' o '04'
  name VARCHAR(50) NOT NULL,                 -- Nombre: 'Corriente' o 'Ahorro'
  description TEXT,                           -- Descripción opcional
  status VARCHAR(20) DEFAULT 'ACTIVE',       -- ACTIVE o INACTIVE
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE public.ach_account_types IS 
'Catálogo maestro de tipos de cuenta ACH para Banco General. Solo 2 tipos permitidos: Corriente (03) y Ahorro (04).';

-- ====================================================================
-- 2. INSERTAR LOS 2 TIPOS DE CUENTA OFICIALES
-- ====================================================================

INSERT INTO public.ach_account_types (code, name, description, status) VALUES
('03', 'Corriente', 'Cuenta Corriente - Permite emisión de cheques', 'ACTIVE'),
('04', 'Ahorro', 'Cuenta de Ahorro - Para ahorro personal', 'ACTIVE')
ON CONFLICT (code) DO NOTHING;

-- ====================================================================
-- 3. CREAR VISTA SIMPLIFICADA
-- ====================================================================

-- Eliminar vista si ya existe
DROP VIEW IF EXISTS public.ach_account_types_active CASCADE;

CREATE OR REPLACE VIEW public.ach_account_types_active AS
SELECT id, code, name
FROM public.ach_account_types
WHERE status = 'ACTIVE'
ORDER BY code;

COMMENT ON VIEW public.ach_account_types_active IS 
'Vista de tipos de cuenta activos para usar en dropdowns.';

-- ====================================================================
-- 4. CONFIGURAR RLS (Row Level Security)
-- ====================================================================

-- Habilitar RLS (solo si no está habilitado)
DO $$
BEGIN
  ALTER TABLE public.ach_account_types ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Crear política solo si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'ach_account_types' 
    AND policyname = 'ach_account_types_select_public'
  ) THEN
    CREATE POLICY ach_account_types_select_public 
    ON public.ach_account_types
    FOR SELECT
    TO authenticated
    USING (status = 'ACTIVE');
  END IF;
END $$;

-- ====================================================================
-- 5. AGREGAR ÍNDICES
-- ====================================================================

CREATE INDEX IF NOT EXISTS idx_ach_account_types_code 
ON public.ach_account_types(code);

CREATE INDEX IF NOT EXISTS idx_ach_account_types_status 
ON public.ach_account_types(status);

-- ====================================================================
-- FIN DE MIGRACIÓN
-- ====================================================================

-- Para verificar:
-- SELECT * FROM ach_account_types;
-- SELECT * FROM ach_account_types_active;
