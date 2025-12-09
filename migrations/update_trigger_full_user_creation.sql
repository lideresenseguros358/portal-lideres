-- ============================================
-- ACTUALIZAR TRIGGER PARA CREAR USUARIO COMPLETO
-- ============================================
-- Este trigger se ejecuta cuando se crea un usuario en auth.users
-- y automáticamente crea el profile y broker con TODOS los datos
-- que vienen en user_metadata
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user_full()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_role public.role_enum;
  v_name text;
  v_cedula text;
  v_telefono text;
  v_licencia text;
  v_fecha_nacimiento date;
  v_bank_route text;
  v_bank_account_no text;
  v_tipo_cuenta text;
  v_beneficiary_name text;
  v_percent_default numeric;
  v_broker_type text;
  v_assa_code text;
  v_carnet_expiry_date date;
BEGIN
  -- Obtener rol de metadata
  v_role := COALESCE(
    (NEW.raw_user_meta_data->>'role')::public.role_enum,
    'broker'::public.role_enum
  );

  -- Nombre
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  -- Datos personales
  v_cedula := NEW.raw_user_meta_data->>'cedula';
  v_telefono := NEW.raw_user_meta_data->>'telefono';
  v_licencia := NEW.raw_user_meta_data->>'licencia';
  v_fecha_nacimiento := (NEW.raw_user_meta_data->>'fecha_nacimiento')::date;

  -- Datos bancarios ACH
  v_bank_route := NEW.raw_user_meta_data->>'bank_route';
  v_bank_account_no := NEW.raw_user_meta_data->>'bank_account_no';
  v_tipo_cuenta := COALESCE(NEW.raw_user_meta_data->>'tipo_cuenta', '04');
  v_beneficiary_name := NEW.raw_user_meta_data->>'beneficiary_name';

  -- Comisión
  v_percent_default := COALESCE(
    (NEW.raw_user_meta_data->>'percent_default')::numeric,
    0.82
  );

  -- Campos adicionales
  v_broker_type := COALESCE(NEW.raw_user_meta_data->>'broker_type', 'corredor');
  v_assa_code := NEW.raw_user_meta_data->>'assa_code';
  v_carnet_expiry_date := (NEW.raw_user_meta_data->>'carnet_expiry_date')::date;

  -- Master especial
  IF lower(NEW.email) = 'contacto@lideresenseguros.com' THEN
    v_role := 'master'::public.role_enum;
    v_percent_default := 1.00;
  END IF;

  -- Crear profile
  INSERT INTO public.profiles (id, full_name, role, email, created_at)
  VALUES (NEW.id, v_name, v_role, NEW.email, NOW())
  ON CONFLICT (id) DO NOTHING;

  -- Crear broker con TODOS los campos
  INSERT INTO public.brokers (
    id,
    p_id,
    name,
    nombre_completo,
    email,
    national_id,
    phone,
    license_no,
    birth_date,
    bank_route,
    bank_account_no,
    tipo_cuenta,
    beneficiary_name,
    percent_default,
    active,
    broker_type,
    assa_code,
    carnet_expiry_date,
    created_at
  ) VALUES (
    NEW.id,
    NEW.id,
    v_name,
    v_name,
    NEW.email,
    v_cedula,
    v_telefono,
    v_licencia,
    v_fecha_nacimiento,
    v_bank_route,
    v_bank_account_no,
    v_tipo_cuenta,
    v_beneficiary_name,
    v_percent_default,
    TRUE,
    v_broker_type,
    v_assa_code,
    v_carnet_expiry_date,
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Vincular profile → broker
  UPDATE public.profiles
  SET broker_id = NEW.id
  WHERE id = NEW.id
    AND broker_id IS NULL;

  RETURN NEW;
END;
$function$;

-- Asegurar que el trigger existe
DROP TRIGGER IF EXISTS on_auth_user_created_full ON auth.users;

CREATE TRIGGER on_auth_user_created_full
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_full();

-- Verificar
SELECT 'Trigger actualizado correctamente' as status;
