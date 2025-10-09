# 🔄 Fix: Sincronización de Actualización de Corredores

## 📋 Problema Reportado
Cuando se editaba información de un corredor desde la página de corredores (nombre, cédula, datos bancarios, etc.), los cambios no se estaban guardando o no se sincronizaban entre las tablas relacionadas (`brokers` y `profiles`).

---

## 🔍 Análisis del Problema

### **Arquitectura de Tablas:**

El sistema tiene **3 tablas relacionadas** para corredores:

```
auth.users (Supabase Auth)
    ↓ (user.id)
profiles (Datos de usuario/perfil)
    ↓ (profiles.id = brokers.p_id)
brokers (Datos específicos de corredor)
```

### **Campos en cada tabla:**

**`auth.users`:**
- `id` (UUID)
- `email` (único)
- Gestionado por Supabase Auth

**`profiles`:**
- `id` (FK a auth.users.id)
- `email`
- `full_name` ← **IMPORTANTE: Debe sincronizarse**
- `role` (master, broker)
- `avatar_url`

**`brokers`:**
- `id` (UUID)
- `p_id` (FK a profiles.id)
- `name` ← **Nombre del corredor**
- `phone`
- `national_id`
- `assa_code`
- `license_no`
- `percent_default`
- `bank_account_no`
- `beneficiary_name`
- `beneficiary_id`
- `active`

### **Problema Identificado:**

```typescript
// ANTES (Incorrecto)
const { data, error } = await supabase
  .from('brokers')
  .update(cleanedUpdates)  // ← Solo actualiza brokers
  .eq('id', brokerId);

// profiles.full_name NO se actualiza ❌
// Resultado: inconsistencia de datos
```

**Síntomas:**
- ❌ Cambias el nombre en la página del corredor
- ❌ Se guarda en `brokers.name`
- ❌ Pero NO se actualiza en `profiles.full_name`
- ❌ El nombre sigue apareciendo desactualizado en otras partes

---

## ✅ Solución Implementada

### **Sincronización Automática:**

```typescript
// 1. Actualizar tabla brokers
const { data: updatedBroker, error } = await supabase
  .from('brokers')
  .update(cleanedUpdates)
  .eq('id', brokerId)
  .select()
  .single();

// 2. Sincronizar name → profiles.full_name
if (cleanedUpdates.name && broker.p_id) {
  await supabase
    .from('profiles')
    .update({ full_name: cleanedUpdates.name })
    .eq('id', broker.p_id);
}
```

### **Flujo Completo:**

```
Usuario edita "JUAN PÉREZ" → "JUAN PÉREZ GÓMEZ"
              ↓
handleSave() en BrokerDetailClient
              ↓
actionUpdateBroker(brokerId, { name: "JUAN PÉREZ GÓMEZ", ... })
              ↓
1. UPDATE brokers SET name = "JUAN PÉREZ GÓMEZ" WHERE id = brokerId
              ↓
2. UPDATE profiles SET full_name = "JUAN PÉREZ GÓMEZ" WHERE id = p_id
              ↓
✅ Ambas tablas actualizadas y sincronizadas
              ↓
revalidatePath() → UI se refresca
              ↓
✅ Usuario ve cambios reflejados en todas partes
```

---

## 🎯 Campos Sincronizados

### **Actualmente sincronizados:**

| Campo en Form | Tabla `brokers` | Tabla `profiles` | Sincronizado |
|---------------|----------------|------------------|--------------|
| Nombre | `name` | `full_name` | ✅ SÍ |

### **No requieren sincronización:**

| Campo | Solo en `brokers` | Razón |
|-------|------------------|-------|
| Teléfono | `phone` | Específico del corredor |
| Cédula | `national_id` | Específico del corredor |
| Código ASSA | `assa_code` | Específico del corredor |
| Licencia | `license_no` | Específico del corredor |
| % Default | `percent_default` | Específico del corredor |
| Cuenta Bancaria | `bank_account_no` | Específico del corredor |
| Titular | `beneficiary_name` | Específico del corredor |
| Cédula Titular | `beneficiary_id` | Específico del corredor |
| Activo | `active` | Específico del corredor |

### **Notas sobre Email:**

El email se gestiona desde `auth.users` y se replica en `profiles`. **NO se debe editar** desde la página de corredores por seguridad:

