# GUÍA DE INTEGRACIÓN - SISTEMA DE CORREOS

Esta guía explica cómo integrar el sistema de correos en los módulos existentes del portal.

---

## 📦 PASO 1: Instalar Dependencias

```bash
npm install nodemailer luxon @types/nodemailer @types/luxon
```

---

## 🔧 PASO 2: Ejecutar Migración SQL

En Supabase SQL Editor, ejecutar:

```sql
-- Archivo: supabase/migrations/20260122000001_create_email_system.sql
```

Esto crea las tablas `email_logs` y `scheduled_jobs`.

---

## 📋 MÓDULO PENDIENTES

### Ubicación
- `src/app/api/pendientes/casos/[id]/route.ts` (UPDATE/PATCH endpoint)
- Otros lugares donde se crean/actualizan casos

### Integración

```typescript
import { 
  notifyCaseCreated, 
  notifyCaseUpdated,
  notifyCaseClosedApproved,
  notifyCaseClosedRejected,
  notifyCasePostponed
} from '@/lib/email/pendientes';

// Al crear caso
const { data: newCase } = await supabase.from('cases').insert(caseData).select().single();
if (newCase) {
  await notifyCaseCreated(newCase.id);
}

// Al actualizar caso
const { data: updatedCase } = await supabase.from('cases').update(updates).eq('id', caseId);
if (updatedCase) {
  await notifyCaseUpdated(caseId, [
    { field: 'Estado', oldValue: 'Nuevo', newValue: 'En proceso' }
  ]);
}

// Al cerrar caso (aprobado)
await notifyCaseClosedApproved(caseId, {
  closedBy: 'Juan Pérez',
  closedAt: new Date().toISOString(),
  notes: 'Póliza emitida exitosamente',
  resolutionTime: '2 días',
});

// Al cerrar caso (rechazado)
await notifyCaseClosedRejected(caseId, {
  closedBy: 'María López',
  closedAt: new Date().toISOString(),
  reason: 'Cliente no cumple requisitos',
  notes: 'Requiere documentación adicional',
});

// Al aplazar caso
await notifyCasePostponed(caseId, {
  aplazadoBy: 'Sistema',
  reason: 'Falta documentación del cliente',
});
```

---

## 📅 MÓDULO AGENDA

### Ubicación
- `src/app/api/agenda/*` (endpoints CRUD de eventos)

### Integración

```typescript
import { 
  notifyEventCreated,
  notifyEventUpdated,
  notifyEventDeleted
} from '@/lib/email/agenda';

// Al crear evento
const { data: newEvent } = await supabase.from('agenda_events').insert(eventData).select().single();
if (newEvent) {
  await notifyEventCreated(newEvent.id);
}

// Al actualizar evento
const { data: updatedEvent } = await supabase.from('agenda_events').update(updates).eq('id', eventId);
if (updatedEvent) {
  await notifyEventUpdated(eventId, [
    { field: 'Hora', oldValue: '10:00', newValue: '14:00' }
  ]);
}

// Al eliminar evento
// IMPORTANTE: Obtener datos ANTES de eliminar
const { data: event } = await supabase.from('agenda_events').select('*').eq('id', eventId).single();
const { data: attendees } = await supabase.from('profiles').select('*').in('id', event.attendees);

await supabase.from('agenda_events').delete().eq('id', eventId);

await notifyEventDeleted(eventId, {
  event,
  attendees,
  deletedBy: 'Admin',
  reason: 'Cancelado por conflicto de horario',
  rescheduled: false,
});
```

### Cron Job para Recordatorios

Ya está configurado en `vercel.json`, pero puedes crear el endpoint:

```typescript
// src/app/api/cron/agenda-reminders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sendEventReminders } from '@/lib/email/agenda';

export async function GET(request: NextRequest) {
  const cronSecret = request.headers.get('x-cron-secret');
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await sendEventReminders();
  return NextResponse.json({ success: true, ...result });
}
```

---

## 💰 MÓDULO COMISIONES

