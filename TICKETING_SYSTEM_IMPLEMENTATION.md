# Sistema de Tickets - Guía de Implementación

## 📋 Resumen del Sistema

Este documento describe el nuevo sistema de tickets con codificación posicional de 12 dígitos para el portal de seguros Líderes.

## 🎯 Formato del Ticket

### Estructura de 12 dígitos numéricos:
```
[AAMM][RAMO][ASEG][TRAMITE][CORRELATIVO]
```

### Ejemplo:
```
260103010001
│││││││││└─── Correlativo: 001 (reinicia cada mes)
││││││└─────── Trámite: 01 (Emisión)
│││└─────────── Aseguradora: 01 (ASSA)
└─────────────── Fecha: 2601 (Enero 2026)
```

## 🗄️ Estructura de Base de Datos

### Tablas Principales

#### 1. `ramos_catalog`
Catálogo configurable de ramos/tipos de póliza.

```sql
- id: UUID
- code: VARCHAR(2) -- 01-99
- name: VARCHAR(100)
- description: TEXT
- sla_days_default: INT
- is_active: BOOLEAN
- display_order: INT
```

**Datos iniciales:**
- 01: Autos
- 02: Incendio
- 03: Vida
- 04: Multiriesgo
- 05: Responsabilidad Civil
- 06: Salud
- 07: Accidentes Personales
- 08: Transporte
- 09: Hogar
- 99: Otros

#### 2. `aseguradoras_catalog`
Catálogo configurable de aseguradoras.

```sql
- id: UUID
- code: VARCHAR(2) -- 01-99
- name: VARCHAR(100)
- short_name: VARCHAR(50)
- insurer_id: UUID (FK a insurers)
- is_active: BOOLEAN
- display_order: INT
```

**Datos iniciales:**
- 01: ASSA
- 02: SURA
- 03: ANCON
- 04: FEDPA
- 05: MAPFRE

#### 3. `tramites_catalog`
Catálogo configurable de tipos de trámite.

```sql
- id: UUID
- code: VARCHAR(2) -- 1-99
- name: VARCHAR(100)
- requires_policy_number: BOOLEAN
- sla_modifier: INT
- is_active: BOOLEAN
```

**Datos iniciales:**
- 1: Emisión
- 2: Renovación
- 3: Siniestro
- 4: Endoso
- 5: Cobro
- 6: Cotización
- 7: Cancelación
- 8: Rehabilitación
- 9: Cambio de Corredor

#### 4. `ticket_sequences`
Tracking de correlativos mensuales.

```sql
- year_month: CHAR(4) -- AAMM
- ramo_code: VARCHAR(2)
- aseguradora_code: VARCHAR(2)
- tramite_code: VARCHAR(2)
- last_correlative: INT
UNIQUE(year_month, ramo_code, aseguradora_code, tramite_code)
```

#### 5. `vacation_config`
Configuración de vacaciones con sistema de respaldo.

```sql
- master_email: VARCHAR(255)
- master_name: VARCHAR(255)
- is_on_vacation: BOOLEAN
- vacation_start: DATE
- vacation_end: DATE
- backup_email: VARCHAR(255)
- auto_reassign: BOOLEAN
```

#### 6. `case_security_logs`
Registro inmutable de todas las acciones (solo Master).

```sql
- case_id: UUID
- action_type: VARCHAR(50)
- actor_id: UUID
- actor_email: VARCHAR(255)
- field_changed: VARCHAR(100)
- old_value: TEXT
- new_value: TEXT
- metadata: JSONB
- created_at: TIMESTAMPTZ
```

**Importante:** Tabla inmutable con triggers que previenen UPDATE y DELETE.

#### 7. `case_ticket_history`
Historial de tickets generados por caso.

```sql
- case_id: UUID
- old_ticket: VARCHAR(12)
- new_ticket: VARCHAR(12)
- reason: VARCHAR(255)
- changed_by: UUID
- metadata: JSONB
```

#### 8. `unclassified_emails`
Emails sin clasificar con ventana de auto-agrupación de 24h.

```sql
- message_id: VARCHAR(255)
- from_email: VARCHAR(255)
- received_at: TIMESTAMPTZ
- grouped_until: TIMESTAMPTZ
- assigned_to_case_id: UUID
- status: VARCHAR(50)
- confidence_score: DECIMAL(3,2)
```

### Campos Nuevos en `cases`

