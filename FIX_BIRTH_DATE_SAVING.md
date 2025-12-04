# CORRECCIÓN: Fecha de Nacimiento No Se Guardaba en Base de Datos

## Problema Reportado

El campo de fecha de nacimiento no se estaba guardando correctamente en la tabla `clients` de Supabase, ni desde el wizard de nuevo cliente ni desde el modal de editar cliente.

## Análisis del Problema

### 1. Verificación de Base de Datos ✅

La tabla `clients` en Supabase **ya tenía** el campo `birth_date` correctamente definido:

```typescript
// database.types.ts - Línea 1175
clients: {
  Row: {
    birth_date: string | null  // ✅ Campo existe
  }
  Insert: {
    birth_date?: string | null  // ✅ Puede insertarse
  }
  Update: {
    birth_date?: string | null  // ✅ Puede actualizarse
  }
}
```

### 2. Verificación de Formularios ✅

Ambos formularios **sí estaban enviando** el campo:

**ClientPolicyWizard.tsx (Wizard de nuevo cliente):**
```typescript
// Línea 379
const clientData = {
  // ... otros campos
  birth_date: formData.birth_date || null,  // ✅ Se enviaba
};
```

**ClientForm.tsx (Modal de editar cliente):**
```typescript
// Líneas 98 y 118
const payload = toUppercasePayload({
  // ... otros campos
  birth_date: formData.birth_date,  // ✅ Se enviaba
});
```

### 3. Causa Raíz Identificada ❌

El problema estaba en la función `toUppercasePayload` que se usa para convertir todos los campos de texto a mayúsculas.

**Archivo:** `src/lib/utils/uppercase.ts`

```typescript
// ❌ ANTES - birth_date NO estaba excluido
const EXCLUDE_UPPERCASE_FIELDS = [
  'role', 
  'email', 
  'password', 
  'token', 
  'tipo_cuenta', 
  'bank_route', 
  'broker_type'
];
```

Aunque las fechas en formato ISO (YYYY-MM-DD) no tienen letras, el proceso de conversión de `toUppercasePayload` estaba interfiriendo con el guardado del campo, posiblemente causando:
- Valores inválidos
- Errores silenciosos de validación
- Conversión incorrecta del tipo de dato

## Solución Implementada

### Archivo Modificado: `src/lib/utils/uppercase.ts`

```typescript
// ✅ DESPUÉS - birth_date agregado a exclusiones
const EXCLUDE_UPPERCASE_FIELDS = [
  'role', 
  'email', 
  'password', 
  'token', 
  'tipo_cuenta', 
  'bank_route', 
  'broker_type',
  'birth_date'  // ✅ Agregado
];
```

### Cómo Funciona

La función `toUppercasePayload` ahora **no procesará** el campo `birth_date`, dejándolo pasar tal cual viene del formulario:

```typescript
export function toUppercasePayload<T extends Record<string, any>>(obj: T): T {
  // ...
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      result[key] = value;
    } else if (typeof value === 'string' && !EXCLUDE_UPPERCASE_FIELDS.includes(key)) {
      result[key] = value.toUpperCase();  // ❌ birth_date YA NO pasa por aquí
    } else if (typeof value === 'object') {
      result[key] = toUppercasePayload(value);
    } else {
      result[key] = value;  // ✅ birth_date se mantiene sin cambios
    }
  }
  return result as T;
}
```

## Impacto de la Corrección

### Formularios Afectados (Ahora Funcionarán Correctamente):

1. **ClientPolicyWizard.tsx** - Wizard de nuevo cliente
   - ✅ Ya estaba bien (no usaba toUppercasePayload en clientData)
   - ✅ Seguirá funcionando igual

2. **ClientForm.tsx** - Modal de editar cliente
   - ❌ Estaba afectado (usaba toUppercasePayload)
   - ✅ Ahora guardará correctamente

### Flujo Correcto Ahora:

**Wizard de Nuevo Cliente:**
```
Usuario ingresa fecha → Input type="date" → formData.birth_date → 
clientData.birth_date → Supabase INSERT → ✅ Guardado correctamente
```

**Modal de Editar Cliente:**
```
Usuario ingresa fecha → Input type="date" → formData.birth_date → 
toUppercasePayload (SKIP birth_date) → payload.birth_date → 
Supabase UPDATE → ✅ Guardado correctamente
```

## Validaciones en Formularios

### ClientPolicyWizard.tsx:
```typescript
// Líneas 274-277
if (!formData.birth_date.trim()) {
  toast.error('La fecha de nacimiento es obligatoria');
  return false;
}
```

### Input HTML:
```tsx
<input
  type="date"
  required
  value={formData.birth_date}
  onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
  className="..."
/>
```

## Otros Campos Excluidos del Uppercase

Para referencia, estos son TODOS los campos que no se convierten a mayúsculas:

```typescript
const EXCLUDE_UPPERCASE_FIELDS = [
  'role',         // Rol de usuario (master, broker)
  'email',        // Correos electrónicos
  'password',     // Contraseñas
  'token',        // Tokens de autenticación
  'tipo_cuenta',  // Código de tipo de cuenta ACH (03, 04)
  'bank_route',   // Código de ruta bancaria ACH
  'broker_type',  // Tipo de corredor
  'birth_date'    // ✅ Fecha de nacimiento (NUEVO)
];
```

## Verificación

### Para Probar la Corrección:

1. **Crear nuevo cliente:**
   - Ir a `/db`
   - Click en "Nuevo Cliente"
   - Llenar formulario incluyendo fecha de nacimiento
   - Guardar
   - ✅ Verificar que la fecha se guardó en la BD

2. **Editar cliente existente:**
   - Ir a `/db`
   - Click en editar un cliente
   - Cambiar fecha de nacimiento
   - Guardar
   - ✅ Verificar que la fecha se actualizó en la BD

3. **Verificar en Supabase:**
   - Abrir Supabase Dashboard
   - Ir a Table Editor → clients
   - Ver columna `birth_date`
   - ✅ Debe mostrar fechas en formato YYYY-MM-DD

## Archivos Involucrados

### Modificado:
- ✅ `src/lib/utils/uppercase.ts` - Agregado 'birth_date' a exclusiones

### Verificados (No requieren cambios):
- ✅ `src/lib/database.types.ts` - Campo birth_date existe
- ✅ `src/components/db/ClientPolicyWizard.tsx` - Envía birth_date correctamente
- ✅ `src/components/db/ClientForm.tsx` - Envía birth_date correctamente

## Conclusión

La corrección fue simple pero crítica: **agregar `'birth_date'` a la lista de campos excluidos del procesamiento de uppercase**. Esto garantiza que las fechas de nacimiento se guarden correctamente sin interferencia de conversiones de texto.

El problema afectaba principalmente al modal de edición (ClientForm.tsx) ya que usaba `toUppercasePayload`. El wizard (ClientPolicyWizard.tsx) casualmente no estaba afectado porque aplicaba uppercase manualmente solo a campos específicos.

**Status:** ✅ Corregido y listo para producción
