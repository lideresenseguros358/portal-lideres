# 🏗️ INTEGRACIÓN INTERNACIONAL DE SEGUROS (IS) - ESTADO DE IMPLEMENTACIÓN

**Fecha:** 30 de octubre de 2025  
**Aseguradora:** Internacional de Seguros (IS)  
**Entidad en BD:** `INTERNACIONAL`  
**Corredor:** `oficina` (fijo)

---

## ✅ LO QUE SE HA IMPLEMENTADO (Backend/Infraestructura)

### **1. Base de Datos** ✅

**Archivo:** `supabase/migrations/20251030_internacional_seguros_integration.sql`

**Tablas creadas:**
- ✅ `audit_payloads` - Auditoría cifrada de requests/responses
- ✅ `is_daily_tokens` - Cache de tokens diarios por ambiente
- ✅ `is_catalogs` - Cache de catálogos (marcas, modelos, planes)
- ✅ `tramites` - Extendida con campos IS específicos

**Campos whitelist en tramites:**
- insurer, ramo, tipo_cobertura
- id_cotizacion, id_emision, nro_poliza
- cliente_* (nombre, apellido, documento, tipo_documento, telefono, correo)
- marca, marca_codigo, modelo, modelo_codigo, anio_auto
- suma_asegurada, prima_total
- estado, corredor (siempre "oficina")
- payment_status, card_last4, card_brand, payment_token
- pdf_url, pdf_binary_ref
- metadata (JSON)

**Funciones SQL:**
- ✅ `clean_expired_is_tokens()` - Limpieza de tokens expirados
- ✅ `get_valid_is_token(env)` - Obtener token válido
- ✅ Triggers `updated_at` en todas las tablas

**RLS Policies:**
- ✅ audit_payloads: solo admins
- ✅ is_daily_tokens: sistema
- ✅ is_catalogs: lectura autenticada, escritura admins

---

### **2. Configuración** ✅

**Archivo:** `src/lib/is/config.ts`

**Credenciales por ambiente:**
```typescript
development: {
  baseUrl: 'https://www.iseguros.com/APIRestIsTester',
  bearerToken: 'eyJhbGciOi...' // Token Dev
}
production: {
  baseUrl: 'https://www.iseguros.com/APIRestIs',
  bearerToken: 'eyJhbGciOi...' // Token Prod
}
```

**Endpoints definidos:**
- ✅ TOKEN - Obtener token diario
- ✅ MARCAS, MODELOS, TIPO_PLANES, GRUPO_TARIFA, PLANES, TIPO_DOCUMENTOS
- ✅ GENERAR_COTIZACION
- ✅ COBERTURAS_COTIZACION
- ✅ EMISION
- ⚠️ PAYMENT (placeholder - confirmar con IS)

**Configuración de reintentos:**
- Max 3 reintentos
- Backoff exponencial (2s, 4s, 8s)
- Códigos recuperables: 408, 429, 5xx

**Validaciones:**
- Email regex
- Teléfono regex
- Cédula regex
- Año (1980 - 2026)
- Suma asegurada (0 - 1,000,000)

---

### **3. Cliente HTTP Robusto** ✅

**Archivo:** `src/lib/is/http-client.ts`

**Características:**
- ✅ Retry con backoff exponencial
- ✅ Token refresh automático
- ✅ Timeout configurable (default 30s)
- ✅ Logging estructurado
- ✅ Auditoría cifrada automática
- ✅ Cache de tokens (memoria + BD)
- ✅ Manejo de 401 (token expirado)
- ✅ Manejo de 5xx y 429

**Funciones:**
```typescript
isRequest<T>(endpoint, options, env)  // Request genérico
isGet<T>(endpoint, env)                // Helper GET
isPost<T>(endpoint, body, env)         // Helper POST
```

**Cifrado:**
- Usa `crypto.createCipher` con key del .env
- `AUDIT_ENCRYPTION_KEY` (debe agregarse)

---

### **4. Servicio de Catálogos** ✅

**Archivo:** `src/lib/is/catalogs.service.ts`

**Funciones disponibles:**
```typescript
getMarcas(env)                    // Marcas de vehículos
getModelos(env)                   // Todos los modelos
getModelosByMarca(marca, env)     // Modelos por marca
getTipoDocumentos(env)            // Tipos de documento
getTipoPlanes(env)                // Tipos de planes
getGruposTarifa(tipoPlan, env)    // Grupos tarifa por tipo plan
getPlanes(env)                    // Planes de cobertura
invalidateCache()                 // Invalidar cache
preloadCatalogs(env)              // Pre-cargar todo
```