```sql
-- Códigos de catálogo
ramo_code: VARCHAR(2)
aseguradora_code: VARCHAR(2)
tramite_code: VARCHAR(2)

-- Estado simplificado
status_v2: case_status_simplified

-- SLA con pausa/resume
sla_paused: BOOLEAN
sla_paused_at: TIMESTAMPTZ
sla_accumulated_pause_days: INT

-- Aplazado mejorado
aplazar_months: INT (1-6)
aplazar_notify_at: TIMESTAMPTZ

-- Reapertura
reopened_from_ticket: VARCHAR(12)
reopen_count: INT

-- Clasificación
is_classified: BOOLEAN
classified_at: TIMESTAMPTZ

-- Cierre
final_policy_number: VARCHAR(100)
```

## 📊 Estados Simplificados

### Enum: `case_status_simplified`

| Estado | Descripción | SLA Pausado |
|--------|-------------|-------------|
| `NUEVO` | Recién creado | No |
| `EN_PROCESO` | En trabajo activo | No |
| `PENDIENTE_CLIENTE` | Esperando cliente | **Sí** |
| `PENDIENTE_BROKER` | Esperando broker | **Sí** |
| `ENVIADO` | Enviado a aseguradora | No |
| `APLAZADO` | Temporalmente cerrado | N/A |
| `CERRADO_APROBADO` | Cerrado exitoso | N/A |
| `CERRADO_RECHAZADO` | Cerrado sin éxito | N/A |

### Reglas de Estados:

1. **NUEVO** → Se crea sin clasificar
2. **Sin clasificar** → NO genera ticket hasta tener ramo + aseguradora + trámite
3. **Clasificado** → Genera ticket automáticamente
4. **PENDIENTE_CLIENTE/BROKER** → Pausa SLA automáticamente
5. **APLAZADO** → Cierra temporalmente, requiere fecha de reapertura
6. **CERRADO_APROBADO** con emisión → Requiere número de póliza
7. **CERRADO_RECHAZADO** → Requiere razón (mínimo 10 caracteres)

## ⚙️ Reglas de Generación de Tickets

### Cuándo NO se genera ticket:
- Caso está en "Sin clasificar"
- Falta `ramo_code`
- Falta `aseguradora_code`
- Falta `tramite_code`

### Cuándo SÍ se genera ticket:
- Caso clasificado con todos los códigos
- Llamada a `generate_ticket_number()` SQL function
- Correlativo se incrementa automáticamente
- Se registra en `case_ticket_history`

### Cuándo se regenera ticket:
- Master cambia `ramo_code`
- Master cambia `aseguradora_code`
- Master cambia `tramite_code`
- Caso se reabre desde APLAZADO (opcional)

**Importante:** El ticket anterior permanece en historial, todo cambio es visible.

## 👥 Asignación Automática de Masters

### Reglas por Sección:

```typescript
RAMOS_GENERALES → yiraramos@lideresenseguros.com (Yira Ramos)
VIDA_ASSA → lucianieto@lideresenseguros.com (Lucía Nieto)
OTROS_PERSONAS → lucianieto@lideresenseguros.com (Lucía Nieto)
```

### Sistema de Vacaciones:

1. Master marca "De vacaciones" en configuración
2. Define fecha inicio y fin
3. Asigna email de backup
4. Si `auto_reassign = true` → casos se reasignan automáticamente al backup
5. Al regresar → puede recuperar casos o dejar en backup

### Emails Especiales (Master Override):

Si un correo llega desde:
- lucianieto@lideresenseguros.com
- yiraramos@lideresenseguros.com
- javiersamudio@lideresenseguros.com
- didimosamudio@lideresenseguros.com

**Flujo:**
1. Detectar broker asignado desde texto o CC
2. Si no se puede determinar → enviar a "Sin clasificar"
3. Master asigna manualmente

## ⏱️ Sistema de SLA con Pausa/Resume

### Cálculo de SLA:

```typescript
SLA Efectivo = SLA Base + SLA Modifier + Días Pausados Acumulados
```

**Ejemplo:**
- Ramo AUTO: SLA base 10 días
- Trámite Siniestro: Modifier +5 días
- Pausado por cliente: 3 días
- **SLA Efectivo: 18 días**

### Auto-Pausa por Estado:

```typescript
if (nuevo_estado === 'PENDIENTE_CLIENTE' || nuevo_estado === 'PENDIENTE_BROKER') {
  sla_paused = true
  sla_paused_at = NOW()
}
```

### Auto-Resume:

