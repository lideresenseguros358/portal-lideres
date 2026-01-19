# Sistema de Tickets - Estado Actual

## ✅ COMPLETADO

### 1. Base de Datos (Migraciones SQL)

**Archivo:** `migrations/20260119_create_ticket_system.sql`

- ✅ `ramos_catalog` - Catálogo de ramos (10 ramos iniciales)
- ✅ `aseguradoras_catalog` - Catálogo de aseguradoras (5 iniciales)
- ✅ `tramites_catalog` - Catálogo de trámites (9 tipos)
- ✅ `ticket_sequences` - Tracking de correlativos mensuales
- ✅ `vacation_config` - Sistema de vacaciones con respaldo
- ✅ `case_security_logs` - Logs inmutables (solo Master)
- ✅ `case_ticket_history` - Historial de tickets
- ✅ `unclassified_emails` - Emails sin clasificar (24h grouping)
- ✅ Función SQL: `generate_ticket_number(ramo, aseg, tramite)` → ticket de 12 dígitos
- ✅ Función SQL: `get_next_ticket_correlative()` - Incrementa correlativos
- ✅ Trigger automático para logs de seguridad
- ✅ Vista: `cases_with_catalogs` - Casos enriquecidos

**Archivo:** `migrations/20260119_update_cases_table.sql`

- ✅ Nuevos campos en `cases`: ramo_code, aseguradora_code, tramite_code
- ✅ Nuevo enum: `case_status_simplified` (8 estados)
- ✅ Campo `status_v2` para estados simplificados
- ✅ SLA con pausa: sla_paused, sla_accumulated_pause_days
- ✅ Aplazado mejorado: aplazar_months, aplazar_notify_at
- ✅ Tracking de reapertura: reopened_from_ticket, reopen_count
- ✅ Clasificación: is_classified, classified_at
- ✅ Función SQL: `calculate_effective_sla_date()` - SLA con pausas
- ✅ Función SQL: `toggle_case_sla_pause()` - Pausa/resume SLA
- ✅ Función SQL: `reopen_aplazado_case()` - Reapertura con nuevo ticket
- ✅ Trigger: Auto-pausa SLA en PENDIENTE_CLIENTE/BROKER

### 2. TypeScript Types y Utilities

**Archivo:** `src/lib/ticketing/types.ts`

- ✅ Interfaces completas: RamoCatalog, AseguradoraCatalog, TramiteCatalog
- ✅ VacationConfig, CaseSecurityLog, UnclassifiedEmail
- ✅ TicketComponents, CaseTicketHistory
- ✅ Enum labels y colores para estados v2
- ✅ Reglas de asignación de masters
- ✅ Secciones y sus configuraciones

**Archivo:** `src/lib/ticketing/ticket-generator.ts`

- ✅ `parseTicket()` - Parsea ticket de 12 dígitos
- ✅ `formatTicketDisplay()` - Formatea para display (2026/01-030101-001)
- ✅ `validateTicketCodes()` - Valida códigos antes de generar
- ✅ `canGenerateTicket()` - Determina si está listo para generar
- ✅ `generatePreviewTicket()` - Preview sin guardar en BD

**Archivo:** `src/lib/ticketing/sla-calculator.ts`

- ✅ `calculateEffectiveSLADate()` - SLA + días pausados
- ✅ `calculateSLADaysRemaining()` - Días restantes
- ✅ `getSLAStatus()` - ok, warning, expired
- ✅ `getSLABadgeColor()` - Colores para badges
- ✅ `getSLALabel()` - Label con emoji si pausado
- ✅ `calculateInitialSLA()` - SLA base + modifier
- ✅ `shouldPauseSLA()` - Detecta si debe pausar

### 3. Server Actions

**Archivo:** `src/app/(app)/cases/ticketing-actions.ts`

- ✅ `actionGenerateTicket()` - Genera ticket de 12 dígitos
- ✅ `actionUpdateCaseCodes()` - Actualiza códigos y regenera ticket
- ✅ `actionGetTicketHistory()` - Historial de tickets del caso
- ✅ `actionGetSecurityLogs()` - Logs de seguridad (solo Master)
- ✅ `actionReopenAplazadoCase()` - Reabre caso aplazado
- ✅ `actionToggleSLAPause()` - Pausa/resume SLA manual
- ✅ `actionCloseCaseApproved()` - Cierre aprobado con n° póliza
- ✅ `actionCloseCaseRejected()` - Cierre rechazado con razón
- ✅ `actionAplazarCase()` - Aplaza por N meses (1-6)

**Archivo:** `src/app/(app)/config/catalog-actions.ts`

