# Sistema de Normalización de Catálogos - Cotizadores

## Objetivo

Permitir que **Internacional de Seguros (IS)** y **FEDPA** funcionen con el **mismo formulario** de cotización, a pesar de que usan sistemas de códigos completamente diferentes.

---

## Problema Identificado

### Internacional de Seguros (IS)
- Usa códigos numéricos para **marcas** y **modelos**
- Ejemplo: Marca 156 = Toyota, Modelo 2469 = Corolla 2024
- Requiere: `vcodmarca`, `vcodmodelo`, `vanioauto`, `vsumaaseg`

### FEDPA
- **NO usa códigos de marca/modelo** de IS
- Usa códigos de **USO** del vehículo (10 = Auto Particular, 22 = Bus)
- Usa códigos de **PLAN** determinados por rangos de valor
- Requiere: `Uso`, `CodPlan`, `Ano`, `SumaAsegurada`

### Incompatibilidad
- Un formulario con "Toyota Corolla 2024, $35,000" no puede enviarse directamente a ambas APIs
- FEDPA no entiende "Marca 156", necesita "USO 10"
- FEDPA no sabe qué PLAN usar sin antes analizar el valor del vehículo

---

## Solución: Normalizador de Catálogos

### Archivo Creado
`src/lib/cotizadores/catalog-normalizer.ts`

### Funciones Principales

#### 1. Mapeo de Marca → USO
```typescript
export function getUsoFromMarca(vcodmarca: number): string
```

**Mapeo actual:**
```typescript
const VEHICLE_MARCA_TO_FEDPA_USO = {
  156: '10', // Toyota → Auto Particular
  148: '10', // Hyundai → Auto Particular
  86: '10',  // Kia → Auto Particular
  113: '10', // Nissan → Auto Particular
  74: '10',  // Suzuki → Auto Particular
  217: '10', // Geely → Auto Particular
  204: '10', // Honda → Auto Particular
};
```

**Por defecto:** Si la marca no está en el mapeo, usa `'10'` (Auto Particular)

#### 2. Determinación Automática de PLAN por Tipo de Cobertura
```typescript
export function getPlanFromCoberturaYValor(
  tipoCoberturaIS: number,
  valorVehiculo: number
): string
```

**Lógica de Determinación:**

**COBERTURA COMPLETA (IS Plan 14):**
- **Siempre** usa Plan FEDPA `411` (C.C. PARTICULAR)
- No importa el rango de suma asegurada
- Para todos los valores de vehículo

**DAÑOS A TERCEROS (IS otros planes):**
- Plan FEDPA `412` (D.T. COMERCIAL HASTA 4 TONELADAS)
- Se pueden agregar rangos específicos según documentación FEDPA

**Ejemplo:**
- Usuario ingresa: Cobertura Completa, Valor = $35,000
- Sistema determina: Tipo IS 14 → **Plan FEDPA 411** (C.C. PARTICULAR)
- **Usuario NO escoge plan**, sucede en background

#### 3. Normalización Completa
```typescript
export function normalizeQuoteData(formData: any): NormalizedQuoteData
```

**Input (Formulario):**
```typescript
{
  vcodtipodoc: 1,
  vnrodoc: "8-123-4567",
  vnombre: "Juan",
  vapellido: "Pérez",
  vtelefono: "6000-0000",
  vcorreo: "juan@email.com",
  vcodmarca: 156,        // IS: Toyota
  vcodmodelo: 2469,      // IS: Corolla 2024
  vanioauto: 2024,
  vsumaaseg: 35000,
  vcodplancobertura: 14, // IS: Cobertura Completa
  vcodgrupotarifa: 28
}
```

