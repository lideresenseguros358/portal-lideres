# 🧪 Testing Manual de Cron Jobs IMAP + Vertex AI

## ✅ Pre-requisitos Verificados

- [x] Migraciones SQL ejecutadas en Supabase
- [x] Variables de entorno configuradas en Vercel:
  - `CRON_SECRET`
  - `ZOHO_IMAP_*`
  - `GOOGLE_CLOUD_*`
  - `FEATURE_ENABLE_IMAP=true`
  - `FEATURE_ENABLE_VERTEX=true`
- [x] Bucket `expediente` existe y funciona
- [x] `vercel.json` con cron jobs configurados
- [x] Deploy a Vercel completado

---

## 🔧 Configuración de CRON_SECRET

### Generar Secret
```bash
openssl rand -base64 32
```

### Agregar a Vercel
1. Ir a Vercel Dashboard > Settings > Environment Variables
2. Agregar:
   - **Name:** `CRON_SECRET`
   - **Value:** (el secret generado)
   - **Environments:** Production, Preview, Development

---

## 📋 Test Manual del Endpoint IMAP

### Opción 1: Con curl (Recomendado)

```bash
# Usando Bearer token
curl -X GET https://tu-dominio.vercel.app/api/cron/imap-ingest \
  -H "Authorization: Bearer TU_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -v

# Usando header x-cron-secret
curl -X GET https://tu-dominio.vercel.app/api/cron/imap-ingest \
  -H "x-cron-secret: TU_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -v
```

### Opción 2: Con Postman

1. Método: **GET**
2. URL: `https://tu-dominio.vercel.app/api/cron/imap-ingest`
3. Headers:
   - `Authorization: Bearer TU_CRON_SECRET`
   - O `x-cron-secret: TU_CRON_SECRET`
4. Send

### Respuesta Esperada (Éxito)

```json
{
  "success": true,
  "timestamp": "2026-01-22T02:30:00.000Z",
  "runId": "uuid-del-run",
  "stats": {
    "messagesProcessed": 5,
    "casesCreated": 3,
    "casesLinked": 2,
    "errors": 0
  }
}
```

### Respuesta Esperada (Sin correos nuevos)

```json
{
  "success": true,
  "timestamp": "2026-01-22T02:30:00.000Z",
  "runId": "uuid-del-run",
  "stats": {
    "messagesProcessed": 0,
    "casesCreated": 0,
    "casesLinked": 0,
    "errors": 0
  }
}
```

### Respuesta de Error (No autorizado)

```json
{
  "error": "Unauthorized"
}
```

---

## 📋 Test Manual del Endpoint Aplazados

```bash
# Test aplazados check
curl -X GET https://tu-dominio.vercel.app/api/cron/aplazados-check \
  -H "Authorization: Bearer TU_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -v
```

### Respuesta Esperada

```json
{
  "success": true,
  "timestamp": "2026-01-22T14:00:00.000Z",
  "runId": "uuid-del-run",
  "aplazadosVencidos": 2,
  "notificacionesCreadas": 2,
  "tickets": ["2601010503001", "2601020104002"]
}
```

---

## 🔍 Verificar Ejecución en Supabase

### 1. Ver Logs de Cron Runs

```sql
-- Últimas 10 ejecuciones
SELECT 
  job_name,
  started_at,
  finished_at,
  status,
  processed_count,
  error_message,
  metadata
FROM cron_runs
ORDER BY started_at DESC
LIMIT 10;
```

### 2. Ver Resumen de Ejecuciones

```sql
-- Resumen por job
SELECT * FROM cron_runs_summary;
```

### 3. Verificar Correos Ingresados

```sql
-- Últimos 10 correos
SELECT 
  id,
  message_id,
  from_email,
  subject,
  processed_status,
  created_at
FROM inbound_emails
ORDER BY created_at DESC
LIMIT 10;
```

### 4. Verificar Casos Creados

```sql
-- Últimos 10 casos
SELECT 
  id,
  ticket,
  estado_simple,
  ramo_bucket,
  ai_confidence,
  created_at
FROM cases
ORDER BY created_at DESC
LIMIT 10;
```

### 5. Verificar Emails Vinculados

```sql
-- Últimas vinculaciones
SELECT 
  ce.id,
  ce.case_id,
  c.ticket,
  ie.subject,
  ce.linked_at
FROM case_emails ce
JOIN cases c ON c.id = ce.case_id
JOIN inbound_emails ie ON ie.id = ce.inbound_email_id
ORDER BY ce.linked_at DESC
LIMIT 10;
```

---

## 📊 Monitoreo en Vercel

### Ver Logs de Cron

1. Ir a Vercel Dashboard
2. Tu Proyecto > Logs
3. Filtrar por función: `/api/cron/imap-ingest`
4. Ver ejecuciones cada 3 minutos

### Verificar Cron Schedule