Al salir de estados de pendiente:
```typescript
dias_pausados = NOW() - sla_paused_at
sla_accumulated_pause_days += dias_pausados
sla_paused = false
```

### Función SQL:

```sql
SELECT calculate_effective_sla_date(case_id);
```

## 📧 Emails Sin Clasificar

### Ventana de Auto-Agrupación: 24 horas

```typescript
grouped_until = received_at + 24 hours
```

### Estados:
- `PENDING` → Esperando en ventana de 24h
- `GROUPED` → Agrupado automáticamente
- `ASSIGNED` → Asignado manualmente a caso
- `DISCARDED` → Descartado

### Proceso:

1. Email llega sin clasificar
2. Se guarda en `unclassified_emails`
3. Sistema intenta agrupar con emails similares (24h)
4. Pasado el tiempo → asignación manual desde UI "Sin clasificar"
5. Master decide qué hacer

## 🔒 Logs de Seguridad

### Eventos Registrados:

- `CASE_CREATED` → Caso creado
- `STATUS_CHANGED` → Cambio de estado
- `TICKET_GENERATED` → Ticket generado
- `TICKET_CHANGED` → Ticket regenerado
- `BROKER_ASSIGNED` → Broker asignado/cambiado
- `MASTER_ASSIGNED` → Master asignado/cambiado

### Metadata Capturada:

```json
{
  "action_type": "TICKET_GENERATED",
  "actor_email": "master@example.com",
  "actor_role": "master",
  "field_changed": "ticket_ref",
  "old_value": null,
  "new_value": "260103010001",
  "ip_address": "192.168.1.1",
  "created_at": "2026-01-19T10:30:00Z"
}
```

**Importante:**
- Solo Master puede ver estos logs
- NO se pueden editar ni eliminar (triggers)
- Separados del historial visible al broker

## 🔄 Reapertura de Casos Aplazados

### Función SQL:

```sql
SELECT reopen_aplazado_case(case_id, create_new_ticket);
```

### Parámetros:
- `create_new_ticket = true` → Genera nuevo ticket
- `create_new_ticket = false` → Mantiene ticket anterior

### Proceso:

1. Caso en estado `APLAZADO` llega a fecha de notificación
2. Cron job envía alerta a Master
3. Master decide:
   - ✅ Reabrir con nuevo ticket
   - ✅ Reabrir con ticket anterior
   - ❌ Confirmar cerrado definitivo

### Registro:

```typescript
reopen_count++ // Se incrementa contador
reopened_from_ticket = "260103010001" // Se guarda referencia
new_ticket = "260203010005" // Nuevo ticket generado
```

## 🎨 UI - Inspiración Monday

### Vista Principal:

