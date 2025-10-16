# 🔄 Sincronización de Datos: auth.users ↔️ profiles ↔️ brokers

## 📊 Estructura de las Tablas

```
auth.users (Supabase Auth)
├── id (UUID)
└── email

profiles (tabla pública)
├── id (UUID) → auth.users.id
├── email
├── full_name
├── avatar_url
└── role

brokers (tabla pública)
├── id (UUID)
├── p_id → profiles.id
├── name
├── email
├── phone
├── bank_account_no
└── ... (otros campos)
```

---

## ✅ FLUJO 1: Master Edita Broker desde `/brokers/[id]`

### Archivo: `src/app/(app)/brokers/actions.ts` → `actionUpdateBroker()`

**Cambios permitidos:**
- Nombre completo
- Email
- Teléfono
- Datos bancarios
- Porcentaje default
- Fecha de vencimiento de carnet
- Etc.

**Sincronización automática:**

1. ✅ **Actualiza `brokers` tabla** (todos los campos)
   ```typescript
   brokers.update({
     name, email, phone, bank_account_no, etc.
   })
   ```

2. ✅ **Sincroniza a `profiles`**
   ```typescript
   profiles.update({
     full_name: brokers.name,  // ← Sincroniza nombre
     email: brokers.email       // ← Sincroniza email
   })
   ```

3. ✅ **Sincroniza a `auth.users`** (si email cambió)
   ```typescript
   supabase.auth.admin.updateUserById(p_id, {
     email: brokers.email  // ← Sincroniza email
   })
   ```

4. ✅ **Revalida rutas**
   - `/brokers`
   - `/brokers/[id]`
   - `/account`
   - Layout (actualiza navbar)

---

## ✅ FLUJO 2: Broker Edita su Perfil desde `/account`

### Archivo: `src/app/(app)/account/actions.ts` → `actionUpdateProfile()`

**Cambios permitidos:**
- Nombre completo
- Email
- Teléfono
- Avatar

**Sincronización automática:**

1. ✅ **Actualiza `profiles` tabla**
   ```typescript
   profiles.update({
     full_name,
     email,
     avatar_url
   })
   ```

2. ✅ **Sincroniza a `brokers`** (si existe broker)
   ```typescript
   brokers.update({
     name: profiles.full_name,  // ← Sincroniza nombre de vuelta
     email: profiles.email,     // ← Sincroniza email de vuelta
     phone                      // ← Actualiza teléfono
   })
   ```

3. ✅ **Sincroniza a `auth.users`** (si email cambió)
   ```typescript
   supabase.auth.admin.updateUserById(user.id, {
     email: profiles.email  // ← Sincroniza email
   })
   ```

4. ✅ **Revalida rutas**
   - `/account`
   - `/brokers`
   - Layout (actualiza navbar)

---

## 🔐 Permisos y Seguridad

### Master (role = 'master'):
- ✅ Puede editar cualquier broker desde `/brokers/[id]`
- ✅ Puede editar su propio perfil desde `/account`
- ✅ Tiene acceso a `getSupabaseAdmin()` via server actions

### Broker (role = 'broker'):
- ✅ Solo puede editar su propio perfil desde `/account`
- ❌ No puede editar otros brokers
- ✅ Cambios se propagan automáticamente a su registro en `brokers`

---

## 📝 Campos Sincronizados

| Campo en `brokers` | Campo en `profiles` | Campo en `auth.users` | Dirección de Sync |
|-------------------|---------------------|----------------------|-------------------|
| `name` | `full_name` | - | ↔️ Bidireccional |
| `email` | `email` | `email` | ↔️ Bidireccional |
| `phone` | - | - | Solo en brokers |
| `avatar_url` | `avatar_url` | - | Solo en profiles |

---

## 🎯 Casos de Uso

