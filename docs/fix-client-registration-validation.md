# 🔧 Fix: Validación de Registro de Clientes

## 📋 Problema Reportado
Se requería actualizar el sistema de registro de clientes para que:
1. La cédula (national_id) NO sea obligatoria
2. La fecha de renovación (renewal_date) SÍ sea obligatoria
3. Aplicar tanto para registro individual como importación CSV
4. Los cambios deben reflejarse inmediatamente en el listado

---

## ✅ Solución Implementada

### **1. Validación de Campos**

**Cédula (national_id):**
- ✅ NO es obligatoria (puede dejarse vacía)
- ✅ Permite crear clientes preliminares sin cédula
- ✅ Se puede agregar posteriormente

**Fecha de Renovación (renewal_date):**
- ✅ SÍ es obligatoria
- ✅ Se valida tanto en frontend como backend
- ✅ Previene creación de pólizas sin fecha de renovación

---

## 📁 Archivos Modificados

### **1. Frontend - Formulario Individual**

**`src/components/db/ClientPolicyWizard.tsx`**

**Cambio 1: Validación en Step 2 (Póliza)**
```typescript
// Líneas 150-158
if (step === 2) {
  if (!formData.policy_number || !formData.insurer_id) {
    toast.error('Número de póliza y aseguradora son obligatorios');
    return false;
  }
  if (!formData.renewal_date) {  // ← NUEVO: Validación agregada
    toast.error('La fecha de renovación es obligatoria');
    return false;
  }
}
```

**Cambio 2: UI - Asterisco Rojo en Label**
```tsx
// Líneas 457-466
<label className="block text-sm font-medium text-gray-700 mb-1">
  Fecha de Renovación <span className="text-red-500">*</span>  {/* ← Asterisco agregado */}
</label>
<input
  type="date"
  value={formData.renewal_date}
  onChange={(e) => setFormData({ ...formData, renewal_date: e.target.value })}
  className="w-full px-4 py-2 border-2..."
  required  {/* ← Atributo HTML5 agregado */}
/>
```

**Cambio 3: Campo Cédula - Confirmación de Opcional**
```tsx
// Líneas 352-365
<label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
  Cédula / Pasaporte / RUC  {/* SIN asterisco - es opcional */}
</label>
<input type="text" value={formData.national_id} ... />
<p className="text-[10px] sm:text-xs text-gray-500 mt-1">
  ℹ️ Campo opcional - puede dejarse vacío si no se dispone del dato
</p>
```

---

### **2. Backend - Esquemas de Validación**

**`src/lib/db/clients.ts`**

**Esquema de Cliente (ClientInsertSchema):**
```typescript
// Líneas 9-16
export const ClientInsertSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),  // ← Obligatorio
  national_id: z.string().trim().optional().nullable(),  // ← Opcional ✓
  email: z.string().email('Email inválido').optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  active: z.boolean().default(true),
  broker_id: z.string().uuid().optional(),
})
```

**Esquema de Póliza (PolicyInsertSchema):**
```typescript
// Líneas 19-26
export const PolicyInsertSchema = z.object({
  policy_number: z.string().min(1, 'Número de póliza requerido'),
  insurer_id: z.string().uuid('Aseguradora requerida'),
  ramo: z.string().optional(),
  start_date: z.string().optional(),
  renewal_date: z.string().min(1, 'Fecha de renovación requerida'),  // ← CAMBIADO a obligatorio
  status: z.enum(['ACTIVA', 'VENCIDA', 'CANCELADA']).default('ACTIVA'),
});
```

**Antes:**
```typescript
renewal_date: z.string().optional(),  // ❌ Era opcional
```

**Después:**
```typescript
renewal_date: z.string().min(1, 'Fecha de renovación requerida'),  // ✅ Ahora obligatorio
```

---

### **3. Importación CSV**

**`src/components/db/ImportModal.tsx`**

**Cambio 1: Instrucciones Actualizadas**
```tsx
// Líneas 115-126
<ul className="text-sm text-blue-800 space-y-1">
  <li>• El archivo debe estar en formato CSV</li>
  <li>• <strong>Columnas OBLIGATORIAS:</strong> name, policy_number, insurer_id, renewal_date</li>
  <li>• <strong>Columnas OPCIONALES:</strong> national_id, email, phone, ramo, start_date, status</li>
  <li>• La cédula (national_id) NO es obligatoria - puede dejarse vacía</li>
  <li>• La fecha de renovación (renewal_date) SÍ es obligatoria</li>
  <li>• Use campos vacíos para valores opcionales</li>
  <li>• Los números de póliza deben ser únicos</li>
</ul>
```

