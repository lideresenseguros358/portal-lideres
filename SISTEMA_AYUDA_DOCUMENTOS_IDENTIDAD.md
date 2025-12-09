# 🆔 Sistema de Ayuda para Documentos de Identidad

## 📋 Objetivo

Proporcionar una experiencia de usuario mejorada para el ingreso de documentos de identidad (cédula, pasaporte, RUC) en todos los formularios del sistema, con validación automática de formato y ayudas visuales.

---

## 🎯 Características Principales

### 1. Selector de Tipo de Documento
- 🪪 **Cédula** - Documento nacional de Panamá
- 🛂 **Pasaporte** - Documento internacional
- 🏢 **RUC** - Registro Único de Contribuyente

### 2. Formatos Específicos por Tipo

#### 📝 CÉDULA (Formato: X-XXXX-XXXXX)

**3 Inputs Separados:**
1. **Provincia/Prefijo** (Dropdown)
   - PE (Panamá Este)
   - E (Extranjero)
   - PN (Panamá Norte)
   - PI (Panamá Interior)
   - 1 (Bocas del Toro)
   - 2 (Coclé)
   - 3 (Colón)
   - 4 (Chiriquí)
   - 5 (Darién)
   - 6 (Herrera)
   - 7 (Los Santos)
   - 8 (Panamá)
   - 9 (Veraguas)
   - 10 (Guna Yala)
   - 11 (Emberá-Wounaan)
   - 12 (Ngäbe-Buglé)

2. **Tomo** (Input numérico, max 4 dígitos)
3. **Asiento** (Input numérico, max 5 dígitos)

**Vista Previa en Tiempo Real:**
```
Vista previa: 8-999-9999
```

**Ejemplos válidos:**
- `8-999-9999`
- `E-8888-88888`
- `PE-1234-12345`

#### 🛂 PASAPORTE (Formato: Alfanumérico)

**Un Solo Input:**
- Acepta letras y números
- Sin espacios
- Ejemplo: `PA123456789`

#### 🏢 RUC (Formato: XXX-X-XXXXXX)

**Un Solo Input:**
- Números separados por guiones
- Ejemplo: `475690-1-434939`

---

## 🔧 Componente: NationalIdInput

### Props

```typescript
interface NationalIdInputProps {
  value: string;              // Valor actual del documento
  onChange: (value: string) => void; // Callback cuando cambia el valor
  label?: string;             // Label personalizado (default: "Documento de Identidad")
  required?: boolean;         // Si el campo es requerido
  error?: string;             // Mensaje de error personalizado
  className?: string;         // Clases CSS adicionales
}
```

### Uso Básico

```tsx
import NationalIdInput from '@/components/ui/NationalIdInput';

<NationalIdInput
  value={formData.cedula}
  onChange={(value) => setFormData({ ...formData, cedula: value })}
  label="Documento de Identidad"
  required
/>
```

---

## 📍 Ubicaciones Implementadas

### 1. ✅ Solicitud de Nuevo Usuario
**Archivo:** `src/app/(auth)/new-user/page.tsx`

```tsx
<NationalIdInput
  value={personalData.cedula}
  onChange={(value) => setPersonalData({ ...personalData, cedula: value })}
  label="Documento de Identidad"
  required
/>
```

**Contexto:** Formulario público de registro paso 2 (Datos Personales)

---

### 2. ✅ Editar Broker
**Archivo:** `src/components/brokers/BrokerDetailClient.tsx`

```tsx
{isEditing ? (
  <NationalIdInput
    value={formData.national_id}
    onChange={(value) => setFormData({ ...formData, national_id: value })}
    label="Documento de Identidad"
  />
) : (
  <div>
    <label>Cédula/Pasaporte</label>
    <div className="font-mono">{formData.national_id || 'No especificado'}</div>
  </div>
)}
```

**Contexto:** Solo visible en modo edición, modo lectura muestra el valor formateado

---

