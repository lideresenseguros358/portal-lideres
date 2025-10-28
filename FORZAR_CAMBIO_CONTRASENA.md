# Forzar Cambio de Contraseña en Próximo Login

**Fecha:** 2025-10-27  
**Objetivo:** Permitir a Master obligar a un usuario a cambiar su contraseña en el próximo inicio de sesión

---

## 🎯 FUNCIONALIDAD

Master puede forzar a cualquier broker/usuario a cambiar su contraseña en el próximo inicio de sesión mediante un botón en la página de detalle del corredor.

---

## 🔑 CASOS DE USO

1. **Resetear contraseña comprometida**
   - Usuario reporta que su cuenta fue accedida
   - Master fuerza cambio de contraseña
   - Usuario debe crear nueva contraseña en próximo login

2. **Seguridad preventiva**
   - Se detecta actividad sospechosa
   - Master fuerza cambio de contraseña
   - Usuario crea nueva contraseña segura

3. **Política de seguridad**
   - Cambio periódico de contraseñas
   - Master fuerza cambio cada X meses
   - Usuario actualiza credenciales

4. **Usuario olvidó contraseña**
   - Usuario no puede recuperar contraseña
   - Master fuerza cambio
   - Usuario crea nueva en próximo login

---

## 🔧 IMPLEMENTACIÓN

### **1. Botón en UI** ✅

**Ubicación:** `/brokers/[id]` - Sección de acciones

```tsx
<button
  onClick={handleForcePasswordChange}
  disabled={saving}
  className="flex-1 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg..."
>
  🔑 Forzar Cambio Contraseña
</button>
```

**Posición:** Entre botones "Editar" y "Eliminar"

**Visibilidad:**
- ✅ Visible cuando NO está en modo edición
- ✅ Solo para brokers (no para Oficina)
- ✅ Solo Master puede ver y usar

---

### **2. Handler en Frontend** ✅

```typescript
const handleForcePasswordChange = async () => {
  // Confirmación
  if (!confirm('¿Obligar a este usuario a cambiar su contraseña?')) {
    return;
  }

  setSaving(true);
  
  // Llamada a API
  const response = await fetch(
    `/api/brokers/${brokerId}/force-password-change`, 
    { method: 'POST' }
  );

  const result = await response.json();

  if (result.ok) {
    toast.success('✅ Usuario deberá cambiar contraseña en próximo login');
  } else {
    toast.error(result.error);
  }
  
  setSaving(false);
};
```

---

### **3. API Endpoint** ✅

**Ruta:** `/api/brokers/[id]/force-password-change`  
**Método:** `POST`  
**Auth:** Solo Master

```typescript
// 1. Verificar usuario autenticado
const { data: { user } } = await supabaseServer.auth.getUser();

// 2. Verificar que es Master
const { data: profile } = await supabaseServer
  .from('profiles')
  .select('role')
  .eq('id', user.id)
  .single();

if (profile?.role !== 'master') {
  return { ok: false, error: 'Solo Master puede forzar cambio' };
}

// 3. Obtener p_id del broker
const { data: broker } = await supabase
  .from('brokers')
  .select('p_id, name')
  .eq('id', brokerId)
  .single();

// 4. Actualizar profiles.must_change_password
await supabase
  .from('profiles')
  .update({ must_change_password: true })
  .eq('id', broker.p_id);

// 5. Log de auditoría
console.log(`Master ${user.email} forced password change for ${broker.name}`);
```

---

## 🔄 FLUJO COMPLETO

```
1️⃣ MASTER FUERZA CAMBIO
   Master → /brokers/[id]
   Master → Click "🔑 Forzar Cambio Contraseña"
   Sistema → Muestra confirmación
   Master → Confirma
   ↓
   Sistema → POST /api/brokers/[id]/force-password-change
   ↓
   API → Verifica Master role
   API → Obtiene broker.p_id
   API → UPDATE profiles SET must_change_password = true
   ↓
   ✅ Toast: "Usuario deberá cambiar contraseña en próximo login"

2️⃣ USUARIO INTENTA LOGIN
   Usuario → Ingresa email/password
   ↓
   Auth → Verifica credenciales ✅
   Auth → Lee profiles.must_change_password = true
   ↓
   Sistema → Redirige a /update-password
   Sistema → Muestra: "Debes actualizar tu contraseña"

3️⃣ USUARIO CAMBIA CONTRASEÑA
   Usuario → Ingresa contraseña actual
   Usuario → Ingresa nueva contraseña
   Usuario → Confirma nueva contraseña
   ↓
   Sistema → Actualiza contraseña en auth.users
   Sistema → UPDATE profiles SET must_change_password = false
   ↓
   ✅ Login exitoso con nueva contraseña
```

---

## 📊 TABLA AFECTADA

