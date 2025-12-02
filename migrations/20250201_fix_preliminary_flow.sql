-- =====================================================
-- FIX: Flujo Preliminar - NO crear clients/policies hasta completar TODOS los campos
-- =====================================================

-- 0. Crear tabla temp_client_imports si no existe
CREATE TABLE IF NOT EXISTS public.temp_client_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Cliente data
  client_name TEXT NOT NULL,
  national_id TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  
  -- Póliza data
  policy_number TEXT NOT NULL,
  insurer_name TEXT NOT NULL,
  ramo TEXT,
  start_date DATE,
  renewal_date DATE,
  status TEXT,
  
  -- Broker y porcentaje
  broker_email TEXT NOT NULL,
  percent_override NUMERIC(5,2),
  
  -- Estado del import
  import_status TEXT DEFAULT 'pending',
  error_message TEXT,
  
  -- Origen del registro
  source TEXT DEFAULT 'ajuste_pendiente',
  created_by UUID REFERENCES auth.users(id),
  
  -- Timestamps de procesamiento
  processed_at TIMESTAMPTZ,
  
  CONSTRAINT valid_import_status CHECK (import_status IN ('pending', 'processed', 'error'))
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_temp_imports_national_id ON public.temp_client_imports(national_id);
CREATE INDEX IF NOT EXISTS idx_temp_imports_policy_number ON public.temp_client_imports(policy_number);
CREATE INDEX IF NOT EXISTS idx_temp_imports_status ON public.temp_client_imports(import_status);
CREATE INDEX IF NOT EXISTS idx_temp_imports_broker_email ON public.temp_client_imports(broker_email);

-- RLS
ALTER TABLE public.temp_client_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "temp_imports_master_all" ON public.temp_client_imports;
CREATE POLICY "temp_imports_master_all" ON public.temp_client_imports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'master'
    )
  );

DROP POLICY IF EXISTS "temp_imports_broker_own" ON public.temp_client_imports;
CREATE POLICY "temp_imports_broker_own" ON public.temp_client_imports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() 
      AND p.email = broker_email
    )
  );

