# ✅ INTEGRACIÓN IS - ADAPTADA AL SISTEMA EXISTENTE

**Fecha:** 30 de octubre de 2025  
**Estado:** Backend 80% Completo | Adaptado a tabla `cases` existente  
**Metodología:** Revisión → Adaptación → Optimización

---

## 🎯 CAMBIO CRÍTICO REALIZADO

### **ANTES (Incorrecto):**
- ❌ Intentaba crear tabla `tramites` nueva
- ❌ No revisó `database.types.ts`
- ❌ No verificó tablas existentes
- ❌ Duplicaba estructura

### **AHORA (Correcto):**
- ✅ Usa tabla `cases` existente del sistema
- ✅ Revisó estructura actual
- ✅ Adaptó al flujo de casos
- ✅ Agrega solo campos IS específicos

---

## 📋 ESTRUCTURA ADAPTADA

### **Tabla `cases` (Existente) + Campos IS**

**Campos estándar de cases (ya existen):**
```sql
- id, section, ctype, canal, management_type
- insurer_id, broker_id
- client_name, policy_number, policy_type
- premium, payment_method
- sla_days, sla_date, status
- is_verified, seen_by_broker
- notes, created_at, updated_at
```

**Campos IS específicos (agregados):**
```sql
-- Identificadores IS
is_id_cotizacion TEXT           -- ID de cotización (IDCOT)
is_id_emision TEXT              -- ID de emisión

-- Pago
is_payment_status TEXT          -- pending, paid, failed, refunded
is_card_last4 TEXT              -- Últimos 4 dígitos
is_card_brand TEXT              -- Visa/Master/Amex
is_payment_token TEXT           -- Token de pago (NO PAN/CVV)

-- PDF
is_pdf_url TEXT                 -- URL del PDF de póliza

-- Vehículo (Auto)
is_suma_asegurada DECIMAL(12,2) -- Suma asegurada
is_marca_codigo TEXT            -- Código marca
is_modelo_codigo TEXT           -- Código modelo
is_anio_auto INTEGER            -- Año del auto
```

**Mapeo de datos IS → cases:**
```typescript
{
  // Campos estándar
  section: 'EMISION',
  ctype: 'AUTO',
  canal: 'PORTAL_IS',
  management_type: 'EMISION',
  insurer_id: '[UUID de Internacional]',
  broker_id: '[UUID de oficina]',
  client_name: `${cliente_nombre} ${cliente_apellido}`,
  policy_number: nro_poliza,
  policy_type: tipo_cobertura,
  premium: prima_total,
  payment_method: 'TARJETA',
  sla_days: 7,
  sla_date: '[7 días desde hoy]',
  status: 'COTIZADO' | 'EMITIDO',
  is_verified: true,
  seen_by_broker: false,
  notes: '[Resumen cliente + vehículo]',
  
  // Campos IS
  is_id_cotizacion: vIdPv,
  is_payment_status: 'paid',
  is_card_last4: '4242',
  is_card_brand: 'Visa',
  is_payment_token: 'tok_xxx',
  is_pdf_url: 'https://...',
  is_suma_asegurada: 25000,
  is_marca_codigo: '01',
  is_modelo_codigo: '001',
  is_anio_auto: 2020,
}
```

---

## 🔧 SERVICIOS ACTUALIZADOS

### **`src/lib/is/quotes.service.ts`**

#### **Función: `guardarCasoIS()`** (antes `guardarTramite()`)
```typescript
export async function guardarCasoIS(data: {
  insurer_id: string;        // UUID de Internacional
  broker_id: string;          // UUID de oficina
  tipo_cobertura: string;
  id_cotizacion?: string;
  // ... resto de campos
}): Promise<{ success: boolean; caseId?: string; error?: string }>
```

**Cambios:**
- ✅ Usa `supabase.from('cases').insert()`
- ✅ Mapea datos IS a estructura de cases
- ✅ Calcula SLA automáticamente (7 días)
- ✅ Guarda resumen en `notes`
- ✅ Retorna `caseId` en lugar de `tramiteId`

