# OPERACIONES — QA Checklist

> Documento interno para validación end-to-end de todos los módulos de Operaciones.
> Última actualización: auto-generado durante hardening.

---

## 1. RENOVACIONES

### 1.1 Inbox / Lista
- [ ] Carga la lista paginada (20 items por defecto)
- [ ] Scroll infinito o paginación funcional (siguiente página trae datos)
- [ ] Búsqueda por nombre de cliente, número de póliza o ticket
- [ ] Filtros por estado: pendiente, en_revision, en_proceso, aplazado, cerrado_renovado, cerrado_cancelado
- [ ] Filtro por SLA vencido muestra solo casos con `sla_breached = true`
- [ ] Filtro por "Sin primera respuesta" funciona correctamente
- [ ] Filtro por asignado (master) filtra correctamente
- [ ] Badges de conteo reflejan totales reales
- [ ] Skeleton loading aparece mientras carga

### 1.2 Detalle de Caso
- [ ] Click en caso muestra panel de detalle a la derecha
- [ ] Datos del caso: cliente, póliza, aseguradora, ramo, fecha renovación
- [ ] Banner SLA visible si `sla_breached = true`
- [ ] Barra de asignación muestra master actual o "Sin asignar"
- [ ] Botón de reasignación funcional (lista de masters carga)

### 1.3 Transiciones de Estado
- [ ] `pendiente → en_revision` ✅
- [ ] `en_revision → en_proceso` ✅
- [ ] `en_revision → aplazado` ✅
- [ ] `en_revision → cerrado_renovado` ✅
- [ ] `en_revision → cerrado_cancelado` (requiere motivo) ✅
- [ ] `en_proceso → cerrado_renovado` ✅
- [ ] `en_proceso → cerrado_cancelado` (requiere motivo) ✅
- [ ] `en_proceso → aplazado` ✅
- [ ] `aplazado → en_revision` ✅
- [ ] `aplazado → en_proceso` ✅
- [ ] `aplazado → cerrado_cancelado` ✅
- [ ] Transición inválida retorna error 400 con mensaje claro
- [ ] `cerrado_cancelado` sin motivo retorna error 400

### 1.4 Confirmar Renovación
- [ ] Acción `confirm_renewal` actualiza estado a `cerrado_renovado`
- [ ] `closed_at` se establece automáticamente
- [ ] Fechas de póliza se actualizan si `policy_id` proporcionado
- [ ] Log de actividad se registra

### 1.5 Cancelar Renovación
- [ ] Acción `cancel` requiere `cancellation_reason`
- [ ] Póliza se marca como inactiva si `policy_id` proporcionado

### 1.6 Historial
- [ ] Vista de historial (`view=history`) muestra cambios de estado con timestamps
- [ ] Before/after state visible en cada entrada

### 1.7 Notas
- [ ] Agregar nota funcional
- [ ] Nota se asocia correctamente al caso

---

## 2. PETICIONES

### 2.1 Inbox / Lista
- [ ] Carga la lista paginada con filtros
- [ ] Búsqueda por nombre, ticket, póliza, email
- [ ] Filtros por estado: pendiente, en_gestion, enviado, cerrado, perdido
- [ ] Filtro por ramo funcional
- [ ] Badges de conteo correctos

### 2.2 Transiciones de Estado
- [ ] `pendiente → en_gestion` ✅
- [ ] `en_gestion → enviado` ✅
- [ ] `en_gestion → perdido` ✅
- [ ] `enviado → cerrado` ✅
- [ ] `enviado → perdido` ✅
- [ ] Transición inválida retorna error 400
- [ ] `first_response_at` se marca al pasar a `en_gestion`

### 2.3 Crear Petición
- [ ] Acción `create` genera ticket único
- [ ] Campos requeridos validados: client_name, ramo
- [ ] Auto-asignación funcional si habilitada
- [ ] Log de actividad registrado

### 2.4 Historial y Notas
- [ ] Vista de historial funcional
- [ ] Notas CRUD funcional

---

## 3. URGENCIAS

