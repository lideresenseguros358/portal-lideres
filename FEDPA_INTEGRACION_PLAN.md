# 🎯 PLAN DE INTEGRACIÓN FEDPA - Portal LISSA

**Fecha:** Octubre 31, 2025  
**Aseguradora:** FEDPA (Corredor: LÍDERES 836)  
**Estado:** 📋 PLANIFICACIÓN E IMPLEMENTACIÓN

---

## 📊 RESUMEN EJECUTIVO

Integración completa de FEDPA para cotización y emisión de seguros AUTO (Daños a Terceros y Cobertura Completa) usando DOS familias de APIs:

1. **EmisorPlan (2024)** - Principal: Token, planes, documentos, emisión
2. **Emisor Externo (2021)** - Complemento: Cotización detallada, límites, fallback

---

## 🔧 ARQUITECTURA DE INTEGRACIÓN

### Dual API Strategy:

```
┌─────────────────────────────────────────────┐
│           PORTAL LISSA (Frontend)           │
└─────────────────┬───────────────────────────┘
                  │
        ┌─────────┴─────────┐
        │   Backend LISSA   │
        │   (API Routes)    │
        └─────────┬─────────┘
                  │
    ┌─────────────┴──────────────┐
    │                            │
┌───▼────────────┐   ┌──────────▼──────────┐
│  EmisorPlan    │   │ Emisor Externo      │
│  (2024)        │   │ (2021)              │
│                │   │                     │
│ • Token        │   │ • Cotización        │
│ • Planes       │   │ • Límites           │
│ • Beneficios   │   │ • Planes CC         │
│ • Docs Upload  │   │ • Usos              │
│ • Emisión ⭐   │   │ • Nro Póliza        │
│                │   │ • Emisión (backup)  │
└────────────────┘   └─────────────────────┘
```

---

## 📁 ESTRUCTURA DE ARCHIVOS A CREAR

### Configuración y Tipos (4 archivos):
```
/src/lib/fedpa/
  ├─ config.ts              ← URLs, credenciales, constantes
  ├─ types.ts               ← Interfaces TypeScript
  ├─ http-client.ts         ← Cliente HTTP con retry
  └─ utils.ts               ← Helpers (normalización, validaciones)
```

### Servicios (6 archivos):
```
/src/lib/fedpa/
  ├─ auth.service.ts        ← Token generation/refresh
  ├─ planes.service.ts      ← Planes, coberturas, beneficios
  ├─ catalogs.service.ts    ← Límites, usos, planes asignados
  ├─ cotizacion.service.ts  ← Cotización detallada
  ├─ documentos.service.ts  ← Upload de inspección
  └─ emision.service.ts     ← Emisión (dual: EmisorPlan + fallback)
```

### Endpoints API (8 archivos):
```
/src/app/api/fedpa/
  ├─ auth/token/route.ts
  ├─ planes/route.ts
  ├─ planes/beneficios/route.ts
  ├─ limites/route.ts
  ├─ cotizacion/route.ts
  ├─ documentos/upload/route.ts
  ├─ emision/route.ts
  └─ poliza/route.ts (get número)
```

### Componentes UI (8 archivos):
```
/src/components/fedpa/
  ├─ PlanSelector.tsx           ← Selección plan + uso
  ├─ PlanBenefits.tsx           ← Lista de beneficios
  ├─ VehicleDataForm.tsx        ← Datos vehículo
  ├─ LimitesSelector.tsx        ← Selección límites coberturas
  ├─ ClientDataForm.tsx         ← Datos cliente (PEP, etc.)
  ├─ CotizacionSummary.tsx      ← Desglose cotización
  ├─ DocumentosUploader.tsx     ← 3 tipos docs (múltiples)
  └─ EmisionConfirmation.tsx    ← Confirmación final
```

### Páginas (2 archivos):
```
/src/app/cotizadores/fedpa/
  ├─ auto/page.tsx          ← Flujo principal 8 pasos
  └─ emision/page.tsx       ← Confirmación y resultado
```

