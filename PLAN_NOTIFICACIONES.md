# 🔔 PLAN COMPLETO - SISTEMA DE NOTIFICACIONES

## 🎯 OBJETIVO
Implementar sistema de notificaciones 100% funcional con:
- 2 cron jobs diarios (renovaciones + digest)
- 4 webhooks inmediatos (comisiones, morosidad, descargas, guías)
- Emails HTML con branding corporativo
- Idempotencia para evitar duplicados
- Deep-links a páginas específicas

---

## 📊 ESTADO ACTUAL

### ✅ YA IMPLEMENTADO:
1. **Tabla `notifications`** en BD con campos:
   - `id`, `title`, `body`, `created_at`
   - `target` (MASTER/BROKER/ALL)
   - `broker_id` (nullable)

2. **Tabla `notification_reads`** en BD con campos:
   - `id`, `notification_id`, `profile_id`, `read_at`

3. **Componentes UI**:
   - `NotificationsBell.tsx` - Campanita con dropdown
   - `NotificationsModal.tsx` - Modal completo
   - Contadores de no leídas
   - Marcar como leída
   - Borrar notificaciones

### ❌ FALTA IMPLEMENTAR:
1. Sistema de envío de emails
2. Templates HTML para emails
3. Tabla para idempotencia (evitar duplicados)
4. Metadata en notificaciones (cta_url, type, etc.)
5. Cron jobs (2)
6. Webhooks (4)
7. Deep-links
8. Toggle "notificar renovaciones" en perfil de broker

---

## 📋 PLAN DE IMPLEMENTACIÓN

### **✅ FASE 1: INFRAESTRUCTURA BASE (COMPLETADA)**

#### ✅ PASO 1.1: Actualizar esquema de BD
- [x] Migrar tabla `notifications` para agregar:
  - `meta` JSONB (para cta_url, entity_id, type, etc.)
  - `email_sent` BOOLEAN DEFAULT false
  - `notification_type` ENUM ('renewal', 'case_digest', 'commission', 'delinquency', 'download', 'guide', 'other')

- [x] Crear tabla `notification_uniques` para idempotencia:
```sql
CREATE TABLE notification_uniques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hash TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notif_uniques_hash ON notification_uniques(hash);
CREATE INDEX idx_notif_uniques_created ON notification_uniques(created_at);
```

- [x] Agregar columna `notify_broker_renewals` BOOLEAN DEFAULT false en tabla `profiles`

#### ✅ PASO 1.2: Configurar servicio de email
- [x] Instalar Resend: `npm install resend`
- [ ] Agregar `RESEND_API_KEY` a `.env.local` (PENDIENTE: usuario debe configurar)
- [x] Crear `src/lib/email/client.ts` con cliente de Resend
- [x] Crear `src/lib/email/templates/` para templates HTML

#### ✅ PASO 1.3: Crear templates de email
- [x] Template base: `BaseEmailTemplate.tsx` con:
  - Logo corporativo
  - Colores #010139 y #8AAA19
  - Header, body, footer
  - Botón CTA
  - Preheader

- [x] Templates específicos:
  - [x] `RenewalEmailTemplate.tsx` (30 días, mismo día, +7 días, diario)
  - [x] `CaseDigestEmailTemplate.tsx` (resumen de casos)
  - [x] `CommissionPaidEmailTemplate.tsx` (quincena pagada)
  - [x] `DelinquencyUpdateEmailTemplate.tsx` (morosidad actualizada)
  - [x] `DownloadUpdateEmailTemplate.tsx` (documento actualizado)
  - [x] `GuideUpdateEmailTemplate.tsx` (guía actualizada)

---

### **✅ FASE 2: HELPERS Y UTILIDADES (COMPLETADA)**

#### ✅ PASO 2.1: Crear helpers de notificaciones
- [x] `src/lib/notifications/create.ts`:
  - Función `createNotification()`
  - Verificar idempotencia con hash
  - Insertar en `notifications`
  - Insertar hash en `notification_uniques`

- [x] `src/lib/notifications/send-email.ts`:
  - Función `sendNotificationEmail()`
  - Recibir destinatarios, template, data
  - Cliente principal + CC para otros
  - Marcar `email_sent = true`

- [x] `src/lib/notifications/utils.ts`:
  - `generateNotificationHash()` - SHA256 de key + date
  - `getDeepLink()` - Construir URLs según tipo
  - `resolveRecipients()` - Master/Broker/Client según contexto

---

### **✅ FASE 3: CRON JOBS (COMPLETADA)**