**Cache:**
- Memoria (Map) + Base de datos
- TTL: 24 horas
- Invalidación manual disponible

---

### **5. Servicio de Cotización y Emisión** ✅

**Archivo:** `src/lib/is/quotes.service.ts`

**Funciones:**
```typescript
generarCotizacionAuto(request, env)
  → { success, idCotizacion, error }
  
obtenerCoberturasCotizacion(vIdPv, vIdOpt, env)
  → { success, data: CoberturasResponse, error }
  
emitirPolizaAuto(request, env)
  → { success, nroPoliza, pdfUrl, error }
  
guardarTramite(data)
  → { success, tramiteId, error }
  
actualizarTramite(tramiteId, updates)
  → { success, error }
```

**Whitelist enforcement:**
- Solo guarda campos permitidos en `tramites`
- Request/response completos en `audit_payloads` cifrados

---

### **6. API Endpoints** ✅

#### **POST /api/is/auto/quote**
Generar cotización Auto

**Request:**
```json
{
  "vcodtipodoc": "CED",
  "vnrodoc": "8-888-8888",
  "vnombre": "Juan",
  "vapellido": "Pérez",
  "vtelefono": "66668888",
  "vcorreo": "juan@example.com",
  "vcodmarca": "01",
  "vmarca_label": "Toyota",
  "vcodmodelo": "001",
  "vmodelo_label": "Corolla",
  "vanioauto": 2020,
  "vsumaaseg": 25000,
  "vcodplancobertura": "PLAN01",
  "vcodgrupotarifa": "GT01",
  "tipo_cobertura": "Daños a terceros",
  "environment": "development"
}
```

**Response:**
```json
{
  "success": true,
  "idCotizacion": "IDCOT12345",
  "tramiteId": "uuid"
}
```

#### **GET /api/is/auto/coberturas**
Obtener coberturas de cotización

**Query params:**
- `vIdPv` (required)
- `vIdOpt` (1, 2 o 3)
- `env` (development | production)

**Response:**
```json
{
  "success": true,
  "data": {
    "coberturas": [...],
    "primaTotal": 450.50,
    "sumaAseguradaMin": 10000,
    "sumaAseguradaMax": 100000
  }
}
```

#### **POST /api/is/auto/emitir**
Emitir póliza Auto

**Request:**
```json
{
  "tramiteId": "uuid",
  "vIdPv": "IDCOT12345",
  "paymentToken": "tok_xxx",
  "card_last4": "4242",
  "card_brand": "Visa",
  ... (todos los campos de cotización)
}
```

**Response:**
```json
{
  "success": true,
  "nroPoliza": "POL-2025-001",
  "pdfUrl": "https://..."
}
```

#### **GET /api/is/catalogs**
Obtener catálogos

**Query params:**
- `type` - marcas | modelos | tipo_documentos | tipo_planes | planes | grupos_tarifa
- `marca` - (opcional, para filtrar modelos)
- `tipoPlan` - (requerido para grupos_tarifa)
- `env` - development | production

**Response:**
```json
{
  "success": true,
  "data": [...]
}
```

---

## ⏳ LO QUE FALTA IMPLEMENTAR (Frontend/UI)

### **1. Componentes de UI** ❌

#### **A. Componente de Tarjeta Animada** ❌
**Archivo:** `src/components/is/CreditCardInput.tsx` (NO CREADO)

**Requerimientos:**
- Tarjeta virtual que se completa en tiempo real
- Flip 3D al enfocar CVV
- BIN detection para mostrar marca (Visa/Master/Amex)
- Parallax sutil al mover mouse
- Validación de Luhn
- Mask de grupos (XXXX XXXX XXXX XXXX)
- No guardar PAN/CVV, solo enviar a tokenizador
- Integrar con endpoint de pago de IS

**Props esperados:**
```typescript
interface CreditCardInputProps {
  onTokenReceived: (token: string, last4: string, brand: string) => void;
  onError: (error: string) => void;
  environment: 'development' | 'production';
}
```

