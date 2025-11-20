# Estado Actual del Sistema de Notificaciones
## Análisis Completo - Portal Líderes en Seguros

---

## ✅ LO QUE YA EXISTE Y FUNCIONA

### 1. Infraestructura Base

#### Tablas de Base de Datos
- ✅ `notifications` - Tabla principal de notificaciones
- ✅ `notification_reads` - Control de lectura por usuario
- ✅ `notification_uniques` - Prevención de duplicados
- ✅ `profiles.notify_broker_renewals` - Toggle para notificaciones (ya existe)

#### Sistema de Notificaciones
- ✅ `src/lib/notifications/create.ts` - Helper para crear notificaciones con idempotencia
- ✅ `src/lib/notifications/send-email.ts` - Helper para enviar emails
- ✅ `src/lib/notifications/utils.ts` - Utilidades (hash, deep-links, recipients)
- ✅ `src/lib/notifications/renewals.ts` - Lógica de renovaciones (BÁSICA, necesita expansión)

#### Cliente de Email (Resend)
- ✅ `src/lib/email/client.ts` - Cliente configurado
- ✅ From configurado: `Portal Líderes <no-reply@lideres.com>`
- ✅ Colores corporativos: #010139 (azul), #8AAA19 (oliva)

#### Templates de Email (YA CREADOS)
- ✅ `BaseEmailTemplate.tsx` - Template base con branding
- ✅ `CarnetRenewalEmailTemplate.tsx` - Renovación de carnet
- ✅ `CaseDigestEmailTemplate.tsx` - Resumen diario de casos
- ✅ `CommissionPaidEmailTemplate.tsx` - Comisiones pagadas (EXISTE!)
- ✅ `DelinquencyUpdateEmailTemplate.tsx` - Actualización morosidad (EXISTE!)
- ✅ `DownloadUpdateEmailTemplate.tsx` - Actualización descargas (EXISTE!)
- ✅ `GuideUpdateEmailTemplate.tsx` - Actualización guías (EXISTE!)
- ✅ `RenewalEmailTemplate.tsx` - Renovaciones de pólizas (EXISTE!)

#### Cron Jobs (YA CONFIGURADOS)
- ✅ `/api/cron/cases-daily-digest` - Resumen diario de casos
  - **YA INCLUYE:** Notificación de clientes preliminares
  - **YA NOTIFICA:** Casos pendientes, vencidos, en proceso
  - **YA TIENE:** Verificación de notify_broker_renewals
- ✅ `/api/cron/renewals` - Renovaciones (estructura base)
- ✅ `/api/cron/cases-reminders` - Recordatorios de casos
- ✅ `/api/cron/cases-cleanup` - Limpieza de casos

#### UI Componentes
- ✅ `NotificationsBell.tsx` - Campanita de notificaciones
- ✅ `NotificationsModal.tsx` - Modal de notificaciones

---

## 🔄 LO QUE NECESITA AJUSTES/EXPANSIÓN

### 1. Sistema de Renovaciones (EXPANDIR)

**Lo que ya está:**
- Cron job base en `/api/cron/renewals`
- Lógica básica en `renewals.ts`
- Template de email `RenewalEmailTemplate.tsx`

**Lo que falta:**
- ❌ Alertas escalonadas (30d, 7d, 0d)
- ❌ Notificación de eliminación (60d post-vencimiento)
- ❌ Agrupamiento de múltiples pólizas por fecha
- ❌ Eliminación automática tras 60 días
- ❌ Integración con toggle de master

### 2. Comisiones Pagadas (INTEGRAR)

**Lo que ya está:**
- Template de email `CommissionPaidEmailTemplate.tsx`
- Tipo de notificación 'commission' existe

**Lo que falta:**
- ❌ Integrar en action `actionMarkFortnight` cuando se marca PAID
- ❌ Filtrar brokers que NO tienen 100% descontado y NO están retenidos
- ❌ Enviar ambas (email + campanita)

### 3. Morosidad Import (INTEGRAR)

**Lo que ya está:**
- Template de email `DelinquencyUpdateEmailTemplate.tsx`
- Tipo de notificación 'delinquency' existe

**Lo que falta:**
- ❌ Integrar en action de import masivo de morosidad
- ❌ Detectar brokers por policy_number → policies.broker_id
- ❌ Enviar ambas (email + campanita)

### 4. Agenda/Eventos (CREAR)