#### **Función: `actualizarCasoIS()`** (antes `actualizarTramite()`)
```typescript
export async function actualizarCasoIS(
  caseId: string,
  updates: Partial<{
    is_id_emision: string;
    policy_number: string;
    status: string;
    is_payment_status: string;
    // ...
  }>
): Promise<{ success: boolean; error?: string }>
```

**Cambios:**
- ✅ Usa `supabase.from('cases').update()`
- ✅ Actualiza campos IS con prefijo `is_`
- ✅ Actualiza campos estándar de cases

---

## 🔌 API ENDPOINTS ACTUALIZADOS

### **POST /api/is/auto/quote**

**Cambios:**
```typescript
// ANTES
await guardarTramite({
  insurer: 'INTERNACIONAL',  // ❌ String
  corredor: 'oficina',       // ❌ String
})

// AHORA
// Obtener IDs de BD
const { data: insurer } = await supabase
  .from('insurers')
  .select('id')
  .ilike('name', '%internacional%')
  .single();

const { data: oficinaBroker } = await supabase
  .from('brokers')
  .select('p_id')
  .eq('slug', 'oficina')
  .single();

await guardarCasoIS({
  insurer_id: insurer.id,    // ✅ UUID
  broker_id: oficinaBroker.p_id,  // ✅ UUID
})
```

**Response:**
```json
{
  "success": true,
  "idCotizacion": "IDCOT12345",
  "caseId": "uuid-del-caso"  // ✅ Era tramiteId
}
```

### **POST /api/is/auto/emitir**

**Cambios:**
```typescript
// ANTES
const { tramiteId } = body;
await actualizarTramite(tramiteId, {
  nro_poliza: result.nroPoliza,
  estado: 'EMITIDO',
  payment_status: 'paid',
})

// AHORA
const { caseId } = body;  // ✅ Cambiado nombre
await actualizarCasoIS(caseId, {
  policy_number: result.nroPoliza,  // ✅ Nombre estándar cases
  status: 'EMITIDO',                // ✅ Nombre estándar cases
  is_payment_status: 'paid',        // ✅ Prefijo is_
})
```

---

## 🗄️ MIGRATION SQL ACTUALIZADA

**Archivo:** `supabase/migrations/20251030_internacional_seguros_integration.sql`

**Cambios:**
```sql
-- ANTES (Incorrecto)
CREATE TABLE tramites (...)  -- ❌ Crear tabla nueva

-- AHORA (Correcto)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS is_id_cotizacion TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS is_id_emision TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS is_payment_status TEXT;
-- ... resto de columnas con prefijo is_
```

**Ventajas:**
- ✅ No crea tabla duplicada
- ✅ Se integra con sistema existente
- ✅ Aprovecha RLS de cases
- ✅ Compatible con flujo de casos actual

---

## 📊 FLUJO INTEGRADO

### **Crear Cotización:**
```
Usuario → POST /api/is/auto/quote
  ↓
Genera cotización en IS
  ↓
Busca insurer_id de "Internacional"
  ↓
Busca broker_id de "oficina"
  ↓
Crea caso en tabla cases:
  - section: EMISION
  - ctype: AUTO
  - canal: PORTAL_IS
  - broker_id: UUID oficina
  - insurer_id: UUID Internacional
  - is_id_cotizacion: IDCOT
  ↓
Retorna { idCotizacion, caseId }
```

### **Emitir Póliza:**
```
Usuario → POST /api/is/auto/emitir
  ↓
Emite póliza en IS
  ↓
Actualiza caso existente:
  - status: EMITIDO
  - policy_number: POL-xxx
  - is_payment_status: paid
  - is_pdf_url: https://...
  ↓
Retorna { nroPoliza, pdfUrl }
```

### **Ver en Portal:**
```
Master/Broker → /cases
  ↓
Filtrar por:
  - section: EMISION
  - ctype: AUTO
  - canal: PORTAL_IS
  - insurer_id: Internacional
  ↓
Ver casos IS con:
  - Cliente
  - Vehículo (en notes)
  - Estado
  - Póliza emitida
  - PDF (is_pdf_url)
```

