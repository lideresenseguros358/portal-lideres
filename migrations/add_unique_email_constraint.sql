-- ============================================
-- ADD UNIQUE CONSTRAINT PARA EMAIL EN user_requests
-- ============================================
-- Esto previene emails duplicados en solicitudes pendientes
-- sin necesidad de hacer SELECT con RLS
-- ============================================

-- Primero verificamos si ya existe el constraint
DO $$
BEGIN
  -- Intentar agregar el constraint solo si no existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_requests_email_pending_unique'
  ) THEN
    -- Crear índice único parcial: solo para status='pending'
    -- Esto permite que un mismo email tenga múltiples solicitudes rechazadas/aprobadas
    -- pero solo UNA pendiente a la vez
    CREATE UNIQUE INDEX user_requests_email_pending_unique 
    ON user_requests (email) 
    WHERE status = 'pending';
    
    RAISE NOTICE '✅ Unique constraint creado: user_requests_email_pending_unique';
  ELSE
    RAISE NOTICE 'ℹ️ Unique constraint ya existe: user_requests_email_pending_unique';
  END IF;
END $$;

-- Verificar que se creó correctamente
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'user_requests' 
  AND indexname = 'user_requests_email_pending_unique';
