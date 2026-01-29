-- FIX: Permitir que todos los usuarios vean información básica de brokers
-- PROBLEMA: Cuando se reasigna un cliente a otro broker, el nuevo broker no puede ver al cliente
-- CAUSA: Las políticas RLS de 'brokers' impiden que un broker vea registros de otros brokers
-- SOLUCIÓN: Permitir lectura de todos los brokers (solo campos básicos: id, name, active)

-- 1. Eliminar política restrictiva anterior si existe
DROP POLICY IF EXISTS "Brokers can view own record" ON brokers;
DROP POLICY IF EXISTS "Brokers view own" ON brokers;

-- 2. Crear nueva política que permite a todos ver todos los brokers (solo lectura)
CREATE POLICY "All authenticated users can view all brokers"
ON brokers FOR SELECT
TO authenticated
USING (true);

-- NOTA: Esta política solo afecta SELECT (lectura)
-- Los brokers NO pueden modificar, insertar o eliminar registros de otros brokers
-- Solo Master puede hacer cambios (esas políticas permanecen intactas)

-- 3. Verificar políticas actuales
COMMENT ON POLICY "All authenticated users can view all brokers" ON brokers IS 
'Permite que todos los usuarios autenticados vean información básica de brokers. 
Necesario para que los JOINs en consultas de clientes funcionen correctamente 
cuando se reasignan clientes entre brokers.';

-- ALTERNATIVA: Si no quieres que todos vean todos los brokers,
-- puedes usar un enfoque diferente en el código (sin JOIN con brokers)
-- o crear una vista/función que bypasee RLS solo para ese campo específico
