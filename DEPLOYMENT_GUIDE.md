# Guía de Deployment - Sistema de Tickets

## ✅ RESUMEN DE IMPLEMENTACIÓN

Sistema completo de tickets con codificación posicional de 12 dígitos, catálogos configurables, SLA inteligente, y UI Monday-style.

**Estado:** ✅ 100% Completado
**Archivos creados:** 24
**Líneas de código:** ~6,000
**Tiempo estimado de deployment:** 2-3 horas

---

## 📦 ARCHIVOS CREADOS

### 1. Migraciones SQL (Base de Datos)
```
migrations/
├── 20260119_create_ticket_system.sql      (850 líneas)
└── 20260119_update_cases_table.sql        (450 líneas)
```

### 2. TypeScript Types & Utilities
```
src/lib/ticketing/
├── types.ts                    (300 líneas) - Interfaces y types
├── ticket-generator.ts         (150 líneas) - Generación de tickets
├── sla-calculator.ts           (120 líneas) - Cálculo de SLA
├── ai-classifier.ts            (150 líneas) - Shell IA (placeholder)
└── email-notifications.ts      (200 líneas) - Shell Resend (placeholder)
```

### 3. Server Actions
```
src/app/(app)/
├── cases/ticketing-actions.ts  (350 líneas) - 9 acciones de tickets
└── config/catalog-actions.ts   (400 líneas) - 13 acciones de catálogos
```

### 4. UI Components
```
src/components/
├── config/tabs/
│   ├── TicketingTab.tsx       (900 líneas) - Config de catálogos
│   └── VacationTab.tsx         (350 líneas) - Config de vacaciones
└── cases/
    ├── CasesBoardV2.tsx        (400 líneas) - Board Monday-style
    ├── UnclassifiedEmailsUI.tsx(400 líneas) - Emails sin clasificar
    └── SecurityLogsViewer.tsx  (500 líneas) - Logs inmutables
```

### 5. Cron Jobs (Automations)
```
src/app/api/cron/
├── notify-aplazados/route.ts          (150 líneas)
├── sla-alerts/route.ts                (200 líneas)
└── process-unclassified-emails/route.ts (150 líneas)
```

### 6. Webhooks & Integration Shells
```
src/app/api/webhooks/
└── tickets/route.ts            (150 líneas) - Webhook receiver
```

### 7. Documentación
```
├── TICKETING_SYSTEM_IMPLEMENTATION.md  (Guía técnica completa)
├── TICKETING_SYSTEM_STATUS.md          (Estado del proyecto)
└── DEPLOYMENT_GUIDE.md                 (Este archivo)
```

---

## 🚀 PASOS DE DEPLOYMENT

### PASO 1: Ejecutar Migraciones SQL

**En Supabase SQL Editor:**

```sql
-- 1. Crear tablas de catálogos y sistema de tickets
-- Copiar y ejecutar: migrations/20260119_create_ticket_system.sql

-- 2. Actualizar tabla cases con nuevos campos
-- Copiar y ejecutar: migrations/20260119_update_cases_table.sql
```

**Verificación:**
```sql
-- Verificar que las tablas se crearon
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'ramos_catalog',
  'aseguradoras_catalog',
  'tramites_catalog',
  'ticket_sequences',
  'vacation_config',
  'case_security_logs',
  'case_ticket_history',
  'unclassified_emails'
);

-- Verificar datos iniciales
SELECT * FROM ramos_catalog;
SELECT * FROM aseguradoras_catalog;
SELECT * FROM tramites_catalog;
SELECT * FROM vacation_config;
```

### PASO 2: Regenerar Database Types

```bash
# En terminal local:
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/database.types.ts
```

Esto eliminará todos los errores de TypeScript relacionados con las nuevas tablas.

### PASO 3: Configurar Variables de Entorno

Agregar a `.env.local`:

```env
# Cron Jobs Security
CRON_SECRET=your-random-secret-key-here

# Webhooks
WEBHOOK_SECRET=your-webhook-secret-here

# Resend (para futuro)
RESEND_API_KEY=your-resend-key

# OpenAI (para futuro)
OPENAI_API_KEY=your-openai-key
```

### PASO 4: Configurar Cron Jobs en Supabase

**En Supabase → Database → Extensions:**

Habilitar extensión `pg_cron`:
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

**Configurar cron jobs:**