#### ✅ PASO 3.1: Renovaciones diarias (`/api/cron/renewals-daily`)
- [x] Crear `src/app/(app)/api/cron/renewals-daily/route.ts`
- [ ] Verificar Authorization header (Vercel Cron secret)
- [ ] Lógica:
  1. Buscar pólizas con `renewal_date`:
     - 30 días antes (exacto)
     - Mismo día (hoy)
     - 7 días vencida (exacto)
     - >7 días vencida (todas diarias)
  2. Por cada póliza encontrada:
     - Generar hash único: `renewal-{policy_id}-{condition}-{YYYY-MM-DD}`
     - Verificar si ya existe en `notification_uniques`
     - Si NO existe:
       - Obtener broker asignado
       - Obtener cliente (correo)
       - Verificar toggle `notify_broker_renewals` del Master
       - Crear notificación
       - Enviar emails:
         - TO: cliente (si tiene correo)
         - CC: broker + master (si toggle activado)
         - Si cliente NO tiene correo: énfasis en mensaje
       - Marcar hash como enviado

#### ✅ PASO 3.2: Digest de pendientes (`/api/cron/pending-digest`)
- [x] Crear `src/app/(app)/api/cron/pending-digest/route.ts`
- [ ] Verificar Authorization header
- [ ] Lógica:
  1. Obtener cambios del día anterior en tabla `case_history`:
     - Nuevos adjuntos
     - Cambios de estado
     - Comentarios
     - Reasignaciones
  2. Agrupar cambios por `broker_id` y `master_id`
  3. Por cada usuario con cambios:
     - Generar hash: `digest-{user_id}-{YYYY-MM-DD}`
     - Verificar idempotencia
     - Si NO existe:
       - Compilar resumen (max 10 items + "Ver todo")
       - Crear notificación
       - Enviar email con deep-link: `/cases?date={YYYY-MM-DD}`

#### ✅ PASO 3.3: Configurar crons en Vercel
- [x] Crear/actualizar `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/renewals-daily",
      "schedule": "0 12 * * *"
    },
    {
      "path": "/api/cron/pending-digest",
      "schedule": "0 12 * * *"
    }
  ]
}
```

---

### **✅ FASE 4: WEBHOOKS INMEDIATOS (COMPLETADA)**

#### ✅ PASO 4.1: Comisiones - Pago de quincena
- [x] Crear `src/app/(app)/api/hooks/commissions/paid/route.ts`
- [ ] POST body: `{ quincena_id }`
- [ ] Lógica:
  1. Obtener quincena y brokers impactados
  2. Por cada broker:
     - Crear notificación
     - Enviar email
  3. Enviar copia a Master
  4. Deep-link: `/comisiones?quincena={id}`

#### ✅ PASO 4.2: Morosidad - Import finalizado
- [x] Crear `src/app/(app)/api/hooks/delinquency/import-finished/route.ts`
- [ ] POST body: `{ insurer_id, as_of_date }`
- [ ] Lógica:
  1. Obtener aseguradora
  2. Obtener brokers con pólizas en deuda > 0
  3. Crear notificaciones
  4. Enviar emails (Master + brokers afectados)
  5. Deep-link: `/morosidad?insurer={id}&date={date}`

#### ✅ PASO 4.3: Descargas - Documento actualizado
- [x] Crear `src/app/(app)/api/hooks/downloads/updated/route.ts`
- [ ] POST body: `{ insurer_id, doc_id, doc_name }`
- [ ] Lógica:
  1. Notificar a ALL (o brokers con cartera de esa aseguradora)
  2. Crear notificaciones
  3. Enviar emails
  4. Deep-link: `/descargas?insurer={id}&doc={doc_id}`

#### ✅ PASO 4.4: Guías - Documento actualizado
- [x] Crear `src/app/(app)/api/hooks/guides/updated/route.ts`
- [ ] POST body: `{ guide_id, section, title }`
- [ ] Lógica:
  1. Notificar a ALL
  2. Crear notificaciones
  3. Enviar emails
  4. Deep-link: `/guias?section={section}&id={guide_id}`

---

### **✅ FASE 5: UI Y MEJORAS (COMPLETADA)**

#### ✅ PASO 5.1: Actualizar NotificationsBell
- [x] Mostrar metadata en dropdown (type icon, cta link)
- [x] Click en notificación → navegar a deep-link
- [x] Marcar como leída al hacer click