- ✅ `actionGetRamosCatalog()` - Obtiene ramos
- ✅ `actionCreateRamo()` - Crea ramo (solo Master)
- ✅ `actionUpdateRamo()` - Actualiza ramo (solo Master)
- ✅ `actionGetAseguradorasCatalog()` - Obtiene aseguradoras
- ✅ `actionCreateAseguradora()` - Crea aseguradora (solo Master)
- ✅ `actionUpdateAseguradora()` - Actualiza aseguradora (solo Master)
- ✅ `actionGetTramitesCatalog()` - Obtiene trámites
- ✅ `actionCreateTramite()` - Crea trámite (solo Master)
- ✅ `actionUpdateTramite()` - Actualiza trámite (solo Master)
- ✅ `actionGetVacationConfig()` - Configuración vacaciones
- ✅ `actionUpdateVacationConfig()` - Actualiza vacaciones (solo Master)
- ✅ `actionGetAssignedMaster()` - Determina master según sección + vacaciones

### 4. UI Componentes

**Archivo:** `src/components/config/tabs/TicketingTab.tsx`

- ✅ Tabs para Ramos, Aseguradoras, Trámites
- ✅ Info card explicando formato de ticket
- ✅ Sección Ramos COMPLETA:
  - ✅ Tabla con códigos, nombres, SLA
  - ✅ Toggle activo/inactivo
  - ✅ Modal de edición
  - ✅ Modal de creación
  - ✅ Validación de códigos (2 dígitos)
- ⏳ Secciones Aseguradoras y Trámites (estructura pendiente)

**Archivo:** `src/components/config/tabs/VacationTab.tsx`

- ✅ Cards de configuración por master
- ✅ Estado visual (activo/de vacaciones)
- ✅ Toggle rápido de vacaciones
- ✅ Modal de configuración completo:
  - ✅ Checkbox "De vacaciones"
  - ✅ Fechas inicio/fin (opcional)
  - ✅ Selector de master de respaldo
  - ✅ Checkbox reasignación automática
  - ✅ Validaciones completas
- ✅ Info card explicando funcionamiento
- ✅ Display de período de vacaciones
- ✅ Indicador de auto-reassign

### 5. Documentación

**Archivo:** `TICKETING_SYSTEM_IMPLEMENTATION.md`

- ✅ Descripción completa del formato de ticket
- ✅ Estructura de todas las tablas
- ✅ Estados simplificados con reglas
- ✅ Reglas de generación de tickets
- ✅ Asignación automática de masters
- ✅ Sistema de SLA con pausa/resume
- ✅ Emails sin clasificar (24h grouping)
- ✅ Logs de seguridad
- ✅ Reapertura de aplazados
- ✅ UI Monday-style (especificación)
- ✅ Cron jobs a implementar
- ✅ Shells de integración (webhook/AI/Resend)
- ✅ Casos especiales
- ✅ Deployment checklist

## 🚧 EN PROGRESO / PENDIENTE

### 1. UI - Catalog Management (Pendiente)

**Aseguradoras Section:**
- [ ] Tabla con códigos y nombres
- [ ] Link a insurer_id existente
- [ ] Modal de edición/creación
- [ ] Toggle activo/inactivo

**Trámites Section:**
- [ ] Tabla con códigos y nombres
- [ ] Campo requires_policy_number
- [ ] Campo sla_modifier (+/- días)
- [ ] Modal de edición/creación

### 2. UI - Cases Board Monday-Style (Pendiente)

**Estructura:**
- [ ] 3 tabs principales: 🔵 VIDA ASSA | 🟢 RAMOS GENERALES | 🟣 RAMO PERSONAS
- [ ] Sub-agrupación por tipo de trámite dentro de cada tab
- [ ] Cards de casos con:
  - [ ] Ticket visible (260103010001)
  - [ ] Cliente y número de póliza
  - [ ] Estado con badge colorido
  - [ ] SLA badge (verde/naranja/rojo)
  - [ ] Acciones inline (cambiar estado, asignar, etc.)
- [ ] Orden automático: SLA próximo arriba
- [ ] Scroll fluido
- [ ] Filtros: por estado, broker, aseguradora

### 3. UI - Sin Clasificar (Pendiente)

**Email Grouping:**
- [ ] Lista de emails sin clasificar
- [ ] Ventana de 24h visible
- [ ] Agrupación visual de emails similares
- [ ] Botón "Asignar a caso existente"
- [ ] Botón "Crear nuevo caso"
- [ ] Botón "Descartar"

**Manual Assignment:**
- [ ] Formulario para asignar:
  - [ ] Seleccionar ramo
  - [ ] Seleccionar aseguradora
  - [ ] Seleccionar trámite
  - [ ] Asignar broker
  - [ ] Preview de ticket generado