### Base de Datos - Nuevas Tablas (9 tablas):
```sql
-- Token cache
fedpa_tokens(session_id, token, exp, amb)

-- Catálogos
fedpa_planes(plan, tipoplan, descripcion, ramo, subramo, prima...)
fedpa_planes_coberturas(plan, codigo, descripcion, limite, prima)
fedpa_planes_usos(plan, uso, descripcion_uso)
fedpa_beneficios(plan, beneficio)
fedpa_usos(uso, descripcion)
fedpa_limites(cobertura, idlimite, limite)
fedpa_marcas(cod_marca, display)  -- homologación local
fedpa_modelos(cod_marca, cod_modelo, display)

-- Transacciones
fedpa_cotizaciones(id, payload, response, created_at)
fedpa_documentos(upload_id, idDoc, files[], created_at)
fedpa_emisiones(id, payload, response, nro_poliza, vigencia...)
```

---

## 🔑 CREDENCIALES Y AMBIENTES

```typescript
// DEV
usuario: "lider836"
clave: "lider836"
ambiente: "DEV"

// PROD
usuario: "lider836"
clave: "lider836"
ambiente: "PROD"
```

**URLs Base:**
- EmisorPlan: `https://wscanales.segfedpa.com/EmisorPlan`
- Emisor Externo: `https://wscanales.segfedpa.com/EmisorFedpa.Api`

---

## 📋 FLUJO COMPLETO (8 PASOS)

### PASO 1: Autenticación (Silenciosa)
```
Al entrar → POST /EmisorPlan/api/generartoken
└─ Guardar token en cache (50 min TTL)
└─ Renovar automáticamente antes de expirar
```

### PASO 2: Selección Plan/Uso
```
GET /EmisorPlan/api/planes
└─ Mostrar lista de planes
└─ GET /EmisorPlan/api/planes/beneficios?plan={id}
└─ Mostrar beneficios del plan seleccionado
```

### PASO 3: Datos del Vehículo
```
Formulario:
- Año, Uso, Pasajeros
- Marca, Modelo (homologación local)
- Color, Placa, VIN, Motor, Puertas
```

### PASO 4: Límites/Coberturas
```
GET /EmisorFedpa.Api/api/Polizas/consultar_limites_externos
└─ Mostrar límites disponibles
└─ Permitir selección según plan
```

### PASO 5: Datos del Cliente
```
Formulario:
- Nombres/apellidos (normalizados MAYÚSCULAS)
- Identificación (Cédula/RUC/Pasaporte)
- Fecha nacimiento (dd/mm/yyyy)
- Sexo (M/F), PEP (0/1)
- Contacto, dirección, acreedor
```

### PASO 6: Cotización
```
POST /EmisorFedpa.Api/api/Polizas/get_cotizacion
└─ Mostrar desglose:
    ├─ Prima base
    ├─ Impuestos (5% + 1%)
    ├─ Prima por cobertura
    ├─ Total primaconimpuesto
    └─ Flag sincronizado
```

### PASO 7: Inspección/Documentos
```
POST /EmisorPlan/api/subirdocumentos (multipart)
└─ Subir 3 tipos (múltiples archivos cada uno):
    ├─ documento_identidad
    ├─ licencia_conducir
    └─ registro_vehicular
└─ Retorna: { idDoc: "Doc-xxxxxxxx" }
```

### PASO 8: Emisión
```
POST /EmisorPlan/api/emitirpoliza
└─ Con: Plan, idDoc, datos completos
└─ Retorna:
    ├─ cotizacion: "216"
    ├─ poliza: "04-07-72-0"
    ├─ desde: "26/02/2024"
    └─ hasta: "26/02/2025"
```

---

## 🔐 VALIDACIONES CRÍTICAS

### Formato Fecha:
```typescript
// OBLIGATORIO: dd/mm/yyyy
FechaNacimiento: "10/02/1985"
```

### Normalización:
```typescript
// TODO en MAYÚSCULAS
Nombre, Apellido, Marca, Modelo, Placa, VIN, Motor
```

### Sexo:
```typescript
"M" | "F"  // String, no número
```

### PEP:
```typescript
0 | 1  // Número, no boolean
```

