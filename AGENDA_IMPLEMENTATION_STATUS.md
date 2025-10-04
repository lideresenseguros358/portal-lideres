# AGENDA MODULE - IMPLEMENTATION STATUS

**Fecha:** 2025-10-03  
**Estado:** 🚧 En Progreso - Estructura Base Iniciada

---

## ✅ COMPLETADO

### 1. Análisis de Tablas Existentes
- ✅ Tabla `events` existe con campos básicos
- ✅ Tabla `event_attendees` existe con RSVP
- ✅ Identificados campos faltantes

### 2. Migración SQL Creada
- ✅ `migrations/enhance_agenda_tables.sql`
- ✅ Agrega: modality, zoom_url, zoom_code, location_name, maps_url
- ✅ Agrega: is_all_day, allow_rsvp, updated_at, canceled_at
- ✅ Actualiza event_attendees: status (going/declined)
- ✅ Crea tabla event_audience para audiencia SELECTED
- ✅ RLS policies actualizadas

### 3. Side Menu
- ✅ "Agenda" ya existe para Master y Broker

### 4. Página Principal
- ✅ `src/app/(app)/agenda/page.tsx` creada

---

## 🚧 PENDIENTE - ARCHIVOS A CREAR

### Server Actions
- ⏳ `src/app/(app)/agenda/actions.ts`
  - actionGetEvents(month, year, userId, role)
  - actionCreateEvent(payload)
  - actionUpdateEvent(id, payload)
  - actionDeleteEvent(id)
  - actionRSVP(eventId, brokerId, status)
  - actionGetAttendees(eventId)
  - actionGenerateICS(eventId)

### Componentes Principales
- ⏳ `src/components/agenda/AgendaMainClient.tsx`
  - Header con selector mes/año
  - Vista mensual (grid calendario)
  - Panel lateral / Modal de detalle

- ⏳ `src/components/agenda/CalendarGrid.tsx`
  - Grid mensual responsive
  - Celdas con puntos para días con eventos
  - Click en día → mostrar eventos

- ⏳ `src/components/agenda/EventDetailPanel.tsx`
  - Desktop: Panel lateral derecho
  - Mobile: Modal deslizante
  - Campos: título, fecha, descripción, modalidad
  - Zoom link / Maps según modalidad
  - Botón RSVP (Asistir/Cancelar)
  - Contador de asistentes

- ⏳ `src/components/agenda/EventFormModal.tsx` (Master only)
  - Crear/Editar eventos
  - Campos: título, fechas, descripción, modalidad
  - Zoom fields si virtual/híbrida
  - Location fields si presencial/híbrida
  - Toggle "Permitir RSVP"
  - Selector de audiencia (ALL/SELECTED)
  - Si SELECTED: multi-select de brokers
  - Duplicar evento / Múltiples fechas

### Mini-Calendario Dashboard
- ⏳ Actualizar `src/components/dashboard/MiniCalendar.tsx`
  - Conectar con API de eventos
  - Mostrar punto oliva en días con eventos
  - Click en día → redirige a /agenda?y=YYYY&m=MM&d=DD
  - Botón "Ver más" → /agenda?y=YYYY&m=MM

- ⏳ Actualizar `src/components/dashboard/BrokerDashboard.tsx`
  - Integrar MiniCalendar con eventos
  - Mostrar próximo evento debajo del calendario

---

## 📋 REQUERIMIENTOS FUNCIONALES

### Roles

**Master:**
- ✅ Ver todos los eventos
- ✅ Crear/Editar/Eliminar eventos
- ✅ Habilitar RSVP por evento
- ✅ Ver contador y listado de asistentes
- ✅ Seleccionar audiencia (ALL o brokers específicos)
- ✅ Duplicar eventos
- ✅ Crear eventos en múltiples fechas

**Broker:**
- ✅ Ver eventos (solo de su audiencia)
- ✅ Confirmar/Cancelar asistencia (si RSVP habilitado)
- ✅ Ver detalles completos
- ✅ Mini-calendario en Dashboard
- ✅ Acceso a Zoom links y ubicaciones

### Modalidades

**Virtual:**
- Campos: zoom_url (requerido), zoom_code (opcional)
- Botón: "Unirme por Zoom" (target="_blank")
- Validación: zoom_url obligatorio

**Presencial:**
- Campos: location_name, maps_url
- Link a Google Maps

