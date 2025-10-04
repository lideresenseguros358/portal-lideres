# Roadmap de Refactorización: Módulo Agenda

**Fecha**: 2025-10-04  
**Alcance**: UX móvil, multi-fecha, timezone, virtualidad, uppercase  
**Estimación**: 8-12 horas de desarrollo + testing

---

## Estado Actual

### Archivos Identificados
1. `src/components/agenda/AgendaMainClient.tsx` (9.1 KB)
2. `src/components/agenda/CalendarGrid.tsx` (6.3 KB)
3. `src/components/agenda/EventDetailPanel.tsx` (15.5 KB)
4. `src/components/agenda/EventFormModal.tsx` (23.5 KB)
5. `src/components/config/tabs/AgendaTab.tsx` (configuración)

**Total**: ~54 KB de código (aprox. 1,500 líneas)

---

## Tareas Requeridas

### 1. **Swipe Mes a Mes en Móvil** (Complejidad: ALTA)
**Estimación**: 3-4 horas

**Componente afectado**: `CalendarGrid.tsx`

**Implementación**:
- [ ] Instalar/configurar librería de gestos (react-swipeable o framer-motion)
- [ ] Detectar swipe left/right en móvil (<640px)
- [ ] Animación de transición entre meses
- [ ] Actualizar estado del mes actual
- [ ] Precarga de datos del mes anterior/siguiente
- [ ] Indicadores visuales de swipe (feedback háptico simulado)

**Consideraciones**:
- Performance: evitar re-renders pesados
- Accesibilidad: mantener botones para usuarios sin touch
- Edge cases: primer/último mes disponible

---

### 2. **Modal de Evento: Eliminar X Duplicada** (Complejidad: BAJA)
**Estimación**: 15 minutos

**Componente afectado**: `EventDetailPanel.tsx`

**Implementación**:
- [ ] Identificar las 2 X (header y body)
- [ ] Remover una (probablemente la del body)
- [ ] Verificar que el cierre funciona correctamente

---

### 3. **Crear Evento: Grid Responsive** (Complejidad: MEDIA)
**Estimación**: 1-2 horas

**Componente afectado**: `EventFormModal.tsx`

**Implementación**:
- [ ] Refactorizar layout a grid responsive
- [ ] Grid 1col móvil (<640px), 2col desktop
- [ ] Aplicar `min-w-0` en inputs para prevenir overflow
- [ ] Inputs dentro del card (sin desbordes)
- [ ] Labels con tipografía consistente

---

### 4. **Corregir Guardado de Hora con Timezone** (Complejidad: ALTA)
**Estimación**: 2-3 horas

**Componente afectado**: `EventFormModal.tsx` + backend actions

**Problema actual**:
- Las horas se guardan sin considerar zona horaria
- Al leer desde BD, pueden mostrar hora incorrecta

**Implementación**:
- [ ] Determinar timezone del usuario (navigator.timeZone o config)
- [ ] Guardar datetime en UTC en la BD
- [ ] Convertir a local timezone al mostrar
- [ ] Usar `date-fns-tz` o `dayjs` con timezone plugin
- [ ] Validar que hora inicio < hora fin
- [ ] Tests con múltiples timezones (GMT-5, GMT+0, GMT+8)

**Patrón recomendado**:
```typescript
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';

// Al guardar
const utcDate = zonedTimeToUtc(localDate, 'America/Panama');

// Al leer
const localDate = utcToZonedTime(utcDate, 'America/Panama');
```

---

### 5. **Multifecha: Refactor UI** (Complejidad: ALTA)
**Estimación**: 2-3 horas

**Componente afectado**: `EventFormModal.tsx`

**UI actual** (asumiendo):
- Selector de rango de fechas complejo

**UI nueva**:
```tsx
┌─────────────────────────────────┐
│ FECHA DEL EVENTO                │
│ [2024-10-15]  [+ Agregar fecha] │
│                                 │
│ Fechas agregadas:               │
│ • 2024-10-15  [X]               │
│ • 2024-10-18  [X]               │
│ • 2024-10-22  [X]               │
└─────────────────────────────────┘
```

**Implementación**:
- [ ] Estado: `const [dates, setDates] = useState<string[]>([]);`
- [ ] Input type="date" + botón "+"
- [ ] Agregar fecha → validar no duplicada
- [ ] Lista ordenada automáticamente (sort)
- [ ] Botón [X] para eliminar fecha
- [ ] Validación: al menos 1 fecha
- [ ] Backend: aceptar array de fechas

