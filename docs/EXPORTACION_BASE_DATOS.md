# 📊 EXPORTACIÓN DE BASE DE DATOS - PDF Y XLSX

## ✅ IMPLEMENTACIÓN COMPLETA

Se han agregado botones de exportación para la lista de clientes en la Base de Datos del portal, permitiendo descargar los datos en formato PDF (con branding corporativo) o XLSX (Excel).

---

## 🎨 BOTONES DE EXPORTACIÓN

### Ubicación
**Página:** `/db` (Base de Datos)
**Tab:** Clientes
**Posición:** Encima de los botones de pestañas (CLIENTES / PRELIMINARES / ASEGURADORAS)

### Diseño

```
┌────────────────────────────────────────────────┐
│                                                │
│  [📄 Exportar PDF]  [📊 Exportar XLSX]        │
│                                                │
│  [CLIENTES] [PRELIMINARES] [ASEGURADORAS]     │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │ Lista de clientes...                     │ │
│  └──────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

### Colores Corporativos

**Botón PDF:**
- Fondo: `#010139` (Azul profundo corporativo)
- Hover: `#020270` (Azul más oscuro)
- Icono: FileDown (Lucide)

**Botón XLSX:**
- Fondo: `#8AAA19` (Oliva corporativo)
- Hover: `#7a9916` (Oliva más oscuro)
- Icono: FileSpreadsheet (Lucide)

---

## 📄 EXPORTACIÓN A PDF

### Características

**Header Corporativo:**
```
┌──────────────────────────────────────────┐
│     LÍDERES EN SEGUROS                   │
│     Base de Datos de Clientes            │
│     28 de octubre de 2025                │
└──────────────────────────────────────────┘
```