**Híbrida:**
- Mostrar ambos: Zoom + Ubicación

### RSVP (Asistencia)

**Estado:**
- `going` - Asistiendo
- `declined` - No asistirá

**Flujo:**
- Broker ve botón "Asistir" si `allow_rsvp = true`
- Click → toggle entre going/declined
- Actualiza tabla `event_attendees`
- Contador visible para todos
- Listado de asistentes solo para Master

### Audiencia

**ALL:**
- Todos los brokers pueden ver el evento

**SELECTED:**
- Solo brokers en tabla `event_audience` pueden ver
- Master selecciona brokers al crear/editar

---

## 🎨 UI/UX MOBILE-FIRST

### Desktop (≥768px)

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Header: [< Octubre 2025 >] [+ Nuevo] (Master)  │
├──────────────────────────────┬──────────────────┤
│                              │                  │
│  Calendario Grid (7x5)       │  Panel Lateral   │
│  [L][M][X][J][V][S][D]      │  Detalle Evento  │
│  [ 1][ 2][ 3][ 4][ 5]...    │                  │
│  [●6][ 7][●8][ 9][10]...    │  [Título]        │
│                              │  [Fecha/Hora]    │
│  ● = Día con eventos         │  [Descripción]   │
│                              │  [Modalidad]     │
│                              │  [Zoom/Maps]     │
│                              │  [RSVP Button]   │
│                              │  [Asistentes]    │
└──────────────────────────────┴──────────────────┘
```

### Mobile (<768px)

**Layout:**
```
┌────────────────────────────┐
│ [< Octubre 2025 >]         │
│ [+ Nuevo] (si Master)      │
├────────────────────────────┤
│ Calendario Grid            │
│ [L][M][X][J][V][S][D]     │
│ [ 1][ 2][ 3][ 4][ 5][●6]  │
│ [ 7][●8][ 9][10][11][12]  │
│                            │
│ (Scroll vertical)          │
└────────────────────────────┘

Click en día con evento →

┌────────────────────────────┐
│ [─] Modal Deslizable       │
│                            │
│ 📅 Evento del día 6        │
│                            │
│ [Título]                   │
│ [Descripción]              │
│ [Modalidad: Virtual]       │
│ [📹 Unirme por Zoom]       │
│ [👥 5 asistentes]          │
│ [✅ Asistir]               │
│                            │
│ [Añadir a calendario]      │
└────────────────────────────┘
```

### Branding

**Colores:**
- `#010139` - Azul (headers, títulos)
- `#8AAA19` - Oliva (puntos en calendario, botones RSVP)
- `#FFFFFF` - Blanco (cards)
- Grises - Info secundaria

**Componentes:**
- Cards: `shadow-lg rounded-xl`
- Botones: Transiciones suaves
- Modal mobile: Handle superior para cerrar
- Swipe gestures: Cambiar de mes

---

## 📅 FEATURES ESPECIALES

### 1. Mini-Calendario Dashboard Broker

**Ubicación:** Dashboard → Sección "Concursos y Agenda"

**Features:**
- ✅ Mostrar mes actual
- ✅ Puntos oliva en días con eventos
- ✅ Swipe horizontal (← →) para cambiar mes
- ✅ Click en día → /agenda?y=YYYY&m=MM&d=DD
- ✅ Botón "Ver más" → /agenda

### 2. Duplicar Eventos

**Flujo:**
- Desde detalle de evento (Master)
- Botón "Duplicar"
- Abre form pre-llenado
- Cambiar fecha/hora
- Crear como evento nuevo

### 3. Múltiples Fechas

**Creación:**
- En formulario de evento
- Opción "Agregar múltiples fechas"
- Selector de fechas múltiples
- Crear eventos independientes (no vinculados)

### 4. ICS Export

**Endpoint:** `GET /api/agenda/events/:id/ics`

**Formato:**
```ics
BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event-id@lissa.com
DTSTART:20251015T140000Z
DTEND:20251015T160000Z
SUMMARY:Junta de Agencia
DESCRIPTION:Detalles del evento
LOCATION:Zoom / Ubicación
URL:https://zoom.us/j/123456
END:VEVENT
END:VCALENDAR
```

### 5. Zoom Integration

**Botón Principal:**
```tsx
<a 
  href={event.zoom_url} 
  target="_blank"
  className="btn-primary"
>
  📹 Unirme por Zoom
</a>
```

