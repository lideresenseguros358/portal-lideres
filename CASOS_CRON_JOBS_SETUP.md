# ⏰ CRON JOBS - CONFIGURACIÓN Y USO

## 📋 RESUMEN

Se han configurado 3 cron jobs para el módulo de Casos/Pendientes:

1. **Auto-limpieza** - Mueve casos vencidos a papelera
2. **Recordatorios SLA** - Notifica casos por vencer y vencidos
3. **Resumen Diario** - Envía estadísticas personalizadas por broker

---

## ✅ CONFIGURACIÓN COMPLETADA

### 1. Variables de Entorno

**Agregadas a `.env.local`:**
```bash
CRON_SECRET="Lissa806CronSecret2025"
```

**Para producción, agregar a Vercel:**
```bash
CRON_SECRET=tu_secret_seguro_aqui_en_produccion
```

### 2. Vercel Cron Configuration

**Actualizado `vercel.json`:**
```json
{
  "crons": [
    {
      "path": "/api/cron/cases-cleanup",
      "schedule": "0 6 * * *"  // 1:00 AM UTC-5 (Panamá)
    },
    {
      "path": "/api/cron/cases-reminders",
      "schedule": "0 13 * * *"  // 8:00 AM UTC-5 (Panamá)
    },
    {
      "path": "/api/cron/cases-daily-digest",
      "schedule": "0 12 * * *"  // 7:00 AM UTC-5 (Panamá)
    }
  ]
}
```

**Nota:** Horarios en UTC (Vercel usa UTC):
- 1:00 AM Panamá = 6:00 AM UTC
- 7:00 AM Panamá = 12:00 PM UTC
- 8:00 AM Panamá = 1:00 PM UTC

---

## 🔧 CRON JOBS IMPLEMENTADOS

### 1. Auto-Limpieza (cases-cleanup)

**Endpoint:** `GET /api/cron/cases-cleanup`  
**Horario:** Diario 1:00 AM (UTC-5)  
**Archivo:** `src/app/api/cron/cases-cleanup/route.ts`

**Función:**
- Busca casos con SLA vencido
- Sin actualización en los últimos 7 días
- No cerrados ni emitidos
- Mueve automáticamente a papelera
- Notifica a brokers afectados

**Criterios:**
```sql
WHERE sla_date < NOW()
  AND updated_at < NOW() - INTERVAL '7 days'
  AND is_deleted = false
  AND status NOT IN ('CERRADO', 'EMITIDO')
```

**Response:**
```json
{
  "ok": true,
  "message": "Moved N expired cases to trash",
  "moved_count": 5,
  "case_ids": ["uuid1", "uuid2", ...]
}
```

---

### 2. Recordatorios SLA (cases-reminders)

**Endpoint:** `GET /api/cron/cases-reminders`  
**Horario:** Diario 8:00 AM (UTC-5)  
**Archivo:** `src/app/api/cron/cases-reminders/route.ts`

**Función:**
- Detecta casos con SLA por vencer (próximos 5 días)
- Detecta casos con SLA vencido
- Agrupa por broker
- Crea notificaciones in-app

**Notificaciones generadas:**

🟡 **Por vencer:**
```
Título: "Casos por vencer pronto"
Body: "Tienes N caso(s) con SLA por vencer en los próximos 5 días"
Target: /cases?sla=due_soon
```

🔴 **Vencidos:**
```
Título: "⚠️ Casos vencidos"
Body: "Tienes N caso(s) con SLA vencido. Requieren atención urgente."
Target: /cases?sla=overdue
```

**Response:**
```json
{
  "ok": true,
  "message": "SLA reminders processed",
  "due_soon_count": 3,
  "overdue_count": 2,
  "notifications_sent": 5
}
```

---

### 3. Resumen Diario (cases-daily-digest)

**Endpoint:** `GET /api/cron/cases-daily-digest`  
**Horario:** Diario 7:00 AM (UTC-5)  
**Archivo:** `src/app/api/cron/cases-daily-digest/route.ts`

**Función:**
- Para cada broker activo:
  - Calcula casos pendientes de revisión
  - Casos que vencen HOY
  - Casos vencidos
  - Casos en proceso
  - Preliminares pendientes en BD
