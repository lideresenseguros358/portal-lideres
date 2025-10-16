# 📧 INSTRUCCIONES DE IMPLEMENTACIÓN - SISTEMA DE NOTIFICACIONES

## ⚠️ IMPORTANTE: PASOS PREVIOS REQUERIDOS

Antes de poder compilar y usar el sistema de notificaciones, **DEBES** ejecutar estos pasos en orden:

### 1. Ejecutar Migración de Base de Datos

La migración SQL está en: `supabase/migrations/20251016_notifications_enhancements.sql`

**Opción A - Supabase CLI:**
```bash
supabase db push
```

**Opción B - Supabase Dashboard:**
1. Ve a tu proyecto en Supabase Dashboard
2. SQL Editor
3. Copia y pega el contenido de `20251016_notifications_enhancements.sql`
4. Ejecuta el script

Esta migración agrega:
- Enum `notification_type`
- Columnas `meta`, `email_sent`, `notification_type` a tabla `notifications`
- Tabla `notification_uniques` para idempotencia
- Columna `notify_broker_renewals` a tabla `profiles`

### 2. Actualizar Types de Base de Datos

**Opción A - Supabase CLI:**
```bash
npm run db:types
# o
supabase gen types typescript --local > src/lib/database.types.ts
```

**Opción B - Supabase Dashboard:**
1. Ve a API Docs → Types
2. Copia el TypeScript generado
3. Reemplaza el contenido de `src/lib/database.types.ts`

### 3. Configurar Variables de Entorno

Agrega a tu `.env.local`:

```env
# Resend API Key (obtener de https://resend.com)
RESEND_API_KEY=re_xxxxxxxxx

# Email de origen (debe estar verificado en Resend)
RESEND_FROM_EMAIL=Portal Líderes <no-reply@tudominio.com>
RESEND_REPLY_TO=soporte@tudominio.com

# Base URL del proyecto
NEXT_PUBLIC_BASE_URL=https://tudominio.com

# Cron Secret para Vercel (generar un string seguro)
CRON_SECRET=tu_secret_seguro_aqui
```

### 4. Crear Logo

Asegúrate de tener un logo en `public/logo.png` (usado en emails).

---

## 🚀 DESPUÉS DE LOS PASOS PREVIOS

Una vez completados los pasos 1-4, ahora sí puedes:

### 5. Verificar Tipos
```bash
npm run typecheck
```

### 6. Compilar
```bash
npm run build
```

### 7. Desplegar

Despliega a Vercel (los crons se configurarán automáticamente desde `vercel.json`).

---

## ✅ TESTING

### Probar Cron de Renovaciones

```bash
curl -X GET https://tudominio.com/api/cron/renewals-daily \
  -H "Authorization: Bearer TU_CRON_SECRET"
```

### Probar Cron de Digest

```bash
curl -X GET https://tudominio.com/api/cron/pending-digest \
  -H "Authorization: Bearer TU_CRON_SECRET"
```

### Probar Webhook de Comisiones

```bash
curl -X POST https://tudominio.com/api/hooks/commissions/paid \
  -H "Content-Type: application/json" \
  -d '{"quincena_id": "uuid-de-quincena"}'
```

### Probar Webhook de Morosidad

```bash
curl -X POST https://tudominio.com/api/hooks/delinquency/import-finished \
  -H "Content-Type: application/json" \
  -d '{"insurer_id": "uuid-aseguradora", "as_of_date": "2025-10-16"}'
```

### Probar Webhook de Descargas

```bash
curl -X POST https://tudominio.com/api/hooks/downloads/updated \
  -H "Content-Type: application/json" \
  -d '{"insurer_id": "uuid-aseguradora", "doc_id": "uuid-doc", "doc_name": "Formulario XYZ"}'
```

### Probar Webhook de Guías

```bash
curl -X POST https://tudominio.com/api/hooks/guides/updated \
  -H "Content-Type: application/json" \
  -d '{"guide_id": "uuid-guia", "section": "Procesos", "title": "Nueva Guía"}'
```

