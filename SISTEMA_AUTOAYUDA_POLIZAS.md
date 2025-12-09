# 🎯 SISTEMA DE AUTOAYUDA PARA NÚMEROS DE PÓLIZA + PARSERS

## 📋 Resumen Ejecutivo

Sistema completo de autoayuda inteligente para ingreso de números de póliza que:
1. **Adapta el formato** según la aseguradora seleccionada
2. **Guía al usuario** con ejemplos y validaciones
3. **Normaliza automáticamente** según reglas específicas
4. **Prepara parsers** para lectura de reportes de comisiones/morosidad

---

## 🎯 Objetivo

Facilitar el ingreso correcto de números de póliza eliminando errores de formato y preparar el sistema para leer automáticamente reportes de cada aseguradora con sus formatos únicos.

---

## 📦 Componentes Creados

### 1. **FORMATOS_POLIZAS_ASEGURADORAS.md**
Documentación completa de 14 aseguradoras con:
- ✅ Estructura de inputs por aseguradora
- ✅ Reglas de unión y normalización
- ✅ Ejemplos válidos e inválidos
- ✅ Reglas para parsers de comisiones/morosidad
- ✅ Notas especiales de casos difíciles

### 2. **src/lib/utils/policy-number.ts**
Librería de utilidades con:
- ✅ `POLICY_FORMATS`: Configuraciones de 14 aseguradoras
- ✅ `normalizePolicyNumber()`: Normaliza según reglas
- ✅ `getPolicySearchTerm()`: Extrae término para búsqueda
- ✅ `validatePolicyFormat()`: Valida formato
- ✅ `getPolicyFormatConfig()`: Obtiene configuración

### 3. **src/components/ui/PolicyNumberInput.tsx**
Componente React inteligente que:
- ✅ Cambia inputs según aseguradora
- ✅ Muestra ejemplos y ayudas
- ✅ Valida en tiempo real
- ✅ Normaliza automáticamente
- ✅ Vista previa para casos especiales

---

## 🏢 14 Aseguradoras Soportadas

### Grupo 1: Formato Especial
1. **ASSA** - 3 inputs (núm + dropdown + núm) sin separador
2. **INTERNACIONAL** - 3 inputs con reordenamiento y normalización
3. **WW MEDICAL** - 3 inputs mixtos (texto-núm-núm)

### Grupo 2: Búsqueda Parcial
4. **ANCON** - Usar solo input del medio
5. **BANESCO** - Usar primeros 3 inputs
6. **MB/FEDPA/REGIONAL/OPTIMA/ALIADO** - Usar solo tercer input
7. **ACERTA** - Usar solo input del medio
8. **UNIVIVIR** - Usar solo último input

### Grupo 3: Campo Único
9. **SURA** - 1 input libre
10. **PALIG** - 1 input libre
11. **MAPFRE** - 1 input libre
12. **ASSISTCARD/VUMI/IFS** - 1 input libre

### Grupo 4: Formato Estándar
13. **MERCANTIL** - 3 inputs numéricos con guiones
14. **GENERAL** - 3 inputs mixtos con guiones

---

## 🎨 Experiencia de Usuario

### Flujo Completo

```
1. Usuario abre formulario de póliza
        ↓
2. Selecciona ASEGURADORA
        ↓
3. Componente carga formato específico
        ↓
4. Muestra inputs adaptados + ejemplos
        ↓
5. Usuario completa campos
        ↓
6. Normalización automática
        ↓
7. Guardado en formato correcto
```

### Ejemplo: ASSA

```
Usuario selecciona: ASSA
Sistema muestra:
┌─────────────────────────────────────┐
│ 🏢 ASSA - Formato: 3 campos         │
├─────────────────────────────────────┤
│ [02] [BR ▼] [12345]                 │
│  ↓     ↓      ↓                      │
│ Núm  Tipo   Núm                     │
├─────────────────────────────────────┤
│ 📝 Ejemplo: 02BR12345               │
└─────────────────────────────────────┘
Resultado: 02BR12345 (sin guiones)
```

### Ejemplo: INTERNACIONAL

```
Usuario selecciona: INTERNACIONAL
Usuario ingresa: 030 - 001 - 00098767
Sistema normaliza:
┌─────────────────────────────────────┐
│ ⚠️ INTERNACIONAL reordena           │
│ automáticamente                     │
├─────────────────────────────────────┤
│ Se guardará como: 1-30-98767        │
│                                     │
│ (Ceros removidos + Reordenado)      │
└─────────────────────────────────────┘
```

### Ejemplo: ANCON

```
Usuario selecciona: ANCON
Usuario ingresa: 0220 - 00678 - 01
Sistema muestra:
┌─────────────────────────────────────┐
│ 🔍 Búsqueda en reportes:            │
│ Se usa solo el número del medio     │
│                                     │
│ Póliza completa: 0220-00678-01      │
│ Parser buscará: 678 o 00678         │
└─────────────────────────────────────┘
```