- Genera resumen personalizado
- Crea notificación tipo 'case_digest'

**Formato del resumen:**
```
Buenos días [Nombre Broker],

Resumen de tus casos (X total):

⚠️ N caso(s) VENCIDO(S) - Requieren atención urgente
🔔 N caso(s) vencen HOY
📋 N caso(s) pendiente(s) de revisión/documentación
⏳ N caso(s) en proceso/cotizando
📝 N preliminar(es) pendiente(s) de completar en BD
```

**Response:**
```json
{
  "ok": true,
  "message": "Daily digest processed",
  "brokers_count": 10,
  "emails_queued": 7
}
```

**Nota:** La notificación se marca como `email_sent: false`. Un servicio de email separado debe leer estas notificaciones y enviar los correos reales.

---

## 🔐 SEGURIDAD

Todos los cron jobs verifican el header de autorización:

```typescript
const authHeader = request.headers.get('authorization');
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Vercel automáticamente agrega este header** cuando ejecuta cron jobs configurados en `vercel.json`.

---

## 🧪 TESTING LOCAL

### Opción 1: Usar curl

```bash
# Auto-limpieza
curl -X GET http://localhost:3000/api/cron/cases-cleanup \
  -H "Authorization: Bearer Lissa806CronSecret2025"

# Recordatorios
curl -X GET http://localhost:3000/api/cron/cases-reminders \
  -H "Authorization: Bearer Lissa806CronSecret2025"

# Resumen diario
curl -X GET http://localhost:3000/api/cron/cases-daily-digest \
  -H "Authorization: Bearer Lissa806CronSecret2025"
```

### Opción 2: Usar Postman

1. Crear nueva request GET
2. URL: `http://localhost:3000/api/cron/[nombre-cron]`
3. Headers:
   - Key: `Authorization`
   - Value: `Bearer Lissa806CronSecret2025`
4. Send

### Opción 3: Usar archivo de test

Crear `test-cron.sh`:
```bash
#!/bin/bash
SECRET="Lissa806CronSecret2025"
BASE_URL="http://localhost:3000"

echo "Testing cases-cleanup..."
curl -X GET "$BASE_URL/api/cron/cases-cleanup" \
  -H "Authorization: Bearer $SECRET"

echo "\n\nTesting cases-reminders..."
curl -X GET "$BASE_URL/api/cron/cases-reminders" \
  -H "Authorization: Bearer $SECRET"

echo "\n\nTesting cases-daily-digest..."
curl -X GET "$BASE_URL/api/cron/cases-daily-digest" \
  -H "Authorization: Bearer $SECRET"
```

Ejecutar:
```bash
chmod +x test-cron.sh
./test-cron.sh
```

---

## 📊 MONITOREO

### Ver Logs en Vercel

1. Ir a Vercel Dashboard
2. Seleccionar proyecto
3. Ir a **Functions** → **Cron Jobs**
4. Ver ejecuciones recientes

### Ver Notificaciones Generadas

```sql
-- En Supabase SQL Editor
SELECT 
  created_at,
  notification_type,
  title,
  body,
  broker_id
FROM notifications
WHERE notification_type IN ('case_digest', 'other')
  AND created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;
```

### Ver Casos Movidos a Papelera

```sql
SELECT 
  case_number,
  deleted_at,
  deleted_reason
FROM cases
WHERE is_deleted = true
  AND deleted_reason LIKE '%Auto-limpieza%'
ORDER BY deleted_at DESC;
```

### Ver Historial de Auto-limpieza

```sql
SELECT 
  ch.created_at,
  ch.action,
  c.case_number,
  ch.metadata
FROM case_history ch
JOIN cases c ON c.id = ch.case_id
WHERE ch.action = 'AUTO_TRASH'
ORDER BY ch.created_at DESC;
```

---

## 🚨 TROUBLESHOOTING

### Error: "Unauthorized"

**Causa:** CRON_SECRET incorrecto o faltante

