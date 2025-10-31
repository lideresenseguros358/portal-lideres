# 🔍 ANÁLISIS COMPLETO: Flujos de Cotización y Emisión

**Fecha:** Octubre 31, 2025  
**Estado:** 📋 ANÁLISIS Y PLAN DE IMPLEMENTACIÓN

---

## 📊 ESTADO ACTUAL

### INTERNACIONAL DE SEGUROS:

**✅ Cobertura Completa (100% Funcional):**
```
Usuario → FormAutoCoberturaCompleta
  ↓ Ingresa datos vehículo
  ↓ sessionStorage
  ↓
/comparar → ThirdPartyComparison
  ↓ POST /api/is/auto/quote (Plan 14)
  ↓ GET /api/is/auto/coberturas
  ↓ Muestra 5 cotizaciones
  ↓
Usuario selecciona INTERNACIONAL
  ↓
/emitir?step=emission-data
  ↓ 8 pasos de emisión
  ↓
POST /api/is/auto/emitir
  ↓ Crea cliente + póliza en BD
  ↓
✅ PÓLIZA EMITIDA
  ↓ sessionStorage.emittedPolicy
  ↓
❌ FALTA: Página de visualización póliza
```

**✅ Daños a Terceros (100% Funcional):**
```
Usuario → ThirdPartyComparison
  ↓ Selecciona plan (Plan 5 o 16)
  ↓
Si INTERNACIONAL:
  POST /api/is/auto/quote (automático, suma=0)
  ↓ Guarda IDCOT en sessionStorage
  ↓
/third-party/issue
  ↓ Formulario datos cliente
  ↓
POST /api/is/auto/emitir
  ↓ Crea cliente + póliza
  ↓
✅ PÓLIZA EMITIDA
  ↓ sessionStorage.emittedPolicy
  ↓
❌ FALTA: Página de visualización póliza
```

### FEDPA:

**🚧 Estado Actual:**
- ✅ Backend completo (servicios + endpoints)
- ✅ BD conectada (clients + policies)
- ❌ NO hay UI de cotización
- ❌ NO hay integración en comparador
- ❌ NO hay página de emisión

---

## 🎯 LO QUE HACE FALTA

### 1. Página de Visualización de Póliza (CRÍTICO):

**Ruta:** `/cotizadores/poliza/[id]` o `/cotizadores/poliza-emitida`

**Debe mostrar:**
```
┌─────────────────────────────────────┐
│  ✅ ¡Póliza Emitida Exitosamente!   │
├─────────────────────────────────────┤
│                                     │
│  Número de Póliza: 04-07-72-0      │
│  Aseguradora: INTERNACIONAL         │
│  Ramo: AUTO                         │
│                                     │
│  Cliente:                           │
│  • Nombre: JUAN PEREZ               │
│  • Cédula: 8-123-456                │
│  • Email: juan@example.com          │
│                                     │
│  Vehículo:                          │
│  • Marca: TOYOTA                    │
│  • Modelo: COROLLA                  │
│  • Año: 2022                        │
│  • Placa: ABC-1234                  │
│                                     │
│  Vigencia:                          │
│  • Desde: 26/02/2024                │
│  • Hasta: 26/02/2025                │
│                                     │
│  Prima: $450.00                     │
│                                     │
│  [📄 Descargar PDF]                 │
│  [🏠 Volver al Inicio]              │
│                                     │
└─────────────────────────────────────┘
```

### 2. Integración FEDPA en Cotizadores:

**A. En ThirdPartyComparison:**
```typescript
// Agregar FEDPA como 6ta opción
const insurers = [
  { slug: 'INTERNACIONAL', name: 'INTERNACIONAL' },
  { slug: 'FEDPA', name: 'FEDPA' },
  { slug: 'MAPFRE', name: 'MAPFRE' },
  { slug: 'ASSA', name: 'ASSA' },
  { slug: 'ANCON', name: 'ANCÓN' },
];

// Al seleccionar FEDPA:
if (selectedInsurer === 'FEDPA') {
  // POST /api/fedpa/cotizacion
  // Guardar idCotizacion
}
```