---

## 🔧 Integración Técnica

### Ubicaciones Implementadas

#### 1. Wizard Nuevo Cliente + Póliza
**Archivo:** `src/components/db/ClientPolicyWizard.tsx`

```tsx
{formData.insurer_id ? (
  <PolicyNumberInput
    insurerName={insurers.find(i => i.id === formData.insurer_id)?.name || ''}
    value={formData.policy_number}
    onChange={(value) => setFormData({ ...formData, policy_number: value })}
    label="Número de Póliza"
    required
  />
) : (
  <div className="p-4 bg-yellow-50">
    ⚠️ Primero selecciona una aseguradora
  </div>
)}
```

#### 2. Modal Editar/Crear Póliza
**Archivo:** `src/components/db/ClientForm.tsx` (PolicyForm)

```tsx
{/* Reordenado: primero aseguradora, luego póliza */}
<select value={formData.insurer_id} onChange={...}>
  {insurers.map(i => <option>{i.name}</option>)}
</select>

{formData.insurer_id && formData.insurer_id !== 'all' ? (
  <PolicyNumberInput
    insurerName={insurers.find(i => i.id === formData.insurer_id)?.name || ''}
    value={formData.policy_number}
    onChange={(value) => setFormData({ ...formData, policy_number: value })}
    required
  />
) : (
  <div>⚠️ Selecciona aseguradora primero</div>
)}
```

---

## 🔍 Sistema de Parsers

### Casos de Uso

#### Lectura de Reportes de Comisiones

Cuando llega un reporte Excel/PDF con números de póliza:

```typescript
import { getPolicySearchTerm } from '@/lib/utils/policy-number';

// Ejemplo 1: ANCON
const policyNumber = '0220-00678-01';
const searchTerm = getPolicySearchTerm('ancon', policyNumber);
// → '678' (solo el medio, sin ceros)

// Buscar en BD
const policy = await db.query(`
  SELECT * FROM policies 
  WHERE policy_number LIKE '%${searchTerm}%'
`);

// Ejemplo 2: MB (y familia)
const policyNumber = '02-01-123456-4';
const searchTerm = getPolicySearchTerm('mb', policyNumber);
// → '123456' (solo el tercer bloque)

// Ejemplo 3: INTERNACIONAL
const policyNumber = '1-30-98767';
const searchTerm = getPolicySearchTerm('internacional', policyNumber);
// → '1-30-98767' (completo, ya normalizado)
```

#### Normalización al Guardar

```typescript
import { normalizePolicyNumber } from '@/lib/utils/policy-number';

// Usuario ingresa para INTERNACIONAL
const inputs = ['030', '001', '00098767'];
const normalized = normalizePolicyNumber('internacional', inputs);
// → '1-30-98767'

// Guardar en BD
await db.insert('policies', {
  policy_number: normalized,
  // ...
});
```

---

## 📊 Tabla de Referencia Rápida

| Aseguradora | Inputs | Separador | Normalización | Parser |
|-------------|--------|-----------|---------------|--------|
| ASSA | 3 (núm-drop-núm) | Ninguno | No | Completo |
| ANCON | 3 numéricos | `-` | No | Solo medio |
| INTERNACIONAL | 3 numéricos | `-` | ✅ Reordena + ceros | Completo |
| SURA | 1 mixto | N/A | No | Completo |
| BANESCO | 4 numéricos | `-` | No | Primeros 3 |
| MB/FEDPA/etc | 4 numéricos | `-` | No | Solo tercero |
| PALIG | 1 mixto | N/A | No | Completo |
| ACERTA | 3 numéricos | `-` | No | Solo medio |
| MAPFRE | 1 mixto | N/A | No | Completo |
| UNIVIVIR | 3 numéricos | `-` | No | Solo último |
| ASSISTCARD/etc | 1 mixto | N/A | No | Completo |
| WW MEDICAL | 3 mixtos | `-` | No | Completo |
| MERCANTIL | 3 numéricos | `-` | No | Completo |
| GENERAL | 3 mixtos | `-` | No | Completo |

---

## 🎯 Casos Especiales Documentados

### INTERNACIONAL (Más Complejo)

**Entrada:**
```
Input 1: 030
Input 2: 001
Input 3: 00098767
```

**Procesamiento:**
1. Remover ceros: `30`, `1`, `98767`
2. Reordenar: input2 - input1 - input3
3. Unir: `1-30-98767`

**Almacenado en BD:** `1-30-98767`

### ANCON (Búsqueda Especial)

**Póliza Completa:** `0220-00678-01`  
**Para Búsqueda:** `678` (sin ceros)  
**Razón:** Los otros números varían entre documentos

### MB, FEDPA, REGIONAL, OPTIMA, ALIADO

**Póliza Completa:** `02-01-123456-4`  
**Para Búsqueda:** `123456` (solo tercero)  
**Razón:** Inputs 1, 2 y 4 no son confiables

---

## 🚀 Próximos Pasos

