-- Migración: Optimizar columnas de tabla brokers para formato ACH Banco General
-- Fecha: 2025-10-17
-- Objetivo: Agregar bank_route y eliminar columnas duplicadas innecesarias

-- ====================================================================
-- 1. AGREGAR COLUMNA FALTANTE PARA ACH
-- ====================================================================

-- bank_route: Código de ruta bancaria (ej: 71 para Banco General, 1 para Nacional)
-- Este campo es MANDATORIO para generar archivos ACH
ALTER TABLE public.brokers 
ADD COLUMN IF NOT EXISTS bank_route VARCHAR(9);

COMMENT ON COLUMN public.brokers.bank_route IS 'Código de ruta del banco destino para ACH (ej: 71=Banco General, 1=Banco Nacional). Numérico 1-9 dígitos.';

-- ====================================================================
-- 2. MIGRAR DATOS DE COLUMNAS DUPLICADAS ANTES DE ELIMINAR
-- ====================================================================

-- Migrar numero_cuenta a bank_account_no si bank_account_no está vacío
UPDATE public.brokers
SET bank_account_no = numero_cuenta
WHERE bank_account_no IS NULL 
  AND numero_cuenta IS NOT NULL;

-- Migrar numero_cedula a national_id si national_id está vacío
UPDATE public.brokers
SET national_id = numero_cedula
WHERE national_id IS NULL 
  AND numero_cedula IS NOT NULL;

-- ====================================================================
-- 3. ELIMINAR COLUMNAS DUPLICADAS INNECESARIAS
-- ====================================================================

-- Eliminar numero_cuenta (duplicado de bank_account_no)
ALTER TABLE public.brokers 
DROP COLUMN IF EXISTS numero_cuenta;

-- Eliminar numero_cedula (duplicado de national_id)
ALTER TABLE public.brokers 
DROP COLUMN IF EXISTS numero_cedula;

-- ====================================================================
-- 4. RENOMBRAR COLUMNAS PARA MAYOR CLARIDAD (OPCIONAL)
-- ====================================================================

-- Renombrar tipo_cuenta a account_type para consistencia con nomenclatura inglesa
-- NOTA: Solo ejecutar si prefieres nomenclatura en inglés
-- ALTER TABLE public.brokers 
-- RENAME COLUMN tipo_cuenta TO account_type;

-- ====================================================================
-- 5. AGREGAR ÍNDICES PARA MEJORAR RENDIMIENTO
-- ====================================================================

-- Índice para búsquedas por código de ruta bancaria
CREATE INDEX IF NOT EXISTS idx_brokers_bank_route 
ON public.brokers(bank_route) 
WHERE bank_route IS NOT NULL;

-- Índice para búsquedas por número de cuenta
CREATE INDEX IF NOT EXISTS idx_brokers_bank_account_no 
ON public.brokers(bank_account_no) 
WHERE bank_account_no IS NOT NULL;

-- ====================================================================
-- 6. AGREGAR VALIDACIONES (CHECK CONSTRAINTS)
-- ====================================================================

-- Validar que bank_route sea numérico cuando está presente
ALTER TABLE public.brokers
ADD CONSTRAINT chk_bank_route_numeric 
CHECK (bank_route IS NULL OR bank_route ~ '^[0-9]+$');

-- Validar que tipo_cuenta sea uno de los valores permitidos para ACH
ALTER TABLE public.brokers
ADD CONSTRAINT chk_tipo_cuenta_ach 
CHECK (
  tipo_cuenta IS NULL OR 
  tipo_cuenta IN ('CORRIENTE', 'AHORRO', 'PRESTAMO', 'CREDITO', 'CHEQUE')
);

-- ====================================================================
-- 7. ACTUALIZAR COMENTARIOS DE COLUMNAS
-- ====================================================================

COMMENT ON COLUMN public.brokers.bank_account_no IS 'Número de cuenta bancaria del broker para transferencias ACH. Sin guiones ni espacios (máx 17 caracteres).';
COMMENT ON COLUMN public.brokers.tipo_cuenta IS 'Tipo de cuenta bancaria: CORRIENTE (03), AHORRO (04), PRESTAMO (07). Se mapea automáticamente al código ACH.';
COMMENT ON COLUMN public.brokers.nombre_completo IS 'Nombre completo del beneficiario para archivo ACH. Se normaliza automáticamente (sin tildes, mayúsculas, máx 22 caracteres).';
COMMENT ON COLUMN public.brokers.national_id IS 'Cédula o RUC del broker. Usado para identificación en reportes.';

-- ====================================================================
-- 8. CREAR VISTA AUXILIAR PARA VALIDACIÓN DE DATOS ACH
-- ====================================================================

CREATE OR REPLACE VIEW public.brokers_ach_validation AS
SELECT 
  b.id,
  b.name,
  b.nombre_completo,
  b.bank_route,
  b.bank_account_no,
  b.tipo_cuenta,
  b.national_id,
  b.active,
  -- Validaciones
  CASE 
    WHEN b.bank_route IS NULL THEN 'Falta ruta bancaria'
    WHEN b.bank_account_no IS NULL THEN 'Falta número de cuenta'
    WHEN b.tipo_cuenta IS NULL THEN 'Falta tipo de cuenta'
    WHEN b.nombre_completo IS NULL AND b.name IS NULL THEN 'Falta nombre beneficiario'
    ELSE 'OK'
  END AS validation_status,
  -- Indicador si está listo para ACH
  CASE 
    WHEN b.bank_route IS NOT NULL 
     AND b.bank_account_no IS NOT NULL 
     AND b.tipo_cuenta IS NOT NULL 
     AND (b.nombre_completo IS NOT NULL OR b.name IS NOT NULL)
    THEN true
    ELSE false
  END AS is_ach_ready
FROM public.brokers b;

COMMENT ON VIEW public.brokers_ach_validation IS 'Vista para verificar qué brokers tienen datos bancarios completos para exportación ACH. Usar para reportes de datos faltantes.';

-- ====================================================================
-- 9. DATOS DE EJEMPLO PARA CÓDIGOS DE RUTA BANCARIA PANAMÁ
-- ====================================================================

-- Tabla de referencia de bancos (opcional, solo para documentación)
-- Códigos de ruta más comunes en Panamá:
-- 
-- 1   = Banco Nacional de Panamá
-- 12  = Banco General
-- 71  = Banco General (ACH)
-- 22  = Banistmo
-- 41  = Global Bank
-- 45  = BAC (Banco de América Central)
-- 52  = Banesco
-- 
-- Nota: Verificar códigos actualizados con Banco General

-- ====================================================================
-- FIN DE MIGRACIÓN
-- ====================================================================

-- Para verificar la migración:
-- SELECT * FROM public.brokers_ach_validation WHERE active = true;
-- 
-- Para ver brokers sin datos completos:
-- SELECT * FROM public.brokers_ach_validation 
-- WHERE active = true AND is_ach_ready = false;