**Cambio 2: Plantilla CSV Actualizada**
```typescript
// Líneas 28-32
const template = `name,national_id,email,phone,policy_number,ramo,insurer_id,start_date,renewal_date,status
"Juan Pérez","8-111-2222","juan@example.com","+507 6000-0000","POL-001","AUTO","1","2024-01-01","2025-01-01","ACTIVA"
"María González","","maria@example.com","","POL-002","VIDA","1","2024-02-01","2025-02-01","ACTIVA"
"Pedro Martínez","","","","POL-003","","1","","2025-03-15","ACTIVA"`;
```

**Ejemplos en la plantilla:**
- ✅ **Juan Pérez:** Con cédula (8-111-2222) - Cliente completo
- ✅ **María González:** SIN cédula (campo vacío) - Cliente preliminar
- ✅ **Pedro Martínez:** SIN cédula, email ni teléfono - Solo datos mínimos
- ✅ **Todos:** Tienen fecha de renovación (obligatoria)

---

## 🔄 Flujo de Validación

### **Registro Individual:**

```
Usuario → Step 1 (Cliente)
              ↓
   Ingresa: Nombre ✓ (obligatorio)
   Cédula: Vacía ✓ (opcional)
              ↓
   Click "Siguiente"
              ↓
Usuario → Step 2 (Póliza)
              ↓
   Ingresa: Número póliza ✓ (obligatorio)
   Selecciona: Aseguradora ✓ (obligatorio)
   Ingresa: Fecha renovación ✓ (obligatorio)
              ↓
   Click "Siguiente" sin fecha renovación
              ↓
   ❌ Error: "La fecha de renovación es obligatoria"
              ↓
   Ingresa: Fecha renovación
              ↓
   ✅ Permite continuar
              ↓
Usuario → Step 3 (Asignación)
Usuario → Step 4 (Confirmar)
              ↓
   Click "Crear Cliente"
              ↓
   Backend valida con Zod Schema
              ↓
   ✅ Cliente creado en DB
   ✅ Póliza creada en DB
              ↓
   Revalidación automática
              ↓
   ✅ Aparece en listado
```

### **Importación CSV:**

```
Usuario → Descarga plantilla CSV
              ↓
   Completa datos en Excel/Google Sheets
   - Nombre: Obligatorio ✓
   - Cédula: Opcional (puede dejarse vacía)
   - Fecha renovación: Obligatoria ✓
              ↓
   Guarda como CSV
              ↓
Usuario → Sube archivo CSV
              ↓
   Vista previa (primeras 5 filas)
              ↓
   Click "Importar"
              ↓
   Backend procesa línea por línea
              ↓
   Valida cada registro con Zod Schema
              ↓
   Si falta renewal_date:
   ❌ Error: "Fecha de renovación requerida"
              ↓
   Si todo válido:
   ✅ Cliente creado en DB
   ✅ Póliza creada en DB
              ↓
   Revalidación automática
              ↓
   ✅ Aparece en listado
```

---

## 📊 Casos de Uso

### **Caso 1: Cliente Completo**

**Registro Individual:**
```
Nombre: JUAN PÉREZ ✓
Cédula: 8-111-2222 ✓
Email: juan@example.com ✓
Teléfono: 6000-0000 ✓
Póliza: POL-001 ✓
Fecha Renovación: 2025-12-31 ✓
```

**Resultado:** ✅ Cliente creado exitosamente

---

### **Caso 2: Cliente Preliminar (Sin Cédula)**

**Registro Individual:**
```
Nombre: MARÍA GONZÁLEZ ✓
Cédula: [VACÍO] ✓ (permitido)
Email: maria@example.com ✓
Póliza: POL-002 ✓
Fecha Renovación: 2025-06-15 ✓
```

**Resultado:** ✅ Cliente preliminar creado

**Nota en UI:**
```
⚠️ Cliente preliminar (sin cédula)
```

---

### **Caso 3: Sin Fecha de Renovación (Error)**

**Registro Individual:**
```
Nombre: PEDRO MARTÍNEZ ✓
Cédula: [VACÍO] ✓
Póliza: POL-003 ✓
Fecha Renovación: [VACÍO] ❌
```

**Resultado:** ❌ Error: "La fecha de renovación es obligatoria"

**Usuario debe:** Agregar fecha antes de continuar

---

### **Caso 4: CSV con Mezcla**

