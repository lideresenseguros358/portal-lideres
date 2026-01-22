# INTEGRACIÓN DE CORREOS EN AGENDA

## Ubicación

Buscar endpoints de Agenda en:
- `/src/app/api/agenda/` (si existe)
- O donde se manejen eventos de calendario

---

## 1. Al crear evento

```typescript
import { notifyEventCreated } from '@/lib/email/agenda';

// Después de insertar el evento
const { data: newEvent } = await supabase
  .from('agenda_events')
  .insert({
    title: 'Reunión con cliente',
    description: 'Revisión de pólizas',
    event_date: '2026-02-15',
    event_time: '10:00',
    location: 'Oficina Central',
    attendees: ['user-id-1', 'user-id-2'],
    created_by: userId,
    needs_rsvp: true,
  })
  .select()
  .single();

if (newEvent) {
  // Enviar correos a todos los asistentes
  try {
    await notifyEventCreated(newEvent.id);
  } catch (emailError) {
    console.error('[AGENDA] Error sending creation notification:', emailError);
  }
}
```

---

## 2. Al actualizar evento

```typescript
import { notifyEventUpdated } from '@/lib/email/agenda';

// Después de actualizar el evento
const { data: updatedEvent } = await supabase
  .from('agenda_events')
  .update({
    event_time: '14:00', // Cambio de hora
    location: 'Oficina Norte', // Cambio de ubicación
  })
  .eq('id', eventId)
  .select()
  .single();

if (updatedEvent) {
  const changes = [
    { field: 'Hora', oldValue: '10:00', newValue: '14:00' },
    { field: 'Lugar', oldValue: 'Oficina Central', newValue: 'Oficina Norte' },
  ];
  
  try {
    await notifyEventUpdated(eventId, changes);
  } catch (emailError) {
    console.error('[AGENDA] Error sending update notification:', emailError);
  }
}
```

---

## 3. Al eliminar evento

```typescript
import { notifyEventDeleted } from '@/lib/email/agenda';

// ANTES de eliminar, obtener datos del evento
const { data: event } = await supabase
  .from('agenda_events')
  .select('*')
  .eq('id', eventId)
  .single();

// Obtener datos de asistentes
const { data: attendees } = await supabase
  .from('profiles')
  .select('id, full_name, email')
  .in('id', event.attendees || []);

// Eliminar el evento
await supabase
  .from('agenda_events')
  .delete()
  .eq('id', eventId);

// Notificar eliminación
try {
  await notifyEventDeleted(eventId, {
    event,
    attendees,
    deletedBy: 'Admin',
    reason: 'Cancelado por conflicto de horario',
    rescheduled: false,
  });
} catch (emailError) {
  console.error('[AGENDA] Error sending deletion notification:', emailError);
}
```

---

## 4. Recordatorios automáticos (Cron Job)

**Crear endpoint:** `/src/app/api/cron/agenda-reminders/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { sendEventReminders } from '@/lib/email/agenda';

export async function GET(request: NextRequest) {
  // Verificar autenticación del cron
  const cronSecret = request.headers.get('x-cron-secret');
  
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await sendEventReminders();
    
    return NextResponse.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[CRON] Error in agenda reminders:', error);
    
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Agregar a `vercel.json`:**

```json
{
  "crons": [
    {
      "path": "/api/cron/agenda-reminders",
      "schedule": "0 12 * * *"
    }
  ]
}
```

Esto enviará recordatorios diariamente a las 12:00 PM (Panamá) para eventos del día siguiente.

---

## Estructura de tabla `agenda_events` (ejemplo)

```sql
CREATE TABLE agenda_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME NOT NULL,
  location TEXT,
  attendees UUID[], -- Array de user IDs
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  needs_rsvp BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Testing

```bash
# Crear evento de prueba
curl -X POST https://portal.lideresenseguros.com/api/agenda/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Event",
    "event_date": "2026-02-15",
    "event_time": "10:00",
    "attendees": ["user-id-1"]
  }'

# Verificar que se envió el correo
# Revisar tabla email_logs en Supabase
```

---

**Nota:** Si el módulo de Agenda aún no existe, estos correos estarán listos para cuando se implemente.