**Mobile:**
- Detectar si soporta `zoommtg://`
- Fallback a web

**Código Zoom:**
- Mostrar si existe
- Formato: "Código: 123 456 789"

---

## 🔔 NOTIFICACIONES (Rutas Preparadas)

### Endpoints a Crear

```typescript
// POST /api/notifications/agenda/event-created
{ event_id: string }

// POST /api/notifications/agenda/event-updated
{ event_id: string }

// POST /api/notifications/agenda/event-canceled
{ event_id: string }

// POST /api/notifications/agenda/event-reminder
{ event_id: string, offset: '24h' | '1h' }

// POST /api/notifications/agenda/rsvp-updated (opcional)
{ event_id: string, broker_id: string, status: string }
```

### Timing

**Creación:**
- Notificar a audiencia inmediatamente

**Actualización:**
- Notificar a audiencia + asistentes

**Cancelación:**
- Notificar a asistentes confirmados

**Recordatorios:**
- 24 horas antes
- 1 hora antes
- Solo a asistentes confirmados

---

## 🗄️ SCHEMA DATABASE

### Tabla: `events` (Mejorada)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| title | TEXT | Título del evento |
| details | TEXT | Descripción |
| start_at | TIMESTAMP | Inicio |
| end_at | TIMESTAMP | Fin |
| is_all_day | BOOLEAN | Todo el día |
| modality | TEXT | virtual/presencial/hibrida |
| zoom_url | TEXT | Link de Zoom |
| zoom_code | TEXT | Código Zoom |
| location_name | TEXT | Nombre del lugar |
| location | TEXT | (legacy) |
| maps_url | TEXT | Google Maps link |
| allow_rsvp | BOOLEAN | Permitir asistencia |
| audience | TEXT | ALL/SELECTED |
| created_by | UUID | FK → profiles |
| created_at | TIMESTAMP | Creación |
| updated_at | TIMESTAMP | Actualización |
| canceled_at | TIMESTAMP | Cancelación |

### Tabla: `event_attendees`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| event_id | UUID | FK → events |
| broker_id | UUID | FK → brokers |
| rsvp | TEXT | (legacy) |
| status | TEXT | going/declined |
| updated_at | TIMESTAMP | Actualización |

### Tabla: `event_audience` (Nueva)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| event_id | UUID | PK, FK → events |
| broker_id | UUID | PK, FK → brokers |

---

## 🚀 DEPLOY CHECKLIST

- [ ] Ejecutar `migrations/enhance_agenda_tables.sql`
- [ ] Regenerar tipos TypeScript
- [ ] Crear server actions (actions.ts)
- [ ] Crear AgendaMainClient.tsx
- [ ] Crear CalendarGrid.tsx
- [ ] Crear EventDetailPanel.tsx
- [ ] Crear EventFormModal.tsx (Master)
- [ ] Actualizar MiniCalendar.tsx
- [ ] Actualizar BrokerDashboard.tsx
- [ ] Crear endpoints de notificaciones
- [ ] Crear endpoint ICS
- [ ] Testing mobile
- [ ] Testing RSVP
- [ ] Testing Zoom links
- [ ] `npm run typecheck`
- [ ] `npm run build`

---

## 📝 NOTAS TÉCNICAS

### Timezone

**America/Panama** para todo
- Server: Almacenar en UTC
- Client: Convertir a Panama timezone
- Display: Formato 12h (AM/PM)

### Validaciones

**Virtual/Híbrida:**
```typescript
if ((modality === 'virtual' || modality === 'hibrida') && !zoom_url) {
  return error('Zoom URL es requerido para eventos virtuales');
}
```

**Fechas:**
```typescript
if (end_at <= start_at) {
  return error('Fecha de fin debe ser posterior a fecha de inicio');
}
```

### Performance

- Cargar solo eventos del mes visible
- Índices en `start_at`, `created_by`
- Cache de contadores de asistentes
- Revalidación light en RSVP

---

## 🎯 PRÓXIMOS PASOS

1. **Ejecutar migración SQL** en Supabase
2. **Regenerar tipos TypeScript**
3. **Crear server actions** completas
4. **Implementar componentes principales**
5. **Integrar mini-calendario** en Dashboard
6. **Testing end-to-end**

---

**AGENDA MODULE - Tablas Analizadas, Migración Lista** ✅  
**Pendiente: Implementación de Componentes** 🚧