#### **B. Wizard de Cotización Auto** ❌
**Archivo:** `src/components/is/auto/QuoteWizard.tsx` (NO CREADO)

**Pasos:**
1. **Datos Cliente** - Tipo doc, cédula, nombre, apellido, teléfono, email
2. **Datos Vehículo** - Marca (dropdown), Modelo (dropdown filtrado), Año
3. **Cobertura** - Tipo (Daños/Completa), Sliders dinámicos (límites), Suma asegurada
4. **Resumen y Cotización** - Vista previa, botón "Cotizar"

**Características:**
- Dropdowns cargan desde `/api/is/catalogs`
- Modelos filtrados por marca seleccionada
- Sliders con min/max/step desde `getcoberturascotizacion`
- Input de suma asegurada sincronizado con slider
- Validaciones inline
- Loading states
- Error handling

#### **C. Componente de Resultados** ❌
**Archivo:** `src/components/is/auto/QuoteResults.tsx` (NO CREADO)

**Mostrar:**
- Logo Internacional con fondo azul
- Resumen del vehículo y cliente
- Grid de coberturas con límites
- Prima total desglosada (neta, IVA, total)
- Botón "Proceder al Pago"

**Funcionalidad:**
- Al hacer click en "Proceder al Pago" → abrir checkout

#### **D. Checkout/Pago Component** ❌
**Archivo:** `src/components/is/auto/Checkout.tsx` (NO CREADO)

**Contenido:**
- Resumen de compra (vehículo, prima)
- `CreditCardInput` component
- Botón "Emitir Póliza"
- Loading state durante emisión
- Manejo de errores de pago
- Integración con `/api/is/auto/emitir`

#### **E. Modal de Celebración** ❌
**Archivo:** `src/components/is/SuccessModal.tsx` (NO CREADO)

**Características:**
- Full-screen modal
- Animación de confetti (vectorial, no GIF)
- Texto "¡Felicidades! Póliza emitida"
- Número de póliza destacado
- Resumen (cliente, vehículo, prima)
- Botón "Descargar Póliza" (PDF)
- Botón "Enviar por Email"
- Botón "Cerrar"

---

### **2. Páginas Principales** ❌

#### **A. Landing de Cotizador IS Auto** ❌
**Ruta:** `/quotes/is/auto` (NO CREADA)

**Contenido:**
- Hero section con logo IS
- Selector de ambiente (Dev/Prod) - solo visible para Master
- Botón "Iniciar Cotización" → Abre wizard

#### **B. Página de Cotización Completa** ❌
**Ruta:** `/quotes/is/auto/new` (NO CREADA)

**Flujo:**
1. Wizard de cotización (`QuoteWizard`)
2. Al enviar → POST /api/is/auto/quote
3. Si success → Cargar resultados con `/api/is/auto/coberturas`
4. Mostrar `QuoteResults`
5. Botón pago → `Checkout`
6. Al emitir → `SuccessModal`

---

### **3. Integración de Pago** ⚠️ CRÍTICO

**Estado:** ⚠️ **PENDIENTE CONFIRMAR CON IS**

**Endpoint de pago no documentado en PDF**

**Opciones:**
1. **IS provee tokenizador propio:**
   - Enviar PAN/CVV/expiry a `https://www.iseguros.com/payment/tokenize`
   - Recibir `payment_token`
   - Enviar `payment_token` en emisión

2. **IS usa pasarela externa (Ej: Stripe, PaymentezX):**
   - Integrar SDK de pasarela
   - Obtener token desde pasarela
   - Enviar token a IS en emisión

3. **IS procesa directamente:**
   - Enviar datos de tarjeta en request de emisión
   - ⚠️ **NO RECOMENDADO** (PCI compliance)

**Archivo a crear:** `src/lib/is/payment.service.ts`

**Funciones requeridas:**
```typescript
async function tokenizeCard(
  cardNumber: string,
  cvv: string,
  expMonth: string,
  expYear: string,
  env: ISEnvironment
): Promise<{ token: string; last4: string; brand: string; error?: string }>

async function validatePayment(
  paymentToken: string,
  amount: number,
  env: ISEnvironment
): Promise<{ success: boolean; transactionId?: string; error?: string }>
```

**⚠️ ACCIÓN REQUERIDA:**
- Contactar a IS para obtener:
  - Endpoint de tokenización/pago
  - Formato de request
  - Manejo de 3DS si aplica
  - Credenciales de API de pago (si diferentes)