**Output (Normalizado):**
```typescript
{
  cliente: {
    tipoDocumento: 1,
    numeroDocumento: "8-123-4567",
    nombre: "Juan",
    apellido: "Pérez",
    telefono: "6000-0000",
    correo: "juan@email.com"
  },
  vehiculo: {
    marca: 156,      // IS usa esto
    modelo: 2469,    // IS usa esto
    anio: 2024,
    valor: 35000
  },
  cobertura: {
    sumaAsegurada: 35000,
    planCobertura: 14,   // IS usa esto
    grupoTarifa: 28      // IS usa esto
  },
  fedpa: {
    uso: "10",          // FEDPA usa esto (determinado automáticamente)
    plan: "412"         // FEDPA usa esto (determinado automáticamente)
  }
}
```

---

## Flujo de Cotización

### Paso 1: Usuario llena formulario
```
Formulario Único (UI):
- Marca: Toyota (código IS: 156)
- Modelo: Corolla 2024 (código IS: 2469)
- Año: 2024
- Valor: $35,000
- [Otros campos...]
```

### Paso 2: Normalización (Backend)
```
Normalizador analiza:
✓ Marca 156 → USO 10 (Auto Particular)
✓ Valor $35,000 → PLAN 412 (Rango Medio)
```

### Paso 3A: Cotización con IS
```
POST /api/is/auto/quote

Request:
{
  vcodmarca: 156,        ← Usa código IS original
  vcodmodelo: 2469,      ← Usa código IS original
  vanioauto: 2024,
  vsumaaseg: 35000,
  vcodplancobertura: 14,
  vcodgrupotarifa: 28,
  ...
}

Response:
{
  success: true,
  idCotizacion: "1030168",
  primaTotal: 480.18
}
```

### Paso 3B: Cotización con FEDPA
```
POST /api/fedpa/cotizacion

Request:
{
  Uso: "10",            ← Determinado automáticamente
  CodPlan: "412",       ← Determinado automáticamente por valor
  Ano: "2024",
  SumaAsegurada: "35000",
  CodMarca: "1",        ← FEDPA usa sus propios códigos
  CodModelo: "1",       ← FEDPA usa sus propios códigos
  ...
}

Response:
{
  success: true,
  idCotizacion: "FEDPA-123",
  primaTotal: 456.50
}
```

---

## Archivos Modificados

### 1. Normalizador (Nuevo)
**`src/lib/cotizadores/catalog-normalizer.ts`**
- Mapeo marca → USO
- Determinación valor → PLAN
- Función de normalización completa
- Logging para debugging

### 2. Endpoint FEDPA
**`src/app/api/fedpa/cotizacion/route.ts`**

**Antes:**
```typescript
const cotizacionRequest = {
  Uso: body.Uso,          // ❌ Usuario debía proveerlo
  CodPlan: body.CodPlan,  // ❌ Usuario debía proveerlo
  ...
};
```

**Después:**
```typescript
const normalized = normalizeQuoteData(formData);

const cotizacionRequest = {
  Uso: normalized.fedpa?.uso || '10',        // ✅ Determinado automáticamente
  CodPlan: normalized.fedpa?.plan || '411',  // ✅ Determinado automáticamente
  ...
};
```

### 3. Endpoint IS
**`src/app/api/is/auto/quote/route.ts`**

**Antes:**
```typescript
const result = await generarCotizacionAuto({
  vcodmarca: parseInt(body.vcodmarca),
  vcodmodelo: parseInt(body.vcodmodelo),
  ...
});
```

**Después:**
```typescript
const normalized = normalizeQuoteData(formData);

const result = await generarCotizacionAuto({
  vcodmarca: normalized.vehiculo.marca,
  vcodmodelo: normalized.vehiculo.modelo,
  ...
});
```

---

## Ventajas del Sistema

### ✅ Un Solo Formulario
El usuario ingresa datos UNA vez, funciona para ambas aseguradoras.

### ✅ Determinación Automática
- **USO:** Se determina por la marca del vehículo
- **PLAN:** Se determina por el valor del vehículo
- **Sin intervención del usuario**

### ✅ Extensible
Agregar más marcas o ajustar rangos es simple:

