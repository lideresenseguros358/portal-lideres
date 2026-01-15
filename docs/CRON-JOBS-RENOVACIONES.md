# Cron Jobs - Sistema de Renovaciones

Sistema automatizado para ejecutar verificaciones diarias de pólizas por renovar.

## 🚀 Opciones Disponibles

### 1. Vercel Cron (Recomendado para producción)

**Ubicación:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/renewals-daily",
      "schedule": "0 12 * * *"
    }
  ]
}
```

**Características:**
- ✅ Ejecuta diariamente a las 12:00 UTC (7:00 AM UTC-5)
- ✅ Vercel maneja automáticamente la autenticación
- ✅ No requiere configuración adicional
- ✅ Incluido en el plan de Vercel

**Endpoint:** `/api/cron/renewals-daily`
- Ejecuta todas las verificaciones: expired, 30d, 7d, 0d
- Protegido con `CRON_SECRET` en headers
- Retorna resumen de todas las notificaciones enviadas

### 2. GitHub Actions

**Ubicación:** `.github/workflows/check-renewals.yml`

```yaml
name: Check Policy Renewals
on:
  schedule:
    - cron: '0 12 * * *'  # Diariamente a las 12:00 UTC
  workflow_dispatch:  # Ejecución manual
```

**Características:**
- ✅ Ejecuta desde GitHub (independiente de Vercel)
- ✅ Puede ejecutarse manualmente desde GitHub UI
- ✅ Gratis en repositorios públicos/privados
- ✅ Logs en GitHub Actions

**Configuración requerida:**

1. Ir a Settings → Secrets and variables → Actions
2. Agregar secret: `APP_URL` con el valor de tu dominio
   ```
   https://portal-lideres.vercel.app
   ```

**Ejecutar manualmente:**
1. Ir a Actions tab en GitHub
2. Seleccionar "Check Policy Renewals"
3. Click en "Run workflow"

### 3. Cron Tradicional (Linux/Mac Server)

**Script:** Crear archivo `check-renewals.sh`

```bash
#!/bin/bash

# URL de tu aplicación
APP_URL="https://portal-lideres.vercel.app"

# Ejecutar verificaciones
echo "🔄 Iniciando verificación de renovaciones - $(date)"

curl -s -X GET "$APP_URL/api/policies/check-renewals?type=expired" | jq '.'
curl -s -X GET "$APP_URL/api/policies/check-renewals?type=30d" | jq '.'
curl -s -X GET "$APP_URL/api/policies/check-renewals?type=7d" | jq '.'
curl -s -X GET "$APP_URL/api/policies/check-renewals?type=0d" | jq '.'

echo "✅ Verificación completada - $(date)"
```

**Instalación:**

```bash
# Dar permisos de ejecución
chmod +x check-renewals.sh

# Editar crontab
crontab -e

# Agregar línea (ejecutar a las 7:00 AM)
0 7 * * * /ruta/completa/check-renewals.sh >> /var/log/renewals-cron.log 2>&1
```

### 4. Llamada Manual desde API

Puedes ejecutar las verificaciones manualmente llamando al endpoint:

```bash
# Verificar todas
curl -X GET "https://tu-dominio.com/api/policies/check-renewals?type=all"

# Verificar solo pólizas vencidas
curl -X GET "https://tu-dominio.com/api/policies/check-renewals?type=expired"

# Verificar 30 días antes
curl -X GET "https://tu-dominio.com/api/policies/check-renewals?type=30d"

# Verificar 7 días antes
curl -X GET "https://tu-dominio.com/api/policies/check-renewals?type=7d"

