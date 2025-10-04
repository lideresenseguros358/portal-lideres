-- Tabla para solicitudes de nuevos usuarios
CREATE TABLE IF NOT EXISTS user_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Credenciales
  email TEXT NOT NULL UNIQUE,
  encrypted_password TEXT NOT NULL, -- Guardamos temporalmente hasta aprobar
  
  -- Datos personales
  cedula TEXT NOT NULL,
  fecha_nacimiento DATE NOT NULL,
  telefono TEXT NOT NULL,
  licencia TEXT,
  
  -- Datos bancarios
  tipo_cuenta TEXT NOT NULL DEFAULT 'Ahorro',
  numero_cuenta TEXT NOT NULL,
  numero_cedula_bancaria TEXT NOT NULL,
  nombre_completo TEXT NOT NULL,
  
  -- Campos dinámicos adicionales (JSON para flexibilidad)
  additional_fields JSONB DEFAULT '{}'::jsonb,
  
  -- Estado de la solicitud
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  
  -- Asignación (cuando se aprueba)
  assigned_role TEXT, -- 'master' | 'broker'
  assigned_commission_percent DECIMAL(5,2),
  
  -- Auditoría
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_requests_email ON user_requests(email);
CREATE INDEX IF NOT EXISTS idx_user_requests_status ON user_requests(status);
CREATE INDEX IF NOT EXISTS idx_user_requests_created_at ON user_requests(created_at DESC);

-- RLS Policies
ALTER TABLE user_requests ENABLE ROW LEVEL SECURITY;

-- Solo Master puede ver/editar solicitudes
CREATE POLICY "Master can view all requests" ON user_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

CREATE POLICY "Master can update requests" ON user_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- Cualquiera puede crear una solicitud (formulario público)
CREATE POLICY "Anyone can create request" ON user_requests
  FOR INSERT
  WITH CHECK (true);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_user_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_requests_updated_at
  BEFORE UPDATE ON user_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_user_requests_updated_at();

-- Comentarios
COMMENT ON TABLE user_requests IS 'Solicitudes de registro de nuevos usuarios pendientes de aprobación';
COMMENT ON COLUMN user_requests.additional_fields IS 'Campos dinámicos extras definidos en configuración CSV';