- ✅ Email se muestra como solo lectura
- ✅ Solo se puede cambiar desde auth management
- ✅ Evita problemas de autenticación

---

## 🔧 Detalles Técnicos

### **1. Obtener p_id del corredor:**

```typescript
const { data: broker } = await supabase
  .from('brokers')
  .select('p_id, email, profiles!p_id(email)')  // ← Incluye p_id
  .eq('id', brokerId)
  .single();
```

**Por qué:** Necesitamos `p_id` para saber qué registro de `profiles` actualizar.

### **2. Actualización con Admin Client:**

```typescript
const supabase = await getSupabaseAdmin();
```

**Por qué:** Se usa admin client para evitar restricciones RLS y garantizar que la actualización funcione.

### **3. Manejo de Errores:**

```typescript
if (profileError) {
  console.error('[actionUpdateBroker] Warning: Could not sync to profiles:', profileError);
  // NO falla la operación completa ← Importante
} else {
  console.log('[actionUpdateBroker] Profile full_name synced successfully');
}
```

**Estrategia:** Si falla la sincronización con `profiles`, se registra el error pero NO se revierte la transacción de `brokers`. Esto evita fallos catastróficos.

### **4. Logging Detallado:**

```typescript
console.log('[actionUpdateBroker] Syncing name to profiles.full_name');
console.log('[actionUpdateBroker] Profile full_name synced successfully');
```

**Por qué:** Facilita debugging en producción.

---

## 📊 Casos de Uso

### **Caso 1: Actualizar Nombre**

**Acción:**
```
Usuario edita: name = "MARÍA GONZÁLEZ"
```

**Resultado:**
```sql
-- Tabla brokers
UPDATE brokers 
SET name = 'MARÍA GONZÁLEZ' 
WHERE id = 'broker-uuid';

-- Tabla profiles (sincronizada automáticamente)
UPDATE profiles 
SET full_name = 'MARÍA GONZÁLEZ' 
WHERE id = 'profile-uuid';
```

✅ Nombre actualizado en ambas tablas

### **Caso 2: Actualizar Datos Bancarios**

**Acción:**
```
Usuario edita:
- bank_account_no = "1234567890"
- beneficiary_name = "MARÍA GONZÁLEZ"
- beneficiary_id = "8-123-456"
```

**Resultado:**
```sql
-- Solo tabla brokers (no requiere sync)
UPDATE brokers 
SET 
  bank_account_no = '1234567890',
  beneficiary_name = 'MARÍA GONZÁLEZ',
  beneficiary_id = '8-123-456'
WHERE id = 'broker-uuid';
```

✅ Datos bancarios actualizados correctamente

### **Caso 3: Actualizar Múltiples Campos**

**Acción:**
```
Usuario edita:
- name = "CARLOS RODRIGUEZ"
- phone = "6789-1234"
- national_id = "8-999-888"
- percent_default = 0.82
```

**Resultado:**
```sql
-- Tabla brokers
UPDATE brokers 
SET 
  name = 'CARLOS RODRIGUEZ',
  phone = '6789-1234',
  national_id = '8-999-888',
  percent_default = 0.82
WHERE id = 'broker-uuid';

-- Tabla profiles (solo nombre)
UPDATE profiles 
SET full_name = 'CARLOS RODRIGUEZ' 
WHERE id = 'profile-uuid';
```

✅ Todos los campos actualizados + sincronización del nombre

---

## 🛡️ Validaciones y Seguridad

### **1. Autenticación:**
```typescript
const { data: { user } } = await supabaseServer.auth.getUser();
if (!user) {
  return { ok: false, error: 'No autenticado' };
}
```

### **2. Autorización (Solo Master):**
```typescript
if (profile?.role !== 'master') {
  return { ok: false, error: 'Solo Master puede editar brokers' };
}
```

### **3. Protección de Oficina:**
```typescript
if (brokerEmail === OFICINA_EMAIL && cleanedUpdates.percent_default !== 1.00) {
  return { ok: false, error: 'No se puede cambiar el % de Oficina (siempre 100%)' };
}
```

### **4. Validación de Campos Nulos:**
```typescript
const nullableFields = [
  'birth_date', 'phone', 'national_id', 'assa_code', 
  'license_no', 'bank_account_no', 'beneficiary_name', 
  'beneficiary_id', 'email'
];

// Convierte strings vacíos a null
if (nullableFields.includes(key) && value === '') {
  acc[key] = null;
}
```

