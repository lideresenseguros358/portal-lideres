# 🔍 VERIFICACIÓN COMPLETA - API INTERNACIONAL

## ❌ PROBLEMAS IDENTIFICADOS EN IMPLEMENTACIÓN ACTUAL

### 1. **TIPO DE DOCUMENTO - FORMATO INCORRECTO**

**Actual:**
```typescript
vcodtipodoc: 'CED'  // ❌ INCORRECTO
```

**Correcto según API:**
```typescript
vcodtipodoc: 1  // 1=CC (Cédula), 2=RUC, 3=PAS (Pasaporte)
```

---

### 2. **CÓDIGOS DE MARCA Y MODELO - FORMATO INCORRECTO**

**Actual:**
```typescript
const marcaMap = {
  'TOYOTA': 'TOY',  // ❌ INCORRECTO - usa strings
  'HONDA': 'HON',
}
```

**Correcto según API:**
```typescript
// Los códigos son NUMÉRICOS sin decimales
vcodmarca: 1  // No 'TOY'
vcodmodelo: 10  // No 'COROLLA'
```

**Nota:** Debo consumir:
- `GET /api/cotizaemisorauto/getmarcas` → Retorna COD_MARCA (numérico)
- `GET /api/cotizaemisorauto/getmodelos/1/10` → Retorna COD_MODELO (numérico)

---

### 3. **SUMA ASEGURADA - FALTA VALIDACIÓN DE RANGOS**

**Problema:** No valido si la suma está en el rango permitido del plan.

**Casos según API:**

**Caso 1: Plan NO requiere suma asegurada**
```json
{
  "RESOSP": -1,
  "MSG": "Disuma asegurada no permitida en este plan, el rango es de $0.00 a $0.00 dolares."
}
```
**Solución:** Enviar `vsumaaseg: 0`

**Caso 2: Plan requiere suma en rango específico**
```json
{
  "MSG": "Suma asegurada no permitida en este plan, el rango es de $4500.00 a $75000.00 dolares."
}
```
**Solución:** Validar que `vsumaaseg` esté entre 4500 y 75000

---

### 4. **PARÁMETRO vIdOpt - NO IMPLEMENTADO**

**Actual:**
```typescript
// Solo uso vIdOpt = 1 por defecto
```

**Correcto según API:**
- `vIdOpt`: 1, 2 o 3 (diferentes opciones de cotización)
- Cada opción puede tener diferentes coberturas/precios

**Solución:** Permitir seleccionar entre las 3 opciones.

---

### 5. **CÓDIGOS DE PLAN Y GRUPO TARIFA - HARDCODEADOS**

**Actual:**
```typescript
vcodplancobertura: '1',  // ❌ Hardcodeado
vcodgrupotarifa: '1',    // ❌ Hardcodeado
```

**Correcto según API:**
- Obtener de `/api/cotizaemisorauto/gettipoplanes`
- Obtener de `/api/cotizaemisorauto/getgrupotarifa/{vCodTipoPlan}`

---

## ✅ FLUJO CORRECTO SEGÚN DOCUMENTACIÓN

### PASO 1: Obtener Token
```
GET /api/tokens
Authorization: Bearer {token de config}
```

### PASO 2: Obtener Catálogos (Cachear)

**2.1 Tipos de Documento:**
```
GET /api/catalogos/tipodocumentos
→ Retorna: [
  { codigoTipoDocumento: 1, sigla: "CC", nombreTipoDocumento: "CEDULA DE CIUDADANIA" },
  { codigoTipoDocumento: 2, sigla: "RUC", nombreTipoDocumento: "RUC" },
  { codigoTipoDocumento: 3, sigla: "PAS", nombreTipoDocumento: "PASAPORTE" }
]
```

**2.2 Marcas:**
```
GET /api/cotizaemisorauto/getmarcas
→ Retorna: [
  { COD_MARCA: 204.0, TXT_MARCA: "TOYOTA" },
  { COD_MARCA: 123.0, TXT_MARCA: "HONDA" },
  ...
]
```
⚠️ **NOTA:** COD_MARCA viene como decimal pero enviar SIN decimales

**2.3 Modelos (por marca):**
```
GET /api/cotizaemisorauto/getmodelos/1/10
Parámetros: pagenumber, rowsperpage
→ Retorna: [
  { COD_MODELO: 1234, TXT_MODELO: "COROLLA" },
  ...
]
```
⚠️ **NOTA:** COD_MODELO sin decimales

**2.4 Tipos de Planes:**
```
GET /api/cotizaemisorauto/gettipoplanes
→ Retorna: [
  { DATO: 5, TEXTO: "DAT Particular" },
  { DATO: 16, TEXTO: "DAT Comercial" },
  { DATO: 14, TEXTO: "Cobertura Completa Comercial" },
  { DATO: 6, TEXTO: "Perdida Total" }
]
```

**2.5 Grupos de Tarifa (por tipo de plan):**
```
GET /api/cotizaemisorauto/getgrupotarifa/3
→ Retorna grupos de tarifa para el plan 3
```