---

### **4. Esqueletos para Incendio y Contenido** ❌

#### **A. Incendio** ❌

**Archivos a crear:**
```
src/lib/is/incendio.service.ts
src/app/api/is/incendio/quote/route.ts
src/app/api/is/incendio/emitir/route.ts
src/components/is/incendio/QuoteWizard.tsx
src/components/is/incendio/QuoteResults.tsx
src/app/(app)/quotes/is/incendio/page.tsx
```

**Campos específicos:**
- Tipo de propiedad
- Dirección
- Valor de construcción
- Tipo de construcción
- Medidas de seguridad

**Catálogos a definir:**
- Tipos de propiedad
- Tipos de construcción
- Zonas de riesgo

**⚠️ Pendiente:** Endpoints de IS para Incendio

#### **B. Contenido** ❌

**Archivos a crear:**
```
src/lib/is/contenido.service.ts
src/app/api/is/contenido/quote/route.ts
src/app/api/is/contenido/emitir/route.ts
src/components/is/contenido/QuoteWizard.tsx
src/components/is/contenido/QuoteResults.tsx
src/app/(app)/quotes/is/contenido/page.tsx
```

**Campos específicos:**
- Tipo de propiedad
- Valor del contenido
- Desglose (electrónicos, muebles, joyas)
- Inventario

**⚠️ Pendiente:** Endpoints de IS para Contenido

---

## 🔐 SEGURIDAD Y PCI COMPLIANCE

### **Implementado:** ✅
- ✅ Auditoría cifrada de todos los requests/responses
- ✅ Solo campos whitelist en BD operativa
- ✅ Metadata sensible en `audit_payloads` cifrada
- ✅ RLS policies (admin-only para auditoría)

### **Pendiente:** ⚠️
- ⚠️ Agregar `AUDIT_ENCRYPTION_KEY` al `.env.local`
- ⚠️ **NO GUARDAR PAN/CVV** en ningún lado
- ⚠️ Solo guardar: `card_last4`, `card_brand`, `payment_token`
- ⚠️ Implementar tokenización de tarjeta
- ⚠️ Validar con IS el flujo de pago seguro
- ⚠️ Agregar HTTPS en producción (obligatorio)
- ⚠️ Implementar rate limiting en endpoints

---

## 🧪 TESTING

### **Tests Requeridos:** ❌ (NINGUNO CREADO)

#### **A. Tests Unitarios**
**Archivos:**
```
src/lib/is/__tests__/http-client.test.ts
src/lib/is/__tests__/catalogs.service.test.ts
src/lib/is/__tests__/quotes.service.test.ts
```

**Casos:**
- Mock de fetch
- Retry con backoff
- Token refresh automático
- Cache de catálogos
- Whitelist enforcement

#### **B. Tests de Integración**
**Archivos:**
```
src/app/api/is/__tests__/auto-quote.test.ts
src/app/api/is/__tests__/emitir.test.ts
```

**Casos:**
- Request válido → success
- Request inválido → 400
- IS no disponible → 500
- Token expirado → refresh y retry

#### **C. Tests E2E** (Opcional)
**Framework:** Playwright

**Casos:**
- Flujo completo: cotización → pago → emisión
- Validaciones de formularios
- Animaciones de tarjeta
- Modal de celebración

---

## 📋 CHECKLIST DE DEPLOYMENT

### **Antes de Producción:**

**Backend:**
- [ ] Ejecutar migration SQL en Supabase Prod
- [ ] Verificar RLS policies aplicadas
- [ ] Agregar `AUDIT_ENCRYPTION_KEY` al .env
- [ ] Poblar catálogos iniciales (pre-carga)
- [ ] Configurar token refresh cron job
- [ ] Configurar limpieza de tokens expirados (cron)

**Frontend:**
- [ ] Crear todos los componentes listados arriba
- [ ] Implementar pago seguro
- [ ] Validar flujo completo en Dev
- [ ] Testing E2E en Dev
- [ ] Agregar loader y error states
- [ ] Responsive mobile verificado
- [ ] Animaciones optimizadas

**Seguridad:**
- [ ] Confirmar flujo de pago con IS
- [ ] Validar que no se guarda PAN/CVV
- [ ] Auditar todos los endpoints
- [ ] Verificar HTTPS en prod
- [ ] Rate limiting implementado
- [ ] Logs monitoreados