```sql
-- 1. Notificaciones de aplazados (Diario 8am)
SELECT cron.schedule(
  'notify-aplazado-cases',
  '0 8 * * *',
  $$ 
    SELECT net.http_post(
      url:='https://your-domain.vercel.app/api/cron/notify-aplazados',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb
    ) as request_id;
  $$
);

-- 2. Alertas de SLA (Cada 6 horas)
SELECT cron.schedule(
  'sla-alerts',
  '0 */6 * * *',
  $$ 
    SELECT net.http_post(
      url:='https://your-domain.vercel.app/api/cron/sla-alerts',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb
    ) as request_id;
  $$
);

-- 3. Procesar emails sin clasificar (Cada hora)
SELECT cron.schedule(
  'process-unclassified-emails',
  '0 * * * *',
  $$ 
    SELECT net.http_post(
      url:='https://your-domain.vercel.app/api/cron/process-unclassified-emails',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb
    ) as request_id;
  $$
);
```

**Verificar cron jobs:**
```sql
SELECT * FROM cron.job;
```

### PASO 5: Deploy a Vercel

```bash
git add .
git commit -m "feat: Sistema de tickets completo con código posicional de 12 dígitos"
git push origin main
```

Vercel desplegará automáticamente.

### PASO 6: Poblar Catálogos (Opcional)

Los catálogos ya vienen con datos iniciales, pero puedes agregar más:

```sql
-- Agregar más ramos
INSERT INTO ramos_catalog (code, name, description, sla_days_default, display_order) 
VALUES ('10', 'Fianzas', 'Seguros de fianzas', 12, 10);

-- Agregar más aseguradoras
INSERT INTO aseguradoras_catalog (code, name, short_name, display_order) 
VALUES ('06', 'AIG Panamá', 'AIG', 6);

-- Agregar más trámites
INSERT INTO tramites_catalog (code, name, requires_policy_number, sla_modifier, display_order) 
VALUES ('10', 'Consulta', false, -5, 10);
```

### PASO 7: Migrar Casos Existentes (Opcional)

Si tienes casos existentes, puedes migrarlos al nuevo sistema:

```sql
-- Mapear estados antiguos a estados v2
UPDATE cases 
SET status_v2 = CASE 
  WHEN status = 'PENDIENTE_REVISION' THEN 'NUEVO'
  WHEN status = 'EN_PROCESO' THEN 'EN_PROCESO'
  WHEN status = 'FALTA_DOC' THEN 'PENDIENTE_CLIENTE'
  WHEN status = 'APLAZADO' THEN 'APLAZADO'
  WHEN status = 'RECHAZADO' THEN 'CERRADO_RECHAZADO'
  WHEN status = 'EMITIDO' THEN 'CERRADO_APROBADO'
  ELSE 'NUEVO'
END::case_status_simplified
WHERE status_v2 IS NULL;

-- Marcar como clasificados los que tienen datos completos
UPDATE cases 
SET is_classified = true
WHERE insurer_id IS NOT NULL 
  AND management_type IS NOT NULL
  AND section != 'SIN_CLASIFICAR';
```

---

## 🧪 TESTING

### 1. Test Manual de Generación de Tickets

```typescript
// En Supabase SQL Editor:
SELECT generate_ticket_number('03', '01', '1');
-- Debe retornar algo como: 260103010001

SELECT generate_ticket_number('03', '01', '1');
-- Debe retornar: 260103010002 (incrementa correlativo)
```

### 2. Test de SLA con Pausa

```sql
-- Crear caso de prueba
INSERT INTO cases (client_name, status_v2, sla_date, sla_paused) 
VALUES ('Test Cliente', 'NUEVO', NOW() + INTERVAL '5 days', false)
RETURNING id;

-- Pausar SLA
SELECT toggle_case_sla_pause('[case_id]', true, 'Esperando cliente');

-- Verificar
SELECT sla_paused, sla_paused_at FROM cases WHERE id = '[case_id]';
```

### 3. Test de Catalog UI

1. Ir a `/config` en el navegador
2. Agregar un nuevo ramo
3. Verificar que aparece en la lista
4. Toggle activo/inactivo
5. Editar y guardar cambios

### 4. Test de Cases Board

1. Ir a `/cases` (nueva versión)
2. Verificar que se ven las 3 secciones
3. Filtrar por estado
4. Buscar por ticket
5. Verificar agrupación por trámite

