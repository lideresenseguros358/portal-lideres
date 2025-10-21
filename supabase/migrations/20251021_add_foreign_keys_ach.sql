-- Migración: Agregar Foreign Keys para integridad referencial ACH
-- Fecha: 2025-10-21
-- Objetivo: Conectar brokers con ach_banks y ach_account_types

-- ====================================================================
-- 1. FOREIGN KEY: brokers.bank_route → ach_banks.route_code
-- ====================================================================

-- Crear índice único en ach_banks.route_code si no existe
CREATE UNIQUE INDEX IF NOT EXISTS idx_ach_banks_route_code_unique 
ON public.ach_banks(route_code);

-- Agregar foreign key
ALTER TABLE public.brokers
DROP CONSTRAINT IF EXISTS fk_brokers_bank_route;

ALTER TABLE public.brokers
ADD CONSTRAINT fk_brokers_bank_route 
FOREIGN KEY (bank_route) 
REFERENCES public.ach_banks(route_code)
ON DELETE SET NULL
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_brokers_bank_route ON public.brokers IS 
'Garantiza que bank_route corresponda a un banco válido en ach_banks.';

-- ====================================================================
-- 2. FOREIGN KEY: brokers.tipo_cuenta → ach_account_types.code
-- ====================================================================

-- Crear índice único en ach_account_types.code si no existe
CREATE UNIQUE INDEX IF NOT EXISTS idx_ach_account_types_code_unique 
ON public.ach_account_types(code);

-- Agregar foreign key
ALTER TABLE public.brokers
DROP CONSTRAINT IF EXISTS fk_brokers_tipo_cuenta;

ALTER TABLE public.brokers
ADD CONSTRAINT fk_brokers_tipo_cuenta 
FOREIGN KEY (tipo_cuenta) 
REFERENCES public.ach_account_types(code)
ON DELETE SET NULL
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_brokers_tipo_cuenta ON public.brokers IS 
'Garantiza que tipo_cuenta corresponda a un código válido en ach_account_types (03 o 04).';

-- ====================================================================
-- 3. ELIMINAR CONSTRAINT ANTIGUO (si existe)
-- ====================================================================

-- Eliminar el CHECK constraint antiguo que permitía texto
ALTER TABLE public.brokers
DROP CONSTRAINT IF EXISTS chk_tipo_cuenta_ach;

-- ====================================================================
-- 4. CREAR VISTA ENRIQUECIDA: brokers_with_ach_info
-- ====================================================================

-- Eliminar vista si ya existe
DROP VIEW IF EXISTS public.brokers_with_ach_info CASCADE;

CREATE OR REPLACE VIEW public.brokers_with_ach_info AS
SELECT 
  b.id,
  b.name,
  b.nombre_completo,
  b.email,
  b.phone,
  b.national_id,
  -- Datos bancarios
  b.bank_route,
  ab.bank_name,
  ab.route_code_raw AS bank_route_full,
  b.bank_account_no,
  -- Tipo de cuenta con nombre
  b.tipo_cuenta AS account_type_code,
  act.name AS account_type_name,
  -- Estado
  b.active,
  b.percent_default,
  b.broker_type,
  -- Validación ACH
  CASE 
    WHEN b.bank_route IS NOT NULL 
     AND b.bank_account_no IS NOT NULL 
     AND b.tipo_cuenta IS NOT NULL 
     AND (b.nombre_completo IS NOT NULL OR b.name IS NOT NULL)
     AND ab.status = 'ACTIVE'
     AND act.status = 'ACTIVE'
    THEN true
    ELSE false
  END AS is_ach_ready,
  -- Estado del banco y tipo cuenta
  CASE WHEN ab.status = 'ACTIVE' THEN true ELSE false END AS bank_is_active,
  CASE WHEN act.status = 'ACTIVE' THEN true ELSE false END AS account_type_is_active
FROM public.brokers b
LEFT JOIN public.ach_banks ab ON b.bank_route = ab.route_code
LEFT JOIN public.ach_account_types act ON b.tipo_cuenta = act.code;

COMMENT ON VIEW public.brokers_with_ach_info IS 
'Vista enriquecida de brokers con información del banco y tipo de cuenta desde tablas maestras ACH.';

