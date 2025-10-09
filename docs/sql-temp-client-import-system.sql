-- =====================================================
-- SISTEMA DE CLIENTES PRELIMINARES
-- Tabla temp_client_import + Triggers automáticos
-- =====================================================

-- =====================================================
-- 1. CREAR TABLA temp_client_import
-- =====================================================

CREATE TABLE IF NOT EXISTS temp_client_import (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Datos del cliente
  client_name TEXT,
  national_id TEXT,
  email TEXT,
  phone TEXT,
  
  -- Datos de la póliza
  policy_number TEXT,
  ramo TEXT,
  insurer_id UUID REFERENCES insurers(id),
  start_date DATE,
  renewal_date DATE,  -- Este campo es el que típicamente falta
  status TEXT DEFAULT 'ACTIVA',
  
  -- Asignación
  broker_id UUID REFERENCES brokers(id),
  
  -- Metadata
  source TEXT, -- 'unidentified_pending', 'manual', etc.
  source_id UUID, -- ID del pending original si aplica
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  migrated_at TIMESTAMPTZ, -- Fecha cuando se migró a clients/policies
  migrated BOOLEAN DEFAULT false,
  
  -- IDs de los registros creados (una vez migrado)
  client_id UUID REFERENCES clients(id),
  policy_id UUID REFERENCES policies(id),
  
  -- Notas
  notes TEXT
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_temp_client_import_migrated ON temp_client_import(migrated);
CREATE INDEX IF NOT EXISTS idx_temp_client_import_broker ON temp_client_import(broker_id);
CREATE INDEX IF NOT EXISTS idx_temp_client_import_source ON temp_client_import(source_id);
CREATE INDEX IF NOT EXISTS idx_temp_client_import_policy_number ON temp_client_import(policy_number);

-- Comentarios
COMMENT ON TABLE temp_client_import IS 'Tabla temporal para clientes preliminares pendientes de completar datos';
COMMENT ON COLUMN temp_client_import.renewal_date IS 'Fecha de renovación - típicamente el dato faltante';
COMMENT ON COLUMN temp_client_import.migrated IS 'True si ya fue migrado a clients/policies';

-- =====================================================
-- 2. FUNCIÓN PARA VALIDAR DATOS COMPLETOS
-- =====================================================

CREATE OR REPLACE FUNCTION check_temp_client_complete()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar si todos los datos obligatorios están presentes
  IF NEW.client_name IS NOT NULL 
     AND NEW.client_name != ''
     AND NEW.policy_number IS NOT NULL 
     AND NEW.policy_number != ''
     AND NEW.insurer_id IS NOT NULL
     AND NEW.renewal_date IS NOT NULL
     AND NEW.broker_id IS NOT NULL
     AND NEW.migrated = false
  THEN
    -- Llamar a la función de migración
    PERFORM migrate_temp_client_to_production(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. FUNCIÓN PARA MIGRAR A PRODUCCIÓN
-- =====================================================

CREATE OR REPLACE FUNCTION migrate_temp_client_to_production(temp_id UUID)
RETURNS void AS $$
DECLARE
  temp_record RECORD;
  new_client_id UUID;
  new_policy_id UUID;
  existing_client_id UUID;
BEGIN
  -- Obtener registro temporal
  SELECT * INTO temp_record FROM temp_client_import WHERE id = temp_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro temporal no encontrado: %', temp_id;
  END IF;
  
  -- Verificar que no esté ya migrado
  IF temp_record.migrated THEN
    RETURN;
  END IF;
  
  -- Verificar datos obligatorios
  IF temp_record.client_name IS NULL OR temp_record.client_name = '' THEN
    RAISE EXCEPTION 'Nombre del cliente requerido';
  END IF;
  
  IF temp_record.policy_number IS NULL OR temp_record.policy_number = '' THEN
    RAISE EXCEPTION 'Número de póliza requerido';
  END IF;
  
  IF temp_record.insurer_id IS NULL THEN
    RAISE EXCEPTION 'Aseguradora requerida';
  END IF;
  
  IF temp_record.renewal_date IS NULL THEN
    RAISE EXCEPTION 'Fecha de renovación requerida';
  END IF;
  
  IF temp_record.broker_id IS NULL THEN
    RAISE EXCEPTION 'Broker requerido';
  END IF;
  
  -- Verificar si el cliente ya existe (por nombre o cédula)
  SELECT id INTO existing_client_id
  FROM clients
  WHERE (national_id IS NOT NULL AND national_id = temp_record.national_id)
     OR (UPPER(name) = UPPER(temp_record.client_name))
  LIMIT 1;
  
  -- Si el cliente existe, usar ese ID
  IF existing_client_id IS NOT NULL THEN
    new_client_id := existing_client_id;
    
    -- Actualizar datos del cliente si es necesario
    UPDATE clients
    SET 
      national_id = COALESCE(clients.national_id, temp_record.national_id),
      email = COALESCE(clients.email, temp_record.email),
      phone = COALESCE(clients.phone, temp_record.phone)
    WHERE id = existing_client_id;
  ELSE
    -- Crear nuevo cliente
    INSERT INTO clients (
      name,
      national_id,
      email,
      phone,
      broker_id,
      active
    ) VALUES (
      UPPER(temp_record.client_name),
      NULLIF(UPPER(TRIM(temp_record.national_id)), ''),
      NULLIF(LOWER(TRIM(temp_record.email)), ''),
      NULLIF(TRIM(temp_record.phone), ''),
      temp_record.broker_id,
      true
    )
    RETURNING id INTO new_client_id;
  END IF;
  
  -- Verificar si la póliza ya existe
  IF EXISTS (SELECT 1 FROM policies WHERE policy_number = UPPER(temp_record.policy_number)) THEN
    RAISE EXCEPTION 'La póliza % ya existe', temp_record.policy_number;
  END IF;
  
  -- Crear póliza
  INSERT INTO policies (
    client_id,
    broker_id,
    policy_number,
    insurer_id,
    ramo,
    start_date,
    renewal_date,
    status
  ) VALUES (
    new_client_id,
    temp_record.broker_id,
    UPPER(temp_record.policy_number),
    temp_record.insurer_id,
    NULLIF(UPPER(TRIM(temp_record.ramo)), ''),
    temp_record.start_date,
    temp_record.renewal_date,
    COALESCE(UPPER(temp_record.status), 'ACTIVA')
  )
  RETURNING id INTO new_policy_id;
  
  -- Actualizar registro temporal como migrado
  UPDATE temp_client_import
  SET 
    migrated = true,
    migrated_at = now(),
    client_id = new_client_id,
    policy_id = new_policy_id
  WHERE id = temp_id;
  
  RAISE NOTICE 'Cliente migrado exitosamente. Client ID: %, Policy ID: %', new_client_id, new_policy_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. TRIGGER PARA MIGRACIÓN AUTOMÁTICA
-- =====================================================

DROP TRIGGER IF EXISTS trigger_migrate_temp_client ON temp_client_import;

CREATE TRIGGER trigger_migrate_temp_client
  AFTER INSERT OR UPDATE ON temp_client_import
  FOR EACH ROW
  EXECUTE FUNCTION check_temp_client_complete();

-- =====================================================
-- 5. FUNCIÓN PARA OBTENER CAMPOS FALTANTES
-- =====================================================

CREATE OR REPLACE FUNCTION get_missing_fields(temp_id UUID)
RETURNS TEXT[] AS $$
DECLARE
  temp_record RECORD;
  missing_fields TEXT[] := ARRAY[]::TEXT[];
BEGIN
  SELECT * INTO temp_record FROM temp_client_import WHERE id = temp_id;
  
  IF NOT FOUND THEN
    RETURN ARRAY['Registro no encontrado'];
  END IF;
  
  IF temp_record.client_name IS NULL OR temp_record.client_name = '' THEN
    missing_fields := array_append(missing_fields, 'Nombre del cliente');
  END IF;
  
  IF temp_record.policy_number IS NULL OR temp_record.policy_number = '' THEN
    missing_fields := array_append(missing_fields, 'Número de póliza');
  END IF;
  
  IF temp_record.insurer_id IS NULL THEN
    missing_fields := array_append(missing_fields, 'Aseguradora');
  END IF;
  
  IF temp_record.renewal_date IS NULL THEN
    missing_fields := array_append(missing_fields, 'Fecha de renovación');
  END IF;
  
  IF temp_record.broker_id IS NULL THEN
    missing_fields := array_append(missing_fields, 'Corredor asignado');
  END IF;
  
  RETURN missing_fields;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. RLS POLICIES
-- =====================================================

-- Habilitar RLS
ALTER TABLE temp_client_import ENABLE ROW LEVEL SECURITY;

-- Policy para Master: Ver todos
CREATE POLICY "Master puede ver todos los clientes temporales"
  ON temp_client_import
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- Policy para Broker: Solo ver los suyos
CREATE POLICY "Broker puede ver sus clientes temporales"
  ON temp_client_import
  FOR SELECT
  TO authenticated
  USING (
    broker_id = auth.uid()
  );

-- Policy para Master: Puede insertar/actualizar todos
CREATE POLICY "Master puede insertar clientes temporales"
  ON temp_client_import
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

CREATE POLICY "Master puede actualizar clientes temporales"
  ON temp_client_import
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- Policy para Broker: Puede actualizar solo los suyos
CREATE POLICY "Broker puede actualizar sus clientes temporales"
  ON temp_client_import
  FOR UPDATE
  TO authenticated
  USING (broker_id = auth.uid())
  WITH CHECK (broker_id = auth.uid());

-- Policy para Master: Puede eliminar
CREATE POLICY "Master puede eliminar clientes temporales"
  ON temp_client_import
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- =====================================================
-- 7. FUNCIÓN HELPER PARA CREAR DESDE PENDIENTES
-- =====================================================

CREATE OR REPLACE FUNCTION create_temp_client_from_pending(
  p_client_name TEXT,
  p_policy_number TEXT,
  p_insurer_id UUID,
  p_broker_id UUID,
  p_source_id UUID DEFAULT NULL,
  p_national_id TEXT DEFAULT NULL,
  p_ramo TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO temp_client_import (
    client_name,
    policy_number,
    insurer_id,
    broker_id,
    source,
    source_id,
    national_id,
    ramo
  ) VALUES (
    UPPER(TRIM(p_client_name)),
    UPPER(TRIM(p_policy_number)),
    p_insurer_id,
    p_broker_id,
    'unidentified_pending',
    p_source_id,
    NULLIF(UPPER(TRIM(p_national_id)), ''),
    NULLIF(UPPER(TRIM(p_ramo)), '')
  )
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. TRIGGER PARA ACTUALIZAR updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_temp_client_import_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_temp_client_import_timestamp ON temp_client_import;

CREATE TRIGGER trigger_update_temp_client_import_timestamp
  BEFORE UPDATE ON temp_client_import
  FOR EACH ROW
  EXECUTE FUNCTION update_temp_client_import_timestamp();

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Ver estructura de la tabla
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'temp_client_import'
ORDER BY ordinal_position;

-- Ver triggers
SELECT 
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'temp_client_import';

-- Ver RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'temp_client_import';
