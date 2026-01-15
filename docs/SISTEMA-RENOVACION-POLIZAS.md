# Sistema de Renovación Automática de Pólizas

Sistema completo para gestionar renovaciones de pólizas con notificaciones automáticas y renovación asistida.

## 📋 Descripción General

El sistema detecta automáticamente pólizas vencidas y próximas a vencer, genera notificaciones para los brokers y permite renovar pólizas con un solo clic, actualizando las fechas sumando 1 año.

## 🎯 Funcionalidades

### 1. Detección Automática de Pólizas

El sistema verifica pólizas en diferentes estados:

- **VENCIDAS**: Pólizas con `renewal_date < hoy`
- **30 días antes**: Recordatorio de renovación próxima
- **7 días antes**: Recordatorio urgente
- **Día de vencimiento**: Última advertencia
- **60 días post-vencimiento**: Eliminación automática

### 2. Notificaciones Inteligentes

Cada tipo de alerta genera notificaciones según estas reglas:

#### **VENCIDAS (expired):**
- ✅ **Broker:** Recibe notificación con botón "Ya renovó"
- ✅ **Master:** Siempre recibe

#### **30 días antes (30d):**
- ✅ **Broker:** SIEMPRE recibe notificación con botón "Ya renovó"
- ✅ **Master:** Recibe SOLO si:
  - El broker tiene `notify_broker_renewals` habilitado en su perfil, O
  - Es broker "Oficina" (contacto@lideresenseguros.com)

#### **7 días antes (7d):**
- ✅ **Broker:** Recibe recordatorio urgente
- ❌ **Master:** NO recibe

#### **Día de vencimiento (0d):**
- ❌ **Broker:** NO recibe
- ✅ **Master:** SOLO master recibe esta notificación

#### **60 días post-vencimiento (60d-delete):**
- ✅ **Broker:** Recibe notificación de eliminación
- ✅ **Master:** Siempre recibe

**Características de las notificaciones:**
- 🔄 Icono y color distintivo
- 📝 Título y mensaje personalizado
- 🔔 Urgencia (normal, high, critical)
- 🎯 Botón "Ya renovó" (para pólizas vencidas y 30 días antes)

### 3. Renovación con Un Click

El botón "🔄 Renovar" permite:
- Confirmar renovación de una o múltiples pólizas
- Actualizar automáticamente `start_date` y `renewal_date` (+1 año)
- Marcar la notificación como leída
- Registrar la acción en `audit_logs`

## 📁 Archivos Creados/Modificados

### Nuevos Archivos

1. **`sql/renew-expired-policies.sql`**
   - Script SQL para actualizar pólizas vencidas masivamente
   - Incluye preview y verificación

2. **`src/app/(app)/api/policies/renew/route.ts`**
   - Endpoint POST para renovar una póliza individual
   - Valida datos y actualiza fechas sumando 1 año

3. **`src/app/(app)/api/policies/check-renewals/route.ts`**
   - Endpoint para ejecutar verificación de renovaciones
   - Puede ser llamado por cron job o manualmente

### Archivos Modificados

1. **`src/lib/notifications/renewals.ts`**
   - Agregada función `runExpiredAlert()` para pólizas vencidas
   - Actualizado tipo `alertType` para incluir `'expired'`
   - Agregado `show_renew_button` en metadata
   - Incluido `policy_id` en datos de policies

2. **`src/components/shell/NotificationsModal.tsx`**
   - Agregado botón "🔄 Renovar" condicional
   - Nueva prop `onRenewPolicy`
   - Estilos para `.renew-btn`

3. **`src/components/shell/NotificationsBell.tsx`**
   - Agregado handler `handleRenewPolicy`
   - Integración con API `/api/policies/renew`
   - Manejo de errores y toast notifications

## 🚀 Uso del Sistema

### Ejecutar SQL de Actualización Masiva (Una Vez)

