# 🧪 Sistema de Testing Automatizado E2E

Sistema completo de testing automatizado para SMTP, IMAP, IA, Casos y Cron Jobs.

## 📋 Endpoints Disponibles

### 1. Test E2E SMTP → IMAP → IA → CASE

**Endpoint:** `POST /api/test/e2e-imap`

**Descripción:** Ejecuta un flujo completo de testing que simula el ciclo completo de vida de un correo:
1. Envía correo de prueba vía SMTP
2. Espera 8 segundos
3. Procesa el correo con IMAP
4. Clasifica con Vertex AI
5. Crea caso automáticamente
6. Verifica resultados en BD

**Autenticación:** Header `x-cron-secret` con valor `CRON_SECRET`

**Ejemplo curl:**
```bash
curl -X POST https://tu-dominio.vercel.app/api/test/e2e-imap \
  -H "x-cron-secret: YOUR_CRON_SECRET_HERE" \
  -H "Content-Type: application/json"
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "testType": "E2E SMTP → IMAP → CASE",
  "testId": "TEST-1737567890123",
  "emailSent": true,
  "imapProcessed": true,
  "caseCreated": true,
  "ticket": "2601220001",
  "brokerDetected": "javiersamudio@lideresenseguros.com",
  "aiConfidence": 0.91,
  "errors": [],
  "timestamps": {
    "started": "2026-01-22T17:38:10.123Z",
    "emailSent": "2026-01-22T17:38:12.456Z",
    "imapProcessed": "2026-01-22T17:38:22.789Z",
    "caseCreated": "2026-01-22T17:38:23.012Z",
    "completed": "2026-01-22T17:38:25.345Z"
  },
  "verifications": {
    "cronRunExists": true,
    "inboundEmailExists": true,
    "caseWithTicketExists": true,
    "brokerAssigned": true,
    "emailLogExists": true
  },
  "duration": 15222
}
```

**Respuesta con errores (500):**
```json
{
  "success": false,
  "testType": "E2E SMTP → IMAP → CASE",
  "testId": "TEST-1737567890123",
  "emailSent": true,
  "imapProcessed": false,
  "caseCreated": false,
  "ticket": null,
  "brokerDetected": null,
  "aiConfidence": null,
  "errors": [
    "IMAP: No emails found - email may not have arrived yet",
    "Case not created - may need more time or classification failed"
  ],
  "timestamps": {
    "started": "2026-01-22T17:38:10.123Z",
    "emailSent": "2026-01-22T17:38:12.456Z",
    "imapProcessed": null,
    "caseCreated": null,
    "completed": "2026-01-22T17:38:25.345Z"
  }
}
```

---

### 2. Test Manual de Cron Jobs

**Endpoint:** `POST /api/test/cron-run`

**Descripción:** Ejecuta manualmente todos los cron jobs en orden para verificar funcionamiento:
1. imap-ingest
2. aplazados-check
3. scheduler
4. pendientes-digest
5. renewals
6. birthdays
7. sla-alerts

**Autenticación:** Header `x-cron-secret` con valor `CRON_SECRET`

**Ejemplo curl:**
```bash
curl -X POST https://tu-dominio.vercel.app/api/test/cron-run \
  -H "x-cron-secret: YOUR_CRON_SECRET_HERE" \
  -H "Content-Type: application/json"
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "testId": "CRON-TEST-1737567890123",
  "executed": [
    {
      "job": "imap-ingest",
      "status": "success",
      "processed": 5,
      "created": 3,
      "duration": 2345
    },
    {
      "job": "aplazados-check",
      "status": "success",
      "resumed": 2
    },
    {
      "job": "scheduler",
      "status": "success",
      "tasksFound": 0
    },
    {
      "job": "pendientes-digest",
      "status": "success",
      "pendingCases": 15,
      "brokers": 3
    },
    {
      "job": "renewals",
      "status": "success",
      "upcomingRenewals": 8
    },
    {
      "job": "birthdays",
      "status": "success",
      "birthdaysToday": 1
    },
    {
      "job": "sla-alerts",
      "status": "success",
      "alertsToSend": 4
    }
  ],
  "startedAt": "2026-01-22T17:40:00.000Z",
  "completedAt": "2026-01-22T17:40:15.234Z"
}
```

**Respuesta con errores (500):**
```json
{
  "success": false,
  "testId": "CRON-TEST-1737567890123",
  "executed": [
    {
      "job": "imap-ingest",
      "status": "error",
      "error": "IMAP connection timeout"
    },
    {
      "job": "aplazados-check",
      "status": "success",
      "resumed": 0
    }
  ],
  "startedAt": "2026-01-22T17:40:00.000Z",
  "completedAt": "2026-01-22T17:40:05.123Z"
}
```

---

### 3. Limpieza de Datos de Testing

**Endpoint:** `POST /api/test/cleanup`

**Descripción:** Elimina todos los datos generados por testing:
- Casos con flag `is_test` o prefijo `TEST-`
- Correos de prueba
- Logs de testing
- Test runs antiguos (> 7 días)

