-- FIX: Políticas RLS de tabla POLICIES
-- PROBLEMA: Clientes aparecen pero sus pólizas no
-- SOLUCIÓN: Corregir políticas de policies para que evalúen broker_id correctamente

-- =====================================================
-- PASO 1: Eliminar TODAS las políticas de policies
-- =====================================================

DROP POLICY IF EXISTS "Brokers view own policies" ON policies;
DROP POLICY IF EXISTS "Brokers can view own policies" ON policies;
DROP POLICY IF EXISTS "Brokers see their policies" ON policies;
DROP POLICY IF EXISTS "Enable read access for brokers on policies" ON policies;
DROP POLICY IF EXISTS "Master can view all policies" ON policies;
DROP POLICY IF EXISTS "Brokers view their assigned policies" ON policies;
DROP POLICY IF EXISTS "Master can modify all policies" ON policies;
DROP POLICY IF EXISTS "Brokers can modify their policies" ON policies;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON policies;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON policies;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON policies;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON policies;

-- =====================================================
-- PASO 2: Crear políticas correctas para POLICIES
-- =====================================================

-- 1. Master puede ver TODAS las pólizas
CREATE POLICY "Master views all policies"
ON policies FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'master'
  )
);

-- 2. Brokers ven SOLO pólizas con SU broker_id
CREATE POLICY "Brokers view their policies"
ON policies FOR SELECT
TO authenticated
USING (
  broker_id IN (
    SELECT b.id 
    FROM brokers b
    WHERE b.p_id = auth.uid()
  )
);

-- 3. Master puede INSERT en todas las pólizas
CREATE POLICY "Master inserts all policies"
ON policies FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'master'
  )
);

-- 4. Brokers pueden INSERT solo con su broker_id
CREATE POLICY "Brokers insert their policies"
ON policies FOR INSERT
TO authenticated
WITH CHECK (
  broker_id IN (
    SELECT b.id 
    FROM brokers b
    WHERE b.p_id = auth.uid()
  )
);

-- 5. Master puede UPDATE todas las pólizas
CREATE POLICY "Master updates all policies"
ON policies FOR UPDATE
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

-- 6. Brokers pueden UPDATE solo pólizas con su broker_id
CREATE POLICY "Brokers update their policies"
ON policies FOR UPDATE
TO authenticated
USING (
  broker_id IN (
    SELECT b.id 
    FROM brokers b
    WHERE b.p_id = auth.uid()
  )
)
WITH CHECK (
  broker_id IN (
    SELECT b.id 
    FROM brokers b
    WHERE b.p_id = auth.uid()
  )
);

-- 7. Master puede DELETE todas las pólizas
CREATE POLICY "Master deletes all policies"
ON policies FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'master'
  )
);

-- 8. Brokers pueden DELETE solo pólizas con su broker_id
CREATE POLICY "Brokers delete their policies"
ON policies FOR DELETE
TO authenticated
USING (
  broker_id IN (
    SELECT b.id 
    FROM brokers b
    WHERE b.p_id = auth.uid()
  )
);

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Ver políticas aplicadas
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'policies'
ORDER BY policyname;

-- NOTA IMPORTANTE:
-- Después de ejecutar este script, el broker debe poder ver:
-- 1. Los clientes con su broker_id
-- 2. Las pólizas de esos clientes (también con su broker_id)
-- 
-- El endpoint de reasignación actualiza AMBOS:
-- - clients.broker_id
-- - policies.broker_id
-- 
-- Así que las pólizas deben aparecer inmediatamente