**Archivo CSV:**
```csv
name,national_id,email,phone,policy_number,ramo,insurer_id,start_date,renewal_date,status
"Juan Pérez","8-111-2222","juan@example.com","6000-0000","POL-001","AUTO","1","2024-01-01","2025-01-01","ACTIVA"
"María González","","maria@example.com","","POL-002","VIDA","1","","2025-02-01","ACTIVA"
"Pedro Martínez","","","","POL-003","","1","","2025-03-15","ACTIVA"
"Ana López","","","","POL-004","","1","","","ACTIVA"
```

**Resultado:**
- ✅ Juan Pérez - Importado (tiene todo)
- ✅ María González - Importado (sin cédula, ok)
- ✅ Pedro Martínez - Importado (mínimos datos, ok)
- ❌ Ana López - ERROR (sin fecha renovación)

**Reporte:**
```
Total: 4 registros
Exitosos: 3
Errores: 1
  - Fila 4 (Ana López): Fecha de renovación requerida
```

---

## ⚠️ Mensajes de Error

### **Frontend (Toast):**

```typescript
// Sin fecha de renovación
toast.error('La fecha de renovación es obligatoria');

// Sin nombre
toast.error('El nombre del cliente es obligatorio');

// Sin póliza o aseguradora
toast.error('Número de póliza y aseguradora son obligatorios');
```

### **Backend (Zod):**

```typescript
// Validación de PolicyInsertSchema
{
  "error": "Fecha de renovación requerida"
}

// Validación de ClientInsertSchema
{
  "error": "Nombre requerido"
}
```

---

## 🎨 Interfaz de Usuario

### **Campo Obligatorio (con asterisco):**
```
┌──────────────────────────────────┐
│ Fecha de Renovación *            │
│ [2025-12-31_____________]        │
│                                  │
└──────────────────────────────────┘
```

### **Campo Opcional (sin asterisco):**
```
┌──────────────────────────────────┐
│ Cédula / Pasaporte / RUC         │
│ [___________________________]    │
│ ℹ️ Campo opcional - puede        │
│   dejarse vacío                  │
└──────────────────────────────────┘
```

---

## 🔍 Verificación de Cambios

### **Checklist - Registro Individual:**

- [ ] Campo nombre con asterisco rojo ✓
- [ ] Campo cédula SIN asterisco ✓
- [ ] Campo fecha renovación con asterisco rojo ✓
- [ ] Validación: permite guardar sin cédula ✓
- [ ] Validación: NO permite guardar sin fecha renovación ✓
- [ ] Toast de error si falta fecha renovación ✓
- [ ] Cliente aparece en listado inmediatamente ✓

### **Checklist - Importación CSV:**

- [ ] Plantilla descargable con ejemplos correctos ✓
- [ ] Instrucciones claras sobre campos obligatorios ✓
- [ ] Ejemplo con cédula vacía en plantilla ✓
- [ ] Ejemplo con fecha renovación en todos los casos ✓
- [ ] Importación rechaza filas sin fecha renovación ✓
- [ ] Importación acepta filas sin cédula ✓
- [ ] Reporte de errores específico ✓
- [ ] Clientes importados aparecen en listado ✓

---

## ✅ Resumen de Cambios

| Campo | Antes | Después | Razón |
|-------|-------|---------|-------|
| **name** | Obligatorio | Obligatorio | Sin cambios |
| **national_id** | Opcional | Opcional | ✓ Confirmado - Permite clientes preliminares |
| **renewal_date** | Opcional | **Obligatorio** | ✓ CAMBIADO - Crítico para gestión de renovaciones |
| **policy_number** | Obligatorio | Obligatorio | Sin cambios |
| **insurer_id** | Obligatorio | Obligatorio | Sin cambios |

---

## 📝 Archivos Modificados

1. **`src/components/db/ClientPolicyWizard.tsx`** - Validación y UI
2. **`src/lib/db/clients.ts`** - Esquema Zod
3. **`src/components/db/ImportModal.tsx`** - Instrucciones y plantilla CSV

---

## ✅ Verificación Final

- ✅ `npm run typecheck` - Sin errores
- ✅ Cédula confirmada como opcional
- ✅ Fecha renovación ahora obligatoria
- ✅ Validación en frontend y backend
- ✅ CSV actualizado con ejemplos
- ✅ Instrucciones claras

---

**Fecha:** 2025-10-09  
**Desarrollado por:** Portal Líderes en Seguros  
**Estado:** ✅ Implementado y verificado