**Autenticación:** Header `x-cron-secret` con valor `CRON_SECRET`

**Ejemplo curl:**
```bash
curl -X POST https://tu-dominio.vercel.app/api/test/cleanup \
  -H "x-cron-secret: YOUR_CRON_SECRET_HERE" \
  -H "Content-Type: application/json"
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "message": "Test data cleanup completed",
  "deleted": {
    "cases": 5,
    "inboundEmails": 1,
    "emailLogs": 1,
    "testRuns": 1,
    "caseFiles": 5,
    "caseComments": 5
  }
}
```

---

### 4. Ver Estadísticas de Datos de Testing

**Endpoint:** `GET /api/test/cleanup`

**Descripción:** Muestra cantidad de datos de testing actuales sin eliminar nada.

**Autenticación:** Header `x-cron-secret` con valor `CRON_SECRET`

**Ejemplo curl:**
```bash
curl -X GET https://tu-dominio.vercel.app/api/test/cleanup \
  -H "x-cron-secret: YOUR_CRON_SECRET_HERE"
```

**Respuesta (200):**
```json
{
  "success": true,
  "testData": {
    "cases": 5,
    "inboundEmails": 3,
    "emailLogs": 2,
    "testRuns": 10
  }
}
```

---

## 🔐 Seguridad

### Autenticación requerida

Todos los endpoints requieren el header:
```
x-cron-secret: YOUR_CRON_SECRET_HERE
```

Si el secret no coincide, recibirás:
```json
{
  "success": false,
  "error": "Unauthorized - Invalid CRON_SECRET"
}
```
Status: **401 Unauthorized**

---

## 📊 Datos de Prueba Generados

### Flag de Testing

Todos los datos de prueba incluyen identificadores:

**Casos:**
- Campo `is_test = true` (si existe en schema)
- Prefijo `TEST-` en `ticket`
- Referencia a `testId` en `notes`

**Correos:**
- Campo `is_test = true` (si existe)
- Prefijo `TEST –` en subject
- Test ID en body

**Logs:**
- Campo `is_test = true` (si existe)
- Subject con `TEST`

### Datos Ficticios Usados

**Cliente de prueba:**
```
Nombre: Cliente Prueba Cron
Cédula: 8-888-8888
Teléfono: 6000-0000
Email: prueba@test.com
```

**Caso de prueba:**
```
Tipo: RENOVACION
Póliza: AUTO
Aseguradora: ASSA
Número: TEST-AUTO-001
```

**Broker:**
```
Email: javiersamudio@lideresenseguros.com (en CC)
```

---

## 🔄 Flujo Completo de Testing

### 1. Ejecutar Test E2E

```bash
# Enviar, procesar, clasificar, crear caso
curl -X POST https://tu-dominio.vercel.app/api/test/e2e-imap \
  -H "x-cron-secret: YOUR_SECRET"
```

Esto debería:
- ✅ Enviar correo vía SMTP
- ✅ Procesar con IMAP
- ✅ Clasificar con IA
- ✅ Crear caso con ticket
- ✅ Asignar broker correcto
- ✅ Generar logs

### 2. Verificar en Base de Datos

Verifica manualmente en Supabase:

```sql
-- Ver casos de prueba
SELECT * FROM cases 
WHERE ticket LIKE '%TEST%' 
ORDER BY created_at DESC;

-- Ver correos procesados
SELECT * FROM inbound_emails 
WHERE subject LIKE '%TEST%' 
ORDER BY received_at DESC;

-- Ver logs de email
SELECT * FROM email_logs 
WHERE subject LIKE '%TEST%' 
ORDER BY created_at DESC;

-- Ver resultados de tests
SELECT * FROM test_runs 
ORDER BY created_at DESC 
LIMIT 10;
```

### 3. Ejecutar Cron Jobs

```bash
# Ejecutar todos los cron jobs
curl -X POST https://tu-dominio.vercel.app/api/test/cron-run \
  -H "x-cron-secret: YOUR_SECRET"
```

### 4. Ver Estadísticas

```bash
# Ver cuántos datos de testing hay
curl -X GET https://tu-dominio.vercel.app/api/test/cleanup \
  -H "x-cron-secret: YOUR_SECRET"
```

### 5. Limpiar Datos (Opcional)

```bash
# Eliminar todos los datos de prueba
curl -X POST https://tu-dominio.vercel.app/api/test/cleanup \
  -H "x-cron-secret: YOUR_SECRET"
```

---

## 🎯 Verificaciones Automáticas

El endpoint E2E realiza las siguientes verificaciones automáticas:

| Verificación | Descripción |
|--------------|-------------|
| `cronRunExists` | Existe registro en tabla `cron_runs` |
| `inboundEmailExists` | Correo fue guardado en `inbound_emails` |
| `caseWithTicketExists` | Caso creado con ticket válido |
| `brokerAssigned` | Broker detectado y asignado correctamente |
| `emailLogExists` | Log de email generado |