**B. Crear FormAutoFEDPA (Cobertura Completa):**
```
/cotizadores/fedpa/auto
  ↓
8 Pasos:
  1. Datos vehículo
  2. Selección plan
  3. Límites coberturas
  4. Datos cliente
  5. Cotización
  6. Documentos
  7. Revisión
  8. Emisión
```

### 3. Flujo Unificado de Emisión:

**Ambas aseguradoras deben terminar en:**
```
POST /api/{is|fedpa}/emision
  ↓
{
  success: true,
  poliza: "04-07-72-0",
  nroPoliza: "04-07-72-0",
  clientId: "uuid",
  policyId: "uuid",
  insurer: "INTERNACIONAL" | "FEDPA",
  ...datos completos
}
  ↓
router.push('/cotizadores/poliza-emitida')
  ↓
Página muestra póliza desde sessionStorage o URL params
```

---

## 📋 PLAN DE IMPLEMENTACIÓN

### FASE 1: Visualización de Póliza (2-3 horas) ⭐ CRÍTICO

**1.1 Crear página:**
```
/src/app/cotizadores/poliza-emitida/page.tsx
```

**Características:**
- Lee datos de sessionStorage ('emittedPolicy')
- Fallback a query params si no hay sessionStorage
- Muestra datos completos de la póliza
- Botón descargar PDF (si está disponible)
- Botón volver al inicio
- Diseño responsive y profesional
- Soporte INTERNACIONAL y FEDPA

**1.2 Actualizar emisión INTERNACIONAL:**
```typescript
// En /api/is/auto/emitir/route.ts
// Guardar datos completos para visualización
sessionStorage.setItem('emittedPolicy', JSON.stringify({
  insurer: 'INTERNACIONAL',
  nroPoliza: result.nroPoliza,
  cliente: { ... },
  vehiculo: { ... },
  vigencia: { ... },
  prima: { ... },
}));

router.push('/cotizadores/poliza-emitida');
```

### FASE 2: Integrar FEDPA en Daños a Terceros (1-2 horas)

**2.1 Actualizar ThirdPartyComparison:**
- Agregar FEDPA como opción
- Llamar `/api/fedpa/cotizacion` al seleccionar
- Guardar idCotizacion en sessionStorage

**2.2 Actualizar /third-party/issue:**
- Detectar si es FEDPA
- Llamar `/api/fedpa/emision` si es FEDPA
- Redirigir a `/poliza-emitida`

### FASE 3: Crear Cotizador FEDPA Cobertura Completa (8-10 horas)

**3.1 Crear estructura:**
```
/src/app/cotizadores/fedpa/
  ├─ auto/
  │  └─ page.tsx (8 pasos)
  └─ poliza/
     └─ page.tsx (resultado)
```

**3.2 Crear componentes:**
```
/src/components/fedpa/
  ├─ PlanSelector.tsx
  ├─ VehicleDataForm.tsx
  ├─ LimitesSelector.tsx
  ├─ ClientDataForm.tsx
  ├─ CotizacionSummary.tsx
  ├─ DocumentosUploader.tsx
  └─ ReviewStep.tsx
```

**3.3 Flujo completo:**
```
1. Datos vehículo → sessionStorage
2. GET /api/fedpa/planes → Seleccionar plan
3. GET /api/fedpa/limites → Seleccionar límites
4. Datos cliente → sessionStorage
5. POST /api/fedpa/cotizacion → Mostrar desglose
6. POST /api/fedpa/documentos/upload → Subir docs
7. Revisión completa
8. POST /api/fedpa/emision → Emitir
9. → /poliza-emitida
```

### FASE 4: Validación y Testing (2-3 horas)

**4.1 Probar flujos:**
- ✅ INTERNACIONAL Cobertura Completa
- ✅ INTERNACIONAL Daños a Terceros
- ✅ FEDPA Daños a Terceros
- ✅ FEDPA Cobertura Completa

