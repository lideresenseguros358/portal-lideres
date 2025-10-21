-- Migración: Actualizar tabla user_requests con campos ACH correctos
-- Fecha: 2025-10-21
-- Objetivo: Alinear user_requests con estructura ACH de brokers

-- ====================================================================
-- 1. AGREGAR NUEVAS COLUMNAS ACH
-- ====================================================================

-- Agregar bank_route (código de ruta bancaria)
ALTER TABLE public.user_requests
ADD COLUMN IF NOT EXISTS bank_route VARCHAR(9);

COMMENT ON COLUMN public.user_requests.bank_route IS 'Código de ruta del banco ACH (ej: 71=Banco General). Se copia a brokers.bank_route al aprobar.';

-- Renombrar numero_cuenta a bank_account_no para consistencia
DO $$
BEGIN
  -- Verificar si la columna numero_cuenta existe
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_requests' 
    AND column_name = 'numero_cuenta'
  ) THEN
    -- Si bank_account_no no existe, renombrar
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'user_requests' 
      AND column_name = 'bank_account_no'
    ) THEN
      ALTER TABLE public.user_requests RENAME COLUMN numero_cuenta TO bank_account_no;
    END IF;
  ELSE
    -- Si numero_cuenta no existe pero tampoco bank_account_no, crear bank_account_no
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'user_requests' 
      AND column_name = 'bank_account_no'
    ) THEN
      ALTER TABLE public.user_requests ADD COLUMN bank_account_no VARCHAR(17);
    END IF;
  END IF;
END $$;

-- Renombrar numero_cedula_bancaria a nombre_completo_titular para mayor claridad
DO $$
BEGIN
  -- Verificar si la columna numero_cedula_bancaria existe
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_requests' 
    AND column_name = 'numero_cedula_bancaria'
  ) THEN
    -- Si nombre_completo_titular no existe, renombrar
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'user_requests' 
      AND column_name = 'nombre_completo_titular'
    ) THEN
      ALTER TABLE public.user_requests RENAME COLUMN numero_cedula_bancaria TO nombre_completo_titular;
    END IF;
  ELSE
    -- Si numero_cedula_bancaria no existe pero tampoco nombre_completo_titular, crear
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'user_requests' 
      AND column_name = 'nombre_completo_titular'
    ) THEN
      ALTER TABLE public.user_requests ADD COLUMN nombre_completo_titular VARCHAR(22);
    END IF;
  END IF;
END $$;

COMMENT ON COLUMN public.user_requests.bank_account_no IS 'Número de cuenta bancaria del solicitante. Se copia a brokers.bank_account_no al aprobar.';
COMMENT ON COLUMN public.user_requests.tipo_cuenta IS 'Código de tipo de cuenta ACH: 03=Corriente, 04=Ahorro. Se copia a brokers.tipo_cuenta al aprobar.';
COMMENT ON COLUMN public.user_requests.nombre_completo_titular IS 'Nombre completo del titular de cuenta bancaria (MAYÚSCULAS sin acentos, máx 22 chars). Se copia a brokers.nombre_completo al aprobar.';

-- ====================================================================
-- 2. ACTUALIZAR CONSTRAINT DE tipo_cuenta
-- ====================================================================

-- Eliminar constraint antiguo si existe
ALTER TABLE public.user_requests DROP CONSTRAINT IF EXISTS chk_user_requests_tipo_cuenta;

-- Agregar constraint que solo permite 03 o 04
ALTER TABLE public.user_requests
ADD CONSTRAINT chk_user_requests_tipo_cuenta 
CHECK (tipo_cuenta IN ('03', '04'));

-- ====================================================================
-- 3. AGREGAR FOREIGN KEY A bank_route (opcional)
-- ====================================================================

-- Solo agregar FK si la tabla ach_banks existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'ach_banks'
  ) THEN
    -- Eliminar FK si ya existe
    ALTER TABLE public.user_requests DROP CONSTRAINT IF EXISTS fk_user_requests_bank_route;
    
    -- Agregar FK
    ALTER TABLE public.user_requests
    ADD CONSTRAINT fk_user_requests_bank_route 
    FOREIGN KEY (bank_route) 
    REFERENCES public.ach_banks(route_code)
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

-- ====================================================================
-- 4. CREAR ÍNDICES
-- ====================================================================

CREATE INDEX IF NOT EXISTS idx_user_requests_bank_route 
ON public.user_requests(bank_route) 
WHERE bank_route IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_requests_tipo_cuenta 
ON public.user_requests(tipo_cuenta);

-- ====================================================================
-- 5. MIGRAR DATOS EXISTENTES (si hay registros pendientes)
-- ====================================================================

-- Si nombre_completo_titular está vacío, usar nombre_completo del solicitante
UPDATE public.user_requests
SET nombre_completo_titular = nombre_completo
WHERE nombre_completo_titular IS NULL 
  OR TRIM(nombre_completo_titular) = '';

-- Si tipo_cuenta está vacío, usar default '04' (Ahorro)
UPDATE public.user_requests
SET tipo_cuenta = '04'
WHERE tipo_cuenta IS NULL 
  OR tipo_cuenta NOT IN ('03', '04');

-- ====================================================================
-- FIN DE MIGRACIÓN
-- ====================================================================

-- Para verificar:
-- SELECT id, nombre_completo, bank_route, bank_account_no, tipo_cuenta, nombre_completo_titular 
-- FROM user_requests 
-- WHERE status = 'pending';