1. Ir a Vercel Dashboard
2. Tu Proyecto > Settings > Cron Jobs
3. Verificar que aparezcan:
   - ✅ `/api/cron/imap-ingest` - `*/3 * * * *` (cada 3 min)
   - ✅ `/api/cron/aplazados-check` - `0 14 * * *` (14:00 UTC)

---

## 🐛 Troubleshooting

### Problema: "Unauthorized"

**Causa:** CRON_SECRET no coincide o no está configurado

**Solución:**
1. Verificar que `CRON_SECRET` esté en Vercel Environment Variables
2. Copiar el valor exacto (sin espacios)
3. Usar en el header del request
4. Redeploy si agregaste la variable recientemente

---

### Problema: "Cannot find module 'imapflow'"

**Causa:** Dependencias no instaladas

**Solución:**
```bash
npm install imapflow mailparser google-auth-library
git add package.json package-lock.json
git commit -m "deps: Add IMAP and AI dependencies"
git push
```

---

### Problema: "Error connecting to IMAP"

**Causa:** Credenciales de Zoho incorrectas

**Solución:**
1. Verificar `ZOHO_IMAP_USER` y `ZOHO_IMAP_PASS` en Vercel
2. Usar **App Password** de Zoho, NO password normal
3. Generar App Password en Zoho: https://accounts.zoho.com/home#security/app-passwords

---

### Problema: "Vertex AI authentication failed"

**Causa:** Service Account JSON incorrecto

**Solución:**
1. Verificar `GOOGLE_APPLICATION_CREDENTIALS_JSON` en Vercel
2. Debe ser el JSON completo como string (sin saltos de línea)
3. Verificar que el Service Account tenga rol "Vertex AI User"
4. Verificar que la API de Vertex AI esté habilitada

---

### Problema: Cron no ejecuta automáticamente

**Causa:** Deploy pendiente o configuración incorrecta

**Solución:**
1. Hacer git push para trigger deploy
2. Esperar que deploy complete
3. Verificar en Vercel > Settings > Cron Jobs que aparezcan los jobs
4. Esperar 3 minutos para la primera ejecución automática

---

## ✅ Checklist de Testing Completo

- [ ] CRON_SECRET generado y configurado en Vercel
- [ ] Test manual exitoso del endpoint `/api/cron/imap-ingest`
- [ ] Verificado que cron_runs registra ejecuciones
- [ ] Verificado que inbound_emails recibe correos
- [ ] Verificado que cases se crean con tickets
- [ ] Verificado que case_emails vincula correctamente
- [ ] Test manual exitoso del endpoint `/api/cron/aplazados-check`
- [ ] Verificado logs en Vercel
- [ ] Verificado que cron ejecuta automáticamente cada 3 min
- [ ] Sin errores en logs de Vercel

---

## 📈 Métricas de Éxito

### Indicadores de Funcionamiento Correcto

1. **cron_runs tiene registros cada 3 minutos**
   - Job: `imap-ingest`
   - Status: `success`
   - Processed_count > 0 (si hay correos)

2. **inbound_emails crece con nuevos correos**
   - Processed_status: `linked`
   - Message_id único (no duplicados)

3. **cases crece con nuevos casos**
   - Ticket generado (formato: AAMM+RAMO+ASEG+TRAMITE+CORREL)
   - Estado_simple: `Nuevo` o `Sin clasificar`
   - AI_confidence > 0

4. **Logs de Vercel muestran ejecuciones exitosas**
   - `[CRON IMAP] Starting ingestion cycle`
   - `[INGESTOR] Fetched N messages from IMAP`
   - `[VERTEX] AI classification: bucket=...`
   - `[CASE ENGINE] Case created: ...`

---

## 🎯 Próximos Pasos Después de Testing

1. **Monitorear durante 24 horas**
   - Verificar que no haya memory leaks
   - Verificar que IMAP cierra conexiones
   - Verificar que no se reprocesen emails

2. **Ajustar configuración si es necesario**
   - `IMAP_POLL_WINDOW_MINUTES` (default: 60)
   - `IMAP_MAX_MESSAGES_PER_RUN` (default: 20)
   - `VERTEX_CONFIDENCE_THRESHOLD` (default: 0.72)

3. **Documentar casos especiales**
   - Emails sin clasificar
   - Brokers no detectados
   - Aseguradoras no reconocidas

---

## 📝 Comandos Útiles

### Ver últimos 20 runs
```sql
SELECT * FROM cron_runs ORDER BY started_at DESC LIMIT 20;
```

### Ver runs con errores
```sql
SELECT * FROM cron_runs WHERE status = 'failed' ORDER BY started_at DESC;
```

### Ver duración promedio
```sql
SELECT 
  job_name,
  AVG(EXTRACT(EPOCH FROM (finished_at - started_at))) as avg_seconds
FROM cron_runs
WHERE finished_at IS NOT NULL
GROUP BY job_name;
```

### Limpiar logs antiguos (opcional)
```sql
DELETE FROM cron_runs WHERE started_at < NOW() - INTERVAL '30 days';
```

---

**El sistema está listo para producción una vez que todas las verificaciones pasen exitosamente.** ✅