### **profiles**

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  email VARCHAR NOT NULL,
  full_name VARCHAR,
  role role_enum,
  must_change_password BOOLEAN DEFAULT false,  -- ⬅️ Campo clave
  ...
);
```

**Valores:**
- `must_change_password = true` → Usuario debe cambiar contraseña
- `must_change_password = false` → Usuario OK

---

## 🎨 DISEÑO DEL BOTÓN

### **Visual:**
```
┌────────────────────────────────────────┐
│ [Editar] [🔑 Forzar Cambio Contraseña] │
│          [Eliminar]                    │
└────────────────────────────────────────┘
```

**Colores:**
- 🟧 Fondo: `bg-amber-600`
- ⚪ Texto: Blanco
- 🟧 Hover: `bg-amber-700`

**Estados:**
- **Normal:** Activo, cursor pointer
- **Saving:** Deshabilitado, opacity 50%
- **Hover:** Color más oscuro

---

## 🔒 SEGURIDAD

### **Validaciones:**

✅ **Auth requerida**
```typescript
if (!user) {
  return { ok: false, error: 'No autenticado' };
}
```

✅ **Solo Master**
```typescript
if (profile?.role !== 'master') {
  return { ok: false, error: 'Solo Master puede forzar cambio' };
}
```

✅ **Broker existe**
```typescript
if (!broker || !broker.p_id) {
  return { ok: false, error: 'Broker no encontrado' };
}
```

✅ **Confirmación de usuario**
```typescript
if (!confirm('¿Obligar a este usuario...?')) {
  return; // Cancelar
}
```

---

## 📝 LOGS DE AUDITORÍA

```typescript
console.log(`[ForcePasswordChange] 
  Master ${user.email} 
  forced password change 
  for broker ${broker.name} (${broker.p_id})`
);
```

**Ejemplo:**
```
[ForcePasswordChange] Master admin@example.com forced password change for broker Juan Pérez (uuid-123)
```

---

## ⚠️ CONSIDERACIONES

### **1. No resetea la contraseña**
- ❌ NO cambia la contraseña del usuario
- ✅ Solo marca que debe cambiarla
- ✅ Usuario usa su contraseña actual una vez más

### **2. Usuario puede seguir trabajando**
- ✅ Sesión activa NO se cierra
- ✅ Si ya está logueado, puede continuar
- ⚠️ Al cerrar sesión, deberá cambiar contraseña

### **3. Cambio es obligatorio**
- ✅ Sistema redirige automáticamente
- ❌ Usuario NO puede saltarse el cambio
- ✅ No puede acceder al sistema sin cambiar

### **4. Solo Master puede forzar**
- ✅ Brokers NO ven el botón
- ✅ Brokers NO pueden forzar cambios
- ✅ Solo permisos de Master

---

## ✅ VERIFICACIONES

```bash
✅ npm run typecheck - 0 errores
✅ Botón visible en /brokers/[id]
✅ API route creada
✅ Validación de permisos
✅ Actualización de BD
✅ Toast de confirmación
✅ Logs de auditoría
```

---

## 🧪 TESTING

### **Test 1: Forzar cambio**
```
1. Login como Master
2. Ir a /brokers/[id] de un broker
3. Click "🔑 Forzar Cambio Contraseña"
4. Confirmar en modal
5. Verificar toast: "✅ Usuario deberá cambiar contraseña"
6. Verificar en Supabase: profiles.must_change_password = true ✅
```

### **Test 2: Próximo login del usuario**
```
1. Usuario afectado cierra sesión
2. Usuario ingresa credenciales
3. Verificar redirección a /update-password ✅
4. Usuario cambia contraseña
5. Verificar login exitoso ✅
6. Verificar profiles.must_change_password = false ✅
```

### **Test 3: Seguridad**
```
1. Login como Broker (no master)
2. Ir a /brokers/[id]
3. Verificar botón NO visible ✅
4. Intentar POST a API directamente
5. Verificar error 403: "Solo Master..." ✅
```

---

## 📋 ARCHIVOS CREADOS/MODIFICADOS

1. ✅ **BrokerDetailClient.tsx**
   - Función `handleForcePasswordChange`
   - Botón "🔑 Forzar Cambio Contraseña"
   - Posicionado en sección de acciones

2. ✅ **`/api/brokers/[id]/force-password-change/route.ts`** (NUEVO)
   - Endpoint POST
   - Validación de permisos
   - Actualización de profiles.must_change_password
   - Logs de auditoría

3. ✅ **FORZAR_CAMBIO_CONTRASENA.md**
   - Documentación completa

---

## 🎯 RESULTADO FINAL

**Funcionalidad completa:**
- ✅ Botón visible para Master en /brokers/[id]
- ✅ API segura con validación de permisos
- ✅ Actualiza profiles.must_change_password en Supabase
- ✅ Usuario debe cambiar contraseña en próximo login
- ✅ Logs de auditoría para tracking
- ✅ Confirmación clara al usuario
- ✅ UX/UI profesional

**Sistema de seguridad robusto implementado** 🔒🎉