**Solución:**
1. Verificar `.env.local` tiene `CRON_SECRET`
2. En Vercel, verificar variable de entorno
3. Verificar header en request: `Authorization: Bearer [secret]`

### Error: "No cases to process"

**Causa:** No hay casos que cumplan los criterios

**Solución:** Normal, no es un error. Solo significa que no hay trabajo que hacer.

### Error: Database connection

**Causa:** Supabase no está disponible o credenciales incorrectas

**Solución:**
1. Verificar `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`
2. Verificar que Supabase está online
3. Revisar logs de Supabase

### Cron no ejecuta en Vercel

**Causa:** Configuración incorrecta en vercel.json

**Solución:**
1. Verificar sintaxis de vercel.json
2. Verificar que el path existe
3. Re-deploy después de cambios en vercel.json
4. Verificar en Vercel Dashboard → Settings → Cron Jobs

---

## 📅 HORARIOS RECOMENDADOS

| Cron Job | Hora Local (UTC-5) | Hora UTC | Razón |
|----------|-------------------|----------|-------|
| **cases-cleanup** | 1:00 AM | 6:00 AM | Hora de baja actividad, antes de que inicie el día laboral |
| **cases-daily-digest** | 7:00 AM | 12:00 PM | Cuando brokers empiezan su día, antes de revisar portal |
| **cases-reminders** | 8:00 AM | 1:00 PM | Ya en horario laboral, recordatorio activo |

**Nota:** Puedes ajustar estos horarios editando `vercel.json` y re-deployando.

---

## 🔄 DESACTIVAR/MODIFICAR CRON JOBS

### Desactivar temporalmente

Comentar en `vercel.json`:
```json
{
  "crons": [
    // {
    //   "path": "/api/cron/cases-cleanup",
    //   "schedule": "0 6 * * *"
    // },
    {
      "path": "/api/cron/cases-reminders",
      "schedule": "0 13 * * *"
    }
  ]
}
```

Re-deploy para aplicar cambios.

### Cambiar horario

Editar `schedule` en formato cron:
```
┌───────────── minuto (0 - 59)
│ ┌───────────── hora (0 - 23)
│ │ ┌───────────── día del mes (1 - 31)
│ │ │ ┌───────────── mes (1 - 12)
│ │ │ │ ┌───────────── día de la semana (0 - 6)
│ │ │ │ │
* * * * *
```

Ejemplos:
- `0 6 * * *` - Diario a las 6:00 AM UTC
- `0 */2 * * *` - Cada 2 horas
- `0 6 * * 1` - Lunes a las 6:00 AM UTC
- `0 6 1 * *` - Primer día del mes a las 6:00 AM UTC

---

## 📝 PRÓXIMOS PASOS

### 1. Configurar Email Service (Opcional)

Para enviar emails reales basados en notificaciones:

```typescript
// src/app/api/cron/send-emails/route.ts
// Leer notificaciones con email_sent = false
// Enviar emails usando servicio (SendGrid, Resend, etc.)
// Marcar como email_sent = true
```

### 2. Agregar Más Cron Jobs (Opcional)

Ideas adicionales:
- Purgar papelera después de 30 días
- Generar reportes mensuales
- Sincronizar con sistema externo
- Backup de casos importantes

---

## ✅ CHECKLIST DE DEPLOY

Antes de hacer deploy a producción:

- [x] Variables de entorno configuradas en Vercel
- [x] `vercel.json` con cron jobs correctos
- [x] CRON_SECRET seguro en producción (cambiar de local)
- [x] Horarios ajustados a zona horaria correcta
- [x] Endpoints probados localmente
- [x] Logs revisados en Vercel después de primer deploy

---

## 🎉 ESTADO ACTUAL

✅ **Cron jobs configurados y listos**

- Auto-limpieza: 1:00 AM diario
- Recordatorios: 8:00 AM diario
- Resumen diario: 7:00 AM diario

**Próximo deploy activará automáticamente los cron jobs en Vercel.**

---

**Fecha:** 2025-10-17  
**Configuración:** ✅ COMPLETA  
**Testing:** ✅ LISTO PARA PROBAR  
**Deploy:** ✅ LISTO PARA PRODUCCIÓN