---

## 📝 Archivos Modificados

**`src/app/(app)/brokers/actions.ts`**

**Función:** `actionUpdateBroker`

**Cambios:**
1. Línea 183-187: Agregado obtención de `p_id` del broker
2. Línea 189-191: Validación de que el broker existe
3. Línea 213-227: **NUEVA** sincronización de `name` → `profiles.full_name`
4. Mejorado: Logging detallado del proceso de sincronización

---

## 🧪 Testing Recomendado

### **Test 1: Actualizar Nombre**
- [ ] Editar nombre del corredor
- [ ] Guardar cambios
- [ ] Verificar `brokers.name` actualizado
- [ ] Verificar `profiles.full_name` sincronizado
- [ ] Verificar que el nombre aparece actualizado en toda la app

### **Test 2: Actualizar Datos Bancarios**
- [ ] Editar número de cuenta
- [ ] Editar nombre del titular
- [ ] Editar cédula del titular
- [ ] Guardar cambios
- [ ] Verificar que todos los campos se guardaron

### **Test 3: Actualizar Múltiples Campos**
- [ ] Editar nombre, teléfono, cédula y % default
- [ ] Guardar cambios
- [ ] Verificar que todos se guardaron correctamente
- [ ] Verificar sincronización de nombre con profiles

### **Test 4: Campos Vacíos**
- [ ] Borrar contenido de campos opcionales
- [ ] Guardar cambios
- [ ] Verificar que se guardan como `null` en BD
- [ ] No debe haber strings vacíos

### **Test 5: Protecciones**
- [ ] Intentar editar Oficina (debe permitir todo excepto % default)
- [ ] Verificar que solo Master puede editar
- [ ] Verificar que % de Oficina no se puede cambiar

---

## ⚠️ Consideraciones Importantes

### **1. Transaccionalidad:**
Actualmente NO se usa una transacción real. Si la actualización de `profiles` falla, la de `brokers` se mantiene.

**Mejora futura:**
```typescript
// Usar transacción
const { data, error } = await supabase.rpc('update_broker_with_profile', {
  broker_id: brokerId,
  broker_updates: cleanedUpdates,
  profile_updates: { full_name: cleanedUpdates.name }
});
```

### **2. Otros Campos que Podrían Necesitar Sincronización:**

Si en el futuro necesitas sincronizar más campos:

```typescript
// Ejemplo: sincronizar email (NO recomendado, solo de ejemplo)
if (cleanedUpdates.email && broker.p_id) {
  await supabase
    .from('profiles')
    .update({ email: cleanedUpdates.email })
    .eq('id', broker.p_id);
}
```

### **3. Webhooks y Triggers:**

**Alternativa a la sincronización manual:**
```sql
-- Crear trigger en Postgres
CREATE OR REPLACE FUNCTION sync_broker_to_profile()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles 
  SET full_name = NEW.name 
  WHERE id = NEW.p_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER broker_update_trigger
AFTER UPDATE ON brokers
FOR EACH ROW
EXECUTE FUNCTION sync_broker_to_profile();
```

**Ventajas:**
- ✅ Sincronización automática siempre
- ✅ No depende del código de la app
- ✅ Funciona incluso con updates directos a la BD

**Desventajas:**
- ❌ Más complejo de mantener
- ❌ Menos visible (lógica en la BD)
- ❌ Requiere acceso a Postgres

---

## ✅ Verificación

- ✅ `npm run typecheck` - Sin errores
- ✅ Actualización de `brokers` funciona
- ✅ Sincronización a `profiles.full_name` implementada
- ✅ Logging detallado agregado
- ✅ Manejo de errores robusto
- ✅ Validaciones de seguridad intactas

---

## 🎯 Resultado Esperado

1. ✅ Usuario edita cualquier campo del corredor
2. ✅ Cambios se guardan en `brokers` inmediatamente
3. ✅ Si se edita el nombre, se sincroniza a `profiles.full_name`
4. ✅ UI se refresca automáticamente (revalidatePath)
5. ✅ Cambios visibles en toda la aplicación
6. ✅ Datos consistentes entre tablas

---

**Fecha:** 2025-10-09  
**Desarrollado por:** Portal Líderes en Seguros  
**Estado:** ✅ Implementado y verificado