**IS Coordination:**
- [ ] Confirmar endpoint de pago
- [ ] Confirmar endpoint de emisión
- [ ] Obtener credenciales Prod
- [ ] Confirmar lista de campos obligatorios
- [ ] Validar respuestas de error
- [ ] Confirmar SLA

---

## 📚 DOCUMENTACIÓN PENDIENTE

### **A. Documento Técnico** ❌
**Archivo:** `docs/IS_INTEGRATION_TECHNICAL.md`

**Contenido:**
- Arquitectura completa
- Diagramas de flujo
- Mapeo de campos
- Ejemplos de requests/responses
- Códigos de error y mensajes

### **B. Guía de Desarrollo** ❌
**Archivo:** `docs/IS_DEV_GUIDE.md`

**Contenido:**
- Setup local
- Variables de entorno
- Cómo agregar un nuevo ramo
- Cómo testear localmente
- Troubleshooting

### **C. Runbook de Producción** ❌
**Archivo:** `docs/IS_PROD_RUNBOOK.md`

**Contenido:**
- Monitoreo
- Alertas
- Procedimiento de rollback
- Manejo de incidentes
- Contactos de IS

---

## 🎯 PRIORIDADES INMEDIATAS

### **CRÍTICO (Hacer ya):**
1. ✅ Backend y APIs (COMPLETADO)
2. ⚠️ **Contactar a IS para confirmar endpoint de pago**
3. ❌ Implementar `CreditCardInput` con tokenización
4. ❌ Implementar `QuoteWizard` (Auto)
5. ❌ Crear páginas `/quotes/is/auto/*`
6. ❌ Testing en Dev

### **IMPORTANTE (Siguiente):**
7. ❌ Modal de celebración
8. ❌ Checkout component
9. ❌ Tests unitarios
10. ❌ Documentación técnica

### **PUEDE ESPERAR:**
11. ❌ Esqueletos Incendio
12. ❌ Esqueletos Contenido
13. ❌ Tests E2E
14. ❌ Runbook producción

---

## 📞 CONTACTO CON IS

### **Preguntas Pendientes:**

1. **Pago:**
   - ¿Cuál es el endpoint de tokenización/pago?
   - ¿Formato del request?
   - ¿Soportan 3DS?
   - ¿Credenciales de API de pago?

2. **Emisión:**
   - ¿El endpoint `/api/cotizaemisorauto/getemision` es el correcto?
   - ¿Qué devuelve en `nro_poliza` y `poliza_pdf_url`?
   - ¿Hay casos donde no devuelve PDF inmediatamente?

3. **Campos:**
   - ¿Hay campos obligatorios no listados en el PDF?
   - ¿Necesitan datos de coasegurados?
   - ¿Necesitan datos del propietario si no es el asegurado?

4. **Errores:**
   - ¿Lista de códigos de error específicos?
   - ¿Mensajes human-friendly disponibles?

5. **SLA:**
   - ¿Tiempo de respuesta esperado?
   - ¿Horarios de soporte?
   - ¿Procedimiento de escalación?

---

## 🎉 RESUMEN

### **✅ COMPLETADO (Backend 80%):**
- Base de datos con tablas, RLS y funciones
- Configuración de ambientes y credenciales
- Cliente HTTP robusto con retry y logging
- Servicio de catálogos con cache
- Servicio de cotización y emisión
- API endpoints para cotización, coberturas, emisión y catálogos
- Auditoría cifrada automática
- Whitelist enforcement

### **⏳ EN PROGRESO (0%):**
- Frontend/UI components
- Integración de pago
- Testing
- Documentación

### **⚠️ BLOQUEADO:**
- Integración de pago (esperando info de IS)
- Esqueletos Incendio/Contenido (esperando endpoints de IS)

### **🚀 PARA CONTINUAR:**
1. Contactar a IS para resolver preguntas de pago
2. Crear componentes de UI listados arriba
3. Implementar flujo de pago seguro
4. Testing en desarrollo
5. Deploy a producción

---

**Tiempo estimado restante:** 20-30 horas de desarrollo  
**Desarrollador asignado:** Windsurf/Claude  
**Fecha objetivo:** TBD

---

**¿Listo para continuar con el frontend? Confirma con IS primero el tema de pago. 🚀**
