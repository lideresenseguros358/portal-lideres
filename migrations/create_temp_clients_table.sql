-- ========================================
-- TABLA TEMPORAL PARA IMPORTACIÓN DE CLIENTES Y PÓLIZAS
-- ========================================
-- Esta tabla sirve como paso intermedio antes de insertar en clients y policies
-- Se usa para: imports CSV, clientes preliminares desde trámites, ajustes pendientes

CREATE TABLE IF NOT EXISTS public.temp_client_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Cliente data
  client_name TEXT NOT NULL,
  national_id TEXT, -- Obligatorio para pasar a oficial, puede ser NULL en preliminar
  email TEXT,
  phone TEXT,
  address TEXT,
  
  -- Póliza data
  policy_number TEXT NOT NULL,
  insurer_name TEXT NOT NULL, -- Se valida contra tabla insurers por nombre
  ramo TEXT,
  start_date DATE,
  renewal_date DATE,
  status TEXT, -- Valores válidos: ACTIVA, CANCELADA, VENCIDA (NULL permitido)
  
  -- Broker y porcentaje
  broker_email TEXT NOT NULL, -- Email del broker (se resuelve a broker_id)
  percent_override NUMERIC(5,2), -- Porcentaje específico, NULL usa default del broker
  
  -- Estado del import
  import_status TEXT DEFAULT 'pending', -- pending, processed, error
  error_message TEXT,
  
  -- Origen del registro (para tracking)
  source TEXT DEFAULT 'csv_import', -- csv_import, tramite, ajuste_pendiente, manual
  created_by UUID REFERENCES auth.users(id),
  
  -- Timestamps de procesamiento
  processed_at TIMESTAMPTZ,
  
  CONSTRAINT valid_import_status CHECK (import_status IN ('pending', 'processed', 'error'))
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_temp_imports_national_id ON public.temp_client_imports(national_id);
CREATE INDEX IF NOT EXISTS idx_temp_imports_policy_number ON public.temp_client_imports(policy_number);
CREATE INDEX IF NOT EXISTS idx_temp_imports_status ON public.temp_client_imports(import_status);
CREATE INDEX IF NOT EXISTS idx_temp_imports_broker_email ON public.temp_client_imports(broker_email);

-- RLS: Master ve todo, Broker solo sus registros
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

-- ========================================
-- FUNCIÓN PARA PROCESAR IMPORTS AUTOMÁTICAMENTE
-- ========================================
-- Se ejecuta cuando national_id pasa de NULL a un valor válido (activación de preliminar)
-- O cuando se inserta un registro con national_id completo

CREATE OR REPLACE FUNCTION public.process_temp_client_import()
RETURNS TRIGGER AS $$
DECLARE
  v_client_id UUID;
  v_policy_id UUID;
  v_broker_id UUID;
  v_insurer_id UUID;
  v_broker_default_percent NUMERIC(5,2);
BEGIN
  -- Si no tiene national_id, dejarlo como preliminar (retornar NEW para insertar/actualizar)
  IF NEW.national_id IS NULL THEN
    RETURN NEW;
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
    RETURN NEW; -- Mantener en temp con error
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
    RETURN NEW; -- Mantener en temp con error
  END IF;

  -- Validar que policy_number no exista ya
  SELECT id INTO v_policy_id
  FROM public.policies
  WHERE policy_number = NEW.policy_number;

  IF v_policy_id IS NOT NULL THEN
    NEW.import_status = 'error';
    NEW.error_message = 'Número de póliza ya existe: ' || NEW.policy_number;
    NEW.processed_at = NOW();
    RETURN NEW; -- Mantener en temp con error
  END IF;

  -- PASO 1: Buscar o crear cliente
  SELECT id INTO v_client_id
  FROM public.clients
  WHERE national_id = NEW.national_id
  AND broker_id = v_broker_id;

  IF v_client_id IS NULL THEN
    -- Crear nuevo cliente
    INSERT INTO public.clients (
      name, national_id, email, phone, broker_id, active
    ) VALUES (
      NEW.client_name,
      NEW.national_id,
      NEW.email,
      NEW.phone,
      v_broker_id,
      true
    ) RETURNING id INTO v_client_id;
  ELSE
    -- Cliente existe, actualizar datos si están presentes
    UPDATE public.clients SET
      name = COALESCE(NEW.client_name, name),
      email = COALESCE(NEW.email, email),
      phone = COALESCE(NEW.phone, phone)
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
    COALESCE(NEW.status, 'ACTIVA')::policy_status_enum,
    NEW.percent_override -- NULL usa el default del broker
  ) RETURNING id INTO v_policy_id;

  -- ✅ ÉXITO: Cliente y póliza creados
  
  -- Si es un UPDATE (registro ya existía), eliminarlo manualmente
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM public.temp_client_imports WHERE id = NEW.id;
    RETURN NULL;
  END IF;
  
  -- Si es un INSERT, retornar NULL para cancelar la inserción
  -- (ya se creó el cliente y póliza, no necesitamos el registro temporal)
  RETURN NULL;

EXCEPTION WHEN OTHERS THEN
  -- Si hay cualquier error, mantener en temp con estado error
  NEW.import_status = 'error';
  NEW.error_message = SQLERRM;
  NEW.processed_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: se ejecuta BEFORE INSERT OR UPDATE
DROP TRIGGER IF EXISTS trigger_process_temp_import ON public.temp_client_imports;
CREATE TRIGGER trigger_process_temp_import
  BEFORE INSERT OR UPDATE ON public.temp_client_imports
  FOR EACH ROW
  EXECUTE FUNCTION public.process_temp_client_import();

-- ========================================
-- FUNCIÓN PARA LIMPIAR REGISTROS PROCESADOS
-- ========================================
-- Ejecutar periódicamente para eliminar registros ya procesados (más de 7 días)

CREATE OR REPLACE FUNCTION public.cleanup_processed_temp_imports()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.temp_client_imports
  WHERE import_status = 'processed'
  AND processed_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- COMENTARIOS
-- ========================================
COMMENT ON TABLE public.temp_client_imports IS 'Tabla temporal para importar clientes y pólizas. Se limpia automáticamente después de procesar.';
COMMENT ON COLUMN public.temp_client_imports.national_id IS 'Cédula/Pasaporte/RUC - Obligatorio para pasar a tablas oficiales';
COMMENT ON COLUMN public.temp_client_imports.broker_email IS 'Email del broker, se resuelve automáticamente a broker_id';
COMMENT ON COLUMN public.temp_client_imports.import_status IS 'pending: esperando procesar, processed: completado, error: falló validación';
COMMENT ON COLUMN public.temp_client_imports.source IS 'Origen: csv_import, tramite, ajuste_pendiente, manual';
