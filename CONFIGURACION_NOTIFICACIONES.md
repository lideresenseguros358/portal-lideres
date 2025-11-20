# 📧 Sistema de Notificaciones y Correos Automáticos - Portal Líderes

## 📋 Resumen Ejecutivo

Sistema completo de notificaciones implementado con:
- ✅ Notificaciones en portal (campanita 🔔)
- ✅ Emails corporativos desde `contacto@lideresenseguros.com`
- ✅ Templates con branding corporativo (#010139, #8AAA19)
- ✅ Alertas escalonadas de renovación
- ✅ Eliminación automática de clientes vencidos
- ✅ Toggle master para recibir notificaciones de brokers

---

## 🎯 Tipos de Notificaciones Implementadas

### 1. **Comisiones Pagadas** 📊
**Trigger:** Al marcar quincena como "Pagada"  
**Destinatarios:** Brokers que reciben pago (no retenidos, no 100% descuento)  
**Canal:** Email + Campanita

**Contenido:**
- Monto neto a recibir
- Tabla con bruto, descuentos y neto
- Detalles de la quincena
- Link directo a `/comisiones`

**Archivo:** `src/app/(app)/commissions/actions.ts` → `actionPayFortnight` (líneas 2649-2714)

---

### 2. **Morosidad Import** ⚠️
**Trigger:** Al importar reporte de morosidad de aseguradora  
**Destinatarios:** Brokers afectados (detectados por `policy_number`)  
**Canal:** Email + Campanita

**Contenido:**
- Total en morosidad
- Tabla de hasta 10 clientes en mora
- Colores por días vencidos (90+, 61-90, 31-60, 1-30)
- Póliza, cliente, días mora, deuda
- Link directo a `/delinquency`

**Archivo:** `src/app/(app)/delinquency/actions.ts` → `actionImportDelinquency` (líneas 221-318)

---

### 3. **Descargas Actualizadas** 📥
**Trigger:** Webhook al actualizar documento en Descargas  
**Destinatarios:** Todos los usuarios (master + brokers)  
**Canal:** SOLO Campanita (NO email)

**Webhook:** `POST /api/hooks/downloads/updated`
```json
{
  "insurer_id": "uuid",
  "doc_id": "uuid",
  "doc_name": "Nombre del documento"
}
```

**Archivo:** `src/app/(app)/api/hooks/downloads/updated/route.ts`

---

### 4. **Guías Actualizadas** 📚
**Trigger:** Webhook al actualizar guía  
**Destinatarios:** Todos los usuarios (master + brokers)  
**Canal:** SOLO Campanita (NO email)

**Webhook:** `POST /api/hooks/guides/updated`
```json
{
  "guide_id": "uuid",
  "section": "Nombre de sección",
  "title": "Título de guía"
}
```

**Archivo:** `src/app/(app)/api/hooks/guides/updated/route.ts`

---

### 5. **Eventos de Agenda** 📅
**Trigger:** 
- Al crear evento nuevo
- Al cambiar fecha de evento existente

**Destinatarios:** 
- Todos los brokers (si audience = 'ALL')
- Brokers seleccionados (si audience = 'SELECTED')

**Canal:** Email + Campanita

**Contenido:**
- Título del evento
- Fecha, hora, ubicación
- Descripción
- Lista de invitados (si aplica)
- Tipo: "Nuevo Evento" o "Evento Reprogramado"
- Link directo a `/agenda`

**Archivos:** 
- `src/app/(app)/agenda/actions.ts` → `actionCreateEvent`, `actionUpdateEvent`
- Template: `src/lib/email/templates/AgendaEventEmailTemplate.tsx`

---

### 6. **Renovaciones de Pólizas** 🔄

Sistema de **alertas escalonadas** con 4 niveles:

#### **Nivel 1: 30 Días Antes** 🔔
**Frecuencia:** Diaria  
**Destinatarios:** Broker  
**Urgencia:** Normal  
**Mensaje:** "🔔 Renovación Próxima: X póliza(s)"

#### **Nivel 2: 7 Días Antes** ⚠️
**Frecuencia:** Diaria  
**Destinatarios:** Broker  
**Urgencia:** High  
**Mensaje:** "⚠️ URGENTE: Renovación en 7 Días"

#### **Nivel 3: Día de Vencimiento** 🚨
**Frecuencia:** Diaria  
**Destinatarios:** Broker  
**Urgencia:** Critical  
**Mensaje:** "🚨 ÚLTIMA ADVERTENCIA: Póliza(s) Vencida(s) Hoy"  
**Nota:** "Si no actualizas en 60 días, los clientes serán eliminados automáticamente"

#### **Nivel 4: 60 Días Post-Vencimiento** ❌
**Frecuencia:** Diaria  
**Destinatarios:** Broker + Master (SIEMPRE)  
**Urgencia:** Critical  
**Acción:** Eliminación automática (soft delete)  
**Mensaje:** "❌ Cliente(s) Eliminado(s) por Vencimiento"

**Proceso de Eliminación:**
- Marca clientes como `status = 'INACTIVO'`
- Marca pólizas como `status = 'CANCELADA'`
- Agrega nota con fecha y razón
- Notifica a broker Y master

**Canal:** Email + Campanita

**Archivos:**
- Lógica: `src/lib/notifications/renewals.ts`
- Cron: `src/app/api/cron/renewals/route.ts`
- Template: `src/lib/email/templates/RenewalEmailTemplate.tsx`

---

## 🎛️ Toggle Master: Recibir Notificaciones de Brokers

### Descripción
Permite a los masters recibir copias de las notificaciones de renovación de brokers específicos.

### Funcionamiento
- **Campo BD:** `profiles.notify_broker_renewals` (boolean)
- **Ubicación UI:** `/brokers` → Toggle en card de cada broker
- **Visible:** Solo para masters
- **Estados:**
  - 🔔 **ON** (verde): Master recibe notificaciones 30d, 7d, 0d
  - 🔕 **OFF** (gris): Master solo recibe notificación de eliminación (60d)

### Lógica
```typescript
// En todas las alertas:
const shouldNotifyMaster = alertType === '60d-delete' || notifyBrokerRenewals;

// Si toggle ON o es eliminación → Notificar master
if (shouldNotifyMaster) {
  // Enviar email + campanita a masters
  // Título: [MASTER] {alert.title} - Broker: {brokerName}
}
```

### Beneficio
Master puede supervisar renovaciones críticas de brokers específicos sin saturarse con todos.

---

## ⚙️ Configuración de Cron Jobs

### Requerido en Vercel (o Plataforma de Deploy)

#### 1. **Variables de Entorno**
```env
CRON_SECRET=tu_secreto_super_seguro_aqui
RESEND_API_KEY=re_tu_key_de_resend
RESEND_FROM_EMAIL=contacto@lideresenseguros.com
NEXT_PUBLIC_BASE_URL=https://portal.lideresenseguros.com
```

#### 2. **Endpoints de Cron Jobs**

##### **Renovaciones - 30 Días**
```
URL: https://portal.lideresenseguros.com/api/cron/renewals?days=30
Schedule: Diario a las 8:00 AM (0 8 * * *)
Headers: x-cron-secret: {CRON_SECRET}
```

##### **Renovaciones - 7 Días**
```
URL: https://portal.lideresenseguros.com/api/cron/renewals?days=7
Schedule: Diario a las 8:00 AM (0 8 * * *)
Headers: x-cron-secret: {CRON_SECRET}
```

##### **Renovaciones - Día de Vencimiento**
```
URL: https://portal.lideresenseguros.com/api/cron/renewals?days=0
Schedule: Diario a las 8:00 AM (0 8 * * *)
Headers: x-cron-secret: {CRON_SECRET}
```

##### **Renovaciones - Eliminación 60 Días**
```
URL: https://portal.lideresenseguros.com/api/cron/renewals?days=-60
Schedule: Diario a las 9:00 AM (0 9 * * *)
Headers: x-cron-secret: {CRON_SECRET}
```

##### **Digest Diario de Casos**
```
URL: https://portal.lideresenseguros.com/api/cron/cases-daily-digest
Schedule: Diario a las 7:00 AM (0 7 * * *)
Headers: x-cron-secret: {CRON_SECRET}
```

#### 3. **Configuración en Vercel**
```bash
# Desde el dashboard de Vercel:
Settings → Cron Jobs → Add Cron Job

# O usando vercel.json:
{
  "crons": [
    {
      "path": "/api/cron/renewals?days=30",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/renewals?days=7",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/renewals?days=0",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/renewals?days=-60",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/cases-daily-digest",
      "schedule": "0 7 * * *"
    }
  ]
}
```

---

## 📧 Templates de Email

Todos los templates incluyen:
- ✅ Header azul con gradiente (#010139 → #020252)
- ✅ Logo corporativo blanco (para fondos azules)
- ✅ Colores corporativos (#010139 azul, #8AAA19 oliva)
- ✅ Botón CTA "Ver en Portal" con link directo
- ✅ Footer con links a portal y soporte
- ✅ Responsive y bien estructurado
- ✅ Preheader para preview en cliente de email

### Templates Creados:
1. `CommissionPaidEmailTemplate.tsx` ✅
2. `DelinquencyUpdateEmailTemplate.tsx` ✅
3. `AgendaEventEmailTemplate.tsx` ✅
4. `RenewalEmailTemplate.tsx` ✅
5. `CaseDigestEmailTemplate.tsx` ✅
6. `DownloadUpdateEmailTemplate.tsx` ✅
7. `GuideUpdateEmailTemplate.tsx` ✅
8. `CarnetRenewalEmailTemplate.tsx` ✅

**Ubicación:** `src/lib/email/templates/`

---

## 🔐 Seguridad

### Headers de Seguridad
Todos los cron jobs validan el header `x-cron-secret`:
```typescript
const cronSecret = request.headers.get('x-cron-secret');
if (cronSecret !== process.env.CRON_SECRET) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### Idempotencia
Sistema de hash para prevenir notificaciones duplicadas:
```typescript
// Hash único por tipo + entidad + fecha
const hash = generateNotificationHash(type, entityId, condition, date);

// Si ya existe, no crea duplicado
const existing = await supabase
  .from('notifications')
  .select('id')
  .eq('hash', hash)
  .single();

if (existing) {
  return { success: true, isDuplicate: true };
}
```

---

## 🧪 Testing

### 1. Test Manual de Notificaciones

#### Comisiones:
```bash
# Marcar quincena como pagada desde /comisiones
# Verificar emails en brokers afectados
# Verificar campanita en portal
```

#### Morosidad:
```bash
# Importar archivo de morosidad desde /delinquency
# Verificar emails en brokers con clientes en mora
```

#### Renovaciones (Desarrollo):
```bash
# Ejecutar manualmente el cron:
curl -X GET "http://localhost:3000/api/cron/renewals?days=30" \
  -H "x-cron-secret: tu_secreto"

# Verificar logs en consola
# Verificar notificaciones en BD
# Verificar emails
```

### 2. Test de Templates
```bash
# Los templates se pueden previsualizar ejecutando:
npm run dev

# Y accediendo a (si implementas vista de preview):
http://localhost:3000/api/email-preview?type=commission
```

---

## 📊 Monitoreo

### Logs en Base de Datos
Tabla `audit_logs` registra todas las ejecuciones de crons:
```sql
SELECT * FROM audit_logs 
WHERE action = 'RENEWAL_NOTIFICATIONS'
ORDER BY created_at DESC 
LIMIT 10;
```

### Logs en Vercel
```bash
# Ver logs de cron jobs:
Vercel Dashboard → Functions → Cron Jobs → View Logs
```

### Métricas Importantes
- Brokers notificados por día
- Emails enviados vs fallidos
- Notificaciones duplicadas prevenidas
- Clientes eliminados automáticamente

---

## 🐛 Troubleshooting

### Emails no llegan
1. Verificar `RESEND_API_KEY` en variables de entorno
2. Verificar dominio verificado en Resend
3. Revisar logs de Resend dashboard
4. Verificar que email no esté en spam

### Notificaciones duplicadas
- Sistema de hash debe prevenir duplicados
- Si ocurren, revisar `generateNotificationHash` en `utils.ts`

### Cron no ejecuta
1. Verificar `CRON_SECRET` coincide
2. Verificar schedule en formato cron correcto
3. Revisar logs de Vercel Functions
4. Verificar timezone (Vercel usa UTC)

### Toggle no funciona
1. Verificar que usuario sea master
2. Verificar que campo `notify_broker_renewals` existe en profiles
3. Revisar consola del navegador para errores

---

## 📝 Checklist de Deploy

- [ ] Verificar todas las variables de entorno en producción
- [ ] Configurar cron jobs en Vercel
- [ ] Verificar dominio de email en Resend
- [ ] Test de cada tipo de notificación
- [ ] Verificar enlaces deep-link funcionan
- [ ] Test de eliminación automática en staging primero
- [ ] Documentar para equipo
- [ ] Capacitar a masters sobre toggle

---

## 🎓 Capacitación para Usuarios

### Para Masters:
1. **Toggle de Notificaciones:**
   - Ve a `/brokers`
   - Cada broker tiene un botón "Notif ON/OFF"
   - Verde = recibes copias de sus renovaciones
   - Gris = solo recibes avisos de eliminación

2. **Tipos de Emails:**
   - Comisiones: cuando pagas quincena
   - Morosidad: cuando importas reporte
   - Renovaciones: 30d, 7d, 0d, 60d automático
   - Agenda: cuando creas/cambias eventos

### Para Brokers:
1. **Campanita 🔔:**
   - Muestra todas tus notificaciones
   - Click para ver detalles
   - Link lleva a la página relevante

2. **Emails:**
   - Recibes de `contacto@lideresenseguros.com`
   - Incluyen detalles completos
   - Botón "Ver en Portal" para más info

---

## 📚 Referencias Técnicas

### Archivos Clave:
- Sistema base: `src/lib/notifications/create.ts`
- Envío email: `src/lib/notifications/send-email.ts`
- Utilidades: `src/lib/notifications/utils.ts`
- Renovaciones: `src/lib/notifications/renewals.ts`
- Cliente email: `src/lib/email/client.ts`

### Base de Datos:
- Tabla: `notifications`
- Campo toggle: `profiles.notify_broker_renewals`
- Logs: `audit_logs`

### Dependencias:
- `resend` - Envío de emails
- `@supabase/ssr` - Base de datos

---

## ✅ Estado del Sistema

**Versión:** 1.0.0  
**Fecha:** Noviembre 2024  
**Estado:** ✅ Completo y listo para producción

**Funcionalidades:**
- [x] Notificaciones de comisiones
- [x] Notificaciones de morosidad
- [x] Notificaciones de descargas (solo campanita)
- [x] Notificaciones de guías (solo campanita)
- [x] Notificaciones de agenda
- [x] Sistema de renovaciones escalonado
- [x] Eliminación automática 60 días
- [x] Toggle master para notificaciones
- [x] Templates con branding completo
- [x] Sistema de idempotencia
- [x] Logs y auditoría

**Próximas Mejoras (Opcional):**
- [ ] Panel de métricas de notificaciones
- [ ] Preferencias de usuario (silenciar tipos)
- [ ] Notificaciones push (PWA)
- [ ] Resumen semanal por email

---

**Documentado por:** Sistema de IA  
**Última actualización:** 2024-11-19
