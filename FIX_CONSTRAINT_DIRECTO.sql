-- =====================================================
-- FIX DIRECTO: Forzar eliminación del constraint
-- =====================================================

-- Ver todos los constraints en la tabla brokers
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.brokers'::regclass
ORDER BY conname;

-- Eliminar TODOS los constraints CHECK en tipo_cuenta
ALTER TABLE public.brokers DROP CONSTRAINT IF EXISTS brokers_tipo_cuenta_check CASCADE;
ALTER TABLE public.brokers DROP CONSTRAINT IF EXISTS chk_tipo_cuenta_ach CASCADE;
ALTER TABLE public.brokers DROP CONSTRAINT IF EXISTS chk_tipo_cuenta_ach_codes CASCADE;

-- Verificar que ya no existen
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.brokers'::regclass
  AND conname LIKE '%tipo_cuenta%'
  AND contype = 'c';

-- Si aparece algún constraint, anotarlo y eliminarlo manualmente