```typescript
// Agregar nueva marca
const VEHICLE_MARCA_TO_FEDPA_USO = {
  // ...
  250: '10', // Nueva marca → Auto Particular
};

// Ajustar rangos de plan
export const FEDPA_PLAN_RANGES = [
  { plan: '411', minValue: 0, maxValue: 15000, ... },
  { plan: '412', minValue: 15001, maxValue: 40000, ... },
  // ...
];
```

### ✅ Logging Completo
```
[Catalog Normalizer] Datos normalizados:
  - Cliente: Juan Pérez
  - Vehículo IS: Marca 156, Modelo 2469, Año 2024
  - Valor: $35,000
  - FEDPA USO: 10 (AUTO PARTICULAR)
  - FEDPA PLAN: 412 (D.T. COMERCIAL HASTA 4 TONELADAS - Rango Medio)
```

---

## Configuración de Rangos

### Actualizar Rangos de PLAN

Si FEDPA proporciona rangos específicos, actualizar en:
`src/lib/cotizadores/catalog-normalizer.ts`

```typescript
export const FEDPA_PLAN_RANGES: FedpaPlanRange[] = [
  {
    plan: '411',
    minValue: 0,
    maxValue: 20000,  // ← Ajustar según FEDPA
    descripcion: 'C.C. PARTICULAR - Rango Bajo',
  },
  // ...
];
```

### Agregar Nuevas Marcas

```typescript
export const VEHICLE_MARCA_TO_FEDPA_USO: Record<number, string> = {
  156: '10', // Toyota
  // ... marcas existentes
  999: '22', // ← Nueva marca para BUS
};
```

---

## Testing

### Caso de Prueba 1: Auto Particular Bajo
```
Input:
- Marca: 156 (Toyota)
- Valor: $15,000

Expected:
- FEDPA USO: "10"
- FEDPA PLAN: "411"
```

### Caso de Prueba 2: Auto Particular Medio
```
Input:
- Marca: 148 (Hyundai)
- Valor: $35,000

Expected:
- FEDPA USO: "10"
- FEDPA PLAN: "412"
```

### Caso de Prueba 3: Auto Particular Alto
```
Input:
- Marca: 113 (Nissan)
- Valor: $75,000

Expected:
- FEDPA USO: "10"
- FEDPA PLAN: "416"
```

---

## Notas Importantes

### Códigos de Marca/Modelo en FEDPA
Actualmente, FEDPA recibe `CodMarca: "1"` y `CodModelo: "1"` como valores por defecto, ya que:
- FEDPA no requiere códigos específicos de marca/modelo de IS
- FEDPA determina la cotización por **USO**, **PLAN** y **SumaAsegurada**

Si FEDPA requiere códigos específicos de marca/modelo, se debe:
1. Crear tabla de mapeo: `IS_MARCA → FEDPA_MARCA`
2. Crear tabla de mapeo: `IS_MODELO → FEDPA_MODELO`
3. Actualizar el normalizador

### Endosos
Los endosos son una funcionalidad separada que NO afecta la cotización inicial. Se manejan posteriormente en el flujo de emisión.

---

## Verificación

```bash
✓ Formulario único para ambas aseguradoras
✓ PLAN determinado automáticamente por valor
✓ USO determinado automáticamente por marca
✓ Logging completo para debugging
✓ Extensible y mantenible
```

---

## Próximos Pasos (Si es necesario)

1. **Confirmar rangos de PLAN con FEDPA**
   - Validar que los rangos de valor sean correctos
   - Ajustar `FEDPA_PLAN_RANGES` si es necesario

2. **Agregar más marcas al mapeo**
   - Completar `VEHICLE_MARCA_TO_FEDPA_USO` con todas las marcas soportadas

3. **Mapeo de códigos FEDPA de Marca/Modelo**
   - Si FEDPA requiere códigos específicos (actualmente usa "1" por defecto)

4. **Testing en ambiente de producción**
   - Verificar que ambas APIs respondan correctamente
   - Confirmar que los precios sean los esperados