### 3. ✅ Base de Datos - Editar Cliente
**Archivo:** `src/components/db/ClientForm.tsx`

```tsx
<NationalIdInput
  value={formData.national_id}
  onChange={(value) => setFormData({ ...formData, national_id: value })}
  label="Documento de Identidad"
/>
```

**Contexto:** Modal de edición de cliente existente

---

### 4. ✅ Base de Datos - Nuevo Cliente + Póliza
**Archivo:** `src/components/db/ClientPolicyWizard.tsx`

```tsx
<NationalIdInput
  value={formData.national_id}
  onChange={(value) => setFormData({ ...formData, national_id: value })}
  label="Documento de Identidad"
  required
/>
```

**Contexto:** Wizard paso 1 (Datos del cliente)

---

## 🎨 Diseño UI/UX

### Selector de Tipo de Documento

```
┌─────────────────────────────────────┐
│  Tipo de Documento                  │
│  ┌─────────────────────────────┐   │
│  │ 🪪 Cédula              ▼    │   │
│  └─────────────────────────────┘   │
│  Selecciona el tipo de documento   │
│  para formato correcto              │
└─────────────────────────────────────┘
```

### Cédula (3 Inputs)

```
┌──────────┬──────────┬──────────┐
│    PE    │   999    │  9999    │
│  ▼       │          │          │
└──────────┴──────────┴──────────┘
  Provincia    Tomo      Asiento

Vista previa: PE-999-9999
```

### Pasaporte (1 Input)

```
┌─────────────────────────────────────┐
│  PA123456789                        │
└─────────────────────────────────────┘
📝 Formato: Letras y números sin espacios
```

### RUC (1 Input)

```
┌─────────────────────────────────────┐
│  475690-1-434939                    │
└─────────────────────────────────────┘
📝 Formato: Números separados por guiones
```

---

## ⚙️ Lógica Interna

### Detección Automática de Tipo

Al cargar un valor existente, el componente intenta detectar automáticamente el tipo:

```typescript
if (value.includes('-')) {
  const parts = value.split('-');
  if (parts.length === 3) {
    // Es cédula (formato: X-XXX-XXXXX)
    setDocumentType('cedula');
    setCedulaPart1(parts[0] || '');
    setCedulaPart2(parts[1] || '');
    setCedulaPart3(parts[2] || '');
  } else {
    // Podría ser RUC
    setDocumentType('ruc');
    setSingleValue(value);
  }
} else {
  // Probablemente pasaporte
  setDocumentType('pasaporte');
  setSingleValue(value);
}
```

### Ensamblado Automático de Cédula

Cuando el usuario completa los 3 campos de cédula:

```typescript
useEffect(() => {
  if (documentType === 'cedula') {
    const fullCedula = [cedulaPart1, cedulaPart2, cedulaPart3]
      .filter(part => part) // Eliminar partes vacías
      .join('-');
    onChange(fullCedula); // Notificar al padre: "8-999-9999"
  }
}, [cedulaPart1, cedulaPart2, cedulaPart3, documentType, onChange]);
```

---

## 🎯 Ventajas

### Para el Usuario:
✅ **Guía visual clara** - Sabe exactamente qué formato usar
✅ **Validación inmediata** - Ve errores en tiempo real
✅ **Autocompletado** - Dropdown de provincias para cédulas
✅ **Vista previa** - Ve cómo quedará su documento
✅ **Sin errores de formato** - El sistema ensambla correctamente

### Para el Sistema:
✅ **Datos consistentes** - Todos los documentos siguen el mismo formato
✅ **Validación automática** - Solo números en campos numéricos
✅ **Reutilizable** - Un solo componente en múltiples lugares
✅ **Fácil mantenimiento** - Cambios centralizados

---

## 📊 Flujo de Datos

```
Usuario selecciona tipo
        ↓
    [Cédula]
        ↓
Dropdown + 2 Inputs numéricos
        ↓
Provincia: "8"
Tomo: "999"
Asiento: "9999"
        ↓
Ensamblado automático
        ↓
onChange("8-999-9999")
        ↓
Guardado en BD
```

