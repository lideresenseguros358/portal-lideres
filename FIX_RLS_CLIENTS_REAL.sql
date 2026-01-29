-- FIX: Problema real - Broker no ve cliente reasignado en su listado
-- CAUSA: Las políticas RLS probablemente cachean el broker_id o usan subqueries
-- SOLUCIÓN: Asegurar que las políticas usen directamente el broker_id de la fila

-- =====================================================
-- PASO 1: Eliminar políticas problemáticas existentes
-- =====================================================

-- Eliminar políticas antiguas de clients
DROP POLICY IF EXISTS "Brokers view own clients" ON clients;
DROP POLICY IF EXISTS "Brokers can view own clients" ON clients;
DROP POLICY IF EXISTS "Brokers see their clients" ON clients;
DROP POLICY IF EXISTS "Enable read access for brokers" ON clients;

-- Eliminar políticas antiguas de policies
DROP POLICY IF EXISTS "Brokers view own policies" ON policies;
DROP POLICY IF EXISTS "Brokers can view own policies" ON policies;
DROP POLICY IF EXISTS "Brokers see their policies" ON policies;
DROP POLICY IF EXISTS "Enable read access for brokers on policies" ON policies;

-- =====================================================
-- PASO 2: Crear políticas correctas para CLIENTS
-- =====================================================

-- Master ve todo
CREATE POLICY "Master can view all clients"
ON clients FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'master'
  )
);

-- Brokers ven SOLO sus clientes (directo por broker_id, sin caché)
CREATE POLICY "Brokers view their assigned clients"
ON clients FOR SELECT
TO authenticated
USING (
  broker_id IN (
    SELECT b.id 
    FROM brokers b
    WHERE b.p_id = auth.uid()
  )
);

-- Master puede modificar todo
CREATE POLICY "Master can modify all clients"
ON clients FOR ALL
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

-- Brokers pueden modificar sus propios clientes
CREATE POLICY "Brokers can modify their clients"
ON clients FOR ALL
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

-- =====================================================
-- PASO 3: Crear políticas correctas para POLICIES
-- =====================================================

-- Master ve todas las pólizas
CREATE POLICY "Master can view all policies"
ON policies FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'master'
  )
);

-- Brokers ven pólizas de sus clientes (directo por broker_id)
CREATE POLICY "Brokers view their assigned policies"
ON policies FOR SELECT
TO authenticated
USING (
  broker_id IN (
    SELECT b.id 
    FROM brokers b
    WHERE b.p_id = auth.uid()
  )
);

-- Master puede modificar todas las pólizas
CREATE POLICY "Master can modify all policies"
ON policies FOR ALL
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

-- Brokers pueden modificar pólizas de sus clientes
CREATE POLICY "Brokers can modify their policies"
ON policies FOR ALL
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

-- =====================================================
-- NOTAS IMPORTANTES:
-- =====================================================
-- 1. Las políticas ahora evalúan broker_id DIRECTAMENTE de cada fila
-- 2. NO hay caché de broker_id, se evalúa en cada query
-- 3. Cuando cambias broker_id de un cliente, la política se re-evalúa
-- 4. El broker nuevo verá al cliente inmediatamente después del cambio
-- 5. El broker antiguo ya NO verá al cliente

-- VERIFICAR: Después de ejecutar, el nuevo broker debe ver al cliente sin cerrar sesión