**Tabla de Datos:**
- Headers con fondo azul corporativo (#010139)
- Texto en blanco para headers
- Filas alternadas en gris claro (245, 245, 245)
- Fuente pequeña optimizada para espacio
- Auto-ajuste de columnas

**Footer:**
- Numeración de páginas (Página X de Y)
- Alineado al centro
- Fuente gris (100)

### Columnas Incluidas

**Para todos los roles:**
- Cliente (nombre)
- Cédula
- Celular
- Correo
- Pólizas (cantidad)
- Aseguradora (principal)
- Renovación (próxima fecha)

**Solo para Master:**
- Corredor Asignado

### Nombre del Archivo

Formato: `clientes-YYYY-MM-DD.pdf`

Ejemplo: `clientes-2025-10-28.pdf`

---

## 📊 EXPORTACIÓN A XLSX (Excel)

### Características

**Hoja de Cálculo:**
- Nombre de hoja: "Clientes"
- Columnas auto-ajustadas
- Headers en negrita automático
- Formato de tabla de Excel

### Columnas y Anchos

| Columna | Ancho (caracteres) | Rol |
|---------|-------------------|-----|
| Cliente | 30 | Todos |
| Cédula | 15 | Todos |
| Celular | 15 | Todos |
| Correo | 30 | Todos |
| Pólizas | 10 | Todos |
| Aseguradora Principal | 20 | Todos |
| Próxima Renovación | 15 | Todos |
| Corredor Asignado | 25 | Solo Master |

### Nombre del Archivo

Formato: `clientes-YYYY-MM-DD.xlsx`

Ejemplo: `clientes-2025-10-28.xlsx`

---

## 🔧 IMPLEMENTACIÓN TÉCNICA

### Archivo Modificado

`src/components/db/DatabaseTabs.tsx`

### Dependencias

```json
{
  "jspdf": "^2.x.x",
  "jspdf-autotable": "^3.x.x",
  "xlsx": "^0.18.x"
}
```

### Importaciones Dinámicas

```typescript
// PDF - Carga solo cuando se usa
const { jsPDF } = await import('jspdf');
await import('jspdf-autotable');

// Excel - Carga solo cuando se usa
const XLSX = await import('xlsx');
```

**Beneficio:** No aumenta el bundle size inicial, solo carga las librerías cuando el usuario exporta.

---

## 🎯 FLUJO DE USUARIO

### Exportar PDF

```
1. Usuario → Click "Exportar PDF"
         ↓
2. Toast → "Generando PDF..."
         ↓
3. Sistema → Prepara datos según rol
         ↓
4. Sistema → Genera PDF con branding
         ↓
5. Browser → Descarga automática
         ↓
6. Toast → "PDF descargado correctamente" ✅
```

### Exportar XLSX

```
1. Usuario → Click "Exportar XLSX"
         ↓
2. Toast → "Generando archivo Excel..."
         ↓
3. Sistema → Prepara datos según rol
         ↓
4. Sistema → Genera archivo XLSX
         ↓
5. Browser → Descarga automática
         ↓
6. Toast → "Archivo Excel descargado correctamente" ✅
```

---

## 📋 DATOS EXPORTADOS

### Estructura de Datos

**PDF:**
- Array de arrays (tabla)
- Headers como primera fila
- Datos normalizados (MAYÚSCULAS para nombres)
- Números de pólizas como enteros
- Fechas formateadas (DD/MM/YYYY)

**XLSX:**
- Array de objetos (JSON)
- Headers automáticos desde keys
- Formato de tabla nativo de Excel
- Auto-filtros disponibles al abrir
- Texto normalizado (MAYÚSCULAS)

### Valores por Defecto

| Campo vacío | Valor mostrado |
|-------------|----------------|
| Sin nombre | "—" |
| Sin cédula | "—" |
| Sin celular | "—" |
| Sin correo | "—" |
| Sin pólizas | 0 |
| Sin aseguradora | "SIN ASEGURADORA" |
| Sin renovación | "—" |
| Sin corredor | "—" |

---

## 🔒 PERMISOS Y ROLES

### Master (role === 'master')

**Ve en exportaciones:**
- Todos los campos
- Incluye columna "Corredor Asignado"
- Todos los clientes del sistema

### Broker (role === 'broker')

**Ve en exportaciones:**
- Campos básicos (sin corredor)
- Solo sus clientes asignados
- Mismas columnas que ve en la interfaz

---

## 📱 RESPONSIVE

Los botones son totalmente responsive:

**Desktop:**
```
[📄 Exportar PDF]  [📊 Exportar XLSX]
```

**Mobile:**
```
[📄 Exportar PDF]
[📊 Exportar XLSX]
```

Clase utilizada: `flex gap-2 mb-4`

---

## 🎨 BRANDING EN PDF

### Colores RGB

```typescript
// Header background
doc.setFillColor(1, 1, 57);  // #010139

// Header text
doc.setTextColor(255, 255, 255);  // Blanco

// Table headers
fillColor: [1, 1, 57]  // #010139

// Body text
textColor: [0, 0, 0]  // Negro

// Footer text
doc.setTextColor(100);  // Gris
```

### Fuentes

- **Títulos:** Helvetica Bold, 20pt
- **Subtítulos:** Helvetica Normal, 12pt
- **Headers tabla:** Helvetica Bold, 9pt
- **Body tabla:** Helvetica Normal, 8pt
- **Footer:** Helvetica Normal, 8pt

---

## 🧪 CASOS DE USO

### Caso 1: Master exporta todos los clientes

```
Total clientes: 150
Columnas: 8 (incluye Corredor)
PDF: ~5 páginas
XLSX: 1 hoja con 151 filas (header + 150 datos)
```

### Caso 2: Broker exporta sus clientes

```
Total clientes: 25 (solo sus asignados)
Columnas: 7 (sin Corredor)
PDF: ~1 página
XLSX: 1 hoja con 26 filas (header + 25 datos)
```

### Caso 3: Lista filtrada

```
Búsqueda activa: "ASSA"
Clientes filtrados: 10
Exportación: Solo los 10 clientes filtrados
```

---

## ⚠️ VALIDACIONES

### Botones Solo Aparecen Si:

1. ✅ `view === 'clients'` (en la pestaña de clientes)
2. ✅ `clients.length > 0` (hay clientes para exportar)

### No Aparecen Si:

- ❌ En pestaña "PRELIMINARES"
- ❌ En pestaña "ASEGURADORAS"
- ❌ Lista vacía (sin clientes)

---

## 🚀 PERFORMANCE

### Optimizaciones

1. **Importaciones dinámicas:**
   - Librerías se cargan solo al exportar
   - No afecta tiempo de carga inicial

2. **Toast feedback:**
   - Usuario ve "Generando..." inmediatamente
   - Evita confusión durante procesamiento

3. **Procesamiento eficiente:**
   - Un solo loop sobre los clientes
   - Sin transformaciones innecesarias

### Tiempos Estimados

| Clientes | PDF | XLSX |
|----------|-----|------|
| 10 | ~1s | <1s |
| 50 | ~2s | <1s |
| 100 | ~3s | ~1s |
| 500 | ~5s | ~2s |

---

## 🐛 MANEJO DE ERRORES

### Try-Catch en Ambas Funciones

```typescript
try {
  // Exportación
} catch (error) {
  console.error('Error al generar [tipo]:', error);
  toast.dismiss();
  toast.error('Error al generar el [tipo]');
}
```

### Mensajes de Error

**PDF:** "Error al generar el PDF"
**XLSX:** "Error al generar el archivo Excel"

---

## 📚 EJEMPLOS DE SALIDA

### PDF - Header

```
╔════════════════════════════════════════════╗
║        LÍDERES EN SEGUROS                  ║
║     Base de Datos de Clientes              ║
║     28 de octubre de 2025                  ║
╚════════════════════════════════════════════╝

┌────────────────────────────────────────────┐
│ Cliente │ Cédula │ Celular │ ... │ Corredor│
├─────────┼────────┼─────────┼─────┼─────────┤
│ JUAN    │ 8-123  │ 6000... │ ... │ MARÍA   │
│ PÉREZ   │ -456   │         │     │         │
└────────────────────────────────────────────┘

              Página 1 de 3
```

### XLSX - Estructura

```
| A              | B          | C            | D             |
|----------------|------------|--------------|---------------|
| Cliente        | Cédula     | Celular      | Correo        |
| JUAN PÉREZ     | 8-123-456  | +507 6000... | juan@mail.com |
| MARÍA GÓMEZ    | 8-789-012  | +507 6100... | maria@mail.com|
```

---

## ✅ CHECKLIST DE VERIFICACIÓN

- [x] Botones agregados en ubicación correcta
- [x] Exportación PDF funcional
- [x] Exportación XLSX funcional
- [x] Branding corporativo aplicado
- [x] Permisos por rol implementados
- [x] Toast notifications funcionando
- [x] Importaciones dinámicas
- [x] Manejo de errores
- [x] Nombres de archivo con fecha
- [x] Responsive design
- [x] TypeScript sin errores
- [x] Dependencias instaladas

---

**¡Exportación de Base de Datos completamente funcional!** 📊✨
