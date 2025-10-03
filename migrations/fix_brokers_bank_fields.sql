-- ========================================
-- FIX: CAMPOS BANCARIOS EN BROKERS
-- ========================================
-- Formato CSV Banco General:
-- "Tipo de cuenta","Numero de cuenta","Numero de cedula o identificacion","Nombre completo","Monto","Concepto de pago"
-- ========================================

-- Eliminar campos bancarios viejos si existen
ALTER TABLE public.brokers DROP COLUMN IF EXISTS bank_name CASCADE;
ALTER TABLE public.brokers DROP COLUMN IF EXISTS bank_account CASCADE;
ALTER TABLE public.brokers DROP COLUMN IF EXISTS account_type CASCADE;
ALTER TABLE public.brokers DROP COLUMN IF EXISTS routing_number CASCADE;

-- Agregar campos bancarios correctos
ALTER TABLE public.brokers 
ADD COLUMN IF NOT EXISTS tipo_cuenta TEXT CHECK (tipo_cuenta IN ('Ahorro', 'Corriente')),
ADD COLUMN IF NOT EXISTS numero_cuenta TEXT,
ADD COLUMN IF NOT EXISTS numero_cedula TEXT,
ADD COLUMN IF NOT EXISTS nombre_completo TEXT;

-- Comentarios
COMMENT ON COLUMN public.brokers.tipo_cuenta IS 'Tipo de cuenta bancaria: Ahorro o Corriente';
COMMENT ON COLUMN public.brokers.numero_cuenta IS 'Número de cuenta bancaria (formato: 040012345678)';
COMMENT ON COLUMN public.brokers.numero_cedula IS 'Cédula o identificación (formato: 8-123-4567, PE-56-7890, E-9-87654)';
COMMENT ON COLUMN public.brokers.nombre_completo IS 'Nombre completo del titular de la cuenta';

-- Actualizar datos existentes desde profiles si es necesario
UPDATE public.brokers b
SET 
  numero_cedula = COALESCE(b.numero_cedula, p.national_id),
  nombre_completo = COALESCE(b.nombre_completo, b.name)
FROM public.profiles p
WHERE b.id = p.id AND (b.numero_cedula IS NULL OR b.nombre_completo IS NULL);
