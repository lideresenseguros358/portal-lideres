# Sistema de Notificaciones de Renovaciones

## Configuración

El sistema de notificaciones de renovaciones se ejecuta mediante un cron job que llama al endpoint `/api/cron/renewals`.

### Variables de Entorno Requeridas

```bash
CRON_SECRET=tu_secreto_seguro_aqui
```

## Prueba Local

Para probar el sistema localmente:

```bash
curl -H "x-cron-secret: tu_secreto_seguro_aqui" http://localhost:3000/api/cron/renewals
```

## Configuración en Producción

### Opción 1: Vercel Cron Jobs

En `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/cron/renewals",
    "schedule": "0 9 * * *"
  }]
}
```

### Opción 2: Servicio Externo (cron-job.org, GitHub Actions, etc.)

Configurar llamada diaria a:
```
POST https://tu-dominio.com/api/cron/renewals
Headers:
  x-cron-secret: tu_secreto_seguro
```

## Lógica de Notificaciones

1. **Próximas a vencer**: Pólizas que vencen en los próximos 30 días
2. **Vencidas recientes**: Pólizas vencidas en los últimos 7 días (notificación semanal)
3. **Ignoradas**: Pólizas con `renewal_date IS NULL`

## Monitoreo

Las notificaciones se registran en `audit_logs` con:
- action: 'RENEWAL_NOTIFICATIONS'
- meta: Detalles de pólizas notificadas