-- ====================================================================
-- 5. FUNCIÓN DE VALIDACIÓN ACTUALIZADA
-- ====================================================================

-- Eliminar la función antigua si existe (tiene firma diferente)
DROP FUNCTION IF EXISTS public.validate_broker_for_ach(UUID);

CREATE OR REPLACE FUNCTION public.validate_broker_for_ach(broker_id UUID)
RETURNS TABLE (
  is_valid BOOLEAN,
  error_message TEXT,
  bank_name TEXT,
  account_type_name TEXT,
  account_number TEXT,
  beneficiary_name TEXT
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_broker RECORD;
BEGIN
  -- Obtener datos del broker con info del banco y tipo cuenta
  SELECT * INTO v_broker
  FROM public.brokers_with_ach_info
  WHERE id = broker_id;
  
  -- Si no existe el broker
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Broker no encontrado', NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Si no está activo
  IF NOT v_broker.active THEN
    RETURN QUERY SELECT false, 'Broker inactivo', NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Validar bank_route
  IF v_broker.bank_route IS NULL THEN
    RETURN QUERY SELECT false, 'Falta código de ruta bancaria', NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Validar que el banco exista y esté activo
  IF v_broker.bank_name IS NULL THEN
    RETURN QUERY SELECT false, 'Código de ruta inválido o banco no encontrado', NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  IF NOT v_broker.bank_is_active THEN
    RETURN QUERY SELECT false, 'El banco seleccionado está inactivo', v_broker.bank_name, NULL::TEXT, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Validar número de cuenta
  IF v_broker.bank_account_no IS NULL OR LENGTH(TRIM(v_broker.bank_account_no)) = 0 THEN
    RETURN QUERY SELECT false, 'Falta número de cuenta bancaria', v_broker.bank_name, NULL::TEXT, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Validar tipo de cuenta
  IF v_broker.account_type_code IS NULL THEN
    RETURN QUERY SELECT false, 'Falta tipo de cuenta', v_broker.bank_name, NULL::TEXT, v_broker.bank_account_no, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Validar que tipo_cuenta sea válido (03 o 04 de la tabla)
  IF v_broker.account_type_name IS NULL THEN
    RETURN QUERY SELECT false, 'Código de tipo de cuenta inválido', v_broker.bank_name, NULL::TEXT, v_broker.bank_account_no, NULL::TEXT;
    RETURN;
  END IF;
  
  IF NOT v_broker.account_type_is_active THEN
    RETURN QUERY SELECT false, 'El tipo de cuenta está inactivo', v_broker.bank_name, v_broker.account_type_name, v_broker.bank_account_no, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Validar nombre del beneficiario
  IF v_broker.nombre_completo IS NULL OR LENGTH(TRIM(v_broker.nombre_completo)) = 0 THEN
    IF v_broker.name IS NULL OR LENGTH(TRIM(v_broker.name)) = 0 THEN
      RETURN QUERY SELECT false, 'Falta nombre del beneficiario', v_broker.bank_name, v_broker.account_type_name, v_broker.bank_account_no, NULL::TEXT;
      RETURN;
    END IF;
  END IF;
  
  -- Si llegamos aquí, todo está OK
  RETURN QUERY SELECT 
    true, 
    'OK - Datos completos para ACH'::TEXT,
    v_broker.bank_name,
    v_broker.account_type_name,
    v_broker.bank_account_no,
    COALESCE(v_broker.nombre_completo, v_broker.name);
END;
$$;

COMMENT ON FUNCTION public.validate_broker_for_ach IS 
'Valida que un broker tenga datos ACH completos y válidos según tablas maestras.';

-- ====================================================================
-- 6. EJEMPLOS DE USO
-- ====================================================================

-- Ver todos los brokers con su información ACH:
-- SELECT * FROM brokers_with_ach_info WHERE active = true;

-- Validar un broker específico:
-- SELECT * FROM validate_broker_for_ach('uuid-del-broker');

-- Ver brokers listos para ACH:
-- SELECT * FROM brokers_with_ach_info WHERE is_ach_ready = true;

-- Ver brokers con problemas:
-- SELECT * FROM brokers_with_ach_info WHERE is_ach_ready = false AND active = true;

-- ====================================================================
-- FIN DE MIGRACIÓN
-- ====================================================================