---

## 🔒 Validaciones

### En el Componente:

1. **Cédula - Parte 2 (Tomo):**
   ```typescript
   const val = e.target.value.replace(/\D/g, ''); // Solo números
   if (val.length <= 4) setCedulaPart2(val); // Max 4 dígitos
   ```

2. **Cédula - Parte 3 (Asiento):**
   ```typescript
   const val = e.target.value.replace(/\D/g, ''); // Solo números
   if (val.length <= 5) setCedulaPart3(val); // Max 5 dígitos
   ```

3. **Cambio de Tipo:**
   ```typescript
   // Al cambiar tipo, limpiar todos los campos
   setCedulaPart1('');
   setCedulaPart2('');
   setCedulaPart3('');
   setSingleValue('');
   onChange('');
   ```

---

## 🎨 Estilos y Responsive

### Mobile:
- **Stack vertical** - Campos uno debajo del otro
- **Inputs full-width** - Aprovecha todo el ancho
- **Touch-friendly** - Botones grandes (h-11)

### Desktop:
- **Horizontal layout** - Campos lado a lado para cédula
- **Ancho fijo** - Provincia (32), Tomo (28), Asiento (32)
- **Gap espacioso** - `gap-3` entre campos

### Clases Comunes:
```css
- border-2 border-gray-300
- focus:border-[#8AAA19]
- rounded-lg
- h-11 (height uniforme)
- font-mono (para inputs numéricos)
```

---

## 🚀 Extensibilidad Futura

### Agregar Nuevo Tipo de Documento:

1. **Actualizar tipo:**
   ```typescript
   type DocumentType = 'cedula' | 'pasaporte' | 'ruc' | 'NUEVO_TIPO';
   ```

2. **Agregar al selector:**
   ```tsx
   <SelectItem value="nuevo_tipo">🆕 Nuevo Tipo</SelectItem>
   ```

3. **Agregar lógica de inputs:**
   ```tsx
   {documentType === 'nuevo_tipo' && (
     <input /* configuración específica */ />
   )}
   ```

---

## 📝 Notas Importantes

### NO se Guarda el Tipo en BD

El tipo de documento (`cedula`, `pasaporte`, `ruc`) **NO** se guarda en la base de datos. Solo es una ayuda visual para facilitar el ingreso.

**En BD solo se guarda:**
```sql
national_id VARCHAR -- Ejemplo: "8-999-9999" o "PA123456789"
```

### Detección Automática al Cargar

Cuando se carga un valor existente, el componente intenta detectar el tipo basándose en el formato, pero esto es solo para mostrar el formato correcto al usuario.

---

## ✅ Checklist de Implementación

- [x] Componente NationalIdInput creado
- [x] Dropdown de provincias para cédulas
- [x] Inputs numéricos validados (tomo y asiento)
- [x] Vista previa en tiempo real
- [x] Detección automática de tipo
- [x] Integrado en formulario de solicitud de usuario
- [x] Integrado en edición de broker
- [x] Integrado en formulario de cliente (editar)
- [x] Integrado en wizard de nuevo cliente + póliza
- [x] Responsive mobile y desktop
- [x] Documentación completa

---

## 🎉 Resultado Final

El sistema proporciona una experiencia de usuario superior para el ingreso de documentos de identidad, eliminando errores comunes de formato y guiando al usuario paso a paso según el tipo de documento que necesite ingresar.

**Antes:**
```
Input simple: [____________]
Usuario debe saber el formato exacto
Errores frecuentes: 8 999 9999, 8-9-9999, etc.
```

**Después:**
```
Selector de tipo + Inputs específicos
Sistema guía al usuario
Formato siempre correcto: 8-999-9999
```

---

**Commit:** `a8c5e65`  
**Branch:** `main`  
**Status:** ✅ Deployed