---

### 6. **Modalidad Virtual con LINK LISSA** (Complejidad: MEDIA-ALTA)
**Estimación**: 2-3 horas

**Componentes afectados**: 
- `EventFormModal.tsx`
- `AgendaTab.tsx` (configuración)
- Backend: tabla de configuración

**Flujo**:

**6.1. Configuración (AgendaTab.tsx)**:
```tsx
<div>
  <label>LINK LISSA RECURRENTE</label>
  <input
    value={config.lissa_recurring_link}
    onChange={...}
    placeholder="https://meet.lissa.pa/sala-123"
  />
</div>

<div>
  <label>CÓDIGO REUNIÓN LISSA</label>
  <input
    value={config.lissa_meeting_code}
    onChange={...}
    placeholder="SALA-123"
  />
</div>
```

**6.2. Crear Evento (EventFormModal.tsx)**:
```tsx
<div>
  <label className="flex items-center gap-2">
    <input
      type="checkbox"
      checked={useLissaLink}
      onChange={(e) => {
        setUseLissaLink(e.target.checked);
        if (e.target.checked) {
          // Autocompletar con recurrentes
          setFormData({
            ...formData,
            virtual_link: config.lissa_recurring_link,
            meeting_code: config.lissa_meeting_code,
          });
        }
      }}
    />
    <span>USAR LINK LISSA RECURRENTE</span>
  </label>
</div>

{!useLissaLink && (
  <>
    <div>
      <label>LINK VIRTUAL MANUAL</label>
      <input
        value={formData.virtual_link}
        onChange={...}
      />
    </div>
    <div>
      <label>CÓDIGO REUNIÓN</label>
      <input
        value={formData.meeting_code}
        onChange={...}
      />
    </div>
  </>
)}
```

**Implementación**:
- [ ] Tabla `config_agenda` con campos link y código
- [ ] CRUD en AgendaTab.tsx
- [ ] Estado checkbox en EventFormModal
- [ ] Autocompletar al marcar checkbox
- [ ] Validación: si virtual, link obligatorio

---

### 7. **Normalización Uppercase** (Complejidad: BAJA)
**Estimación**: 1 hora

**Componentes afectados**: `EventFormModal.tsx`

**Campos a normalizar**:
- Título del evento
- Lugar/Ubicación
- Descripción (opcional, según preferencia)
- Notas

**Implementación**:
```tsx
import { createUppercaseHandler, uppercaseInputClass } from '@/lib/utils/uppercase';

<input
  onChange={createUppercaseHandler((e) => setFormData({ ...formData, title: e.target.value }))}
  className={`... ${uppercaseInputClass}`}
/>
```

**Labels**:
```tsx
<label className="block text-xs sm:text-sm font-semibold text-gray-600 mb-2 uppercase">
  Título del evento
</label>
```

---

## Testing Requerido

### Unit Tests
- [ ] Funciones de conversión timezone (UTC ↔ Local)
- [ ] Validación de fechas múltiples (no duplicadas, ordenadas)
- [ ] Autocompletado de LINK LISSA

### Integration Tests
- [ ] Crear evento single con uppercase → Verificar BD
- [ ] Crear evento multi-fecha → Verificar BD (array)
- [ ] Crear evento virtual con LINK LISSA → Verificar autocompletado
- [ ] Guardar hora → Verificar no se altera al leer

### E2E Tests
- [ ] Swipe left/right en móvil → Cambiar mes
- [ ] Crear evento en timezone GMT-5 → Verificar hora correcta
- [ ] RSVP a evento virtual → Verificar link visible
- [ ] Editar evento multi-fecha → Agregar/eliminar fechas

### Manual QA
**Resoluciones**:
- [ ] **360px**: Swipe funcional, inputs dentro del card
- [ ] **768px**: Grid 2 columnas, sin overflow
- [ ] **1024px**: Layout completo sin problemas

**Navegadores**:
- [ ] Chrome (swipe con mouse drag)
- [ ] Safari iOS (swipe táctil)
- [ ] Firefox

---

## Dependencias a Instalar

### NPM Packages
```bash
npm install react-swipeable       # Swipe gestures
npm install date-fns-tz           # Timezone handling
# O alternativamente:
npm install dayjs                 # Librería de fechas más ligera
npm install dayjs/plugin/timezone # Plugin timezone
```

