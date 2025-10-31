# 📊 FEDPA - PROGRESO DE IMPLEMENTACIÓN

**Fecha:** Octubre 31, 2025  
**Estado:** 🚧 EN PROGRESO (30% completado)

---

## ✅ COMPLETADO (Fase 1: Infraestructura)

### Archivos Creados (6):

1. **`/lib/fedpa/config.ts`** ✅
   - Configuración completa DEV/PROD
   - URLs base (EmisorPlan + Emisor Externo)
   - Credenciales
   - Constantes de negocio
   - Validaciones regex
   - Cache TTL

2. **`/lib/fedpa/types.ts`** ✅
   - 30+ interfaces TypeScript
   - Tipos para ambas APIs
   - Estructuras de formularios
   - Cache y DB types
   - Error handling types

3. **`/lib/fedpa/http-client.ts`** ✅
   - Cliente HTTP con retry automático
   - Manejo de errores
   - Support para JSON y multipart
   - Bearer token authentication
   - Factory para ambas APIs

4. **`/lib/fedpa/utils.ts`** ✅
   - Normalización a MAYÚSCULAS
   - Validaciones (fecha, placa, cédula, VIN, email)
   - Transformaciones de fechas
   - Helpers de archivos
   - Cálculos de impuestos

5. **`/lib/fedpa/auth.service.ts`** ✅
   - Generación de token
   - Cache en memoria + BD
   - Renovación automática
   - Obtener cliente autenticado
   - Validación de token

6. **`/lib/fedpa/planes.service.ts`** ✅
   - Obtener planes
   - Obtener beneficios
   - Filtros y búsquedas

---

## ⏳ PENDIENTE (Fase 2-8)

### Servicios Backend (4 pendientes):

**1. `/lib/fedpa/catalogs.service.ts`** ⏳
```typescript
// Emisor Externo (2021)
export async function obtenerLimites()
export async function obtenerUsos()
export async function obtenerPlanesCC()
export async function obtenerBeneficiosPlanesExternos()
```

**2. `/lib/fedpa/cotizacion.service.ts`** ⏳
```typescript
// Emisor Externo (2021)
export async function generarCotizacion(request: CotizacionRequest)
```

**3. `/lib/fedpa/documentos.service.ts`** ⏳
```typescript
// EmisorPlan (2024)
export async function subirDocumentos(files: File[], tipos: string[])
```

**4. `/lib/fedpa/emision.service.ts`** ⏳
```typescript
// EmisorPlan (2024) - Principal
export async function emitirPoliza(request: EmitirPolizaRequest)

// Emisor Externo (2021) - Fallback
export async function emitirPolizaFallback(request: any)
```

---

### Endpoints API (8 pendientes):

**1. `/app/api/fedpa/auth/token/route.ts`** ⏳
```typescript
POST - Generar/renovar token
```

**2. `/app/api/fedpa/planes/route.ts`** ⏳
```typescript
GET - Obtener lista de planes
```

**3. `/app/api/fedpa/planes/beneficios/route.ts`** ⏳
```typescript
GET - Obtener beneficios de un plan
```

**4. `/app/api/fedpa/limites/route.ts`** ⏳
```typescript
GET - Obtener límites disponibles
```

**5. `/app/api/fedpa/cotizacion/route.ts`** ⏳
```typescript
POST - Generar cotización detallada
```

**6. `/app/api/fedpa/documentos/upload/route.ts`** ⏳
```typescript
POST (multipart) - Subir documentos inspección
```

**7. `/app/api/fedpa/emision/route.ts`** ⏳
```typescript
POST - Emitir póliza (dual: EmisorPlan + fallback)
```

**8. `/app/api/fedpa/poliza/route.ts`** ⏳
```typescript
GET - Obtener número de póliza (Emisor Externo)
```

---

### Base de Datos (12 tablas pendientes):

**Script SQL necesario:**