---

## ✅ VENTAJAS DE ESTA ADAPTACIÓN

### **1. Reutilización**
- ✅ Usa sistema de casos existente
- ✅ Hereda RLS policies
- ✅ Compatible con historial
- ✅ Compatible con archivos adjuntos
- ✅ Compatible con checklist

### **2. Consistencia**
- ✅ Misma UI para todos los casos
- ✅ Mismo flujo broker/master
- ✅ Misma estructura de permisos
- ✅ Mismo sistema de notificaciones

### **3. Mantenimiento**
- ✅ No duplica código
- ✅ No duplica tablas
- ✅ Más fácil de mantener
- ✅ Menos bugs potenciales

### **4. Escalabilidad**
- ✅ Fácil agregar otras aseguradoras
- ✅ Fácil agregar otros ramos
- ✅ Fácil filtrar por canal
- ✅ Fácil reportear

---

## 🔍 BÚSQUEDA Y FILTRADO

### **Casos IS en el sistema:**
```typescript
// Filtrar casos de IS
const { data } = await supabase
  .from('cases')
  .select('*')
  .eq('canal', 'PORTAL_IS')
  .eq('insurer_id', internacionalId);

// Filtrar cotizaciones pendientes
.eq('status', 'COTIZADO')

// Filtrar pólizas emitidas
.eq('status', 'EMITIDO')
.not('policy_number', 'is', null)

// Filtrar por tipo de seguro
.eq('ctype', 'AUTO')  // o INCENDIO, CONTENIDO

// Filtrar por ID de cotización IS
.eq('is_id_cotizacion', 'IDCOT12345')
```

---

## 🎯 PRÓXIMOS PASOS

### **Pendiente (Frontend):**
1. ❌ Componente `CreditCardInput` con tokenización
2. ❌ Componente `QuoteWizard` (4 pasos)
3. ❌ Páginas `/quotes/is/auto/*`
4. ❌ Modal de celebración

### **Bloqueador:**
- 🚨 **Confirmar endpoint de pago con IS**

### **Después:**
- ❌ Esqueletos Incendio/Contenido
- ❌ Testing E2E
- ❌ Deploy producción

---

## 📝 LECCIONES APRENDIDAS

### **Metodología correcta aplicada:**

1. ✅ **Revisar database.types.ts PRIMERO**
   - Encontró que `tramites` no existe
   - Encontró que `cases` sí existe

2. ✅ **Buscar código similar**
   - Encontró flujo de creación de casos
   - Encontró estructura de casos
   - Encontró campos disponibles

3. ✅ **Adaptar solución**
   - Usó `cases` en lugar de `tramites`
   - Agregó solo campos IS necesarios
   - Mapeó datos IS a estructura cases

4. ✅ **Optimizar flujo**
   - Reutilizó sistema existente
   - Aprovechó RLS y permisos
   - Mantuvo consistencia

---

## 📚 DOCUMENTACIÓN

**Resúmenes:**
- `IS_INTEGRACION_ESTADO_ACTUAL.md` - Estado general
- `INTEGRACION_IS_RESUMEN.md` - Resumen ejecutivo
- `INTEGRACION_IS_IMPLEMENTACION.md` - Documentación completa
- `IS_INTEGRACION_ADAPTADA_SISTEMA.md` - Este documento (adaptación)

---

## 🎉 CONCLUSIÓN

**Integración IS exitosamente adaptada al sistema existente:**

✅ Usa tabla `cases` (no crea `tramites`)  
✅ Compatible con flujo actual de casos  
✅ Aprovecha RLS y permisos existentes  
✅ Integrado con UI actual  
✅ Menos código duplicado  
✅ Más fácil de mantener  
✅ Backend 80% completo  

**Metodología correcta aplicada:**
1. Revisar → 2. Adaptar → 3. Optimizar

**Siguiente paso:**
- Contactar IS para endpoint de pago
- Continuar con frontend

---

**¡Integración adaptada correctamente al sistema! 🚀**