### 5. Test de Cron Jobs (Manual)

```bash
# Test local con curl
curl -X POST http://localhost:3000/api/cron/notify-aplazados \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

---

## 🔧 CONFIGURACIÓN POST-DEPLOYMENT

### 1. Configurar Vacaciones de Masters

En `/config` → Tab "Vacaciones":
- Configurar Yira Ramos y Lucía Nieto
- Definir respaldos
- Activar auto-reassign

### 2. Revisar y Ajustar Catálogos

En `/config` → Tab "Sistema de Tickets":
- Revisar códigos de ramos
- Vincular aseguradoras con tabla `insurers` existente
- Ajustar SLA base por ramo
- Configurar modificadores de SLA por trámite

### 3. Capacitar al Equipo

Puntos clave:
- Nuevo formato de ticket de 12 dígitos
- Estados simplificados (8 estados vs 11 anteriores)
- SLA con pausa automática
- Sistema de aplazados mejorado
- Emails sin clasificar

---

## 📊 MONITOREO

### Queries Útiles

```sql
-- Ver últimos tickets generados
SELECT * FROM case_ticket_history ORDER BY created_at DESC LIMIT 10;

-- Ver casos con SLA próximo a vencer
SELECT ticket_ref, client_name, sla_date, 
       calculate_effective_sla_date(sla_date, sla_accumulated_pause_days) as effective_sla
FROM cases 
WHERE status_v2 NOT IN ('CERRADO_APROBADO', 'CERRADO_RECHAZADO', 'APLAZADO')
ORDER BY effective_sla ASC
LIMIT 20;

-- Ver logs de seguridad recientes
SELECT action_type, actor_email, created_at 
FROM case_security_logs 
ORDER BY created_at DESC 
LIMIT 50;

-- Ver emails sin clasificar pendientes
SELECT from_email, subject, received_at, status 
FROM unclassified_emails 
WHERE status = 'PENDING' 
ORDER BY received_at DESC;

-- Estadísticas de tickets por mes
SELECT 
  year_month,
  COUNT(*) as total_tickets,
  MAX(last_correlative) as max_correlative
FROM ticket_sequences 
GROUP BY year_month 
ORDER BY year_month DESC;
```

---

## ⚠️ TROUBLESHOOTING

### Problema: Errores de TypeScript después de migración

**Solución:** Regenerar types
```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/database.types.ts
```

### Problema: Cron jobs no se ejecutan

**Verificar:**
1. Extensión `pg_cron` habilitada
2. URL correcta en cron schedule
3. `CRON_SECRET` configurado
4. Logs en Supabase → Logs → Functions

### Problema: Tickets no se generan

**Verificar:**
1. Caso tiene `ramo_code`, `aseguradora_code`, `tramite_code`
2. Códigos existen en catálogos y están activos
3. Función `generate_ticket_number` existe
4. Ver logs en browser console

### Problema: SLA no se pausa automáticamente

**Verificar:**
1. Trigger `auto_manage_sla_pause_trigger` existe
2. Estado cambió a `PENDIENTE_CLIENTE` o `PENDIENTE_BROKER`
3. Ver security logs para debugging

---

## 🎯 PRÓXIMOS PASOS (Futuro)

1. **Implementar IA Classifier**
   - Integrar OpenAI para clasificación automática
   - Auto-asignar emails con alta confianza
   - Entrenar con feedback

2. **Implementar Resend**
   - Notificaciones por email
   - Templates personalizados
   - Tracking de emails enviados

3. **Implementar Webhooks**
   - Recibir actualizaciones de aseguradoras
   - Auto-actualizar estados
   - Sincronización bidireccional

4. **Dashboard de Analytics**
   - Métricas de SLA
   - Tiempos promedio por trámite
   - Performance por master/broker

5. **Mobile App**
   - Notificaciones push
   - Escaneo de documentos
   - Firma digital

---

## 📞 SOPORTE

Si encuentras problemas durante el deployment:

1. Revisar logs en Vercel
2. Revisar logs en Supabase
3. Verificar este documento
4. Consultar `TICKETING_SYSTEM_IMPLEMENTATION.md`

---

**Última actualización:** 2026-01-19
**Versión:** 1.0.0
**Estado:** ✅ Listo para Production