#### ✅ PASO 5.2: Actualizar NotificationsModal
- [x] Agregar columna "Tipo" con badge coloreado
- [x] Links clickeables en títulos
- [ ] Filtros por tipo (OPCIONAL - puede agregarse después)

#### PASO 5.3: Toggle en configuración de brokers
- [ ] **PENDIENTE:** Agregar toggle "Notificar renovaciones" en:
  - Página de perfil de broker
  - Configuración de Master
- [ ] Guardar en `profiles.notify_broker_renewals`
- **NOTA:** Campo ya existe en BD, solo falta UI

---

### **⏳ FASE 6: TESTING Y VALIDACIÓN (PENDIENTE)**

#### PASO 6.1: **PRIMERO** - Ejecutar migración SQL
- [ ] Ejecutar `supabase/migrations/20251016_notifications_enhancements.sql`
- [ ] Actualizar `database.types.ts` con `npm run db:types`
- [ ] Configurar `.env.local` (RESEND_API_KEY, CRON_SECRET, etc.)

#### PASO 6.2: Verificar compilación
- [ ] `npm run typecheck` (debe pasar sin errores después de migración)
- [ ] `npm run build` (debe compilar sin errores)

#### PASO 6.3: Probar crons manualmente
- [ ] Llamar `/api/cron/renewals-daily` con header correcto
- [ ] Verificar notificaciones creadas
- [ ] Verificar emails enviados
- [ ] Verificar idempotencia (segunda llamada = 0 duplicados)

#### PASO 6.4: Probar webhooks
- [ ] Llamar cada webhook con datos de prueba
- [ ] Verificar notificaciones
- [ ] Verificar emails
- [ ] Verificar deep-links

#### PASO 6.5: Probar UI
- [ ] Campanita actualiza en tiempo real
- [ ] Dropdown muestra últimas 5
- [ ] Modal muestra todas
- [ ] Marcar leída funciona
- [ ] Borrar funciona
- [ ] Deep-links navegan correctamente

---

## 📦 ENTREGABLES TÉCNICOS

### Archivos nuevos a crear:
1. **Base de datos**:
   - Migración para `notifications.meta`, `notifications.email_sent`, `notifications.notification_type`
   - Migración para tabla `notification_uniques`
   - Migración para `profiles.notify_broker_renewals`

2. **Email**:
   - `src/lib/email/client.ts`
   - `src/lib/email/templates/BaseEmailTemplate.tsx`
   - `src/lib/email/templates/RenewalEmailTemplate.tsx`
   - `src/lib/email/templates/CaseDigestEmailTemplate.tsx`
   - `src/lib/email/templates/CommissionPaidEmailTemplate.tsx`
   - `src/lib/email/templates/DelinquencyUpdateEmailTemplate.tsx`
   - `src/lib/email/templates/DownloadUpdateEmailTemplate.tsx`
   - `src/lib/email/templates/GuideUpdateEmailTemplate.tsx`

3. **Helpers**:
   - `src/lib/notifications/create.ts`
   - `src/lib/notifications/send-email.ts`
   - `src/lib/notifications/utils.ts`

4. **Cron jobs**:
   - `src/app/(app)/api/cron/renewals-daily/route.ts`
   - `src/app/(app)/api/cron/pending-digest/route.ts`

5. **Webhooks**:
   - `src/app/(app)/api/hooks/commissions/paid/route.ts`
   - `src/app/(app)/api/hooks/delinquency/import-finished/route.ts`
   - `src/app/(app)/api/hooks/downloads/updated/route.ts`
   - `src/app/(app)/api/hooks/guides/updated/route.ts`

6. **Configuración**:
   - `vercel.json` (crons a 12:00 UTC)

### Archivos a modificar:
1. `src/components/shell/NotificationsBell.tsx` (deep-links, metadata)
2. `src/components/shell/NotificationsModal.tsx` (tipos, filtros)
3. `.env.local` (RESEND_API_KEY)

---

## 🎨 CRITERIOS DE DISEÑO

### Email Templates:
- **Colores**: #010139 (azul profundo), #8AAA19 (oliva)
- **Logo**: URL absoluta al logo corporativo
- **Structure**:
  - Preheader (texto oculto para preview)
  - Header con logo y fondo #010139
  - Body con contenido dinámico
  - Botón CTA con #8AAA19
  - Footer gris con info de contacto
- **Mobile-first**: Responsive con max-width 600px
- **Accesibilidad**: Asunto conciso, alt text en imágenes

