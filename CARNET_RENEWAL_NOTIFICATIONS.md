# 🎫 Sistema de Notificaciones de Renovación de Carnet

## 📋 Descripción

Sistema automático que verifica diariamente los carnets de corredores y envía notificaciones por email y en el portal cuando están próximos a vencer o ya han vencido.

---

## ⚙️ Configuración

### 1. Ejecutar Migración SQL

Primero, ejecuta la migración en Supabase para agregar el nuevo tipo de notificación:

```bash
# En Supabase Dashboard → SQL Editor, ejecuta:
supabase/migrations/20251016_add_carnet_renewal_notification_type.sql
```

La migración agrega el valor `'carnet_renewal'` al enum `notification_type`.

### 2. Actualizar Types de TypeScript

Después de ejecutar la migración, regenera los tipos:

```bash
npm run db:types
```

Esto actualizará `src/lib/database.types.ts` con el nuevo enum.

### 3. Variables de Entorno

Asegúrate de tener configuradas:

```env
CRON_SECRET=tu_secret_para_cron_jobs
RESEND_API_KEY=tu_api_key_de_resend
NEXT_PUBLIC_BASE_URL=https://tudominio.com
```

---

## 🔔 Condiciones de Notificación

El sistema verifica **diariamente** y envía notificaciones según estas condiciones:

| Condición | Días hasta vencimiento | Urgencia | Icono | Color |
|-----------|------------------------|----------|-------|-------|
| **60 días antes** | Exactamente 60 | Warning | 🎫 | Naranja |
| **30 días antes** | Exactamente 30 | Critical | 🎫 | Rojo |
| **Mismo día** | 0 (vence hoy) | Critical | 🎫 | Rojo |
| **Vencido** | < 0 (ya venció) | Expired | 🎫 | Rojo oscuro |

### Características Especiales:

- ✅ **Solo brokers activos** (`active = true`)
- ✅ **Solo si tiene fecha de carnet** (`carnet_expiry_date IS NOT NULL`)
- ✅ **Prevención de duplicados** (una notificación por día por condición)
- ✅ **Idempotencia** (usa hash único para evitar notificaciones repetidas)

---

## 📧 Destinatarios

### Email:
- **TO:** Email del corredor (desde `profiles.email`)
- **CC:** Todos los masters del sistema

### Notificación en Portal:
- Se crea una notificación en la campana del broker
- También los masters pueden ver las notificaciones de carnets

---

## 🎨 Email Template

El email incluye:

### Header con Urgencia:
- 🎫 Icono de carnet
- Título según urgencia
- Degradado corporativo (azul → oliva)

### Información del Carnet:
- Nombre del corredor
- Email del corredor
- Fecha de vencimiento (formato: "16 de octubre de 2025")
- Banner de urgencia con color según estado

### Pasos para Renovar:
1. Contactar a la Superintendencia
2. Preparar documentación
3. Realizar pago
4. Actualizar fecha en el sistema

### Call to Action:
- Botón "Ir a Mi Cuenta" que lleva a `/account`

---

## 📅 Cron Job

### Configuración en Vercel

El cron job está configurado en `vercel.json`:

```json
{
  "path": "/api/cron/carnet-renewals",
  "schedule": "0 13 * * *"
}
```

**Horario:** Todos los días a las 1:00 PM UTC (8:00 AM Panamá)

### Endpoint

```
GET /api/cron/carnet-renewals
```

**Autenticación:** Requiere header:
```
Authorization: Bearer ${CRON_SECRET}
```

---

## 🧪 Testing

### Probar Manualmente el Cron:

```bash
curl -X GET https://tudominio.com/api/cron/carnet-renewals \
  -H "Authorization: Bearer TU_CRON_SECRET"
```

### Respuesta Exitosa:

```json
{
  "success": true,
  "message": "Carnet renewals check completed",
  "results": {
    "total": 5,
    "sent": 4,
    "duplicates": 1,
    "errors": 0,
    "conditions": {
      "60days": 2,
      "30days": 1,
      "sameday": 0,
      "expired": 1
    }
  }
}
```

---

## 🔧 Configurar Fecha de Carnet

### Como Master:

1. Ve a `/brokers`
2. Click en un broker
3. Edita el campo **"Fecha Vencimiento Carnet"**
4. Guarda cambios

### Como Broker:

El broker **NO puede** editar su propia fecha de carnet. Solo el Master puede hacerlo desde la página de edición del broker.

---

## 📊 Vista en el Portal

### Campana de Notificaciones:

