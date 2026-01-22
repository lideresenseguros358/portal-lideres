# 📧 Sistema de Ingestión Automática de Correos + IA + Módulo Pendientes

## 🎯 Resumen Ejecutivo

Sistema completo de ingestión automática de correos desde Zoho Mail vía IMAP, clasificación con Google Vertex AI (Gemini), y módulo Pendientes con UX tipo Monday.

**Características implementadas:**
- ✅ Ingestión automática cada 3 minutos desde Zoho IMAP
- ✅ Clasificación AI con Gemini (ramo, aseguradora, trámite)
- ✅ Generación de tickets posicionales 12 dígitos (AAMM+RAMO+ASEG+TRAMITE+CORREL)
- ✅ Sistema de estados simplificados con SLA pausable
- ✅ Historial de eventos + Audit logs inmutables
- ✅ Routing de masters con soporte de vacaciones
- ✅ Cron de aplazados diario
- ✅ Deduplicación por Message-ID
- ✅ Agrupación de correos en casos existentes (24h)

---

## 📦 Dependencias NPM a Instalar

```bash
npm install imapflow mailparser google-auth-library
```

**Detalles:**
- `imapflow`: Cliente IMAP stream-based para Node.js
- `mailparser`: Parser de emails (headers, body, attachments)
- `google-auth-library`: Autenticación con Google Service Account

---

## 🔐 Variables de Entorno Requeridas

Agregar en **Vercel > Project Settings > Environment Variables**:

### IMAP - Zoho Mail
```env
ZOHO_IMAP_HOST=imap.zoho.com
ZOHO_IMAP_PORT=993
ZOHO_IMAP_USER=tu-email@zoho.com
ZOHO_IMAP_PASS=app-password-aqui  # App Password, NO password normal
IMAP_DEFAULT_FOLDER=INBOX
IMAP_POLL_WINDOW_MINUTES=60
IMAP_MAX_MESSAGES_PER_RUN=20
IMAP_ATTACHMENTS_MAX_MB=18
```

### Google Cloud - Vertex AI
```env
GOOGLE_CLOUD_PROJECT_ID=thinking-device-471822-e6
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account","project_id":"..."}
VERTEX_MODEL_EMAIL=gemini-1.5-flash
VERTEX_MODEL_DOCS=gemini-1.5-pro
VERTEX_CONFIDENCE_THRESHOLD=0.72
```

**IMPORTANTE:** 
- `GOOGLE_APPLICATION_CREDENTIALS_JSON` debe ser el JSON completo del Service Account como **string**
- NO usar archivo .json en disco (no funciona en serverless)

### Feature Flags
```env
FEATURE_ENABLE_IMAP=true
FEATURE_ENABLE_VERTEX=true
```

### Cron Security
```env
CRON_SECRET=tu-secret-aqui  # Genera con: openssl rand -base64 32
```

### General
```env
APP_TIMEZONE=America/Panama
PENDIENTES_UNCLASSIFIED_AGE_HOURS=24
```

---

## 🗄️ Migraciones de Base de Datos

Ejecutar en orden (Supabase Dashboard > SQL Editor):

1. **20260121000001_create_inbound_emails.sql**
   - Tabla `inbound_emails` (correos entrantes)
   - Tabla `inbound_email_attachments`
   - RLS policies

2. **20260121000002_create_case_emails.sql**
   - Tabla `case_emails` (vinculación correos-casos)
   - Tabla `case_history_events` (historial visible)
   - Tabla `security_audit_logs` (auditoría inmutable)
   - RLS policies

3. **20260121000003_create_ticket_counters.sql**
   - Tabla `ticket_counters` (numeración posicional)
   - Función `generate_next_ticket()`
   - Tabla `master_routing_config` (vacaciones)
   - Datos iniciales de routing

4. **20260121000004_update_cases_for_ai_system.sql**
   - Agrega columnas a tabla `cases` existente
   - `ticket`, `ramo_code`, `aseguradora_code`, `tramite_code`
   - `estado_simple`, `sla_paused_at`, `ai_classification`
   - Funciones `pause_case_sla()`, `resume_case_sla()`

---

## 🚀 Despliegue

### 1. Instalar Dependencias
```bash
npm install imapflow mailparser google-auth-library
```

### 2. Configurar Variables de Entorno en Vercel
- Ir a Vercel Dashboard > tu-proyecto > Settings > Environment Variables
- Agregar todas las variables listadas arriba
- **IMPORTANTE:** Marcar como "Production", "Preview", y "Development" según necesites

### 3. Ejecutar Migraciones
- Ir a Supabase Dashboard > SQL Editor
- Ejecutar cada migración en orden

### 4. Desplegar a Vercel
```bash
git add .
git commit -m "feat: Sistema de ingestión automática IMAP + Vertex AI"
git push origin main
```