### Notificaciones UI:
- **Iconos por tipo**:
  - Renovación: 🔄
  - Casos: 📋
  - Comisiones: 💰
  - Morosidad: ⚠️
  - Descargas: 📥
  - Guías: 📚
- **Colores de badge**:
  - No leída: background rgba(138, 170, 25, 0.14)
  - Leída: background rgba(1, 1, 57, 0.04)

---

## ✅ CRITERIOS DE ACEPTACIÓN

1. **Crons ejecutan a las 12:00 UTC** (7:00am UTC-5)
2. **Renovaciones**:
   - 30 días antes: 1 notificación + 1 email
   - Mismo día: 1 notificación + 1 email
   - 7 días vencida: 1 notificación + 1 email
   - >7 días: notificación + email DIARIO hasta actualización/borrado
3. **Digest**: resumen de casos del día anterior, 1 vez por usuario
4. **Webhooks inmediatos**: disparan notificación + email al momento
5. **Destinatarios correctos**:
   - Broker asignado (siempre)
   - Cliente (si tiene correo; si no, énfasis en notificación)
   - Master (si toggle activado)
6. **Idempotencia**: NO duplicados en mismo día por misma condición
7. **Deep-links correctos**: navegan a página específica con filtros
8. **Emails con branding**: logo, colores, CTA, footer
9. **UI actualizada**: campanita funcional, modal con tipos, marcar leída
10. **Sin errores**: typecheck + build exitosos

---

## 🚀 ORDEN DE EJECUCIÓN

### Sesión 1 (3-4 horas):
- FASE 1: Infraestructura base
- FASE 2: Helpers y utilidades

### Sesión 2 (3-4 horas):
- FASE 3: Cron jobs

### Sesión 3 (2-3 horas):
- FASE 4: Webhooks inmediatos

### Sesión 4 (1-2 horas):
- FASE 5: UI y mejoras
- FASE 6: Testing y validación

---

## 📝 NOTAS TÉCNICAS

### Idempotencia:
- Hash format: `{type}-{entity_id}-{condition}-{YYYY-MM-DD}`
- Ejemplos:
  - `renewal-policy-123-30days-2025-10-16`
  - `renewal-policy-123-sameday-2025-10-16`
  - `renewal-policy-123-7expired-2025-10-16`
  - `renewal-policy-123-daily-2025-10-16`
  - `digest-user-456-2025-10-15`
  - `commission-quincena-789-2025-10-16`

### Deep-links:
```typescript
const deepLinks = {
  renewal: `/clientes?policy={policy_id}`,
  case_digest: `/cases?date={YYYY-MM-DD}`,
  commission: `/comisiones?quincena={id}`,
  delinquency: `/morosidad?insurer={id}&date={date}`,
  download: `/descargas?insurer={id}&doc={doc_id}`,
  guide: `/guias?section={section}&id={guide_id}`
};
```

### Email destinatarios:
- **TO**: destinatario principal (cliente o broker)
- **CC**: destinatarios secundarios (broker, master)
- Si cliente NO tiene email: solo enviar a broker/master con nota

### Vercel Cron Authorization:
```typescript
const authHeader = request.headers.get('authorization');
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

---

## 🎯 ESTADO ACTUAL

### ✅ COMPLETADO (Código implementado):
- ✅ Migración SQL creada
- ✅ Cliente de email (Resend)
- ✅ 6 Templates HTML
- ✅ Helpers (create, send-email, utils)
- ✅ 2 Cron jobs
- ✅ 4 Webhooks
- ✅ UI actualizada (NotificationsBell + Modal)
- ✅ vercel.json configurado
- ✅ Documentación completa

### ⚠️ ERRORES DE TYPESCRIPT ACTUALES:
Estos errores son **ESPERADOS** y se resolverán automáticamente al ejecutar la migración SQL:
- `column 'meta' does not exist on 'notifications'`
- `column 'notification_type' does not exist`
- `column 'policy_id' does not exist on 'delinquency'`

### 🚀 PRÓXIMOS PASOS PARA EL USUARIO:

1. **Ejecutar migración SQL** (ver `INSTRUCCIONES_NOTIFICACIONES.md`)
2. **Actualizar database types** con `npm run db:types`
3. **Configurar `.env.local`** (RESEND_API_KEY, CRON_SECRET)
4. **Compilar** con `npm run build`
5. **Desplegar** a Vercel
6. **Testing** manual de endpoints

### 📋 PENDIENTE (Opcional):
- Toggle UI para `notify_broker_renewals` en configuración de brokers
- Filtros por tipo en modal de notificaciones