Si alguna verificación falla, el test marca `success: false`.

---

## 🐛 Troubleshooting

### El correo no llega en IMAP

**Problema:** `imapProcessed: false`, error "No emails found"

**Soluciones:**
1. Espera más tiempo (8 segundos puede no ser suficiente)
2. Verifica credenciales IMAP en variables de entorno
3. Revisa que `tramites@lideresenseguros.com` esté configurado
4. Ejecuta manualmente el cron `/api/cron/imap-ingest`

### El caso no se crea

**Problema:** `caseCreated: false`, error "Case not created"

**Soluciones:**
1. Verifica que Vertex AI esté configurado
2. Revisa logs de clasificación IA
3. Verifica que el correo tenga suficiente información
4. Revisa tabla `inbound_emails` para ver si el correo fue procesado

### Broker no detectado

**Problema:** `brokerDetected: null`

**Soluciones:**
1. Verifica que el broker exista en tabla `brokers`
2. Verifica que el email esté en CC del correo
3. Revisa lógica de detección de broker en clasificador

### Errores de autenticación

**Problema:** `401 Unauthorized`

**Solución:**
1. Verifica que el header `x-cron-secret` sea correcto
2. Verifica variable de entorno `CRON_SECRET` en Vercel

---

## 📝 Ejemplo Completo

```bash
#!/bin/bash

DOMAIN="https://tu-dominio.vercel.app"
SECRET="tu-cron-secret-aqui"

echo "🧪 Iniciando testing E2E completo..."

# 1. Test E2E
echo "1️⃣ Ejecutando test E2E SMTP → IMAP → CASE..."
curl -X POST "$DOMAIN/api/test/e2e-imap" \
  -H "x-cron-secret: $SECRET" \
  -H "Content-Type: application/json" | jq

echo ""
echo "⏳ Esperando 30 segundos para procesamiento completo..."
sleep 30

# 2. Test Cron Jobs
echo "2️⃣ Ejecutando todos los cron jobs..."
curl -X POST "$DOMAIN/api/test/cron-run" \
  -H "x-cron-secret: $SECRET" \
  -H "Content-Type: application/json" | jq

# 3. Ver estadísticas
echo ""
echo "3️⃣ Verificando estadísticas de datos de testing..."
curl -X GET "$DOMAIN/api/test/cleanup" \
  -H "x-cron-secret: $SECRET" | jq

# 4. Limpieza (opcional)
echo ""
echo "❓ ¿Deseas limpiar los datos de prueba? (y/n)"
read -r CLEANUP

if [ "$CLEANUP" = "y" ]; then
  echo "🧹 Limpiando datos de testing..."
  curl -X POST "$DOMAIN/api/test/cleanup" \
    -H "x-cron-secret: $SECRET" \
    -H "Content-Type: application/json" | jq
fi

echo ""
echo "✅ Testing completado!"
```

---

## 🎯 Objetivos Cumplidos

✅ Probar SMTP (envío) automáticamente
✅ Probar IMAP (recepción) sin esperar cron
✅ Probar clasificación IA con datos reales
✅ Probar creación automática de casos + tickets
✅ Probar todos los cron jobs manualmente
✅ Confirmar correos automáticos
✅ Datos ficticios identificables
✅ No afecta producción real
✅ Verificaciones automáticas
✅ Limpieza de datos

---

## 📚 Tablas Afectadas

| Tabla | Acción | Flag |
|-------|--------|------|
| `cases` | Insert | `is_test = true`, `ticket` con `TEST-` |
| `inbound_emails` | Insert | `is_test = true`, `subject` con `TEST –` |
| `email_logs` | Insert | `is_test = true`, `subject` con `TEST` |
| `test_runs` | Insert | Guarda resultados de tests |
| `case_files` | Insert (si aplica) | Por `case_id` de prueba |
| `case_comments` | Insert (si aplica) | Por `case_id` de prueba |
| `cron_runs` | Insert | Registro normal de cron |

---

## 🔗 Referencias

- **Migración:** `supabase/migrations/20260122170000_create_test_runs.sql`
- **Endpoint E2E:** `src/app/api/test/e2e-imap/route.ts`
- **Endpoint Cron:** `src/app/api/test/cron-run/route.ts`
- **Endpoint Cleanup:** `src/app/api/test/cleanup/route.ts`
- **IMAP Client:** `src/lib/email/imap-client.ts`
- **Email Sender:** `src/lib/email/send.ts`

---

## ⚠️ Notas Importantes

1. **No ejecutar en producción sin precaución** - Los tests envían correos reales
2. **Limitar frecuencia** - No ejecutar test E2E más de 1 vez cada 5 minutos
3. **Monitorear cuotas** - Vertex AI y Zoho tienen límites
4. **Revisar logs** - Siempre revisar `test_runs` para resultados
5. **Limpiar regularmente** - Ejecutar cleanup cada semana

---

**Última actualización:** 2026-01-22
**Versión:** 1.0.0