### 5. Verificar Cron Jobs
En Vercel Dashboard > tu-proyecto > Deployments > [última versión] > Cron Jobs:
- ✅ `/api/cron/imap-ingest` - cada 3 minutos
- ✅ `/api/cron/aplazados-check` - diario a las 14:00 UTC (09:00 Panama)

---

## 🧪 Testing

### Test Manual del Endpoint IMAP
```bash
curl -X GET https://tu-dominio.vercel.app/api/cron/imap-ingest \
  -H "Authorization: Bearer TU_CRON_SECRET"
```

**Respuesta esperada:**
```json
{
  "success": true,
  "timestamp": "2026-01-21T...",
  "stats": {
    "messagesProcessed": 5,
    "casesCreated": 3,
    "casesLinked": 2,
    "errors": 0
  }
}
```

### Verificar Datos en Supabase
```sql
-- Ver correos ingresados
SELECT id, message_id, from_email, subject, processed_status, created_at
FROM inbound_emails
ORDER BY created_at DESC
LIMIT 10;

-- Ver casos creados
SELECT id, ticket, estado_simple, ramo_bucket, ai_confidence, created_at
FROM cases
ORDER BY created_at DESC
LIMIT 10;

-- Ver emails vinculados
SELECT ce.*, ie.subject, c.ticket
FROM case_emails ce
JOIN inbound_emails ie ON ie.id = ce.inbound_email_id
JOIN cases c ON c.id = ce.case_id
ORDER BY ce.linked_at DESC
LIMIT 10;
```

---

## 📊 Estructura de Tickets Posicionales

### Formato: `[AAMM][RAMO(2)][ASEG(2)][TRAMITE(1-2)][CORREL(3)]`

**Ejemplo:** `2601010503001`
- `26` = Año 2026
- `01` = Enero
- `01` = Ramo Vida
- `05` = Aseguradora Acerta
- `03` = Trámite Inclusión
- `001` = Correlativo (primer ticket de esta combinación en el mes)

### Catálogo de Códigos

**RAMOS (2 dígitos):**
- 01 = Vida
- 02 = Salud
- 03 = Auto
- 04 = Hogar
- 05 = Empresarial
- 06 = Accidentes Personales
- 07 = Colectivos
- 99 = Otro/Desconocido

**ASEGURADORAS (2 dígitos):**
- 01 = ASSA (Vida ASSA)
- 02 = ASSA (otros ramos)
- 03 = Mapfre
- 04 = Fedpa
- 05 = Acerta
- 06 = Vivir
- 07 = Universal
- 08 = Aseguradora del Istmo
- 09 = Pan American Life (PALIC)
- 10 = Internacional de Seguros
- 99 = Otra/Desconocida

**TRÁMITES (1-2 dígitos):**
- 1 = Emisión
- 2 = Renovación
- 3 = Inclusión
- 4 = Exclusión
- 5 = Modificación
- 6 = Cancelación
- 7 = Rehabilitación
- 8 = Reclamo
- 9 = Cambio de Corredor
- 10 = Cotización
- 99 = Otro

---

## 🔄 Estados Simplificados

1. **Nuevo** - Caso recién creado y clasificado
2. **Sin clasificar** - Caso provisional (confidence baja o campos faltantes)
3. **En proceso** - Master trabajando en el caso
4. **Pendiente cliente** - Esperando respuesta/documentos del cliente (SLA pausado)
5. **Pendiente broker** - Esperando acción del broker (SLA pausado)
6. **Enviado** - Enviado a aseguradora
7. **Aplazado** - Pausado por 1-6 meses
8. **Cerrado aprobado** - Completado exitosamente
9. **Cerrado rechazado** - No procede o rechazado

---

## 🔍 Troubleshooting

### Problema: "Cannot find module 'imapflow'"
**Solución:** 
```bash
npm install imapflow mailparser google-auth-library
```

### Problema: "GOOGLE_APPLICATION_CREDENTIALS_JSON invalid"
**Solución:**
1. Ir a Google Cloud Console > IAM & Admin > Service Accounts
2. Descargar JSON del Service Account
3. Copiar TODO el contenido del JSON como string
4. Pegarlo en variable de entorno Vercel (sin saltos de línea, como string continuo)

### Problema: "Unauthorized" en cron endpoints
**Solución:**
- Verificar que `CRON_SECRET` esté configurado en Vercel
- Usar header: `Authorization: Bearer TU_CRON_SECRET`

### Problema: Correos no se ingresan
**Checklist:**
1. ✅ `FEATURE_ENABLE_IMAP=true`
2. ✅ Credenciales Zoho correctas (usar App Password, NO password normal)
3. ✅ Verificar logs en Vercel: Functions > [cron-imap-ingest]
4. ✅ Verificar que bucket `inbound-email-attachments` existe en Supabase Storage