**Lo que falta:**
- ❌ Template de email `AgendaEventEmailTemplate.tsx` (CREAR)
- ❌ Tipo de notificación 'agenda_event' (agregar a enum)
- ❌ Integrar en crear/editar eventos
- ❌ Lógica para brokers específicos vs todos

### 5. Descargas y Guías (INTEGRAR)

**Lo que ya está:**
- Template `DownloadUpdateEmailTemplate.tsx`
- Template `GuideUpdateEmailTemplate.tsx`
- Tipos 'download' y 'guide' existen

**Lo que falta:**
- ❌ Integrar en crear/actualizar documentos
- ❌ Solo campanita (NO email)

### 6. Toggle Master en Página Corredores (USAR EXISTENTE)

**Lo que ya está:**
- Campo `profiles.notify_broker_renewals` YA EXISTE
- Cron de casos diarios YA LO USA

**Lo que falta:**
- ❌ Mostrar UI toggle en página de corredores (solo master)
- ❌ Aplicar lógica en sistema de renovaciones

---

## 📋 TIPOS DE NOTIFICACIÓN - ESTADO

### Enum actual: `notification_type`
```typescript
'renewal'            ✅ Existe
'case_digest'        ✅ Existe  
'commission'         ✅ Existe
'delinquency'        ✅ Existe
'download'           ✅ Existe
'guide'              ✅ Existe
'carnet_renewal'     ✅ Existe
'other'              ✅ Existe
```

### Tipos a agregar:
```typescript
'agenda_event'       ❌ Agregar (eventos de agenda)
'preliminary_clients'❌ No necesario (ya se usa 'case_digest')
'renewal_30d'        ❌ No necesario (usar 'renewal' con meta)
'renewal_7d'         ❌ No necesario (usar 'renewal' con meta)
'renewal_0d'         ❌ No necesario (usar 'renewal' con meta)
'renewal_60d'        ❌ No necesario (usar 'renewal' con meta)
```

**Conclusión:** Solo agregar `'agenda_event'`

---

## 🎯 PLAN DE IMPLEMENTACIÓN OPTIMIZADO

### FASE 1: Ajustes Rápidos (30 min)
1. ✅ Actualizar enum para agregar 'agenda_event'
2. ✅ Verificar configuración de email (cambiar from a contacto@lideresenseguros.com)

### FASE 2: Integrar Notificaciones Existentes (2-3 horas)
3. 🔄 **Comisiones:** Integrar en actionMarkFortnight
4. 🔄 **Morosidad:** Integrar en import masivo
5. 🔄 **Descargas/Guías:** Integrar en crear/actualizar (solo campanita)

### FASE 3: Crear Notificaciones de Agenda (1-2 horas)
6. 🔄 Crear template `AgendaEventEmailTemplate.tsx`
7. 🔄 Integrar en crear/editar eventos

### FASE 4: Expandir Sistema de Renovaciones (4-6 horas)
8. 🔄 Implementar alertas escalonadas (30d, 7d, 0d)
9. 🔄 Implementar alerta de eliminación (60d)
10. 🔄 Agrupar pólizas por fecha
11. 🔄 Eliminación automática
12. 🔄 Integrar toggle de master

### FASE 5: UI Toggle Master (1 hora)
13. 🔄 Agregar toggle en página de corredores
14. 🔄 Conectar con profiles.notify_broker_renewals

### FASE 6: Testing y Ajustes (2 horas)
15. 🔄 Probar cada flujo
16. 🔄 Ajustar templates según necesidad
17. 🔄 Verificar cron jobs

---

## 🚀 NOTA IMPORTANTE

El cron de **casos diarios ya incluye notificación de clientes preliminares** (líneas 81-87):
```typescript
const { data: preliminares } = await supabase
  .from('policies')
  .select('id, policy_number')
  .eq('is_preliminary', true)
  .eq('created_by', broker.p_id);

const preliminaresCount = preliminares?.length || 0;
```

Y ya genera el mensaje en el email (línea 161-163):
```typescript
if (stats.preliminaresCount > 0) {
  parts.push(`\n📝 ${stats.preliminaresCount} preliminar(es) pendiente(s) de completar en BD`);
}
```

**Conclusión:** No necesitamos crear notificación separada para preliminares. ✅ Ya funciona.

---

## ⏱️ TIEMPO ESTIMADO TOTAL: 10-14 horas

Mucho más eficiente que las 15-22 horas originales gracias a la infraestructura existente.

