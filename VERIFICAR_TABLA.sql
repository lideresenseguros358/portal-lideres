-- Ejecuta esto en Supabase SQL Editor para verificar si la tabla existe

-- 1. Verificar si la tabla existe
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public'
   AND table_name = 'insurer_contacts'
);

-- 2. Si existe, ver su estructura
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'insurer_contacts'
ORDER BY ordinal_position;

-- 3. Ver los constraints
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name = 'insurer_contacts';