**2.6 Planes de Cobertura:**
```
GET /api/cotizaemisorauto/getplanes/3
→ Retorna: [
  { TEXTO: "SEGAT 6/18 - € - EMB/2.309", DATO: 655 },
  { TEXTO: "DAT 15/30 -B -7/48", DATO: 262 },
  ...
]
```

### PASO 3: Generar Cotización

```
GET /api/cotizaemisorauto/getgenerarcotizacion
Parámetros:
- vcodtipodoc: 1 (número, no string)
- vnrodoc: "8-999-9999"
- vnombre: "Juan"
- vapellido: "Pérez"
- vtelefono: "6000-0000"
- vcorreo: "cliente@example.com"
- vcodmarca: 204 (número, no string)
- vcodmodelo: 1234 (número, no string)
- vanioauto: 2020
- vsumaaseg: 15000 (o 0 si el plan no lo requiere)
- vcodplancobertura: 655 (del catálogo)
- vcodgrupotarifa: 1 (del catálogo)

→ Retorna:
{
  "RESOSP": 1,
  "MSG": "La cotización fue generada.",
  "IDCOT": 1030168,
  "NROGCOT": 11668,
  "PTOTAL": 400.18
}
```

### PASO 4: Obtener Coberturas

```
GET /api/cotizaemisorauto/getcoberturascotizacion/1030168/1
Parámetros:
- IDCOT (vIdPv): 1030168
- vIdOpt: 1 (puede ser 1, 2 o 3)

→ Retorna:
{
  "Table": [
    {
      "COD_AMPARO": 1.0,
      "COBERTURA": "LESIONES CORPORALES",
      "LIMITE": "$0.00 // 138,828.20",
      "DEDUCIBLE": "",
      "PRIMA": "98.87",
      "ON_DEDUCIBLE": "",
      "MOSTRARINODAT": 0
    },
    {
      "COD_AMPARO": 2.0,
      "COBERTURA": "DAÑOS A LA PROPIEDAD AJENA",
      "LIMITE": "8,000.00",
      "DEDUCIBLE": "",
      "PRIMA": "860.00",
      "ON_DEDUCIBLE": "",
      "MOSTRARINODAT": 0
    }
  ]
}
```

⚠️ **NOTA:** Anotar COD_AMPARO y vcodgrupotarifa SIN decimales

---

## 🔧 CORRECCIONES NECESARIAS

### 1. Actualizar `/lib/is/config.ts`
```typescript
// ✅ Ya tiene los tokens correctos
export const IS_CONFIG = {
  development: {
    baseUrl: 'https://www.iseguros.com/APIRestIsTester',
    bearerToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  },
  production: {
    baseUrl: 'https://www.iseguros.com/APIRestIs',
    bearerToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  },
}
```

### 2. Implementar Servicio de Catálogos

Crear funciones para:
- ✅ `getMarcas()` - Ya existe
- ✅ `getModelos()` - Ya existe
- ✅ `getTipoDocumentos()` - Ya existe
- ✅ `getTipoPlanes()` - Ya existe
- ✅ `getPlanes()` - Ya existe
- ✅ `getGruposTarifa()` - Ya existe

### 3. Modificar Formulario de Cotización

**Agregar selects dinámicos:**
- Marca → Cargar de API
- Modelo → Cargar de API (filtrado por marca)
- Plan de Cobertura → Cargar de API
- Grupo Tarifa → Cargar de API

### 4. Corregir Tipos de Datos

```typescript
// ❌ ANTES
vcodtipodoc: 'CED'
vcodmarca: 'TOY'
vcodmodelo: 'COROLLA'

// ✅ DESPUÉS
vcodtipodoc: 1  // Numérico
vcodmarca: 204  // Numérico sin decimales
vcodmodelo: 1234  // Numérico sin decimales
```

### 5. Validar Suma Asegurada

```typescript
// Antes de generar cotización, validar:
if (planNoRequiereSuma) {
  vsumaaseg = 0;
} else {
  // Validar que esté en rango del plan
  if (vsumaaseg < rangoMin || vsumaaseg > rangoMax) {
    throw new Error(`Suma debe estar entre $${rangoMin} y $${rangoMax}`);
  }
}
```

---

## 📝 PRIORIDADES DE CORRECCIÓN

### 🔴 CRÍTICO (Bloquea funcionalidad):
1. Cambiar `vcodtipodoc` de string a número
2. Cambiar `vcodmarca` y `vcodmodelo` de string a número
3. Quitar decimales de códigos

### 🟡 IMPORTANTE (Mejora experiencia):
4. Implementar selects dinámicos de marcas/modelos
5. Validar rangos de suma asegurada
6. Implementar las 3 opciones de cotización (vIdOpt)

### 🟢 MEJORA (Futuro):
7. Cache de catálogos
8. Manejo de errores mejorado
9. Indicador visual "Cotización Real vs Estimada"

---

## ✅ SIGUIENTE PASO

Corregir los tipos de datos en:
1. `/app/cotizadores/comparar/page.tsx` - Función `generateInternacionalRealQuote()`
2. `/app/cotizadores/emitir/page.tsx` - Función `handleConfirmEmission()`
3. Implementar mapeo correcto de códigos numéricos

