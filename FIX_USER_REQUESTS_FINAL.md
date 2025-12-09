# ✅ FIX COMPLETO: FLUJO DE SOLICITUDES DE USUARIOS

## 🎯 Problema Resuelto

El flujo de "New User Request" estaba fallando con error RLS. Ahora funciona completamente:

1. ✅ **Usuarios anónimos** pueden enviar solicitudes
2. ✅ **Master** puede aprobar/rechazar
3. ✅ **Trigger automático** crea usuario completo (auth + profile + broker)
4. ✅ **Todos los datos** se guardan correctamente

---

## 🔧 Cambios Implementados

### 1. RLS Policies (Supabase)

**Ejecutado en Supabase SQL Editor:**

```sql
-- Política para INSERT público
CREATE POLICY "public_can_insert_request" ON user_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Políticas Master para SELECT/UPDATE/DELETE
CREATE POLICY "master_can_view_requests" ON user_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- (Similar para UPDATE y DELETE)
```

### 2. API Route (`/api/requests`)

**Cambio crítico:** Usar cliente anónimo para POST

```typescript
// Cliente 100% anónimo
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// INSERT sin .select() (porque anon no puede hacer SELECT)
const { error } = await supabase
  .from('user_requests')
  .insert([{...}]); // Sin .select()
```

### 3. API Route de Aprobación (`/api/requests/[id]`)

**Pasar TODOS los datos en `user_metadata`:**

```typescript
const adminClient = getSupabaseAdmin(); // Service role key

await adminClient.auth.admin.createUser({
  email: userRequest.email,
  password: password,
  email_confirm: true,
  user_metadata: {
    // Datos básicos
    full_name: userRequest.nombre_completo,
    role: role.toLowerCase(),
    
    // Datos personales
    cedula: userRequest.cedula,
    telefono: userRequest.telefono,
    licencia: userRequest.licencia,
    fecha_nacimiento: userRequest.fecha_nacimiento,
    
    // Datos bancarios ACH
    bank_route: userRequest.bank_route,
    bank_account_no: userRequest.bank_account_no,
    tipo_cuenta: userRequest.tipo_cuenta,
    beneficiary_name: userRequest.nombre_completo_titular,
    
    // Comisión
    percent_default: parseFloat(commission_percent),
    
    // Campos adicionales
    broker_type: additionalFields.broker_type || 'corredor',
    assa_code: additionalFields.assa_code || null,
    carnet_expiry_date: additionalFields.carnet_expiry_date || null
  }
});
```

### 4. Trigger SQL (`handle_new_user_full`)

**Ejecutado en Supabase SQL Editor:**

```sql
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
  v_broker_type public.broker_type_enum;  -- ✅ ENUM correcto
  v_assa_code text;
  v_carnet_expiry_date date;
BEGIN
  -- Extraer todos los valores de user_metadata
  v_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.role_enum, 'broker');
  v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  v_cedula := NEW.raw_user_meta_data->>'cedula';
  v_telefono := NEW.raw_user_meta_data->>'telefono';
  v_licencia := NEW.raw_user_meta_data->>'licencia';
  v_fecha_nacimiento := (NEW.raw_user_meta_data->>'fecha_nacimiento')::date;
  v_bank_route := NEW.raw_user_meta_data->>'bank_route';
  v_bank_account_no := NEW.raw_user_meta_data->>'bank_account_no';
  v_tipo_cuenta := COALESCE(NEW.raw_user_meta_data->>'tipo_cuenta', '04');
  v_beneficiary_name := NEW.raw_user_meta_data->>'beneficiary_name';
  v_percent_default := COALESCE((NEW.raw_user_meta_data->>'percent_default')::numeric, 0.82);
  
  -- ✅ CAST correcto a ENUM
  v_broker_type := COALESCE(
    (NEW.raw_user_meta_data->>'broker_type')::public.broker_type_enum,
    'corredor'::public.broker_type_enum
  );
  
  v_assa_code := NEW.raw_user_meta_data->>'assa_code';
  v_carnet_expiry_date := (NEW.raw_user_meta_data->>'carnet_expiry_date')::date;

  -- Crear profile
  INSERT INTO public.profiles (id, full_name, role, email, created_at)
  VALUES (NEW.id, v_name, v_role, NEW.email, NOW())
  ON CONFLICT (id) DO NOTHING;

  -- Crear broker con TODOS los campos (incluyendo meta_personal)
  INSERT INTO public.brokers (
    id, p_id, name, nombre_completo, email,
    national_id, phone, license_no, birth_date,
    bank_route, bank_account_no, tipo_cuenta, beneficiary_name,
    percent_default, meta_personal, active, 
    broker_type, assa_code, carnet_expiry_date, created_at
  ) VALUES (
    NEW.id, NEW.id, v_name, v_name, NEW.email,
    v_cedula, v_telefono, v_licencia, v_fecha_nacimiento,
    v_bank_route, v_bank_account_no, v_tipo_cuenta, v_beneficiary_name,
    v_percent_default, 0, TRUE,
    v_broker_type, v_assa_code, v_carnet_expiry_date, NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Vincular profile → broker
  UPDATE public.profiles
  SET broker_id = NEW.id
  WHERE id = NEW.id AND broker_id IS NULL;

  RETURN NEW;
END;
$function$;
```

---

## 🎯 Errores Resueltos