-- 1. Modificar función de proceso para REQUERIR TODOS los campos
CREATE OR REPLACE FUNCTION public.process_temp_client_import()
RETURNS TRIGGER AS $$
DECLARE
  v_client_id UUID;
  v_policy_id UUID;
  v_broker_id UUID;
  v_insurer_id UUID;
  v_broker_default_percent NUMERIC(5,2);
  v_missing_fields TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- VALIDAR TODOS LOS CAMPOS REQUERIDOS
  IF NEW.national_id IS NULL OR TRIM(NEW.national_id) = '' THEN
    v_missing_fields := array_append(v_missing_fields, 'Cédula/RUC');
  END IF;
  
  IF NEW.client_name IS NULL OR TRIM(NEW.client_name) = '' THEN
    v_missing_fields := array_append(v_missing_fields, 'Nombre cliente');
  END IF;
  
  IF NEW.email IS NULL OR TRIM(NEW.email) = '' THEN
    v_missing_fields := array_append(v_missing_fields, 'Email');
  END IF;
  
  IF NEW.phone IS NULL OR TRIM(NEW.phone) = '' THEN
    v_missing_fields := array_append(v_missing_fields, 'Teléfono');
  END IF;
  
  IF NEW.address IS NULL OR TRIM(NEW.address) = '' THEN
    v_missing_fields := array_append(v_missing_fields, 'Dirección');
  END IF;
  
  IF NEW.policy_number IS NULL OR TRIM(NEW.policy_number) = '' THEN
    v_missing_fields := array_append(v_missing_fields, 'Número de póliza');
  END IF;
  
  IF NEW.ramo IS NULL OR TRIM(NEW.ramo) = '' THEN
    v_missing_fields := array_append(v_missing_fields, 'Ramo');
  END IF;
  
  IF NEW.start_date IS NULL THEN
    v_missing_fields := array_append(v_missing_fields, 'Fecha inicio');
  END IF;
  
  IF NEW.renewal_date IS NULL THEN
    v_missing_fields := array_append(v_missing_fields, 'Fecha renovación');
  END IF;
  
  IF NEW.status IS NULL OR TRIM(NEW.status) = '' THEN
    v_missing_fields := array_append(v_missing_fields, 'Estado de póliza');
  END IF;

  -- Si faltan campos, mantener como preliminar con error descriptivo
  IF array_length(v_missing_fields, 1) > 0 THEN
    NEW.import_status = 'pending';
    NEW.error_message = 'Campos faltantes: ' || array_to_string(v_missing_fields, ', ');
    RETURN NEW; -- Mantener en temp_client_imports como preliminar
  END IF;

  -- Si ya fue procesado anteriormente, no hacer nada
  IF NEW.import_status = 'processed' THEN
    RETURN NEW;
  END IF;

  -- Resolver broker_id desde email
  SELECT b.id, b.percent_default INTO v_broker_id, v_broker_default_percent
  FROM public.brokers b
  INNER JOIN public.profiles p ON p.id = b.p_id
  WHERE p.email = NEW.broker_email;

  IF v_broker_id IS NULL THEN
    NEW.import_status = 'error';
    NEW.error_message = 'Broker no encontrado con email: ' || NEW.broker_email;
    NEW.processed_at = NOW();
    RETURN NEW;
  END IF;

  -- Resolver insurer_id desde nombre
  SELECT id INTO v_insurer_id
  FROM public.insurers
  WHERE LOWER(name) = LOWER(TRIM(NEW.insurer_name))
  AND active = true;

  IF v_insurer_id IS NULL THEN
    NEW.import_status = 'error';
    NEW.error_message = 'Aseguradora no encontrada o inactiva: ' || NEW.insurer_name;
    NEW.processed_at = NOW();
    RETURN NEW;
  END IF;

  -- Validar que policy_number no exista ya
  SELECT id INTO v_policy_id
  FROM public.policies
  WHERE policy_number = NEW.policy_number;

  IF v_policy_id IS NOT NULL THEN
    NEW.import_status = 'error';
    NEW.error_message = 'Número de póliza ya existe: ' || NEW.policy_number;
    NEW.processed_at = NOW();
    RETURN NEW;
  END IF;

  -- ✅ TODOS LOS CAMPOS COMPLETOS - PROCESAR

  -- PASO 1: Buscar o crear cliente
  SELECT id INTO v_client_id
  FROM public.clients
  WHERE national_id = NEW.national_id
  AND broker_id = v_broker_id;

  IF v_client_id IS NULL THEN
    -- Crear nuevo cliente
    INSERT INTO public.clients (
      name, national_id, email, phone, address, broker_id, active
    ) VALUES (
      NEW.client_name,
      NEW.national_id,
      NEW.email,
      NEW.phone,
      NEW.address,
      v_broker_id,
      true
    ) RETURNING id INTO v_client_id;
  ELSE
    -- Cliente existe, actualizar datos
    UPDATE public.clients SET
      name = COALESCE(NEW.client_name, name),
      email = COALESCE(NEW.email, email),
      phone = COALESCE(NEW.phone, phone),
      address = COALESCE(NEW.address, address)
    WHERE id = v_client_id;
  END IF;

  -- PASO 2: Crear póliza
  INSERT INTO public.policies (
    client_id,
    broker_id,
    insurer_id,
    policy_number,
    ramo,
    start_date,
    renewal_date,
    status,
    percent_override
  ) VALUES (
    v_client_id,
    v_broker_id,
    v_insurer_id,
    NEW.policy_number,
    NEW.ramo,
    NEW.start_date,
    NEW.renewal_date,
    NEW.status::policy_status_enum,
    NEW.percent_override
  ) RETURNING id INTO v_policy_id;

  -- ✅ ÉXITO: Cliente y póliza creados
  NEW.import_status = 'processed';
  NEW.processed_at = NOW();
  NEW.error_message = NULL;
  
  -- Si es un UPDATE, eliminar registro después de procesar
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM public.temp_client_imports WHERE id = NEW.id;
    RETURN NULL;
  END IF;
  
  -- Si es un INSERT, retornar NULL para cancelar la inserción
  RETURN NULL;

EXCEPTION WHEN OTHERS THEN
  NEW.import_status = 'error';
  NEW.error_message = SQLERRM;
  NEW.processed_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recrear trigger
DROP TRIGGER IF EXISTS trigger_process_temp_import ON public.temp_client_imports;
CREATE TRIGGER trigger_process_temp_import
  BEFORE INSERT OR UPDATE ON public.temp_client_imports
  FOR EACH ROW
  EXECUTE FUNCTION public.process_temp_client_import();


-- =====================================================
-- COMENTARIOS
-- =====================================================
COMMENT ON FUNCTION public.process_temp_client_import() IS 
'ACTUALIZADO: Requiere TODOS los campos antes de crear clients/policies. Mantiene registros incompletos en temp_client_imports como preliminares con error_message descriptivo de campos faltantes.';
