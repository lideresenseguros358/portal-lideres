-- Permitir que los brokers actualicen su propio registro (phone)
-- Solo pueden actualizar campos específicos, no todo

-- Primero, eliminar la política existente si existe para recrearla
DROP POLICY IF EXISTS brokers_update_own ON public.brokers;

-- Crear política que permita a los brokers actualizar su propio registro
CREATE POLICY brokers_update_own ON public.brokers
  FOR UPDATE
  TO authenticated
  USING (p_id = auth.uid())
  WITH CHECK (p_id = auth.uid());

-- Nota: La política permite UPDATE pero solo cuando p_id = auth.uid()
-- Esto significa que un broker solo puede actualizar su propio registro
-- Los campos que puede actualizar están controlados por la aplicación
