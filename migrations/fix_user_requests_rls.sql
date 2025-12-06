-- ============================================
-- FIX: USER_REQUESTS RLS PARA ACCESO PÚBLICO
-- ============================================
-- 
-- PROBLEMA: La tabla user_requests tiene RLS que bloquea inserts públicos
-- SOLUCIÓN: Políticas que permiten:
--   1. Cualquiera puede INSERT (formulario público)
--   2. Solo Master puede SELECT/UPDATE (aprobar/rechazar)
--   3. Master puede DELETE (rechazar solicitudes)
--
-- EJECUTAR ESTE SCRIPT EN SUPABASE SQL EDITOR
-- ============================================

-- 1. Eliminar políticas existentes (para evitar conflictos)
DROP POLICY IF EXISTS "Master can view all requests" ON user_requests;
DROP POLICY IF EXISTS "Master can update requests" ON user_requests;
DROP POLICY IF EXISTS "Anyone can create request" ON user_requests;
DROP POLICY IF EXISTS "Master can delete requests" ON user_requests;

-- 2. Asegurar que RLS está habilitado
ALTER TABLE user_requests ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICA PÚBLICA: Cualquiera puede crear solicitud
-- Esta política NO requiere autenticación (true = todos)
CREATE POLICY "public_can_insert_request" ON user_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 4. POLÍTICA MASTER: Ver todas las solicitudes
CREATE POLICY "master_can_view_requests" ON user_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- 5. POLÍTICA MASTER: Actualizar solicitudes (aprobar)
CREATE POLICY "master_can_update_requests" ON user_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- 6. POLÍTICA MASTER: Eliminar solicitudes (rechazar)
CREATE POLICY "master_can_delete_requests" ON user_requests
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- 7. Verificar políticas creadas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'user_requests'
ORDER BY policyname;

-- ============================================
-- RESULTADO ESPERADO:
-- ============================================
-- public_can_insert_request     → INSERT para anon y authenticated (true)
-- master_can_view_requests      → SELECT solo para master
-- master_can_update_requests    → UPDATE solo para master
-- master_can_delete_requests    → DELETE solo para master
-- ============================================

COMMENT ON POLICY "public_can_insert_request" ON user_requests 
IS 'Permite a cualquier usuario (autenticado o anónimo) crear solicitudes de registro';

COMMENT ON POLICY "master_can_view_requests" ON user_requests 
IS 'Solo usuarios con rol master pueden ver las solicitudes';

COMMENT ON POLICY "master_can_update_requests" ON user_requests 
IS 'Solo usuarios con rol master pueden aprobar solicitudes';

COMMENT ON POLICY "master_can_delete_requests" ON user_requests 
IS 'Solo usuarios con rol master pueden rechazar (eliminar) solicitudes';