```sql
-- 1. Ver preview de pólizas a actualizar
SELECT 
  id, policy_number, client_name,
  effective_date as vigencia_actual,
  renewal_date as renovacion_actual,
  effective_date + INTERVAL '1 year' as nueva_vigencia,
  renewal_date + INTERVAL '1 year' as nueva_renovacion
FROM policies
WHERE renewal_date < '2026-01-15'
  AND status = 'active'
ORDER BY renewal_date;

-- 2. Ejecutar actualización
UPDATE policies
SET 
  effective_date = effective_date + INTERVAL '1 year',
  renewal_date = renewal_date + INTERVAL '1 year',
  updated_at = NOW()
WHERE renewal_date < '2026-01-15'
  AND status = 'active';
```

### Verificación Manual de Renovaciones

```bash
# Verificar todas las categorías
curl -X POST http://localhost:3000/api/policies/check-renewals \
  -H "Content-Type: application/json" \
  -d '{"type": "all"}'

# Solo pólizas vencidas
curl -X POST http://localhost:3000/api/policies/check-renewals \
  -H "Content-Type: application/json" \
  -d '{"type": "expired"}'

# 30 días antes
curl -X POST http://localhost:3000/api/policies/check-renewals \
  -H "Content-Type: application/json" \
  -d '{"type": "30d"}'
```

### Renovar Póliza desde UI

1. El broker recibe una notificación con pólizas vencidas/próximas
2. Hace click en "Ver todas" en el dropdown de notificaciones
3. En el modal, aparece el botón "🔄 Renovar" para notificaciones con `show_renew_button: true`
4. Al hacer click, confirma la renovación
5. El sistema actualiza las fechas (+1 año) automáticamente

### Renovar Póliza desde API

```bash
curl -X POST http://localhost:3000/api/policies/renew \
  -H "Content-Type: application/json" \
  -d '{"policyId": "uuid-de-la-poliza"}'
```

## ⚙️ Configuración de Cron Job (Recomendado)

Para automatizar las verificaciones diarias, configurar un cron job o tarea programada:

### Opción 1: Cron en Linux/Mac

```bash
# Editar crontab
crontab -e

# Agregar líneas (ejecutar diariamente a las 8 AM)
0 8 * * * curl -X POST https://tu-dominio.com/api/policies/check-renewals -H "Content-Type: application/json" -d '{"type": "expired"}'
0 8 * * * curl -X POST https://tu-dominio.com/api/policies/check-renewals -H "Content-Type: application/json" -d '{"type": "30d"}'
0 8 * * * curl -X POST https://tu-dominio.com/api/policies/check-renewals -H "Content-Type: application/json" -d '{"type": "7d"}'
0 8 * * * curl -X POST https://tu-dominio.com/api/policies/check-renewals -H "Content-Type: application/json" -d '{"type": "0d"}'
```

### Opción 2: Vercel Cron (si está en Vercel)

Crear archivo `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/policies/check-renewals?type=expired",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/policies/check-renewals?type=30d",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/policies/check-renewals?type=7d",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/policies/check-renewals?type=0d",
      "schedule": "0 8 * * *"
    }
  ]
}
```

### Opción 3: GitHub Actions

Crear `.github/workflows/check-renewals.yml`:

```yaml
name: Check Policy Renewals
on:
  schedule:
    - cron: '0 8 * * *'  # Diariamente a las 8 AM UTC
  workflow_dispatch:  # Permite ejecución manual

jobs:
  check-renewals:
    runs-on: ubuntu-latest
    steps:
      - name: Check Expired Policies
        run: |
          curl -X POST ${{ secrets.APP_URL }}/api/policies/check-renewals \
            -H "Content-Type: application/json" \
            -d '{"type": "all"}'
```

## 📊 Estructura de Datos

### Notificación con Renovación

```typescript
{
  id: "uuid",
  notification_type: "renewal",
  title: "⚠️ PÓLIZAS VENCIDAS: 3 pólizas",
  body: "3 pólizas están vencidas. ¿Ya renovó?",
  meta: {
    alert_type: "expired",
    urgency: "critical",
    policies_count: 3,
    show_renew_button: true,
    policies: [
      {
        policy_id: "uuid-poliza-1",
        policy_number: "POL-12345",
        client_name: "Juan Pérez",
        renewal_date: "2025-11-21",
        insurer_name: "ASSA"
      },
      // ...más pólizas
    ]
  }
}
```

### Respuesta de Renovación