# Verificar día de renovación
curl -X GET "https://tu-dominio.com/api/policies/check-renewals?type=0d"
```

## 📊 Flujo de Notificaciones

### Pólizas Vencidas (expired)
- **Broker:** Recibe notificación con botón "Ya renovó"
- **Master:** Siempre recibe

### 30 días antes (30d)
- **Broker:** SIEMPRE recibe con botón "Ya renovó"
- **Master:** Recibe SOLO si:
  - `notify_broker_renewals = true` en perfil del broker, O
  - Es broker "Oficina" (`contacto@lideresenseguros.com`)

### 7 días antes (7d)
- **Broker:** Recibe recordatorio urgente
- **Master:** NO recibe

### Día de renovación (0d)
- **Broker:** NO recibe
- **Master:** SOLO master recibe

### 60 días post-vencimiento (60d-delete)
- **Broker:** Recibe notificación de eliminación
- **Master:** Siempre recibe

## 🔐 Variables de Entorno

### Vercel Cron
```bash
CRON_SECRET=tu-secret-aleatorio-aqui
```

Generar secret:
```bash
openssl rand -base64 32
```

### GitHub Actions
En GitHub Settings → Secrets:
```
APP_URL=https://portal-lideres.vercel.app
```

## 📝 Logs y Monitoreo

### Vercel Cron
1. Ir a Vercel Dashboard
2. Seleccionar proyecto
3. Functions → Logs
4. Buscar `/api/cron/renewals-daily`

### GitHub Actions
1. Ir a repositorio en GitHub
2. Actions tab
3. Seleccionar workflow "Check Policy Renewals"
4. Ver logs de ejecución

### Endpoint Manual
Los logs se muestran en la respuesta JSON:

```json
{
  "success": true,
  "timestamp": "2026-01-15T12:00:00.000Z",
  "results": {
    "expired": {
      "alert_expired": 5,
      "brokers_notified": 3
    },
    "thirtyDay": {
      "alert_30d": 10,
      "brokers_notified": 8
    },
    "sevenDay": {
      "alert_7d": 3,
      "brokers_notified": 3
    },
    "zeroDay": {
      "alert_0d": 2,
      "brokers_notified": 0
    }
  }
}
```

## 🧪 Testing

### Probar localmente (desarrollo)
```bash
# Asegúrate de tener CRON_SECRET en .env.local
curl -H "Authorization: Bearer tu-cron-secret" \
  http://localhost:3000/api/cron/renewals-daily
```

### Probar en producción
```bash
# Ejecutar desde GitHub Actions (método recomendado)
# O llamar directamente:
curl "https://tu-dominio.com/api/policies/check-renewals?type=all"
```

## ⚙️ Configuración Recomendada

**Para Producción:**
1. ✅ Usar Vercel Cron como principal
2. ✅ Configurar GitHub Actions como backup
3. ✅ Monitorear logs semanalmente

**Para Desarrollo:**
1. ✅ Ejecutar manualmente cuando sea necesario
2. ✅ Usar endpoint GET con query params

## 🔧 Troubleshooting

### Cron no se ejecuta en Vercel
- Verificar que `vercel.json` esté en la raíz del proyecto
- Verificar que el cron esté deployado (`git push` activa deploy)
- Revisar logs en Vercel Dashboard

### GitHub Actions falla
- Verificar que `APP_URL` secret esté configurado
- Verificar que la app esté accesible públicamente
- Revisar logs en GitHub Actions tab

### No se envían notificaciones
- Verificar que existan pólizas que cumplan las condiciones
- Revisar logs del endpoint
- Verificar configuración de emails en Supabase

### Pólizas no se detectan
```sql
-- Verificar pólizas que deberían detectarse
SELECT 
  p.policy_number,
  p.renewal_date,
  c.name as client_name,
  b.name as broker_name
FROM policies p
JOIN clients c ON p.client_id = c.id
JOIN brokers b ON p.broker_id = b.id
WHERE p.renewal_date = CURRENT_DATE + INTERVAL '30 days'
  AND p.status = 'ACTIVA';
```

## 📅 Horario de Ejecución

**Zona Horaria:** UTC  
**Hora Configurada:** 12:00 UTC  
**Hora Local (UTC-5):** 7:00 AM  

Esto asegura que las notificaciones se envíen temprano en la mañana para que los brokers las vean al iniciar su día.

## 🔄 Actualización de Horario

### Vercel Cron
Editar `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/renewals-daily",
      "schedule": "0 13 * * *"  // 1:00 PM UTC = 8:00 AM UTC-5
    }
  ]
}
```

### GitHub Actions
Editar `.github/workflows/check-renewals.yml`:
```yaml
on:
  schedule:
    - cron: '0 13 * * *'  # 1:00 PM UTC = 8:00 AM UTC-5
```

## 📞 Soporte

Si las notificaciones no se están enviando:
1. Verificar logs en Vercel/GitHub Actions
2. Ejecutar manualmente el endpoint GET
3. Revisar que existan pólizas que cumplan condiciones
4. Verificar configuración de `notify_broker_renewals` en profiles

---

**Última actualización:** Enero 15, 2026  
**Versión:** 2.0.0 (Sistema renovado con notificaciones escalonadas)