```
┌─────────────────────────────────────────────┐
│ 🔵 VIDA ASSA (15)                           │
├─────────────────────────────────────────────┤
│ Por Tipo de Trámite:                        │
│                                             │
│ ┌─ Emisión (8) ──────────────────────┐    │
│ │ • Ticket 260103010001 - Cliente A  │    │
│ │ • Ticket 260103010002 - Cliente B  │    │
│ └───────────────────────────────────────┘    │
│                                             │
│ ┌─ Renovación (5) ───────────────────┐    │
│ │ • Ticket 260103020001 - Cliente C  │    │
│ └───────────────────────────────────────┘    │
│                                             │
│ ┌─ Siniestro (2) ────────────────────┐    │
│ │ • Ticket 260103030001 - Cliente D  │    │
│ └───────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### Características Monday-Style:

- ✅ Grupos por tipo de trámite
- ✅ Acciones inline (cambiar estado, asignar, etc.)
- ✅ Drag & drop entre estados (futuro)
- ✅ Colores por prioridad/SLA
- ✅ Badges visuales
- ✅ Scroll fluido
- ✅ Orden automático (plazo próximo arriba)

## 🤖 Automaciones (Cron Jobs)

### 1. Notificación de Aplazados

**Frecuencia:** Diaria 8:00 AM

```typescript
// Buscar casos con aplazar_notify_at <= NOW()
SELECT * FROM cases 
WHERE status_v2 = 'APLAZADO' 
AND aplazar_notify_at <= NOW()
```

**Acción:**
- Enviar email a Master
- Mostrar en dashboard
- Opciones: Reabrir / Cerrar definitivo

### 2. Alerta SLA Próximo a Vencer

**Frecuencia:** Cada 6 horas

```typescript
// Casos con SLA <= 2 días
SELECT * FROM cases 
WHERE calculate_effective_sla_date(id) <= NOW() + INTERVAL '2 days'
AND status_v2 NOT IN ('CERRADO_APROBADO', 'CERRADO_RECHAZADO', 'APLAZADO')
```

**Acción:**
- Notificación push
- Email a Master y Broker
- Badge rojo en UI

### 3. Auto-Asignación de Emails (24h)

**Frecuencia:** Cada hora

```typescript
// Emails que superaron ventana de 24h
SELECT * FROM unclassified_emails
WHERE grouped_until < NOW()
AND status = 'PENDING'
```

**Acción:**
- Mover a sección "Sin clasificar" en UI
- Alerta a Master para asignación manual

## 🔌 Shells de Integración (Placeholder)

### 1. Webhook Receiver

**Endpoint:** `/api/webhooks/tickets`

```typescript
export async function POST(request: Request) {
  // TODO: Implementar recepción de webhooks externos
  // Ejemplo: Aseguradoras que envían actualizaciones
  return NextResponse.json({ ok: true, message: 'Webhook placeholder' });
}
```

### 2. AI Classifier

**Función:** `classifyEmailWithAI(email)`

```typescript
export async function classifyEmailWithAI(emailContent: string) {
  // TODO: Implementar clasificación con IA
  // Ejemplo: OpenAI para detectar ramo, aseguradora, trámite
  return {
    ramo_code: '03',
    aseguradora_code: '01',
    tramite_code: '1',
    confidence: 0.85
  };
}
```

### 3. Resend Email Notifications

**Función:** `sendTicketNotification()`

```typescript
export async function sendTicketNotification(ticketId: string, type: string) {
  // TODO: Implementar envío de emails con Resend
  // Ejemplo: Notificar a broker cuando cambia estado
  return { ok: true };
}
```

## 📝 Casos Especiales

### Cambio de Corredor sin Póliza

**Problema:** Cliente quiere cambiar de corredor pero no tiene número de póliza.

**Solución:**
- Permitir crear caso sin `policy_number`
- Marcar como "Sin clasificar" temporalmente
- Master completa información cuando la obtiene
- Genera ticket cuando esté completo

### Correos Masivos

**Problema:** Correo con múltiples casos/clientes.

**Solución:**
- Guardar email original en `unclassified_emails`
- Master lo divide en casos individuales desde UI
- Cada caso referencia el email original
- Se mantiene thread_id para trazabilidad

## 🚀 Deployment

### 1. Ejecutar Migraciones

```bash
# En Supabase SQL Editor:
-- 1. Ejecutar 20260119_create_ticket_system.sql
-- 2. Ejecutar 20260119_update_cases_table.sql
```

### 2. Regenerar Types

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/database.types.ts
```

### 3. Verificar Datos Iniciales

```sql
SELECT * FROM ramos_catalog;
SELECT * FROM aseguradoras_catalog;
SELECT * FROM tramites_catalog;
SELECT * FROM vacation_config;
```

### 4. Configurar Cron Jobs

En Supabase → Database → Cron:

```sql
-- Notificaciones de aplazados (diaria 8am)
SELECT cron.schedule(
  'notify-aplazado-cases',
  '0 8 * * *',
  $$ SELECT notify_aplazado_cases() $$
);

-- Alertas SLA (cada 6 horas)
SELECT cron.schedule(
  'sla-alerts',
  '0 */6 * * *',
  $$ SELECT send_sla_alerts() $$
);
```

## 📚 Referencias

- **Migrations:** `/migrations/20260119_*.sql`
- **Types:** `/src/lib/ticketing/types.ts`
- **Utilities:** `/src/lib/ticketing/*.ts`
- **Actions:** `/src/app/(app)/cases/ticketing-actions.ts`
- **UI Config:** `/src/components/config/tabs/TicketingTab.tsx`

## ✅ Checklist de Implementación

- [x] Migraciones SQL creadas
- [x] Types TypeScript definidos
- [x] Utilities de ticket generation
- [x] Utilities de SLA calculation
- [x] Server actions para tickets
- [x] Server actions para catálogos
- [x] UI de configuración de catálogos (parcial)
- [ ] UI de configuración de vacaciones
- [ ] UI de casos simplificada (Monday-style)
- [ ] Cron jobs implementados
- [ ] Shells de webhook/AI/Resend
- [ ] Testing completo
- [ ] Documentación de usuario

---

**Última actualización:** 2026-01-19
**Versión:** 1.0
**Estado:** En desarrollo