### 3.1 Inbox / Lista
- [ ] Lista paginada con filtros de estado, severidad, SLA
- [ ] Búsqueda por nombre, ticket, categoría
- [ ] Filtro "hoy" muestra solo casos del día
- [ ] Badges de conteo correctos (incluye severidad)
- [ ] Dots de severidad (alta=rojo, media=amarillo, baja=verde)

### 3.2 Transiciones de Estado
- [ ] `pendiente → en_atencion` ✅
- [ ] `en_atencion → resuelto` ✅
- [ ] `en_atencion → cerrado` (requiere nota ≥10 chars) ✅
- [ ] `resuelto → cerrado` ✅
- [ ] Nota obligatoria cuando SLA vencido ✅
- [ ] Transición inválida retorna error 400 con transiciones permitidas

### 3.3 Crear Urgencia
- [ ] Acción `create` genera ticket
- [ ] Severidad (alta/media/baja) se asigna
- [ ] `chat_thread_id` enlace a ADM COT funcional

### 3.4 AI Evaluation
- [ ] Widget de IA muestra score, sentimiento, razonamiento
- [ ] Re-evaluación manual funcional
- [ ] Historial de evaluaciones visible

### 3.5 Deep Link a Chat
- [ ] Botón de enlace a chat ADM COT navega correctamente

---

## 4. MOROSIDAD

### 4.1 Dashboard
- [ ] Cards de resumen: al_día, atrasado, pago_recibido, cancelado
- [ ] Totales reflejan datos reales de `ops_morosidad_view`

### 4.2 Tabla
- [ ] Lista paginada con filtros de estado
- [ ] Búsqueda por nombre de cliente o número de póliza
- [ ] Ordenamiento por días de atraso (descendente)
- [ ] Badge de estado con colores correctos

### 4.3 Bulk Email
- [ ] Multi-select funcional
- [ ] Modal de envío masivo con plantilla
- [ ] Emails enviados via Zepto con merge
- [ ] Log de actividad para cada email enviado

### 4.4 Notas y Seguimiento
- [ ] Agregar nota a caso de morosidad
- [ ] Marcar seguimiento funcional

### 4.5 Notificaciones 30 días
- [ ] Casos con ≥30 días de atraso generan notificación portal
- [ ] No se duplican dentro de 7 días

---

## 5. EQUIPO / TEAM

### 5.1 Dashboard Métricas
- [ ] Cards de productividad por master
- [ ] Horas trabajadas, casos manejados, SLA breaches
- [ ] Datos diarios de `ops_metrics_daily`

### 5.2 Sesiones
- [ ] Session blocks registrados correctamente
- [ ] Inactividad cierra bloques automáticamente

### 5.3 Productividad
- [ ] Flags de baja productividad se detectan correctamente
- [ ] Umbral configurable desde ops_config

---

## 6. AUDITORÍA + EXPORT

### 6.1 Feed Unificado
- [ ] Muestra eventos de: ops_activity_log, ops_case_history, ops_notes, ops_ai_evaluations, ops_user_sessions, cron_runs
- [ ] Filtros por tipo de entidad, acción, usuario, rango de fechas
- [ ] Búsqueda textual funcional
- [ ] Quick pills (Hoy, 7d, 30d) funcionan
- [ ] Paginación funcional

### 6.2 Timeline de Caso
- [ ] Drawer de auditoría muestra timeline completo para un caso
- [ ] Diffs de before/after visibles
- [ ] Notas, evaluaciones IA, marcadores SLA incluidos

### 6.3 Export
- [ ] Export Excel genera archivo multi-sheet descargable
- [ ] Export PDF genera documento formateado
- [ ] Rate limiting funcional (no más de 1 export/min)
- [ ] Export se loguea en auditoría

---

## 7. CONFIGURACIÓN

### 7.1 Secciones
- [ ] Autoasignación: toggle on/off, método (equilibrado)
- [ ] SLA + Horarios: horas de primera respuesta por tipo
- [ ] Productividad: umbrales configurables
- [ ] Plantillas de Email: CRUD funcional
- [ ] IMAP: checkpoint visible, test de conexión
- [ ] IA: umbral de efectividad, modelo, activar/desactivar
- [ ] Retención/Exports: período de retención configurable
- [ ] Salud del Sistema: estado de crons, última ejecución, errores

### 7.2 Guardado
- [ ] Cambios se guardan con diff logging
- [ ] `updated_by` se registra correctamente