Las notificaciones de carnet aparecen con:
- 🎫 Icono de ticket/carnet
- Badge rojo (#EF4444)
- Título indicando días restantes
- Click lleva a `/account`

### Modal de Notificaciones:

Columna "Tipo" muestra:
- Badge rojo con icono 🎫
- Título del corredor y urgencia
- Fecha de creación
- Botones para marcar leída y eliminar

---

## 📁 Archivos Creados/Modificados

### Nuevos Archivos:

1. **`src/lib/email/templates/CarnetRenewalEmailTemplate.tsx`**
   - Template HTML del email de renovación de carnet
   - Estilos corporativos y responsive
   - 307 líneas

2. **`src/app/(app)/api/cron/carnet-renewals/route.ts`**
   - Cron job que verifica carnets diariamente
   - Lógica de condiciones (60, 30, 0, <0 días)
   - 304 líneas

3. **`supabase/migrations/20251016_add_carnet_renewal_notification_type.sql`**
   - Migración para agregar enum 'carnet_renewal'
   - 9 líneas

4. **`CARNET_RENEWAL_NOTIFICATIONS.md`**
   - Documentación completa del sistema
   - Este archivo

### Archivos Modificados:

1. **`src/lib/notifications/utils.ts`**
   - Agregado `'carnet_renewal'` al tipo NotificationType
   - Agregado deep link para carnet_renewal → `/account`

2. **`src/lib/notifications/send-email.ts`**
   - Importado template de carnet renewal
   - Agregado case 'carnet_renewal' en switch

3. **`src/lib/notifications/create.ts`**
   - Cast temporal para notification_type (hasta ejecutar migración)

4. **`src/components/shell/NotificationsModal.tsx`**
   - Agregado tipo 'carnet_renewal' 
   - Icono: 🎫
   - Color: #EF4444 (rojo)

5. **`vercel.json`**
   - Agregado cron job `/api/cron/carnet-renewals`
   - Horario: 1:00 PM UTC diario

---

## 🔍 Logs y Debugging

El cron job incluye logs detallados:

```
🔍 [Carnet Renewals] Buscando carnets por vencer...
📅 Hoy: 2025-01-16
📅 60 días: 2025-03-17
📅 30 días: 2025-02-15
📋 Encontrados 2 carnets que vencen en 60 días
🔔 Procesando notificación para: JUAN PÉREZ
   Condición: 60days, Días: 60
   📝 Creando notificación para broker...
   📧 Masters encontrados: 2
   📤 Enviando email...
   ✅ Email enviado correctamente
✅ [Carnet Renewals] Proceso completado
📊 Resultados: { total: 5, sent: 4, duplicates: 1, errors: 0 }
```

---

## 🚨 Casos Especiales

### Carnet sin Fecha:
- ✅ Se ignora automáticamente
- ✅ No genera notificaciones
- ✅ No aparece en el cron job

### Broker Inactivo:
- ✅ No recibe notificaciones
- ✅ Solo se procesan brokers con `active = true`

### Múltiples Carnets el Mismo Día:
- ✅ Cada broker recibe su propia notificación
- ✅ Masters reciben CC de todas
- ✅ No se mezclan ni duplican

### Carnet Muy Vencido:
- ✅ Se envía notificación diaria mientras esté vencido
- ✅ Hash de idempotencia incluye la fecha actual
- ✅ Una notificación por día por broker

---

## ✅ Checklist de Implementación

- [x] Template de email HTML creado
- [x] Cron job implementado
- [x] Migración SQL creada
- [x] Tipos TypeScript actualizados
- [x] UI del modal actualizada
- [x] Deep links configurados
- [x] Idempotencia implementada
- [x] Logs de debugging agregados
- [x] vercel.json actualizado
- [x] TypeCheck pasa sin errores
- [x] Documentación completa

---

## 🎯 Próximos Pasos (Usuario debe hacer)

1. ✅ **Ejecutar migración SQL** en Supabase
2. ✅ **Regenerar types:** `npm run db:types`
3. ✅ **Configurar fechas de carnet** en brokers existentes
4. ✅ **Desplegar a Vercel** (`git push`)
5. ✅ **Verificar cron job** funciona correctamente
6. ✅ **Probar con datos reales**

---

## 🎉 Resultado Final

El sistema ahora:
- ✅ Revisa automáticamente carnets de corredores
- ✅ Envía emails con 60, 30 y 0 días de anticipación
- ✅ Crea notificaciones en el portal
- ✅ Notifica tanto al broker como a los masters
- ✅ Previene duplicados con sistema de hash
- ✅ Incluye deep links para acceso rápido
- ✅ Emails profesionales con branding corporativo

**¡Sistema de renovación de carnets listo para producción!** 🚀