**4.2 Verificar:**
- Tarifas correctas
- Planes correctos
- Datos en BD
- Visualización póliza

---

## ⏱️ TIEMPO ESTIMADO TOTAL

| Fase | Tiempo | Prioridad |
|------|--------|-----------|
| 1. Visualización Póliza | 2-3h | ⭐ CRÍTICA |
| 2. FEDPA Daños Terceros | 1-2h | 🔥 ALTA |
| 3. FEDPA Cobertura Completa | 8-10h | 📋 MEDIA |
| 4. Testing | 2-3h | ✅ ALTA |
| **TOTAL** | **13-18h** | - |

---

## 🚀 PRIORIDADES INMEDIATAS

### HOY (2-3 horas):
1. ✅ Crear `/cotizadores/poliza-emitida/page.tsx`
2. ✅ Actualizar emisión IS para redirigir a nueva página
3. ✅ Probar flujo completo IS

### ESTA SEMANA (1-2 horas):
4. ✅ Integrar FEDPA en Daños a Terceros
5. ✅ Probar emisión FEDPA Third-Party

### PRÓXIMA SEMANA (8-10 horas):
6. ⏳ Crear cotizador FEDPA Cobertura Completa
7. ⏳ Testing completo

---

## 📊 PLANES Y TARIFAS

### INTERNACIONAL:

**Cobertura Completa:**
- Plan: 14
- Suma asegurada: Variable ($5,000 - $100,000)
- Prima: Calculada por API
- Coberturas: Desde API

**Daños a Terceros:**
- Plan 5: DAT Particular
- Plan 16: DAT Comercial
- Suma asegurada: 0 (tácito)
- Prima: Calculada por API

### FEDPA:

**Cobertura Completa:**
- Planes: Desde `/api/fedpa/planes`
- Suma asegurada: Variable
- Prima: Desde `/api/fedpa/cotizacion`
- Coberturas: Configurables con límites

**Daños a Terceros:**
- Planes: Filtrar por tipo="DAÑOS A TERCEROS"
- Suma asegurada: 0 o según plan
- Prima: Desde `/api/fedpa/cotizacion`

---

## 🎯 RESULTADO FINAL ESPERADO

### Flujo Usuario (Cualquier Aseguradora):

```
1. Usuario completa datos
   ↓
2. Ve cotizaciones
   ↓
3. Selecciona aseguradora
   ↓
4. Completa emisión
   ↓
5. ✅ Póliza emitida
   ↓
6. 📄 VE PÓLIZA COMPLETA en pantalla
   ↓
7. Puede descargar PDF
   ↓
8. Datos guardados en BD
```

### Características Visualización Póliza:

- ✅ Diseño profesional
- ✅ Datos completos visibles
- ✅ Número de póliza destacado
- ✅ Info cliente, vehículo, vigencia
- ✅ Prima total
- ✅ Botón descargar PDF (si disponible)
- ✅ Botón volver al inicio
- ✅ Responsive (mobile/desktop)
- ✅ Soporte multi-aseguradora

---

## 📝 NOTAS TÉCNICAS

### SessionStorage Structure:
```typescript
{
  emittedPolicy: {
    insurer: 'INTERNACIONAL' | 'FEDPA',
    nroPoliza: string,
    clientId: string,
    policyId: string,
    cliente: {
      nombre: string,
      cedula: string,
      email: string,
      telefono: string,
    },
    vehiculo: {
      marca: string,
      modelo: string,
      ano: number,
      placa: string,
    },
    vigencia: {
      desde: string, // dd/mm/yyyy
      hasta: string, // dd/mm/yyyy
    },
    prima: {
      total: number,
      desglose?: any[],
    },
    pdfUrl?: string,
  }
}
```

---

**Estado:** 📋 PLAN COMPLETO LISTO  
**Siguiente:** Implementar Fase 1 (Visualización Póliza)