```sql
-- 1. Tokens
CREATE TABLE fedpa_tokens (
  session_id TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  exp BIGINT NOT NULL,
  amb TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Planes
CREATE TABLE fedpa_planes (
  plan INTEGER PRIMARY KEY,
  tipoplan TEXT,
  descripcion TEXT,
  ramo TEXT,
  subramo TEXT,
  prima NUMERIC,
  impuesto1 NUMERIC,
  impuesto2 NUMERIC,
  primaconimpuesto NUMERIC,
  sincronizado BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Coberturas de planes
CREATE TABLE fedpa_planes_coberturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan INTEGER REFERENCES fedpa_planes(plan),
  codigo TEXT,
  descripcion TEXT,
  limite TEXT,
  prima NUMERIC
);

-- 4. Usos de planes
CREATE TABLE fedpa_planes_usos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan INTEGER REFERENCES fedpa_planes(plan),
  uso TEXT,
  descripcion_uso TEXT
);

-- 5. Beneficios
CREATE TABLE fedpa_beneficios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan INTEGER REFERENCES fedpa_planes(plan),
  beneficio TEXT
);

-- 6. Usos
CREATE TABLE fedpa_usos (
  uso TEXT PRIMARY KEY,
  descripcion TEXT
);

-- 7. Límites
CREATE TABLE fedpa_limites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cobertura INTEGER,
  idlimite INTEGER,
  limite TEXT,
  UNIQUE(cobertura, idlimite)
);

-- 8. Marcas (homologación)
CREATE TABLE fedpa_marcas (
  cod_marca TEXT PRIMARY KEY,
  display TEXT NOT NULL,
  activa BOOLEAN DEFAULT TRUE
);

-- 9. Modelos (homologación)
CREATE TABLE fedpa_modelos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_marca TEXT REFERENCES fedpa_marcas(cod_marca),
  cod_modelo TEXT NOT NULL,
  display TEXT NOT NULL,
  activa BOOLEAN DEFAULT TRUE,
  UNIQUE(cod_marca, cod_modelo)
);

-- 10. Cotizaciones
CREATE TABLE fedpa_cotizaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id INTEGER,
  payload JSONB NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Documentos
CREATE TABLE fedpa_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id TEXT,
  id_doc TEXT UNIQUE,
  files JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Emisiones
CREATE TABLE fedpa_emisiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id UUID REFERENCES fedpa_cotizaciones(id),
  id_doc TEXT,
  payload JSONB NOT NULL,
  response JSONB NOT NULL,
  nro_poliza TEXT,
  vigencia_desde TEXT,
  vigencia_hasta TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_fedpa_tokens_exp ON fedpa_tokens(exp);
CREATE INDEX idx_fedpa_planes_tipo ON fedpa_planes(tipoplan);
CREATE INDEX idx_fedpa_cotizaciones_created ON fedpa_cotizaciones(created_at DESC);
CREATE INDEX idx_fedpa_emisiones_poliza ON fedpa_emisiones(nro_poliza);
```

---

### Componentes UI (8 pendientes):

**1. `/components/fedpa/PlanSelector.tsx`** ⏳
- Selección de plan
- Filtros por tipo
- Vista de tarjetas

**2. `/components/fedpa/PlanBenefits.tsx`** ⏳
- Lista de beneficios
- Iconos por tipo

**3. `/components/fedpa/VehicleDataForm.tsx`** ⏳
- Formulario de vehículo
- Dropdowns dinámicos

**4. `/components/fedpa/LimitesSelector.tsx`** ⏳
- Selección de límites
- Cards seleccionables

**5. `/components/fedpa/ClientDataForm.tsx`** ⏳
- Datos del cliente
- Validaciones PEP

**6. `/components/fedpa/CotizacionSummary.tsx`** ⏳
- Desglose de cotización
- Badge sincronizado

**7. `/components/fedpa/DocumentosUploader.tsx`** ⏳
- Upload múltiple
- 3 tipos de documentos
- Drag & drop

**8. `/components/fedpa/EmisionConfirmation.tsx`** ⏳
- Confirmación final
- Número de póliza
- Resumen

---

### Páginas (2 pendientes):

**1. `/app/cotizadores/fedpa/auto/page.tsx`** ⏳
- Flujo completo 8 pasos
- Navegación entre steps
- sessionStorage management