---

## 📋 USO DEL SISTEMA

### Campanita de Notificaciones

- Aparece en el navbar
- Muestra contador de no leídas
- Dropdown con últimas 5 notificaciones
- Click en notificación → navega a deep-link y marca como leída

### Modal de Notificaciones

- Botón "Ver todas" en el dropdown
- Tabla completa con:
  - Tipo (icono colorizado)
  - Título (link clickeable)
  - Mensaje
  - Fecha
  - Estado (Leída/No leída)
  - Acciones (Marcar leído, Borrar)

### Toggle de Renovaciones para Master

**Pendiente de implementar en UI de configuración de brokers:**

En la página de configuración de brokers, agregar toggle:
```tsx
<label>
  <input 
    type="checkbox" 
    checked={broker.notify_broker_renewals}
    onChange={(e) => updateBroker({ notify_broker_renewals: e.target.checked })}
  />
  Notificar al Master sobre renovaciones de este broker
</label>
```

---

## 🔧 INTEGRACIÓN EN TU CÓDIGO

### Llamar webhook de comisiones cuando se marca quincena como pagada:

```typescript
// En tu código de pago de quincena
await fetch('/api/hooks/commissions/paid', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ quincena_id: quincenaId })
});
```

### Llamar webhook de morosidad al finalizar import:

```typescript
// Después de importar archivo de morosidad
await fetch('/api/hooks/delinquency/import-finished', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    insurer_id: insurerId,
    as_of_date: '2025-10-16'
  })
});
```

### Llamar webhook de descargas al actualizar documento:

```typescript
// Cuando Master actualiza un documento en Descargas
await fetch('/api/hooks/downloads/updated', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    insurer_id: insurerId,
    doc_id: documentId,
    doc_name: 'Formulario ABC'
  })
});
```

### Llamar webhook de guías al actualizar:

```typescript
// Cuando Master actualiza una guía
await fetch('/api/hooks/guides/updated', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    guide_id: guideId,
    section: 'Procesos',
    title: 'Cómo hacer X'
  })
});
```

---

## 🐛 TROUBLESHOOTING

### Emails no se envían

1. Verifica que `RESEND_API_KEY` está configurada
2. Verifica que el email de origen está verificado en Resend
3. Revisa logs de Resend Dashboard

### Notificaciones duplicadas

- El sistema usa hashes para prevenir duplicados
- Si necesitas resetear: `DELETE FROM notification_uniques;`

### Crons no ejecutan

1. Verifica que `vercel.json` existe en la raíz
2. Verifica que el proyecto está desplegado en Vercel
3. En Vercel Dashboard → Settings → Cron Jobs (debe aparecer listado)
4. Verifica que `CRON_SECRET` está configurado en Vercel

### Errores de TypeScript antes de ejecutar migración

**ESTO ES NORMAL.** Los errores desaparecerán después de:
1. Ejecutar migración SQL
2. Actualizar database.types.ts

---

## 📊 MONITOREO

### Ver notificaciones enviadas:

```sql
SELECT 
  notification_type,
  COUNT(*) as total,
  SUM(CASE WHEN email_sent THEN 1 ELSE 0 END) as emails_sent
FROM notifications
GROUP BY notification_type;
```

### Ver hashes de idempotencia:

```sql
SELECT * FROM notification_uniques
ORDER BY created_at DESC
LIMIT 20;
```

### Limpiar hashes antiguos (ejecutar periódicamente):

```sql
SELECT cleanup_old_notification_hashes();
```

---

## 🎯 SIGUIENTES PASOS RECOMENDADOS

1. ✅ Ejecutar pasos previos (migración, types, env)
2. ✅ Compilar y desplegar
3. ✅ Probar cada endpoint manualmente
4. ✅ Integrar webhooks en tu código existente
5. ✅ Agregar toggle `notify_broker_renewals` en UI de configuración
6. ✅ Monitorear logs de Resend
7. ✅ Ajustar templates de email según feedback

---

**¡Sistema de notificaciones listo para usar!** 🎉