---

## 8. CRON JOBS

### 8.1 ops-imap-sync (cada 1 min)
- [ ] Ejecuta sincronización IMAP
- [ ] Advisory lock impide ejecución concurrente
- [ ] Heartbeat en `cron_runs` (started_at, finished_at, status, processed_count)
- [ ] Errores de IMAP se loguean pero no crashean el cron
- [ ] Cooldown de 30s respetado

### 8.2 ops-sla-check (cada 6h)
- [ ] Marca `sla_breached = true` para casos que exceden SLA
- [ ] Renovaciones/Peticiones: 48h sin primera respuesta
- [ ] Urgencias: 24 horas hábiles sin primera respuesta
- [ ] Advisory lock con cooldown de 5min
- [ ] Heartbeat en `cron_runs`

### 8.3 ops-metrics-nightly (23:55 diario)
- [ ] Agrega métricas diarias por master
- [ ] Detecta baja productividad
- [ ] Actualiza tasas de conversión
- [ ] Agrega effectiveness de IA
- [ ] Métricas de morosidad (emails, casos)
- [ ] Notificaciones de morosidad 30 días
- [ ] Alertas de observabilidad (cron failures, IMAP down, SLA spikes, AI low)
- [ ] Advisory lock con cooldown de 1h
- [ ] Heartbeat en `cron_runs`

### 8.4 ops-ai-eval-urgencies (cada 1h)
- [ ] Evalúa urgencias cerradas en últimas 24h
- [ ] Evalúa urgencias activas con actividad reciente
- [ ] Aprende de intervenciones humanas (solo cerradas)
- [ ] Deduplica evaluaciones
- [ ] Advisory lock con cooldown de 30min
- [ ] Heartbeat en `cron_runs`

---

## 9. SEGURIDAD (RLS + Auth)

- [ ] Todas las tablas ops tienen RLS habilitado
- [ ] Políticas service_role permiten acceso completo (API usa service_role)
- [ ] Endpoints de cron requieren `CRON_SECRET` o `Authorization: Bearer`
- [ ] No hay acceso directo de anon key a tablas ops

---

## 10. PERFORMANCE

- [ ] List endpoints usan columnas lean (no `select('*')`)
- [ ] Índices compuestos existen para queries frecuentes
- [ ] Summary counts usan queries eficientes (solo columnas necesarias)
- [ ] Paginación con `range()` en todas las listas

---

## 11. OBSERVABILIDAD / ALERTAS

- [ ] Notificación por 2+ cron failures consecutivos
- [ ] Notificación si IMAP no corre en 5+ minutos
- [ ] Notificación si 5+ SLA breaches en 24h
- [ ] Notificación si AI effectiveness promedio semanal < umbral
- [ ] Notificaciones no se duplican dentro de 6h
- [ ] Target: todos los masters (`target_role: 'master'`)

---

## 12. MIGRATION FILES

| Archivo | Descripción |
|---|---|
| `MIGRATION_OPERACIONES.sql` | Tablas base: activity_log, renewals, petitions, urgencies, email, config |
| `MIGRATION_OPERACIONES_V2.sql` | ops_cases unificado, triggers, SLA engine, metrics, sessions, morosidad view |
| `MIGRATION_OPS_IMAP.sql` | ops_case_messages, IMAP config |
| `MIGRATION_OPS_AI_EVAL.sql` | AI evaluations, memory, training, notes |
| `MIGRATION_OPS_CONFIG_V2.sql` | Config seeds, email_templates, cron_runs |
| `MIGRATION_OPS_HARDENING.sql` | **NUEVO**: 14 indexes, 15 RLS policies, cron_locks table + functions |

---

## Notas de ejecución

1. Ejecutar todas las migraciones en orden en Supabase SQL Editor
2. Verificar que `CRON_SECRET` está configurado en Vercel env vars
3. Verificar que Zoho IMAP credentials están configurados
4. Verificar que Zepto API key está configurado
5. Verificar que Vertex AI (Gemini) credentials están configurados
6. Correr `npx tsc --noEmit` para verificar 0 errores TypeScript
7. Deploy a Vercel preview y hacer smoke test de cada módulo