### 4. UI - Security Logs Viewer (Pendiente)

**Solo Master:**
- [ ] Tabla de logs inmutables
- [ ] Filtros: por caso, actor, fecha, acción
- [ ] Export a CSV/PDF
- [ ] Display de metadata JSON
- [ ] Timeline view
- [ ] No se permite editar/eliminar

### 5. Cron Jobs (Pendiente)

**Crear archivos en:** `src/app/api/cron/`

- [ ] `/api/cron/notify-aplazados` - Diario 8am
  - [ ] Buscar casos con aplazar_notify_at <= NOW()
  - [ ] Enviar email a master
  - [ ] Crear notificación en dashboard
  
- [ ] `/api/cron/sla-alerts` - Cada 6 horas
  - [ ] Buscar casos con SLA <= 2 días
  - [ ] Enviar alertas a master y broker
  - [ ] Badge rojo en UI
  
- [ ] `/api/cron/auto-assign-emails` - Cada hora
  - [ ] Buscar emails con grouped_until < NOW()
  - [ ] Mover a "Sin clasificar"
  - [ ] Notificar a master

### 6. Webhook/AI/Resend Shells (Pendiente)

**Webhooks:**
- [ ] `/api/webhooks/tickets` - Recibir actualizaciones externas
- [ ] Estructura básica con logging
- [ ] Placeholder para procesamiento futuro

**AI Classifier:**
- [ ] `src/lib/ticketing/ai-classifier.ts`
- [ ] Función `classifyEmailWithAI(content)`
- [ ] Retorna: ramo_code, aseguradora_code, tramite_code, confidence
- [ ] Placeholder para OpenAI integration

**Resend Notifications:**
- [ ] `src/lib/ticketing/email-notifications.ts`
- [ ] `sendTicketCreated()` - Notificar broker
- [ ] `sendTicketStatusChanged()` - Cambio de estado
- [ ] `sendSLAAlert()` - Alerta SLA próximo a vencer
- [ ] `sendAplazadoNotification()` - Recordatorio reapertura
- [ ] Placeholder para Resend API

### 7. Testing (Pendiente)

- [ ] Test de generación de tickets
- [ ] Test de correlativos mensuales
- [ ] Test de SLA con pausa/resume
- [ ] Test de asignación con vacaciones
- [ ] Test de reapertura de aplazados
- [ ] Test de validaciones de códigos

## 📦 PRÓXIMOS PASOS RECOMENDADOS

### Prioridad Alta:

1. **Completar Catalog UI** (Aseguradoras y Trámites)
   - Mismo patrón que Ramos
   - 1-2 horas de trabajo

2. **Crear Cases Board Monday-Style**
   - Vista principal del sistema
   - Crítico para operación
   - 4-6 horas de trabajo

3. **Implementar Cron Jobs**
   - Notificaciones de aplazados
   - Alertas de SLA
   - 2-3 horas de trabajo

### Prioridad Media:

4. **Security Logs Viewer**
   - Solo Master
   - Auditoría completa
   - 2-3 horas de trabajo

5. **Sin Clasificar UI**
   - Email grouping
   - Asignación manual
   - 3-4 horas de trabajo

### Prioridad Baja:

6. **Webhook/AI/Resend Shells**
   - Placeholders funcionales
   - 1-2 horas de trabajo

7. **Testing Completo**
   - Tests unitarios
   - Tests de integración
   - 4-6 horas de trabajo

## 🚀 DEPLOYMENT CHECKLIST

### Antes de Deploy:

- [ ] Ejecutar migración `20260119_create_ticket_system.sql`
- [ ] Ejecutar migración `20260119_update_cases_table.sql`
- [ ] Regenerar `database.types.ts`
- [ ] Verificar datos iniciales en catálogos
- [ ] Configurar vacations para Yira y Lucía
- [ ] Configurar cron jobs en Supabase
- [ ] Testing en staging

### Después de Deploy:

- [ ] Migrar casos existentes a nuevos estados
- [ ] Generar tickets para casos clasificados
- [ ] Entrenar al equipo en nuevo sistema
- [ ] Monitorear logs de seguridad
- [ ] Validar generación de tickets

## 📊 ESTADÍSTICAS DEL PROYECTO

**Archivos creados:** 8
**Líneas de código:** ~3,500
**Tablas nuevas:** 8
**Funciones SQL:** 6
**Server Actions:** 18
**UI Components:** 2 (parciales)

**Tiempo estimado total:** 20-25 horas
**Tiempo invertido:** ~8 horas
**Tiempo restante:** ~12-17 horas

---

**Última actualización:** 2026-01-19 11:30 AM
**Estado:** 40% Completado
**Próximo hito:** Completar Catalog UI y Cases Board