### Archivos:
```typescript
// Nombres EXACTOS
"documento_identidad"
"licencia_conducir"
"registro_vehicular"

// MIME permitidos
"application/pdf"
"image/jpeg", "image/jpg", "image/png"
"image/gif", "image/bmp", "image/webp"
"image/tiff", "image/svg+xml"

// Tamaño máximo: 10MB por archivo
```

---

## 🎨 COMPONENTES UI - ESPECIFICACIONES

### 1. PlanSelector
- Lista de planes con tipo (Daños Terceros / Cobertura Completa)
- Filtros por tipo
- Vista de tarjetas con prima y coberturas principales

### 2. PlanBenefits
- Lista expandible de beneficios
- Iconos por tipo de beneficio

### 3. VehicleDataForm
- Dropdowns: Uso (desde API), Marca/Modelo (homologación)
- Inputs: Año, Color, Placa, VIN, Motor
- Selectors: Pasajeros, Puertas

### 4. LimitesSelector
- Cards seleccionables para:
  - Lesiones corporales
  - Daños a propiedad
  - Gastos médicos
- Mostrar límites disponibles por plan

### 5. ClientDataForm
- Split nombre/apellido (primer/segundo)
- Selector tipo identificación
- Date picker dd/mm/yyyy
- Radio Sexo (M/F)
- Checkbox PEP
- Input opcional Acreedor

### 6. CotizacionSummary
- Tabla desglose:
  - Prima base
  - Coberturas (cada una)
  - Impuesto 5%
  - Impuesto 1%
  - Total
- Badge "Sincronizado" (verde/rojo)

### 7. DocumentosUploader
- 3 secciones (una por tipo)
- Drag & drop múltiple
- Vista previa imágenes
- Validación MIME + tamaño
- Compresión automática >5MB

### 8. EmisionConfirmation
- Número de póliza destacado
- Vigencia desde/hasta
- Botón descargar póliza (si disponible)
- Resumen final de la cotización

---

## 🔄 MANEJO DE ERRORES

### Token Expirado:
```typescript
if (response.status === 401) {
  await refreshToken();
  return retry(request);
}
```

### API No Disponible:
```typescript
try {
  return await emisorPlanEmitir();
} catch (error) {
  console.warn('EmisorPlan failed, using fallback');
  return await emisorExternoEmitir();
}
```

### Validación de Archivos:
```typescript
// Validar ANTES de subir
if (!ALLOWED_MIMES.includes(file.type)) {
  throw new Error('Formato no permitido');
}
if (file.size > MAX_SIZE) {
  file = await compressImage(file);
}
```

---

## 📊 CACHE STRATEGY

### Token:
```
TTL: 50 minutos
Storage: Redis/Memory + BD (fedpa_tokens)
Refresh: Automático 5 min antes de expirar
```

### Planes/Catálogos:
```
TTL: 24 horas
Storage: BD (fedpa_planes, fedpa_limites, etc.)
Sync: Manual o cron diario
```

### Cotizaciones:
```
Permanente: Guardar todas (auditoría)
Storage: BD (fedpa_cotizaciones)
```

---

## 🧪 TESTING PLAN

### Fase 1: Servicios
- [ ] Autenticación (DEV y PROD)
- [ ] Obtener planes
- [ ] Obtener beneficios
- [ ] Obtener límites
- [ ] Cotización exitosa
- [ ] Upload documentos
- [ ] Emisión exitosa

### Fase 2: Validaciones
- [ ] Fecha dd/mm/yyyy
- [ ] Normalización MAYÚSCULAS
- [ ] Sexo M/F
- [ ] PEP 0/1
- [ ] Archivos MIME
- [ ] Archivos >10MB (compresión)

### Fase 3: Flujo Completo
- [ ] Daños a Terceros end-to-end
- [ ] Cobertura Completa end-to-end
- [ ] Múltiples archivos por tipo
- [ ] Cambio de límites
- [ ] Fallback Emisor Externo

### Fase 4: Errores
- [ ] Token inválido
- [ ] Plan no válido
- [ ] Marca/modelo inexistente
- [ ] Formato fecha inválido
- [ ] Archivo formato incorrecto
- [ ] API no disponible

---

## 📦 PLAN DE IMPLEMENTACIÓN

