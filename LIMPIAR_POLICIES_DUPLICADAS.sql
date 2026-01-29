-- ELIMINAR POLÍTICAS DUPLICADAS Y PROBLEMÁTICAS DE TABLA POLICIES
-- Las políticas viejas usan broker_id = auth.uid() que es INCORRECTO
-- auth.uid() es el ID del usuario, NO del broker

-- Eliminar todas las políticas viejas problemáticas
DROP POLICY IF EXISTS "policies_select_by_role" ON policies;
DROP POLICY IF EXISTS "policies_modify_by_role" ON policies;
DROP POLICY IF EXISTS "policies_cud_own" ON policies;
DROP POLICY IF EXISTS "policies_cud_master" ON policies;
DROP POLICY IF EXISTS "policies_read_own" ON policies;
DROP POLICY IF EXISTS "policies_read_master" ON policies;

-- Las políticas correctas ya están creadas:
-- ✅ Brokers view their policies
-- ✅ Master views all policies
-- ✅ Brokers insert their policies
-- ✅ Master inserts all policies
-- ✅ Brokers update their policies
-- ✅ Master updates all policies
-- ✅ Brokers delete their policies
-- ✅ Master deletes all policies

-- Verificar que solo queden las correctas
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'policies'
ORDER BY policyname;

-- Debe retornar solo 8 políticas (las correctas que creamos)
