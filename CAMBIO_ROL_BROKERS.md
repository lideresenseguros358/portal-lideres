# Cambio de Rol de Usuarios en Página Corredores

**Fecha:** 2025-10-27  
**Objetivo:** Permitir a Master cambiar el rol de usuarios entre Broker y Master

---

## 🎯 FUNCIONALIDAD IMPLEMENTADA

Los usuarios Master ahora pueden cambiar el rol de cualquier broker/usuario desde la página de detalle del corredor (`/brokers/[id]`).

---

## 🔧 CAMBIOS REALIZADOS

### **1. Frontend - BrokerDetailClient.tsx** ✅

**Agregado campo de rol al formulario:**

```typescript
// Estado inicial - Leer rol desde profiles
setFormData({
  // ... otros campos
  role: (result.data as any).profiles?.role || 'broker',
});
```

**Agregado select en UI:**

```tsx
<div>
  <label>Rol del Usuario</label>
  <select
    value={formData.role}
    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
    disabled={!isEditing}
  >
    <option value="broker">Broker</option>
    <option value="master">Master</option>
  </select>
  {isEditing && (
    <p className="text-xs text-amber-600 mt-2">
      ⚠️ El cambio de rol se aplicará en el próximo inicio de sesión
    </p>
  )}
</div>
```

**Ubicación:** En la sección "% Default de comisión", antes del selector de porcentaje.

---

### **2. Backend - actions.ts** ✅

**Agregada sincronización de rol a profiles:**

```typescript
// En actionUpdateBroker, después de sincronizar name y email
// Sync role to profiles.role (NUEVO)
if ((cleanedUpdates as any).role) {
  const newRole = (cleanedUpdates as any).role;
  if (newRole === 'master' || newRole === 'broker') {
    console.log('[actionUpdateBroker] Syncing role to profiles.role:', newRole);
    profileUpdates.role = newRole;
  }
}

// Update profiles if there are changes
if (Object.keys(profileUpdates).length > 0) {
  await supabase
    .from('profiles')
    .update(profileUpdates)
    .eq('id', broker.p_id);
}
```

**Validación:**
- Solo acepta valores "master" o "broker"
- Se actualiza en tabla `profiles`
- El cambio se refleja inmediatamente en BD

---

## 🔄 FLUJO COMPLETO

```
1️⃣ CAMBIAR ROL
   Master → Va a /brokers/[id]
   Master → Click "Editar"
   Master → Cambia rol en dropdown (Broker ↔ Master)
   Master → Click "Guardar"
   Sistema → ✅ Actualiza profiles.role en Supabase

2️⃣ VALIDACIÓN EN BD
   Supabase → Campo profiles.role actualizado
   Supabase → Valor: "broker" | "master"
   Logs → "[actionUpdateBroker] Syncing role to profiles.role: master"

3️⃣ PRÓXIMO LOGIN DEL USUARIO
   Usuario → Ingresa credenciales
   Auth → Lee profiles.role de Supabase
   Sistema → Asigna permisos según nuevo rol
   Usuario → ✅ Ve interfaz según nuevo rol
```

---

## 📊 TABLA AFECTADA

### **profiles**

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  email VARCHAR NOT NULL,
  full_name VARCHAR,
  role role_enum,  -- ⬅️ Este campo se actualiza
  ...
);

-- Enum de roles
CREATE TYPE role_enum AS ENUM ('master', 'broker');
```

**Columna actualizada:** `profiles.role`

---

## 🎨 INTERFAZ DE USUARIO

### **Vista Lectura (Modo visualización):**
```
┌────────────────────────────────────┐
│ % Default de comisión              │
├────────────────────────────────────┤
│ Rol del Usuario                    │
│ [ Master            ▼ ]  (disabled)│
│                                    │
│ % Comisión Default                 │
│ [ 82% (0.82)        ▼ ]  (disabled)│
└────────────────────────────────────┘
```

### **Vista Edición (Modo editable):**
```
┌────────────────────────────────────┐
│ % Default de comisión              │
├────────────────────────────────────┤
│ Rol del Usuario                    │
│ [ Master            ▼ ]  (activo)  │
│ ⚠️ El cambio se aplicará en el     │
│    próximo inicio de sesión        │
│                                    │
│ % Comisión Default                 │
│ [ 82% (0.82)        ▼ ]  (activo)  │
└────────────────────────────────────┘
```

---

## 🔒 PERMISOS Y SEGURIDAD

### **Quién puede cambiar roles:**
- ✅ Solo usuarios con rol "master"
- ❌ Brokers NO pueden cambiar roles
- ❌ Usuarios no autenticados NO tienen acceso

### **Validaciones en Backend:**
```typescript
// Verificar que usuario es master
const { data: profile } = await supabaseServer
  .from('profiles')
  .select('role')
  .eq('id', user.id)
  .single();