### FASE 1: Infraestructura (2-3 horas)
- [x] Analizar especificaciones
- [ ] Crear configuración (/lib/fedpa/config.ts)
- [ ] Crear tipos TypeScript (/lib/fedpa/types.ts)
- [ ] Crear HTTP client (/lib/fedpa/http-client.ts)
- [ ] Crear utils (/lib/fedpa/utils.ts)

### FASE 2: Servicios Backend (4-5 horas)
- [ ] auth.service.ts - Token
- [ ] planes.service.ts - Planes y beneficios
- [ ] catalogs.service.ts - Límites, usos
- [ ] cotizacion.service.ts - Cotización
- [ ] documentos.service.ts - Upload
- [ ] emision.service.ts - Emisión dual

### FASE 3: API Endpoints (3-4 horas)
- [ ] /api/fedpa/auth/token
- [ ] /api/fedpa/planes
- [ ] /api/fedpa/planes/beneficios
- [ ] /api/fedpa/limites
- [ ] /api/fedpa/cotizacion
- [ ] /api/fedpa/documentos/upload
- [ ] /api/fedpa/emision
- [ ] /api/fedpa/poliza

### FASE 4: Base de Datos (2 horas)
- [ ] Crear tablas en Supabase
- [ ] Crear índices
- [ ] Configurar RLS
- [ ] Scripts de migración

### FASE 5: Componentes UI (6-8 horas)
- [ ] PlanSelector
- [ ] PlanBenefits
- [ ] VehicleDataForm
- [ ] LimitesSelector
- [ ] ClientDataForm
- [ ] CotizacionSummary
- [ ] DocumentosUploader
- [ ] EmisionConfirmation

### FASE 6: Páginas Principales (4-5 horas)
- [ ] /cotizadores/fedpa/auto (8 pasos)
- [ ] /cotizadores/fedpa/emision
- [ ] Navegación entre pasos
- [ ] sessionStorage management
- [ ] Loading states

### FASE 7: Testing & QA (3-4 horas)
- [ ] Tests unitarios servicios
- [ ] Tests integración APIs
- [ ] Tests UI componentes
- [ ] Tests flujo completo
- [ ] Tests validaciones
- [ ] Tests errores

### FASE 8: Documentación (2 horas)
- [ ] README técnico
- [ ] Guía de uso
- [ ] Mapeo de campos
- [ ] Troubleshooting

---

## ⏱️ ESTIMACIÓN TOTAL

**Tiempo estimado:** 26-33 horas de desarrollo

**Desglose:**
- Infraestructura: 2-3h
- Servicios: 4-5h
- API Endpoints: 3-4h
- Base de Datos: 2h
- UI Componentes: 6-8h
- Páginas: 4-5h
- Testing: 3-4h
- Documentación: 2h

---

## 🎯 ENTREGABLES FINALES

1. ✅ Servicios backend completos
2. ✅ 8 endpoints API funcionales
3. ✅ 8 componentes UI reutilizables
4. ✅ 2 páginas principales
5. ✅ 9 tablas en BD con RLS
6. ✅ Catálogos homologados (Marca/Modelo)
7. ✅ Sistema de cache (token + catálogos)
8. ✅ Upload múltiple de documentos
9. ✅ Emisión dual (principal + fallback)
10. ✅ Documentación completa

---

## 📝 NOTAS IMPORTANTES

1. **Homologación Marca/Modelo:** No hay endpoint oficial, mantener catálogo local editable
2. **Dual API:** EmisorPlan principal, Emisor Externo como complemento/fallback
3. **Normalización:** TODO en MAYÚSCULAS según regla global del portal
4. **Fechas:** Siempre dd/mm/yyyy (validar y transformar)
5. **Documentos:** Nombres exactos, múltiples archivos permitidos
6. **Sincronizado:** Validar pero permitir continuar con warning
7. **Logs:** Registrar TODAS las transacciones para auditoría

---

## 🚀 PRÓXIMOS PASOS

**AHORA:** Crear estructura base (config, types, servicios)  
**DESPUÉS:** Implementar endpoints API  
**LUEGO:** Crear componentes UI  
**FINAL:** Testing y documentación

**Estado:** 📋 PLAN COMPLETO - LISTO PARA IMPLEMENTAR