### Caso 1: Master cambia el nombre de un broker
1. Master edita desde `/brokers/[id]`
2. Cambia `brokers.name` → "JUAN PÉREZ"
3. ✅ Automáticamente se actualiza `profiles.full_name` → "JUAN PÉREZ"
4. ✅ El navbar del broker se actualiza con el nuevo nombre
5. ✅ La página `/account` del broker muestra el nuevo nombre

### Caso 2: Broker actualiza su email desde /account
1. Broker edita desde `/account`
2. Cambia `profiles.email` → "nuevo@email.com"
3. ✅ Automáticamente se actualiza `brokers.email` → "nuevo@email.com"
4. ✅ Automáticamente se actualiza `auth.users.email` → "nuevo@email.com"
5. ✅ La lista de brokers en `/brokers` muestra el nuevo email
6. ✅ Recibe email de confirmación en la nueva dirección

### Caso 3: Broker sube un avatar
1. Broker sube foto desde `/account`
2. Se actualiza `profiles.avatar_url`
3. ✅ El navbar se actualiza con la nueva foto
4. ✅ La página `/brokers` muestra la nueva foto (si se implementa)

### Caso 4: Master cambia el teléfono de un broker
1. Master edita desde `/brokers/[id]`
2. Cambia `brokers.phone` → "6000-0000"
3. ✅ El broker ve el nuevo teléfono en `/account`
4. ⚠️ `profiles` NO tiene campo `phone`, por eso solo se guarda en `brokers`

---

## 🚨 Validaciones Especiales

### Oficina (OFICINA_EMAIL = "oficina@lideresenseguros.com")
- ❌ No se puede cambiar el `percent_default` (siempre 100%)
- ❌ No se puede desactivar
- ❌ No se puede eliminar

### Cambio de Email
- ⚠️ Supabase Auth envía email de confirmación a la nueva dirección
- ⚠️ El usuario debe confirmar antes de que el cambio sea efectivo
- ✅ Se actualiza en las 3 tablas simultáneamente

---

## 🔍 Logs para Debugging

Todos los cambios incluyen logs detallados:

```
🔄 [actionUpdateBroker] Starting update for brokerId: xxx
✅ [actionUpdateBroker] Broker table updated successfully
🔄 [actionUpdateBroker] Syncing name to profiles.full_name
🔄 [actionUpdateBroker] Syncing email to profiles.email
✅ [actionUpdateBroker] Profile synced successfully
🔄 [actionUpdateBroker] Syncing email to auth.users
✅ [actionUpdateBroker] Auth email synced successfully
✅ [actionUpdateBroker] Complete!
```

---

## 🛠️ Archivos Modificados

1. **`src/app/(app)/brokers/actions.ts`**
   - `actionUpdateBroker()` - Mejorada sincronización completa

2. **`src/app/(app)/account/actions.ts`** ⭐ NUEVO
   - `actionUpdateProfile()` - Nueva server action para sync bidireccional

3. **`src/app/(app)/account/page.tsx`**
   - Usa `actionUpdateProfile()` para actualizaciones
   - Mejor manejo de sincronización con router.refresh()

---

## ✅ Checklist de Verificación

- [x] Master edita broker → sincroniza a profiles y auth.users
- [x] Broker edita perfil → sincroniza de vuelta a brokers
- [x] Email se sincroniza en las 3 tablas
- [x] Nombre se sincroniza bidireccional
- [x] Teléfono se guarda correctamente
- [x] Avatar se actualiza en navbar inmediatamente
- [x] Navbar se refresca con router.refresh()
- [x] TypeCheck pasa sin errores
- [x] Logs detallados para debugging

---

## 🎉 Resultado Final

**Ahora las 3 tablas están SIEMPRE sincronizadas:**

```
auth.users.email ←→ profiles.email ←→ brokers.email
                    profiles.full_name ←→ brokers.name
```

No importa desde dónde se edite la información, **siempre se propaga correctamente** a todas las tablas relacionadas. 🚀
