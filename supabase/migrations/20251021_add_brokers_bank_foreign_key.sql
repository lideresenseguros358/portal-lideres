-- Migración: Conectar tabla brokers con ach_banks mediante foreign key
-- Fecha: 2025-10-21
-- Objetivo: Garantizar integridad referencial entre brokers.bank_route y ach_banks.route_code

-- ====================================================================
-- 1. AGREGAR FOREIGN KEY DE brokers.bank_route → ach_banks.route_code
-- ====================================================================

-- Primero, crear un índice único en ach_banks.route_code si no existe
CREATE UNIQUE INDEX IF NOT EXISTS idx_ach_banks_route_code_unique 
ON public.ach_banks(route_code);

-- Agregar foreign key constraint
-- Esto asegura que todo bank_route en brokers debe existir en ach_banks.route_code
ALTER TABLE public.brokers
ADD CONSTRAINT fk_brokers_bank_route 
FOREIGN KEY (bank_route) 
REFERENCES public.ach_banks(route_code)
ON DELETE SET NULL  -- Si se elimina un banco, poner NULL en brokers
ON UPDATE CASCADE;  -- Si cambia el route_code, actualizar en brokers

COMMENT ON CONSTRAINT fk_brokers_bank_route ON public.brokers IS 
'Garantiza que bank_route siempre corresponda a un banco válido en ach_banks. Mantiene integridad referencial del catálogo de bancos.';

-- ====================================================================
-- 2. CREAR VISTA ENRIQUECIDA CON DATOS DEL BANCO
-- ====================================================================

-- Vista que une brokers con información del banco desde ach_banks
CREATE OR REPLACE VIEW public.brokers_with_bank_info AS
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
  b.tipo_cuenta,
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
    THEN true
    ELSE false
  END AS is_ach_ready,
  -- Información del banco (puede ser NULL si no tiene bank_route)
  CASE 
    WHEN ab.status = 'ACTIVE' THEN true
    ELSE false
  END AS bank_is_active
FROM public.brokers b
LEFT JOIN public.ach_banks ab ON b.bank_route = ab.route_code;

COMMENT ON VIEW public.brokers_with_bank_info IS 
'Vista enriquecida de brokers con información del banco desde ach_banks. Incluye validación ACH y estado del banco.';

-- ====================================================================
-- 3. FUNCIÓN AUXILIAR PARA VALIDAR BROKER ANTES DE EXPORTAR ACH
-- ====================================================================

CREATE OR REPLACE FUNCTION public.validate_broker_for_ach(broker_id UUID)
RETURNS TABLE (
  is_valid BOOLEAN,
  error_message TEXT,
  bank_name TEXT,
  account_number TEXT,
  account_type TEXT,
  beneficiary_name TEXT
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_broker RECORD;
BEGIN
  -- Obtener datos del broker con info del banco
  SELECT * INTO v_broker
  FROM public.brokers_with_bank_info
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
    RETURN QUERY SELECT false, 'Falta código de ruta bancaria (bank_route)', NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Validar que el banco exista y esté activo
  IF v_broker.bank_name IS NULL THEN
    RETURN QUERY SELECT false, 'Código de ruta bancaria inválido o banco no encontrado', NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  IF NOT v_broker.bank_is_active THEN
    RETURN QUERY SELECT false, 'El banco seleccionado está inactivo en el catálogo', v_broker.bank_name, NULL::TEXT, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Validar número de cuenta
  IF v_broker.bank_account_no IS NULL OR LENGTH(TRIM(v_broker.bank_account_no)) = 0 THEN
    RETURN QUERY SELECT false, 'Falta número de cuenta bancaria', v_broker.bank_name, NULL::TEXT, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Validar tipo de cuenta
  IF v_broker.tipo_cuenta IS NULL THEN
    RETURN QUERY SELECT false, 'Falta tipo de cuenta', v_broker.bank_name, v_broker.bank_account_no, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Validar que tipo_cuenta sea 03 o 04
  IF v_broker.tipo_cuenta NOT IN ('03', '04', 'CORRIENTE', 'AHORRO') THEN
    RETURN QUERY SELECT false, 'Tipo de cuenta inválido. Debe ser CORRIENTE (03) o AHORRO (04)', v_broker.bank_name, v_broker.bank_account_no, v_broker.tipo_cuenta, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Validar nombre del beneficiario
  IF v_broker.nombre_completo IS NULL OR LENGTH(TRIM(v_broker.nombre_completo)) = 0 THEN
    IF v_broker.name IS NULL OR LENGTH(TRIM(v_broker.name)) = 0 THEN
      RETURN QUERY SELECT false, 'Falta nombre del beneficiario', v_broker.bank_name, v_broker.bank_account_no, v_broker.tipo_cuenta, NULL::TEXT;
      RETURN;
    END IF;
  END IF;
  
  -- Si llegamos aquí, todo está OK
  RETURN QUERY SELECT 
    true, 
    'OK - Datos completos para ACH'::TEXT,
    v_broker.bank_name,
    v_broker.bank_account_no,
    v_broker.tipo_cuenta,
    COALESCE(v_broker.nombre_completo, v_broker.name);
END;
$$;

COMMENT ON FUNCTION public.validate_broker_for_ach IS 
'Valida que un broker tenga todos los datos necesarios para exportación ACH. Retorna detalles de validación y datos bancarios.';

-- ====================================================================
-- 4. EJEMPLO DE USO
-- ====================================================================

-- Validar un broker específico:
-- SELECT * FROM validate_broker_for_ach('uuid-del-broker');

-- Ver todos los brokers con su información bancaria:
-- SELECT * FROM brokers_with_bank_info WHERE active = true;

-- Ver brokers listos para ACH:
-- SELECT * FROM brokers_with_bank_info WHERE is_ach_ready = true AND active = true;

-- Ver brokers con problemas para ACH:
-- SELECT * FROM brokers_with_bank_info WHERE is_ach_ready = false AND active = true;

-- Validar todos los brokers activos:
-- SELECT 
--   b.id,
--   b.name,
--   v.*
-- FROM brokers b
-- CROSS JOIN LATERAL validate_broker_for_ach(b.id) v
-- WHERE b.active = true
-- ORDER BY v.is_valid DESC, b.name;

-- ====================================================================
-- FIN DE MIGRACIÓN
-- ====================================================================