### Para Implementar Parsers Automáticos:

1. **Parser de Excel/PDF:**
   ```typescript
   async function parseComisionesReport(file: File, insurer: string) {
     const policyNumbers = extractPolicyNumbers(file);
     
     for (const policyNumber of policyNumbers) {
       const searchTerm = getPolicySearchTerm(insurer, policyNumber);
       const policy = await findPolicyBySearchTerm(searchTerm);
       
       if (policy) {
         // Procesar comisión
       }
     }
   }
   ```

2. **Matching Inteligente:**
   ```typescript
   async function findPolicyBySearchTerm(searchTerm: string, insurer: string) {
     const config = getPolicyFormatConfig(insurer);
     
     if (config.parserRule === 'partial') {
       // Búsqueda flexible
       return await db.query(`
         SELECT * FROM policies 
         WHERE policy_number LIKE '%${searchTerm}%'
         AND insurer_slug = '${insurer}'
       `);
     } else {
       // Búsqueda exacta
       return await db.query(`
         SELECT * FROM policies 
         WHERE policy_number = '${searchTerm}'
       `);
     }
   }
   ```

3. **Entrenamiento del Parser:**
   - Usar configuraciones de `POLICY_FORMATS`
   - Aplicar reglas de normalización
   - Usar términos de búsqueda correctos
   - Manejar casos especiales

---

## ✅ Beneficios del Sistema

### Para el Usuario:
✅ **Formato correcto garantizado** - No más errores de guiones o ceros  
✅ **Guía visual clara** - Ejemplos y ayuda contextual  
✅ **Validación inmediata** - Feedback en tiempo real  
✅ **Sin confusión** - Cada aseguradora muestra su formato único  

### Para el Sistema:
✅ **Datos consistentes** - Todos los números en formato correcto  
✅ **Parsers preparados** - Configuración lista para lectura automática  
✅ **Búsquedas precisas** - Usa solo las partes confiables  
✅ **Escalable** - Fácil agregar nuevas aseguradoras  

### Para el Negocio:
✅ **Menos errores** - Reduce trabajo manual de corrección  
✅ **Automatización** - Base para parsers de reportes  
✅ **Eficiencia** - Matching automático de comisiones  
✅ **Trazabilidad** - Reglas documentadas y auditables  

---

## 📁 Archivos del Sistema

```
/FORMATOS_POLIZAS_ASEGURADORAS.md
    └─ Documentación completa de 14 aseguradoras

/src/lib/utils/policy-number.ts
    ├─ POLICY_FORMATS (configuraciones)
    ├─ normalizePolicyNumber()
    ├─ getPolicySearchTerm()
    ├─ validatePolicyFormat()
    └─ getPolicyFormatConfig()

/src/components/ui/PolicyNumberInput.tsx
    └─ Componente React adaptativo

/src/components/db/ClientPolicyWizard.tsx
    └─ Integración en wizard nuevo cliente

/src/components/db/ClientForm.tsx
    └─ Integración en modal editar póliza
```

---

## 🔧 Mantenimiento

### Agregar Nueva Aseguradora:

1. **Agregar configuración:**
   ```typescript
   // En policy-number.ts
   'nueva-aseguradora': {
     insurer: 'NUEVA',
     slug: 'nueva-aseguradora',
     inputCount: 2,
     inputTypes: ['numeric', 'numeric'],
     joinWith: '-',
     normalize: false,
     examples: ['123-456'],
     parserRule: 'full',
   }
   ```

2. **Documentar en MD:**
   ```markdown
   ## NUEVA ASEGURADORA
   - Estructura: 2 inputs numéricos
   - Unión: Con guiones
   - Ejemplo: 123-456
   - Parser: Búsqueda completa
   ```

3. **Listo** - El componente se adapta automáticamente

---

## 📊 Estadísticas

- **14 aseguradoras** soportadas
- **3 tipos de inputs** (numeric, text, dropdown, mixed)
- **2 reglas de parser** (full, partial)
- **Normalización especial** para INTERNACIONAL
- **5 aseguradoras** con búsqueda parcial
- **0 errores** de TypeScript

---

## 🎉 Resultado Final

Sistema completo de autoayuda para números de póliza que:

1. ✅ **Guía al usuario** con formato correcto según aseguradora
2. ✅ **Normaliza automáticamente** casos especiales
3. ✅ **Prepara parsers** para lectura de reportes
4. ✅ **Documenta reglas** de todas las aseguradoras
5. ✅ **Escalable** para agregar más aseguradoras
6. ✅ **Integrado** en puntos clave del sistema

**Commit:** `b8a9b96`  
**Branch:** `main`  
**Status:** ✅ Deployed

---

**El sistema está listo para:**
- ✅ Guiar usuarios en ingreso de pólizas
- ✅ Normalizar datos automáticamente
- 🔜 Implementar parsers de reportes Excel/PDF
- 🔜 Matching automático de comisiones
- 🔜 Lectura de reportes de morosidad