```typescript
{
  ok: true,
  data: {
    newStartDate: "2026-11-21",
    newRenewalDate: "2027-11-21"
  }
}
```

## ⚙️ Configuración de Notificaciones

### Campo `notify_broker_renewals` en Perfil del Broker

Este campo booleano en la tabla `profiles` controla si el Master recibe copia de las notificaciones 30 días antes:

```sql
-- Ver configuración actual de brokers
SELECT 
  p.full_name,
  p.email,
  p.notify_broker_renewals
FROM profiles p
WHERE p.role = 'broker'
ORDER BY p.full_name;

-- Habilitar notificación a master para un broker específico
UPDATE profiles
SET notify_broker_renewals = true
WHERE email = 'broker@example.com';

-- Deshabilitar
UPDATE profiles
SET notify_broker_renewals = false
WHERE email = 'broker@example.com';
```

**Casos especiales:**
- 🏢 **Broker "Oficina"** (`contacto@lideresenseguros.com`): Master SIEMPRE recibe notificaciones 30d, sin importar la configuración
- 👤 **Otros brokers**: Master solo recibe si `notify_broker_renewals = true`

## 🔒 Seguridad

- ✅ Solo usuarios autenticados pueden renovar pólizas
- ✅ Solo rol `master` puede ejecutar verificaciones masivas
- ✅ Confirmación obligatoria antes de renovar
- ✅ Registro de auditoría en `audit_logs`
- ✅ Validación de datos antes de actualizar

## 🧪 Testing

### Casos de Prueba

1. **Póliza vencida hace 1 mes**
   - ✅ Debe aparecer notificación con botón "Renovar"
   - ✅ Al renovar, debe actualizar fechas +1 año

2. **Póliza que vence en 30 días**
   - ✅ Debe generar notificación con botón "Renovar"
   - ✅ Puede renovarse anticipadamente

3. **Póliza que vence en 7 días**
   - ✅ Notificación urgente SIN botón renovar
   
4. **Póliza recién creada**
   - ✅ NO debe generar notificaciones

### Verificar Funcionamiento

```sql
-- Ver pólizas vencidas
SELECT id, policy_number, client_name, renewal_date
FROM policies
WHERE renewal_date < CURRENT_DATE
  AND status = 'ACTIVA'
ORDER BY renewal_date;

-- Ver audit logs de renovaciones
SELECT *
FROM audit_logs
WHERE action = 'POLICY_RENEWED'
ORDER BY created_at DESC
LIMIT 10;
```

## 📝 Notas Importantes

1. **Nombres de Columnas**
   - La tabla `policies` usa `start_date` y `renewal_date` (NO `effective_date`)
   - Verificar schema antes de ejecutar scripts

2. **Zona Horaria**
   - El sistema usa fechas locales de Panamá (UTC-5)
   - Las comparaciones son por fecha, no datetime

3. **Eliminación Automática**
   - A los 60 días de vencimiento, los clientes se marcan como `INACTIVO`
   - Las pólizas se marcan como `CANCELADA`
   - Es un "soft delete", no se eliminan físicamente

4. **Notificaciones Duplicadas**
   - El sistema usa `entityId` único para evitar duplicados
   - Formato: `renewal-{type}-{brokerId}-{renewalDate}`

## 🆘 Troubleshooting

### Problema: No aparece el botón "Renovar"

**Solución**: Verificar que:
- `meta.show_renew_button === true`
- `meta.policies` tenga al menos un elemento
- Cada policy tenga `policy_id` definido

### Problema: Error al renovar póliza

**Solución**: Verificar en consola del navegador y logs del servidor. Posibles causas:
- Póliza no encontrada
- Sin fecha de renovación
- Permisos insuficientes

### Problema: Notificaciones no se generan

**Solución**: Ejecutar manualmente el endpoint y verificar logs:
```bash
curl -X POST http://localhost:3000/api/policies/check-renewals \
  -H "Content-Type: application/json" \
  -d '{"type": "all"}'
```

## 📞 Soporte

Para preguntas o problemas:
1. Revisar logs en `audit_logs` tabla
2. Verificar estructura de `policies` tabla
3. Comprobar que cron job esté ejecutándose

---

**Última actualización**: Enero 15, 2026  
**Versión**: 1.0.0