### Error 1: "new row violates row-level security policy"
**Causa:** API usaba `getSupabaseServer()` (requiere auth) para INSERT público  
**Solución:** Usar `createClient` con anon key

### Error 2: ".select() falla después de INSERT"
**Causa:** Usuario anónimo no puede hacer SELECT (policy solo permite master)  
**Solución:** Eliminar `.select()` después del INSERT

### Error 3: "Database error creating new user"
**Causa:** Trigger intentaba insertar en `brokers` sin campo obligatorio `meta_personal`  
**Solución:** Agregar `meta_personal: 0` en INSERT

### Error 4: "column broker_type is of type enum but expression is text"
**Causa:** Variable `v_broker_type` era `text`, no `broker_type_enum`  
**Solución:** Cambiar tipo y hacer cast correcto: `(value)::public.broker_type_enum`

---

## 📋 Flujo Completo Funcionando

### 1. Usuario Anónimo Envía Solicitud

```
/new-user
  ↓
POST /api/requests (cliente anónimo)
  ↓
INSERT en user_requests (status: pending)
  ↓
✅ "Solicitud enviada exitosamente"
```

### 2. Master Aprueba Solicitud

```
/requests (Master login)
  ↓
Click "Aprobar" → Modal con rol y comisión
  ↓
PATCH /api/requests/[id] (admin client)
  ↓
createUser en auth.users (con user_metadata completo)
  ↓
✅ TRIGGER automático ejecuta:
   - Crea profile
   - Crea broker (con TODOS los datos)
   - Vincula broker_id en profile
  ↓
UPDATE user_requests (status: approved)
  ↓
✅ Usuario completo creado
```

### 3. Master Rechaza Solicitud

```
/requests (Master login)
  ↓
Click "Rechazar" → Confirmación
  ↓
PATCH /api/requests/[id] (action: reject)
  ↓
DELETE user_requests (eliminación completa)
  ↓
✅ Solicitud eliminada
```

---

## 🔍 Verificación

### Supabase SQL Queries de Verificación:

```sql
-- 1. Ver políticas RLS
SELECT 
  policyname,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'user_requests'
ORDER BY cmd;

-- 2. Ver usuario creado
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'segurosjaenjaen@gmail.com';

-- 3. Ver profile creado
SELECT id, full_name, role, broker_id
FROM profiles 
WHERE email = 'segurosjaenjaen@gmail.com';

-- 4. Ver broker creado
SELECT 
  id, name, email, national_id, phone,
  bank_route, bank_account_no, tipo_cuenta,
  percent_default, broker_type, active
FROM brokers 
WHERE email = 'segurosjaenjaen@gmail.com';

-- 5. Ver solicitud aprobada
SELECT id, email, status, assigned_role, assigned_commission_percent
FROM user_requests 
WHERE email = 'segurosjaenjaen@gmail.com';
```

---

## 📦 Archivos Modificados

1. **src/app/(app)/api/requests/route.ts**
   - POST handler usa cliente anónimo
   - Eliminado `.select()` después de INSERT
   - Agregados validaciones y logging

2. **src/app/(app)/api/requests/[id]/route.ts**
   - PATCH handler usa admin client para createUser
   - Pasa TODOS los datos en user_metadata
   - Espera a que trigger ejecute
   - Actualiza user_requests a 'approved'

3. **src/components/requests/ApproveModal.tsx**
   - Agregado logging para debug
   - Manejo de errores mejorado

4. **migrations/update_trigger_full_user_creation.sql**
   - Trigger actualizado con todos los campos
   - Variables con tipos correctos (ENUM donde corresponde)
   - Manejo de errores con BEGIN/EXCEPTION

---

## ✅ Resultado Final

**Logs del servidor al aprobar:**

```
🔵 Intentando crear usuario: {
  email: 'segurosjaenjaen@gmail.com',
  has_password: true,
  password_length: 12,
  password_preview: 'pgd***',
  role: 'broker'
}
✅ Usuario creado en auth.users: f7367d3e-ec2b-4400-a444-5f8c3ef6b81b
✅ Trigger ejecutado - Profile y Broker creados
✅ Response status: 200
✅ message: 'Solicitud aprobada y usuario creado'
```

**Usuario creado con:**
- ✅ Auth user en `auth.users`
- ✅ Profile en `profiles` (con rol y broker_id)
- ✅ Broker en `brokers` (con TODOS los datos: cédula, teléfono, banco, comisión, etc.)
- ✅ Solicitud actualizada a `status='approved'`

---

## 🚀 Deploy

Todos los cambios están en producción:

- Commit: `61aba2a`
- Branch: `main`
- Status: ✅ Deployed to Vercel

---

## 📝 Notas Importantes

1. **Service Role Key:** Necesaria para `getSupabaseAdmin()` - crear usuarios
2. **Unique Index:** Email en `user_requests` para prevenir duplicados pendientes
3. **ENUM Cast:** `broker_type` debe ser `public.broker_type_enum`, no `text`
4. **meta_personal:** Campo obligatorio en `brokers`, se pone en `0` por defecto
5. **Trigger SECURITY DEFINER:** Bypasea RLS para crear profile y broker

---

## 🎉 Listo para Usar

El flujo completo está funcionando en producción. Usuarios anónimos pueden registrarse, Master puede aprobar/rechazar, y se crean automáticamente todos los registros necesarios.
