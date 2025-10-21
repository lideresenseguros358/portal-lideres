# 📑 MÓDULO DE CASOS/PENDIENTES - ÍNDICE MAESTRO

## 🎯 Resumen Ejecutivo

Este módulo gestiona el **ciclo completo de trámites de seguros**, desde la ingesta automática por correo electrónico hasta la emisión y creación de registros preliminares en la base de datos.

**Características principales:**
- ✅ Ingesta automática por Zoho Mail webhook
- ✅ Clasificación determinista (sin IA)
- ✅ Flujo especial para ASSA (tickets)
- ✅ Checklist dinámico por tipo de póliza
- ✅ SLA con semáforo y auto-limpieza
- ✅ Generación de PDF y envío por correo
- ✅ Gestión de pagos y descuentos a corredores
- ✅ Creación de preliminares en BD al emitir
- ✅ Mobile-first, RLS completo

---

## 📚 Estructura de la Documentación

### [01_REQUISITOS_DOCUMENTOS.md](./01_REQUISITOS_DOCUMENTOS.md)
**Contenido completo de documentos requeridos por tipo de trámite.**

#### Secciones:
- Leyenda de asteriscos (`*` = cotizar, `**` = emitir)
- **Ramo de Personas:**
  - Vida ASSA
  - Vida Web
  - Salud
  - Accidentes Personales
  - Colectivos
- **Ramos Generales:**
  - Auto (Daños a Terceros, Cobertura Completa)
  - Incendio, Multipóliza
  - RC, Equipo Electrónico, Equipo Pesado
  - Robo, Mercancía, Casco Marítimo/Aéreo
  - Comercial, Taxi, Moto
- **Diferentes Trámites:**
  - Rehabilitación
  - Modificación
  - Cancelación
  - Cambio de Corredor
  - Reclamos
- **Reglas de Prima Inicial y Forma de Pago**
- **Estados de Casos**
- **Categoría OTROS** (documentos adicionales)

**Uso:** Referencia para construir checklist dinámico.

---

### [02_FLUJO_MODULO_CASOS.md](./02_FLUJO_MODULO_CASOS.md)
**Flujo completo del módulo, páginas y componentes.**

#### Secciones:
- **Reglas Globales:**
  - Roles y permisos (MASTER vs BROKER)
  - Flujo ASSA (sin ticket → con ticket)
  - Emisión → Preliminar BD
  - PDF y Storage
  - Clasificación determinista
- **Páginas:**
  - `/cases` - Lista de casos (tabs, listado, kanban)
  - `/cases/new` - Wizard creación manual (5 pasos)
  - `/cases/[id]` - Detalle del caso (6 paneles)
- **Estados del Sistema**
- **Semáforo SLA**
- **Aplazado y Papelera**

**Uso:** Guía de desarrollo de UI/UX y navegación.

---

### [03_INGESTA_CORREO_Y_APIS.md](./03_INGESTA_CORREO_Y_APIS.md)
**Webhook de Zoho Mail y endpoints API.**

#### Secciones:
- **Webhook `/api/zoho/webhook`:**
  - Estructura JSON de entrada
  - Flujo de procesamiento (9 pasos)
  - Idempotencia
  - Normalización de texto
  - Verificación de remitente
  - Clasificación determinista (keywords)
  - Detección de ticket ASSA
  - Agrupación 48h
  - Manejo de adjuntos
  - Auto-respuesta
  - Notificaciones
- **APIs del Módulo:**
  - Cases CRUD
  - Estados
  - Checklist
  - Adjuntos
  - Comentarios
  - Reclasificar / Fusionar
  - Pagos/Comisiones
  - Preliminar BD

**Uso:** Guía de desarrollo backend y integraciones.

---

### [04_SLA_NOTIFICACIONES_PDF.md](./04_SLA_NOTIFICACIONES_PDF.md)
**Sistema de SLA, notificaciones y generación de PDF.**

#### Secciones:
- **SLA:**
  - Configuración por defecto
  - Semáforo (🟢 En tiempo, 🟡 Por vencer, 🔴 Vencido)
  - Auto-limpieza a Papelera
  - Estado APLAZADO
- **Notificaciones:**
  - Eventos que disparan notificación (tabla completa)
  - Campanita (in-app)
  - Correo diario 7:00 AM (resumen personalizado)
  - Templates de email
- **Generación de PDF:**
  - PDF individual (detalle del caso)
  - PDF consolidado (selección múltiple)
  - Generador con branding
  - Envío por correo