### Problema: Vertex AI retorna error
**Checklist:**
1. ✅ `FEATURE_ENABLE_VERTEX=true`
2. ✅ Service Account tiene rol "Vertex AI User"
3. ✅ API de Vertex AI habilitada en Google Cloud
4. ✅ Modelo `gemini-1.5-flash` disponible en `us-central1`

---

## 📝 Logs y Monitoreo

### Vercel Logs
```
Dashboard > Functions > Logs
Buscar: "[INGESTOR]", "[VERTEX]", "[CASE ENGINE]"
```

### Supabase Logs
```sql
-- Audit logs recientes
SELECT * FROM security_audit_logs
ORDER BY created_at DESC
LIMIT 50;

-- Errores en inbound_emails
SELECT id, message_id, error_code, error_detail, created_at
FROM inbound_emails
WHERE processed_status = 'error'
ORDER BY created_at DESC;
```

---

## 🎨 UI Tipo Monday (Pendiente)

La implementación de la UI está **pendiente** y requiere:

1. **Componentes base:**
   - `PendientesBoard.tsx` - Vista principal tipo kanban
   - `CaseCard.tsx` - Tarjeta individual de caso
   - `CaseDetailModal.tsx` - Modal de detalle completo
   - `QuickEditPopover.tsx` - Edición inline

2. **Vistas por tabs:**
   - Tab 1: Vida ASSA (incluye Vida Web)
   - Tab 2: Ramos Generales
   - Tab 3: Ramo Personas

3. **Features:**
   - Drag & drop entre estados
   - Quick edit inline (estado, plazo, asignaciones)
   - Filtros por aseguradora, trámite, broker, fecha
   - Ordenamiento: "por vencer" arriba, "más nuevos" abajo
   - Búsqueda por ticket, cliente, email

**Nota:** La UI se implementará en una fase posterior usando los mismos principios mobile-first y componentes shadcn/ui existentes.

---

## 📚 Arquitectura Técnica

### Flujo Completo

```
┌──────────────┐
│  Zoho IMAP   │ (cada 3 min)
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ /api/cron/imap-ingest│
└──────┬───────────────┘
       │
       ▼
┌──────────────────┐
│  imapClient.ts   │ fetch emails
└──────┬───────────┘
       │
       ▼
┌──────────────────────┐
│ inbound_emails (DB)  │ deduplicar + guardar
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  vertexClient.ts     │ clasificar con Gemini
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  caseEngine.ts       │ crear/vincular caso
└──────┬───────────────┘
       │
       ├─► Determinar broker (AI > From > CC)
       ├─► Determinar master (routing config)
       ├─► Buscar caso existente (24h + ticket)
       │
       ▼
┌──────────────────────┐
│  Caso Nuevo/Vinculado│
└──────┬───────────────┘
       │
       ├─► Generar ticket (si clasificado)
       ├─► Crear historial
       ├─► Audit log
       │
       ▼
┌──────────────────────┐
│   Notificación       │ (broker + master)
└──────────────────────┘
```

---

## 🔒 Seguridad

- ✅ RLS habilitado en todas las tablas
- ✅ Master ve todo, broker solo sus casos
- ✅ Audit logs inmutables (solo INSERT)
- ✅ Cron endpoints protegidos con CRON_SECRET
- ✅ Secrets NUNCA en logs (solo IDs)
- ✅ Service Account JSON nunca en archivos

---

## 📞 Soporte

Para issues o dudas sobre la implementación, revisar:
1. Este README completo
2. Logs en Vercel Dashboard
3. Audit logs en Supabase
4. Código fuente con comentarios detallados

**Archivos clave:**
- `/src/lib/imap/imapClient.ts` - Cliente IMAP
- `/src/lib/vertex/vertexClient.ts` - Cliente Vertex AI
- `/src/lib/cases/caseEngine.ts` - Motor de casos
- `/src/app/api/cron/imap-ingest/route.ts` - Endpoint principal

---

## ✅ Checklist de Implementación

- [ ] Dependencias npm instaladas
- [ ] Variables de entorno configuradas en Vercel
- [ ] Migraciones ejecutadas en Supabase
- [ ] Service Account JSON configurado correctamente
- [ ] App Password de Zoho Mail generado
- [ ] Bucket `inbound-email-attachments` creado en Supabase Storage
- [ ] Deploy a Vercel exitoso
- [ ] Cron jobs activos y verificados
- [ ] Test manual del endpoint IMAP exitoso
- [ ] Primeros correos ingresados correctamente
- [ ] Primeros casos creados con tickets

**Una vez completado, el sistema estará 100% operativo y los correos se procesarán automáticamente cada 3 minutos.**