if (profile?.role !== 'master') {
  return { ok: false, error: 'Solo Master puede editar brokers' };
}
```

### **Validaciones de Rol:**
```typescript
// Solo permite valores válidos
if (newRole === 'master' || newRole === 'broker') {
  profileUpdates.role = newRole; // ✅ OK
} else {
  // ❌ Ignora valores inválidos
}
```

---

## 🚀 CASOS DE USO

### **Caso 1: Promover Broker a Master**

```
Situación: Juan es broker y necesita permisos de master

Pasos:
1. Master va a /brokers → Busca "Juan Pérez"
2. Click en el broker → /brokers/{id}
3. Click "Editar"
4. Cambia "Rol del Usuario" de "Broker" a "Master"
5. Click "Guardar"

Resultado:
✅ profiles.role = "master" en BD
✅ Juan en próximo login tendrá permisos de master
✅ Verá menú completo y opciones de administración
```

### **Caso 2: Degradar Master a Broker**

```
Situación: María dejó de ser administradora

Pasos:
1. Master va a /brokers → Busca "María González"
2. Click en el usuario → /brokers/{id}
3. Click "Editar"
4. Cambia "Rol del Usuario" de "Master" a "Broker"
5. Click "Guardar"

Resultado:
✅ profiles.role = "broker" en BD
✅ María en próximo login tendrá permisos limitados
✅ Solo verá su cartera y opciones de broker
```

---

## ⚠️ CONSIDERACIONES IMPORTANTES

### **1. Cambio se aplica en próximo login**
- El cambio NO es inmediato en la sesión activa
- Usuario debe cerrar sesión y volver a ingresar
- Advertencia visible en UI

### **2. No afecta sesión actual**
- Si usuario está logueado, seguirá con rol anterior
- Session token mantiene rol antiguo hasta expirar
- Al renovar token, obtendrá nuevo rol

### **3. Logs y auditoría**
```
Console logs:
[actionUpdateBroker] Syncing role to profiles.role: master
[actionUpdateBroker] Profile synced successfully: { role: 'master' }
```

### **4. No afecta tabla brokers**
- El rol NO se guarda en tabla `brokers`
- Solo se guarda en tabla `profiles`
- `brokers` es para datos operacionales
- `profiles` es para datos de autenticación

---

## ✅ VERIFICACIONES

```bash
✅ npm run typecheck - 0 errores
✅ Campo rol visible en formulario
✅ Select con opciones Broker/Master
✅ Sincronización a profiles.role
✅ Validación de permisos (solo master)
✅ Validación de valores (broker|master)
✅ Advertencia de próximo login
✅ Logs de auditoría
```

---

## 🧪 TESTING

### **Test 1: Cambiar rol**
```
1. Login como Master
2. Ir a /brokers/{id}
3. Click "Editar"
4. Cambiar rol a Master
5. Click "Guardar"
6. Verificar en Supabase: profiles.role = "master" ✅
```

### **Test 2: Verificar próximo login**
```
1. Cambiar rol de usuario X a Master
2. Usuario X cierra sesión
3. Usuario X ingresa nuevamente
4. Verificar menú completo visible ✅
5. Verificar acceso a funciones master ✅
```

### **Test 3: Seguridad**
```
1. Login como Broker (no master)
2. Intentar editar otro broker
3. Verificar error: "Solo Master puede editar" ✅
```

---

## 📝 ARCHIVOS MODIFICADOS

1. ✅ `src/components/brokers/BrokerDetailClient.tsx`
   - Agregado campo `role` al formData
   - Agregado select de rol en UI
   - Advertencia de próximo login

2. ✅ `src/app/(app)/brokers/actions.ts`
   - Agregada sincronización de rol en actionUpdateBroker
   - Validación de valores (master|broker)
   - Logs de auditoría

---

## 🎯 RESULTADO FINAL

**El sistema ahora permite:**
- ✅ Master puede cambiar roles de usuarios
- ✅ Cambios se guardan en Supabase profiles.role
- ✅ Usuario ve nuevo rol en próximo login
- ✅ Seguridad: Solo master puede cambiar roles
- ✅ Validación: Solo valores válidos (master|broker)
- ✅ UX: Advertencia clara sobre aplicación del cambio
- ✅ Auditoría: Logs de todos los cambios

**Flujo completo funcional y seguro** 🎉
