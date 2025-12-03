# ✅ Agregar Fecha de Nacimiento a Clientes

## Fecha: 3 de diciembre, 2025

---

## 📋 Resumen

Se agregó el campo `birth_date` (Fecha de Nacimiento) a la tabla `clients` y se actualizó toda la UI para que sea obligatorio en:

1. **Formulario de nuevo cliente** (`ClientForm.tsx`)
2. **Formulario de cliente preliminar** (`PreliminaryClientsTab.tsx`)

---

## 🗄️ Cambios en Base de Datos

### Script SQL: `add_birth_date_to_clients.sql`

```sql
ALTER TABLE clients
ADD COLUMN birth_date DATE;
```

**Ejecutar en Supabase SQL Editor:**
1. Abre Supabase Dashboard
2. Ve a SQL Editor
3. Ejecuta el script `add_birth_date_to_clients.sql`

---

## 🔧 Cambios en Código

### 1. **Validaciones y Tipos** (`src/lib/db/clients.ts`)

**Schema Zod actualizado:**
```typescript
export const ClientInsertSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  national_id: z.string().trim().optional().nullable(),
  email: z.string().email('Email inválido').optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  birth_date: z.string().min(1, 'Fecha de nacimiento requerida'), // ✅ NUEVO
  active: z.boolean().default(true),
  broker_id: z.string().uuid().optional(),
})
```

**Funciones actualizadas:**
- `toInsertPayload()` - Incluye `birth_date`
- `toUpdatePayload()` - Incluye `birth_date`

---

### 2. **Formulario de Nuevo Cliente** (`ClientForm.tsx`)

**Campo agregado en el formulario:**
```tsx
<div>
  <label className="block text-sm font-bold text-[#010139] mb-2">
    🎂 Fecha de Nacimiento *
  </label>
  <input
    type="date"
    required
    value={formData.birth_date}
    onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:ring-2 focus:ring-[#8AAA19]/20 focus:outline-none text-sm font-medium transition-all"
  />
</div>
```

**Ubicación:** Después del campo de Email, antes del checkbox "Cliente Activo"

---

### 3. **Formulario de Cliente Preliminar** (`PreliminaryClientsTab.tsx`)

**Campo agregado en 3 lugares:**

#### A. Estado inicial (`startEdit`):
```typescript
setEditForm({
  client_name: client.client_name || '',
  national_id: client.national_id || '',
  email: client.email || '',
  phone: client.phone || '',
  birth_date: client.birth_date || '', // ✅ NUEVO
  // ... resto de campos
});
```

#### B. Vista de información (solo lectura):
```tsx
<div>
  <p className="text-xs text-gray-500 mb-1">Fecha de Nacimiento</p>
  <p className="font-semibold text-sm">{client.birth_date || '—'}</p>
</div>
```

#### C. Formulario de edición:
```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Fecha de Nacimiento <span className="text-red-500">*</span>
  </label>
  <input
    type="date"
    value={editForm.birth_date}
    onChange={(e) => setEditForm({ ...editForm, birth_date: e.target.value })}
    className="w-full px-4 py-2 border-2 rounded-lg focus:border-[#8AAA19] focus:outline-none"
  />
</div>
```

---

## ⚠️ Errores de TypeScript Esperados

Después de los cambios, verás errores de TypeScript:

```
Property 'birth_date' does not exist in type...
```

**Esto es normal.** Se resolverá automáticamente cuando:

1. **Ejecutes el script SQL en Supabase**
2. **Regeneres los tipos de Supabase:**

```bash
npx supabase gen types typescript --project-id <tu-project-id> > src/lib/supabase/database.types.ts
```

O si usas el CLI de Supabase localmente:

```bash
supabase gen types typescript --local > src/lib/supabase/database.types.ts
```

---

## 🧪 Testing

### Test 1: Nuevo Cliente
1. Ve a `/db`
2. Click en "Nuevo Cliente"
3. Intenta enviar sin llenar fecha de nacimiento → Debe marcar error
4. Llena todos los campos incluyendo fecha de nacimiento
5. Guarda y verifica que se creó correctamente

### Test 2: Cliente Preliminar
1. Ve a la pestaña "Preliminares" en `/db`
2. Edita un cliente preliminar
3. El campo "Fecha de Nacimiento" debe aparecer marcado como obligatorio (*)
4. Completa el campo
5. Guarda y verifica que se actualizó

### Test 3: Migración Automática
1. Un cliente preliminar con todos los campos completos (incluida fecha de nacimiento)
2. Debe poder migrar a la BD principal
3. Verificar que el campo `birth_date` se guardó correctamente

---

## 📁 Archivos Modificados

1. ✅ `add_birth_date_to_clients.sql` - Script SQL (NUEVO)
2. ✅ `src/lib/db/clients.ts` - Validaciones y tipos
3. ✅ `src/components/db/ClientForm.tsx` - Formulario de nuevo cliente
4. ✅ `src/components/db/PreliminaryClientsTab.tsx` - Formulario de preliminares
5. ✅ `AGREGAR_FECHA_NACIMIENTO_CLIENTES.md` - Documentación (este archivo)

---

## 📝 Notas Importantes

1. **Campo obligatorio:** El campo es requerido tanto en validación Zod como en HTML (`required`)
2. **Formato:** El input type="date" garantiza formato correcto (YYYY-MM-DD)
3. **Clientes existentes:** Quedarán con `birth_date = NULL` hasta que se editen
4. **Migración:** Los clientes preliminares sin fecha de nacimiento NO podrán migrar

---

## 🚀 Próximos Pasos

1. **Ejecutar script SQL en Supabase**
2. **Regenerar tipos de Supabase** (para eliminar errores de TypeScript)
3. **Probar creación de nuevo cliente**
4. **Probar edición de cliente preliminar**
5. **Verificar migración automática**

---

## 🎯 Estado

- ✅ Script SQL creado
- ✅ Validaciones Zod actualizadas
- ✅ Formulario de nuevo cliente actualizado
- ✅ Formulario de preliminares actualizado
- ⏳ Pendiente: Ejecutar SQL en Supabase
- ⏳ Pendiente: Regenerar tipos TypeScript
- ⏳ Pendiente: Testing

---

**Fecha de implementación:** Diciembre 3, 2025  
**Severidad:** Media  
**Prioridad:** Media  
**Breaking change:** No (backward compatible con clientes existentes)