### Ubicación
- Endpoint que marca quincena como pagada
- Endpoint que aplica ajustes

### Integración

```typescript
import { sendEmail } from '@/server/email/sendEmail';
import { renderEmailTemplate } from '@/server/email/renderer';
import { generateDedupeKey } from '@/server/email/dedupe';

// Al marcar quincena como pagada
const { data: fortnight } = await supabase
  .from('fortnights')
  .update({ status: 'PAID' })
  .eq('id', fortnightId)
  .select()
  .single();

// Obtener broker
const { data: broker } = await supabase
  .from('brokers')
  .select('name, email')
  .eq('id', brokerId)
  .single();

const html = renderEmailTemplate('commissionPaid', {
  brokerName: broker.name,
  fortnightName: `Quincena ${fortnight.fortnight_number}`,
  startDate: fortnight.start_date,
  endDate: fortnight.end_date,
  totalAmount: fortnight.total_amount,
  paidDate: new Date().toISOString(),
  itemCount: fortnight.item_count,
  totalPremium: fortnight.total_premium,
  avgPercentage: fortnight.avg_percentage,
  portalUrl: process.env.APP_BASE_URL,
});

await sendEmail({
  to: broker.email,
  subject: `💰 Quincena pagada: ${fortnight.fortnight_number}`,
  html,
  fromType: 'PORTAL',
  template: 'commissionPaid',
  dedupeKey: generateDedupeKey(broker.email, 'commissionPaid', fortnightId),
  metadata: { fortnightId, brokerId },
});

// Al aplicar ajuste
const html2 = renderEmailTemplate('commissionAdjustmentPaid', {
  brokerName: broker.name,
  adjustmentType: 'Adelanto',
  amount: 500,
  paidDate: new Date().toISOString(),
  concept: 'Adelanto de quincena',
  description: 'Ajuste solicitado el 15/01/2026',
  portalUrl: process.env.APP_BASE_URL,
});

await sendEmail({
  to: broker.email,
  subject: `💵 Ajuste de comisión aplicado`,
  html: html2,
  fromType: 'PORTAL',
  template: 'commissionAdjustmentPaid',
  metadata: { adjustmentId, brokerId, amount: 500 },
});
```

---

## 📊 MÓDULO PRELIMINAR

### Ubicación
- Donde se detectan clientes incompletos

### Integración

```typescript
import { sendEmail } from '@/server/email/sendEmail';
import { renderEmailTemplate } from '@/server/email/renderer';

// Agrupar clientes incompletos por broker
const incompleteByBroker = new Map();

for (const client of incompleteClients) {
  if (!incompleteByBroker.has(client.broker_id)) {
    incompleteByBroker.set(client.broker_id, []);
  }
  incompleteByBroker.get(client.broker_id).push(client);
}

// Enviar un correo por broker
for (const [brokerId, clients] of incompleteByBroker) {
  const { data: broker } = await supabase
    .from('brokers')
    .select('name, email')
    .eq('id', brokerId)
    .single();

  const html = renderEmailTemplate('preliminarIncomplete', {
    brokerName: broker.name,
    incompleteCount: clients.length,
    clients: clients.map(c => ({
      name: c.name,
      missingFields: c.missing_fields.join(', '),
    })),
    portalUrl: process.env.APP_BASE_URL,
  });

  await sendEmail({
    to: broker.email,
    subject: `⚠️ ${clients.length} clientes con información incompleta`,
    html,
    fromType: 'PORTAL',
    template: 'preliminarIncomplete',
    metadata: { brokerId, count: clients.length },
  });
}
```

---

## 📈 MÓDULO MOROSIDAD

### Ubicación
- Endpoint que confirma importación de morosidad

### Integración

