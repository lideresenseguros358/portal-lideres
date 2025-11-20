# Sistema de Notificaciones y Correos Automáticos
**Portal Líderes en Seguros**

## Medios de Comunicación
- **AMBAS**: Correo electrónico + Notificación en portal (campanita)
- **Notificación**: Solo campanita en portal
- **Correo**: Solo correo electrónico

## Configuración de Correos
- **From**: contacto@lideresenseguros.com
- **Branding**: Logo y colores corporativos (#010139, #8AAA19)
- **Contenido**: Información completa + botón "Ver Portal" con link directo

---

## 1. Comisiones - Quincena Pagada (AMBAS)

### Trigger
- Cuando se marca como PAID una quincena en `fortnights`

### Condiciones
- Solo notificar brokers donde:
  - NO se descontó el 100% de las comisiones generadas
  - NO se marcó como retenido

### Destinatarios
- Brokers involucrados en esa quincena

### Contenido Notificación
```
Título: "💵 Comisiones Pagadas - {período}"
Body: "Se han procesado los pagos de la quincena {período}. Revisa los detalles de tu pago."
```

### Contenido Email
- Resumen de comisiones pagadas
- Monto neto a recibir
- Detalle de deducciones (si aplica)
- Link directo a página de comisiones con filtro de quincena

---

## 2. Morosidad - Import Reportes (AMBAS)

### Trigger
- Cuando se hace import masivo de reportes de morosidad
- Cuando se marca "subir a todos"

### Detección de Brokers
- Por número de póliza → tabla `policies` → campo `broker_id`

### Contenido Notificación
```
Título: "⚠️ Nuevos Reportes de Morosidad"
Body: "Se han cargado {N} nuevos reportes de morosidad que afectan a tus clientes."
```

### Contenido Email
- Lista de clientes afectados
- Número de póliza
- Días de mora
- Monto en mora
- Link directo a página de morosidad con filtros

---

## 3. Pendientes/Trámites - Diario (AMBAS)

### Trigger
- Cron job diario (ya existe configuración de hora)

### Condiciones
- Solo si broker tiene casos pendientes activos
- NO notificar si todos están aplazados

### Contenido Notificación
```
Título: "📋 Tienes {N} Trámites Pendientes"
Body: "Recuerda completar los trámites pendientes de hoy."
```

### Contenido Email
- Lista de casos pendientes
- Cliente
- Tipo de trámite
- Fecha de creación
- Estado
- Link directo a página de casos

---

## 4. Agenda - Eventos (AMBAS)

### Trigger
- Cuando se crea evento nuevo
- Cuando se cambia fecha de evento

### Destinatarios
- Si NO hay brokers específicos seleccionados → TODOS los brokers
- Si hay brokers seleccionados → Solo esos brokers

### Contenido Notificación
```
Título: "📅 {Nuevo Evento / Evento Reprogramado}: {título}"
Body: "{Descripción del evento} - {Fecha}"
```

### Contenido Email
- Título del evento
- Descripción
- Fecha y hora
- Ubicación (si aplica)
- Brokers invitados
- Link directo a agenda

---

## 5. Renovaciones de Pólizas (AMBAS) ⭐ COMPLEJO

### Sistema de Alertas Escalonadas

#### 5.1. Primera Alerta: 30 Días Antes
**Destinatarios**: Broker propietario
**Acción**: Recordatorio de renovación próxima

**Notificación**:
```
Título: "🔔 Renovación Próxima: {cliente}"
Body: "{N} pólizas de tus clientes vencen en 30 días. Actualiza las fechas de renovación."
```

**Email**:
- Agrupar múltiples clientes con misma fecha
- Info completa: Cliente, Póliza, Aseguradora, Fecha vencimiento
- Botón "Actualizar Renovación" → Link a BD con filtro

#### 5.2. Segunda Alerta: 7 Días Antes
**Destinatarios**: Broker propietario
**Acción**: Recordatorio urgente

**Notificación**:
```
Título: "⚠️ URGENTE: Renovación en 7 Días - {cliente}"
Body: "¡Quedan solo 7 días! Actualiza la fecha de renovación."
```

#### 5.3. Tercera Alerta: Día de Vencimiento
**Destinatarios**: Broker propietario
**Acción**: Advertencia de eliminación

**Notificación**:
```
Título: "🚨 ÚLTIMA ADVERTENCIA: Póliza Vencida Hoy - {cliente}"
Body: "La póliza venció hoy. Si no actualizas en 60 días, el cliente será eliminado automáticamente."
```

#### 5.4. Cuarta Alerta: 60 Días Post-Vencimiento
**Destinatarios**: Master + Broker
**Acción**: Eliminación automática de cliente

**Notificación**:
```
Título: "❌ Cliente Eliminado por Vencimiento - {cliente}"
Body: "El cliente {nombre} fue eliminado automáticamente tras 60 días sin renovación."
```

### Toggle Master en Página Corredores

**Campo nuevo**: `receive_broker_renewal_notifications` (boolean en tabla `brokers`)

**Funcionalidad**:
- Si habilitado → Master recibe notificaciones 30d, 7d, 0d como si fuera el broker
- Si deshabilitado → Master solo recibe notificación de eliminación (60d)

**UI**: Toggle en cada fila de la tabla de corredores (solo visible para master)

---

## 6. Clientes Preliminares - Diario (SOLO NOTIFICACIÓN)

### Trigger
- Cron job diario

### Condiciones
- Solo si `preliminary_clients` > 0 para ese broker

### Contenido
```
Título: "📝 Tienes {N} Clientes en Preliminar"
Body: "Completa la información de {N} clientes para agregarlos a la base de datos."
```

**No envía email**, solo notificación en campanita.

---

## 7. Descargas y Guías - Actualización (SOLO NOTIFICACIÓN)

### Trigger
- Al crear/actualizar documento en tabla `downloads` o `guides`

### Contenido
```
Título: "📥 Nuevo Documento Disponible"
Body: "Se actualizó: {nombre_documento} en {sección}"
```

**No envía email**, solo notificación en campanita.

---

## Estructura de Tablas

### notifications
```sql
id: uuid
notification_type: enum (ampliar tipos)
target: 'MASTER' | 'BROKER' | 'ALL'
title: text
body: text
broker_id: uuid (nullable)
meta: jsonb
email_sent: boolean
created_at: timestamp
```

### notification_reads
```sql
id: uuid
notification_id: uuid
user_id: uuid (profile_id)
read_at: timestamp
```

### notification_uniques
```sql
id: uuid
hash: text (unique)
created_at: timestamp
```

### brokers (nuevo campo)
```sql
receive_broker_renewal_notifications: boolean DEFAULT false
```

---

## Nuevos Notification Types
Agregar a enum `notification_type`:
- `agenda_event` (nuevo evento o cambio de fecha)
- `preliminary_clients` (clientes en preliminar)
- `agent_carnet_renewal` (ya existe como carnet_renewal)

---

## Prioridades de Implementación

1. ✅ Base de notificaciones (ya existe)
2. 🔄 Templates de email
3. 🔄 Comisiones pagadas
4. 🔄 Import morosidad
5. 🔄 Agenda eventos
6. 🔄 Renovaciones (sistema complejo)
7. 🔄 Toggle master
8. 🔄 Clientes preliminares
9. 🔄 Descargas/guías
10. 🔄 Cron jobs

---

## Endpoints/Functions a Crear

### Server Actions
- `src/app/(app)/commissions/actions.ts` → `notifyCommissionPaid()`
- `src/app/(app)/morosidad/actions.ts` → `notifyDelinquencyImport()`
- `src/app/(app)/agenda/actions.ts` → `notifyEventChange()`
- `src/app/(app)/db/actions.ts` → `notifyRenewalsDue()`

### Cron Jobs
- `/api/cron/daily-cases` → Ampliar para casos pendientes
- `/api/cron/daily-renewals` → Nuevo: renovaciones
- `/api/cron/daily-preliminaries` → Nuevo: clientes preliminares

### Email Templates
- `src/lib/email/templates/CommissionPaidEmailTemplate.tsx` (ya existe)
- `src/lib/email/templates/DelinquencyUpdateEmailTemplate.tsx` (ya existe)
- `src/lib/email/templates/AgendaEventEmailTemplate.tsx` (nuevo)
- `src/lib/email/templates/RenewalEmailTemplate.tsx` (ya existe)

---

## Checklist de Implementación

- [ ] Migración SQL: Agregar tipos de notificación
- [ ] Migración SQL: Campo `receive_broker_renewal_notifications` en brokers
- [ ] Crear templates de email faltantes
- [ ] Integrar notificaciones en acciones de comisiones
- [ ] Integrar notificaciones en import de morosidad
- [ ] Integrar notificaciones en agenda
- [ ] Sistema completo de renovaciones (4 alertas)
- [ ] Toggle en página de corredores
- [ ] Cron job clientes preliminares
- [ ] Notificaciones descargas/guías
- [ ] Configurar cron jobs en Vercel
- [ ] Testing completo