**Uso:** Implementación de alertas, reportes y comunicaciones.

---

### [05_ESPECIFICACIONES_TECNICAS_Y_QA.md](./05_ESPECIFICACIONES_TECNICAS_Y_QA.md)
**Estructura de base de datos, RLS y criterios de QA.**

#### Secciones:
- **Tablas:**
  - `cases` (principal)
  - `case_checklist`
  - `case_files`
  - `case_comments`
  - `case_history`
  - `broker_assistants` (nueva)
- **Row Level Security (RLS):**
  - Políticas para brokers y masters
  - Políticas para archivos y comentarios
- **Componentes UI:**
  - `CasesList`
  - `CaseCard`
  - Ejemplos de código React
- **Criterios de Aceptación (QA):**
  - Wizard de creación
  - Cambio a EMITIDO
  - Ingesta por correo
  - Estados y selección múltiple
  - SLA y semáforo
  - Notificaciones
  - Permisos y seguridad
  - Mobile y UX
  - Búsqueda y filtros
- **Notas de Implementación**
- **Resumen ASSA (crítico)**

**Uso:** Guía de desarrollo técnico, testing y QA.

---

## 🔑 Conceptos Clave

### 1. Clasificación Determinista (NO IA)

**NO usar inteligencia artificial.**

Usar arrays de keywords para detectar:
- Aseguradora (ASSA, MAPFRE, FEDPA, etc.)
- Gestión (COTIZACION, EMISION, REHABILITACION, etc.)
- Tipo de póliza (VIDA, AUTO, SALUD, etc.)

```typescript
const ASEGURADORAS_KEYWORDS = {
  'ASSA': ['assa', 'assa compañía'],
  'MAPFRE': ['mapfre'],
  // ...
};
```

---

### 2. Flujo ASSA Especial

**Todos los correos a ASSA:**

1. **Sin ticket inicial** → Crea caso en "Vida ASSA"
2. **ASSA responde con ticket** → Asocia al caso existente
3. **Sugiere estado** basado en contenido
4. **Humano SIEMPRE confirma** el cambio

⚠️ **CRÍTICO:** Nunca cambiar estado automáticamente. Solo sugerir.

---

### 3. Emisión → Preliminar BD

**Al cambiar a estado EMITIDO:**

1. Validar `policy_number` existe
2. Si NO existe en BD **Y** NO es VIDA ASSA WEB:
   - Mostrar popup a Master
   - "¿Crear preliminar en BD?"
3. Si SÍ:
   - Crear en `clients` (is_preliminary = true)
   - Crear en `policies` (is_preliminary = true)
   - Notificar broker para completar

**Exclusión:** VIDA ASSA WEB no pregunta, cambio directo.

---

### 4. Checklist Dinámico

**Se autogenera según:**
- Tipo de póliza
- Tipo de gestión
- Aseguradora
- Ámbito (Personas/Generales)

**Basado en:** `docs/casos/01_REQUISITOS_DOCUMENTOS.md`

**Funcionalidades:**
- Reordenable (drag & drop)
- Agregar ítems ad-hoc
- Marcar cumplido sin archivo (Master)
- Upload → ¿Es recurrente? → Guardar en Descargas

---

### 5. Categoría OTROS

**Todos los trámites** deben permitir agregar documentos en categoría "OTROS":
- Nombre personalizado
- Obligatorio/Opcional
- Aunque no se haya recibido aún (tracking)

⚠️ **NO detener** creación de caso por falta de documentos obligatorios.

---

### 6. SLA y Semáforo

| Estado | Condición | Color | Acción |
|--------|-----------|-------|--------|
| 🟢 En tiempo | > 5 días | Verde | Ninguna |
| 🟡 Por vencer | 0-5 días | Amarillo | Notificación diaria |
| 🔴 Vencido | < 0 días | Rojo | Notificación urgente |
| 🗑️ Auto-limpieza | Vencido + 7d sin update | - | A Papelera |

**Papelera:** 30 días visibles, luego purga.

---

### 7. Roles y Permisos (RLS)

| Acción | MASTER | BROKER |
|--------|--------|--------|
| Ver todos los casos | ✅ | ❌ (solo suyos) |
| Ver No identificados | ✅ | ❌ |
| Crear caso manual | ✅ | ❌ |
| Cambiar estado | ✅ | ❌ |
| Editar SLA | ✅ | ❌ |
| Descontar a corredor | ✅ | ❌ |
| Reclasificar | ✅ | ❌ |
| Fusionar | ✅ | ❌ |
| Aplazar/Cerrar/Eliminar | ✅ | ❌ |
| Marcar cumplido sin archivo | ✅ | ❌ |
| Eliminar archivos | ✅ | ❌ |
| Adjuntar archivos | ✅ | ✅ (sus casos) |
| Comentar | ✅ | ✅ (sus casos) |
| Marcar checklist | ✅ | ✅ (sus casos) |
| Marcar "mío" | ✅ | ✅ |