```typescript
import { sendEmail } from '@/server/email/sendEmail';
import { renderEmailTemplate } from '@/server/email/renderer';

// Después de importar morosidad
const delinquentByBroker = new Map();

for (const record of delinquentRecords) {
  if (!delinquentByBroker.has(record.broker_id)) {
    delinquentByBroker.set(record.broker_id, []);
  }
  delinquentByBroker.get(record.broker_id).push(record);
}

for (const [brokerId, records] of delinquentByBroker) {
  const { data: broker } = await supabase
    .from('brokers')
    .select('name, email')
    .eq('id', brokerId)
    .single();

  const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);

  const html = renderEmailTemplate('morosidadImported', {
    brokerName: broker.name,
    period: '2026-01',
    affectedCount: records.length,
    totalAmount,
    importDate: new Date().toISOString(),
    topDebtors: records
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map(r => ({ name: r.client_name, amount: r.amount })),
    portalUrl: process.env.APP_BASE_URL,
  });

  await sendEmail({
    to: broker.email,
    subject: `📊 Nueva importación de morosidad - ${records.length} clientes`,
    html,
    fromType: 'PORTAL',
    template: 'morosidadImported',
    metadata: { brokerId, count: records.length, totalAmount },
  });
}
```

---

## 🔄 RENOVACIONES CON CTA

### API Endpoint para Confirmar Renovación

Crear endpoint que se llama desde el botón del correo:

```typescript
// src/app/api/renewals/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const policyId = searchParams.get('policyId');
  const masterToken = searchParams.get('masterToken');

  if (!policyId || !masterToken) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Obtener póliza
  const { data: policy } = await supabase
    .from('policies')
    .select('*, clients(*), brokers(*)')
    .eq('id', policyId)
    .single();

  if (!policy) {
    return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
  }

  // Crear caso en Pendientes
  const { data: newCase } = await supabase
    .from('cases')
    .insert({
      ctype: 'RENOVACION',
      client_id: policy.client_id,
      client_name: policy.clients.name,
      broker_id: policy.broker_id,
      assigned_master_id: masterToken,
      policy_id: policyId,
      policy_number: policy.policy_number,
      ramo_code: policy.ramo,
      aseguradora_code: policy.insurer_id,
      premium: policy.premium,
      estado_simple: 'Nuevo',
      notes: `Renovación iniciada desde correo automático`,
      canal: 'CORREO',
    })
    .select()
    .single();

  if (!newCase) {
    return NextResponse.json({ error: 'Failed to create case' }, { status: 500 });
  }

  // Notificar creación
  await import('@/lib/email/pendientes').then(m => m.notifyCaseCreated(newCase.id));

  // Redirigir al portal
  return NextResponse.redirect(`${process.env.APP_BASE_URL}/pendientes?highlight=${newCase.id}`);
}
```

---

## ✅ Checklist de Integración

### Pendientes
- [ ] Agregar `notifyCaseCreated()` al crear caso
- [ ] Agregar `notifyCaseUpdated()` al actualizar caso
- [ ] Agregar `notifyCaseClosedApproved()` al cerrar aprobado
- [ ] Agregar `notifyCaseClosedRejected()` al cerrar rechazado
- [ ] Agregar `notifyCasePostponed()` al aplazar

### Agenda
- [ ] Agregar `notifyEventCreated()` al crear evento
- [ ] Agregar `notifyEventUpdated()` al actualizar evento
- [ ] Agregar `notifyEventDeleted()` al eliminar evento
- [ ] Crear endpoint `/api/cron/agenda-reminders`

### Comisiones
- [ ] Enviar correo al marcar quincena como pagada
- [ ] Enviar correo al aplicar ajuste

### Preliminar
- [ ] Enviar correo cuando hay clientes incompletos

### Morosidad
- [ ] Enviar correo al confirmar importación

### Renovaciones
- [ ] Crear endpoint `/api/renewals/confirm` para CTA

---

## 🧪 Testing

```bash
# Test SMTP
curl https://portal.lideresenseguros.com/api/test-email?type=portal
curl https://portal.lideresenseguros.com/api/test-email?type=tramites

# Test crons manualmente
curl -X GET "https://portal.lideresenseguros.com/api/cron/birthdays" \
  -H "x-cron-secret: YOUR_SECRET"
```

---

**Última actualización:** 22 de enero de 2026