---

## Orden de Implementación Recomendado

### Fase 1: Foundation (2-3 horas)
1. ✅ Normalización uppercase (rápido, base para todo)
2. ✅ Grid responsive (layout base)
3. ✅ Eliminar X duplicada (quick win)

### Fase 2: Core Features (4-5 horas)
4. ⏳ Timezone handling (crítico para datos correctos)
5. ⏳ Multi-fecha refactor (UX importante)
6. ⏳ LINK LISSA virtualidad (feature nueva)

### Fase 3: Polish (2-3 horas)
7. ⏳ Swipe gestures (nice to have)
8. ⏳ Testing exhaustivo
9. ⏳ QA en múltiples dispositivos

---

## Riesgos y Consideraciones

### Timezone Handling
**Riesgo ALTO**: Errores de timezone pueden causar eventos a horas incorrectas

**Mitigación**:
- Usar librería probada (date-fns-tz)
- Tests exhaustivos con múltiples zonas
- Documentar asunciones (¿todos en GMT-5?)

### Swipe Gestures
**Riesgo MEDIO**: Conflicto con scroll vertical en móvil

**Mitigación**:
- Detectar dirección de swipe (horizontal > vertical)
- Threshold mínimo (50px horizontal)
- Desactivar si hay scroll activo

### Multi-fecha Backend
**Riesgo MEDIO**: Cambio en estructura de datos

**Mitigación**:
- Verificar schema actual de tabla `events`
- Migración si es necesario (single date → array)
- Backward compatibility con eventos existentes

---

## Estimación Final

### Tiempo de Desarrollo
- **Mínimo**: 8 horas (sin imprevistos)
- **Realista**: 10 horas
- **Con buffer**: 12 horas

### Tiempo de Testing
- Unit/Integration: 2 horas
- E2E: 1 hora
- Manual QA: 2 horas

**Total**: 13-17 horas (2-3 días de trabajo)

---

## Estado Actual del Proyecto

### ✅ Completado Hoy (Sesión Extendida)
1. Base de Datos (Clientes/Aseguradoras)
2. Aseguradoras (Configuración)
3. Comisiones (Historial)
4. Cheques (DatePickers)
5. Morosidad (Importación)
6. Pendientes (Wizard)

**Total**: 6 módulos, 16 componentes con uppercase, 6 documentos de auditoría

### ⏳ Pendiente
7. **Agenda** (Este roadmap)

---

## Recomendaciones

### Opción A: Implementación Completa
**Pros**: Feature completa, UX mejorada significativamente  
**Contras**: 12-17 horas de trabajo adicional  
**Cuándo**: Si hay tiempo y equipo disponible

### Opción B: Implementación Parcial (Prioridades)
**Fase 1 solamente** (2-3 horas):
1. ✅ Uppercase (consistencia con otros módulos)
2. ✅ Grid responsive (evitar overflow)
3. ✅ Eliminar X duplicada

**Fase 2 como siguiente sprint**:
4. Timezone handling
5. Multi-fecha
6. LINK LISSA

**Fase 3 como nice-to-have**:
7. Swipe gestures

### Opción C: Solo Uppercase + Quick Fixes
**Estimación**: 1-2 horas  
**Incluye**:
- Uppercase en todos los inputs
- Grid responsive básico
- Eliminar X duplicada

**Excluye**:
- Swipe gestures
- Timezone refactor
- Multi-fecha UI
- LINK LISSA

---

## Próximos Pasos Inmediatos

Si decides proceder, el orden sería:

1. **Leer archivos actuales** (30 min)
   - EventFormModal.tsx
   - CalendarGrid.tsx
   - EventDetailPanel.tsx

2. **Decisión de scope** (10 min)
   - ¿Opción A, B o C?
   - ¿Cuánto tiempo disponible?

3. **Setup inicial** (20 min)
   - Instalar dependencias (react-swipeable, date-fns-tz)
   - Crear branch: `feature/agenda-refactor`

4. **Implementación según opción elegida**

---

**Conclusión**: El módulo Agenda es el más complejo de los 7 módulos identificados. Requiere trabajo significativo en UX, lógica de fechas, y features nuevas. Recomiendo dividir en fases y priorizar según urgencia.

**Estado**: 📋 Roadmap completo | ⏳ Awaiting decision on scope | 🎯 Ready to implement