---

## 🛠️ Stack Tecnológico

### Frontend
- Next.js 15 (App Router)
- React Server Components
- TypeScript
- TailwindCSS
- Componentes móvil-first

### Backend
- Next.js API Routes
- Supabase (PostgreSQL + Storage)
- RLS (Row Level Security)
- Webhooks (Zoho Mail)

### Integraciones
- Zoho Mail → Webhook
- Supabase Storage → Adjuntos
- Mailer → Notificaciones

### Generación PDF
- jsPDF + jspdf-autotable
- Branding: Arial, #010139, #8AAA19

---

## 📦 Entregables

### Migraciones SQL
- [ ] Tabla `cases`
- [ ] Tabla `case_checklist`
- [ ] Tabla `case_files`
- [ ] Tabla `case_comments`
- [ ] Tabla `case_history`
- [ ] Tabla `broker_assistants`
- [ ] Políticas RLS
- [ ] Índices y triggers

### Páginas
- [ ] `/cases` - Lista con tabs y filtros
- [ ] `/cases/new` - Wizard 5 pasos
- [ ] `/cases/[id]` - Detalle con 6 paneles

### Componentes
- [ ] CasesList (lista/kanban toggle)
- [ ] CaseCard (móvil-first)
- [ ] CaseFilters
- [ ] CaseKanban
- [ ] CaseDetail (tabs)
- [ ] ChecklistManager
- [ ] FileUpload
- [ ] CommentSection
- [ ] HistoryTimeline

### APIs
- [ ] POST /api/zoho/webhook
- [ ] POST /api/cases
- [ ] PUT /api/cases/:id
- [ ] DELETE /api/cases/:id
- [ ] POST /api/cases/:id/status
- [ ] POST /api/cases/:id/checklist
- [ ] PUT /api/cases/:id/checklist/:item
- [ ] POST /api/cases/:id/files
- [ ] DELETE /api/cases/:id/files/:file
- [ ] POST /api/cases/:id/comments
- [ ] POST /api/cases/:id/reclassify
- [ ] POST /api/cases/merge
- [ ] POST /api/cases/:id/discount
- [ ] POST /api/cases/:id/direct-payment
- [ ] POST /api/cases/:id/create-db-preliminar

### Utilidades
- [ ] Generador de PDF individual
- [ ] Generador de PDF consolidado
- [ ] Clasificador determinista (keywords)
- [ ] Detector de ticket ASSA
- [ ] Calculador de SLA
- [ ] Sistema de notificaciones
- [ ] Mailer con templates
- [ ] Cron jobs (auto-limpieza, correo diario)

---

## ✅ Checklist de QA

Ver **05_ESPECIFICACIONES_TECNICAS_Y_QA.md** sección "Criterios de Aceptación" para lista completa.

**Mínimos críticos:**
- [ ] Wizard crea caso con checklist correcto
- [ ] Webhook es idempotente
- [ ] ASSA sin ticket → con ticket funciona
- [ ] Preliminar BD se crea al emitir (no VIDA ASSA WEB)
- [ ] RLS funciona (broker solo ve sus casos)
- [ ] SLA semáforo correcto
- [ ] Notificaciones se envían
- [ ] PDF se genera con branding
- [ ] Mobile funciona perfectamente

---

## 🚀 Próximos Pasos

1. **Revisar y aprobar** esta documentación completa
2. **Crear migraciones SQL** en `supabase/migrations/`
3. **Implementar APIs** core (webhook, CRUD)
4. **Desarrollar páginas** en orden: lista → detalle → wizard
5. **Configurar Zoho webhook** en producción
6. **Testing** según criterios de QA
7. **Deploy** a staging
8. **Capacitación** a usuarios Master y Broker

---

## 📞 Soporte y Contacto

Para preguntas sobre esta especificación:
- Revisar primero el archivo correspondiente
- Validar contra requisitos originales
- Consultar con equipo de desarrollo

---

**Fecha de creación:** 2025-10-17  
**Versión:** 1.0 - Documentación completa  
**Archivos:** 6 (índice + 5 especificaciones)  
**Estado:** Listo para implementación