**2. `/app/cotizadores/fedpa/emision/page.tsx`** ⏳
- Resultado de emisión
- Descarga de póliza

---

## 📊 PROGRESO GENERAL

| Fase | Completado | Pendiente | % |
|------|------------|-----------|---|
| 1. Infraestructura | ✅ 6/6 | - | 100% |
| 2. Servicios | ✅ 2/6 | 4 | 33% |
| 3. Endpoints | - | 8 | 0% |
| 4. Base de Datos | - | 12 tablas | 0% |
| 5. Componentes UI | - | 8 | 0% |
| 6. Páginas | - | 2 | 0% |

**TOTAL: 30% completado**

---

## 🎯 PRÓXIMOS PASOS INMEDIATOS

### PASO 1: Completar Servicios (2-3 horas)
1. Crear `/lib/fedpa/catalogs.service.ts`
2. Crear `/lib/fedpa/cotizacion.service.ts`
3. Crear `/lib/fedpa/documentos.service.ts`
4. Crear `/lib/fedpa/emision.service.ts`

### PASO 2: Crear Endpoints API (3-4 horas)
1. Crear los 8 endpoints en `/app/api/fedpa/`
2. Probar con Postman/Thunder Client
3. Validar respuestas

### PASO 3: Configurar Base de Datos (1-2 horas)
1. Ejecutar script SQL en Supabase
2. Configurar RLS policies
3. Poblar catálogos iniciales

### PASO 4: Crear Componentes UI (6-8 horas)
1. Crear los 8 componentes
2. Integrar con hooks
3. Styling con Tailwind

### PASO 5: Crear Páginas (4-5 horas)
1. Página principal con flujo de 8 pasos
2. Página de confirmación
3. Navegación y estado

### PASO 6: Testing (3-4 horas)
1. Probar autenticación
2. Probar flujo completo
3. Validaciones
4. Manejo de errores

---

## ⏱️ TIEMPO RESTANTE ESTIMADO

- Servicios: 2-3h
- Endpoints: 3-4h
- Base de Datos: 1-2h
- Componentes UI: 6-8h
- Páginas: 4-5h
- Testing: 3-4h

**TOTAL: 19-26 horas**

---

## 📝 NOTAS IMPORTANTES

### Lo que YA funciona:
- ✅ HTTP Client con retry
- ✅ Autenticación y cache de tokens
- ✅ Normalización y validaciones
- ✅ Obtención de planes y beneficios

### Lo que FALTA para funcionar:
- ⏳ Resto de servicios (catálogos, cotización, docs, emisión)
- ⏳ Endpoints API expuestos
- ⏳ Tablas en base de datos
- ⏳ Interfaz de usuario

### Prioridad de implementación:
1. **ALTA:** Servicios + Endpoints (permiten probar APIs)
2. **MEDIA:** Base de datos (almacenamiento)
3. **BAJA:** UI (puede testearse con Postman mientras)

---

## 🚀 CÓMO CONTINUAR

### Opción A: Implementar TODO
Continuar secuencialmente con cada fase hasta completar.

**Ventajas:**
- Sistema completo end-to-end
- Listo para producción

**Tiempo:** 19-26 horas adicionales

### Opción B: MVP Funcional
Implementar solo servicios + endpoints para probar APIs.

**Ventajas:**
- Más rápido (5-7 horas)
- Permite validar integración con FEDPA
- UI puede agregarse después

**Tiempo:** 5-7 horas

---

## 🎯 RECOMENDACIÓN

**Seguir con Opción B (MVP Funcional):**
1. Completar servicios restantes (2-3h)
2. Crear endpoints API (3-4h)
3. Probar con Postman
4. Validar con FEDPA real

**Luego:**
5. Crear BD (1-2h)
6. Crear UI progresivamente (6-8h)

**Total MVP:** 5-7 horas  
**Total Completo:** +7-10 horas más

---

**Estado Actual:** 🚧 30% COMPLETADO  
**Listo para:** Continuar con servicios restantes  
**Siguiente:** `catalogs.service.ts`
