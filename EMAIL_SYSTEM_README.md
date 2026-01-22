# SISTEMA DE CORREOS AUTOMÁTICOS - PORTAL LÍDERES EN SEGUROS

## 📧 Arquitectura General

El sistema maneja **DOS cuentas SMTP separadas** de Zoho:

### 1. SMTP TRAMITES (`tramites@lideresenseguros.com`)
**Uso exclusivo para:**
- Casos de Pendientes (Trámites)
- Creación de tickets
- Actualizaciones de casos
- Cierres (aprobado/rechazado)
- Aplazados
- Confirmaciones de renovación con CTA

### 2. SMTP PORTAL (`portal@lideresenseguros.com`)
**Uso para todo lo demás:**
- Renovaciones (recordatorios)
- Cumpleaños (clientes y brokers)
- Comisiones
- Morosidad
- Preliminar
- Agenda
- Digest diarios
- Notificaciones administrativas

---

## 🗂️ Estructura del Código

```
/src/server/email/
├── mailer.ts              # Nodemailer transports (portal + tramites)
├── sendEmail.ts           # Función central de envío
├── renderer.ts            # Motor de templates HTML
├── dedupe.ts              # Control de duplicados
├── types.ts               # Tipos TypeScript
│
└── templates/
    ├── layout.html        # Layout base con branding
    ├── partials/          # Componentes reutilizables
    │   ├── button.html
    │   ├── table.html
    │   └── footer.html
    └── actions/           # Templates específicos
        ├── renewalReminder.html
        ├── renewalConfirm.html
        ├── birthdayClient.html
        ├── birthdayBroker.html
        ├── commissionPaid.html
        ├── pendienteCreated.html
        ├── pendienteClosedApproved.html
        ├── pendientesDailyDigest.html
        ├── agendaReminder.html
        └── ... (17 templates en total)

/src/lib/email/
├── renewals.ts            # Lógica de renovaciones
├── birthdays.ts           # Lógica de cumpleaños
├── commissions.ts         # Hooks de comisiones
└── pendientes.ts          # Correos de casos

/src/lib/timezone/
└── panama.ts              # Helpers de zona horaria (America/Panama)
```

---

## 🔐 Variables de Entorno

Todas las variables YA ESTÁN CONFIGURADAS en Vercel:

```env
# SMTP Zoho
ZOHO_SMTP_HOST=smtppro.zoho.com
ZOHO_SMTP_PORT=465
ZOHO_SMTP_SECURE=true

# SMTP Portal
ZOHO_SMTP_USER=portal@lideresenseguros.com
ZOHO_SMTP_PASS=********

# SMTP Tramites
ZOHO_SMTP_USER_TRAMITES=tramites@lideresenseguros.com
ZOHO_SMTP_PASS_TRAMITES=********

# Correos FROM
EMAIL_FROM_PORTAL="Líderes en Seguros <portal@lideresenseguros.com>"
EMAIL_FROM_TRAMITES="Líderes en Seguros <tramites@lideresenseguros.com>"

# Sistema
CRON_SECRET=********
APP_BASE_URL=https://portal.lideresenseguros.com
TZ_DEFAULT=America/Panama
```

---

## ⏰ Cron Jobs Configurados

```json
{
  "crons": [
    { "path": "/api/cron/imap-ingest", "schedule": "*/3 * * * *" },
    { "path": "/api/cron/scheduler", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/renewals", "schedule": "0 12 * * *" },
    { "path": "/api/cron/birthdays", "schedule": "0 12 * * *" },
    { "path": "/api/cron/pendientes-digest", "schedule": "0 12 * * *" }
  ]
}
```

### Horarios (Zona horaria: America/Panama, UTC-5)

| Cron | Frecuencia | Hora Panamá | Descripción |
|------|-----------|-------------|-------------|
| `imap-ingest` | Cada 3 min | 24/7 | Ingesta de correos IMAP |
| `scheduler` | Cada 5 min | 24/7 | Procesa jobs programados |
| `renewals` | Diario | 12:00 PM | Recordatorios de renovación |
| `birthdays` | Diario | 12:00 PM | Cumpleaños clientes y brokers |
| `pendientes-digest` | Diario | 7:00 AM | Resumen de casos pendientes |

---

## 📊 Base de Datos

### Tabla: `email_logs`
Registro de todos los correos enviados:

```sql
- id: UUID
- to: TEXT
- subject: TEXT
- template: TEXT
- dedupe_key: TEXT UNIQUE
- status: 'sent' | 'failed' | 'skipped'
- error: TEXT
- metadata: JSONB
- created_at: TIMESTAMPTZ
```

### Tabla: `scheduled_jobs`
Jobs programados para ejecución diferida:

```sql
- id: UUID
- job_type: TEXT
- payload: JSONB
- scheduled_for: TIMESTAMPTZ
- executed_at: TIMESTAMPTZ
- status: 'pending' | 'processing' | 'completed' | 'failed'
- retry_count: INT
- max_retries: INT
- created_at: TIMESTAMPTZ
```

---

## 🚀 Uso del Sistema

### Enviar correo simple

```typescript
import { sendEmail } from '@/server/email/sendEmail';

await sendEmail({
  to: 'broker@example.com',
  subject: 'Título del correo',
  html: '<h1>Contenido HTML</h1>',
  fromType: 'PORTAL', // o 'TRAMITES'
  dedupeKey: 'unique-key-123', // Opcional
  metadata: { customData: 'value' },
});
```

### Enviar con template

```typescript
import { renderEmailTemplate } from '@/server/email/renderer';
import { sendEmail } from '@/server/email/sendEmail';

const html = renderEmailTemplate('renewalReminder', {
  brokerName: 'Juan Pérez',
  clientName: 'María González',
  renewalDate: '15/02/2026',
  daysRemaining: 30,
  // ... más datos
});

await sendEmail({
  to: 'broker@example.com',
  subject: 'Recordatorio de Renovación',
  html,
  fromType: 'PORTAL',
  template: 'renewalReminder',
});
```

### Programar job diferido

```typescript
await supabase.from('scheduled_jobs').insert({
  job_type: 'email_reminder',
  payload: {
    to: 'user@example.com',
    template: 'agendaReminder',
    data: { /* template data */ },
    fromType: 'PORTAL',
  },
  scheduled_for: '2026-01-25T14:00:00Z', // UTC
});
```

---

## 🔄 Flujos Automáticos

### 1. Renovaciones

**Recordatorios a brokers (SMTP Portal):**
- 30 días antes → correo automático
- 7 días antes → correo automático
- Mismo día → correo automático

**Confirmaciones a masters con CTA (SMTP Portal):**
- 7 días vencida → correo con botón "Confirmar Renovación"
- 90 días vencida → correo URGENTE

Al hacer clic en "Confirmar":
1. Se crea automáticamente un CASE en Pendientes
2. Tipo: "Renovación"
3. Broker y Master asignados
4. Usa `tramites@lideresenseguros.com` para el caso

### 2. Cumpleaños

**Clientes (SMTP Portal):**
- Notificación al broker del cliente
- Solo email (NO llamadas)
- Diariamente a las 12:00 PM

**Brokers (SMTP Portal):**
- Correo HTML con felicitación
- Diariamente a las 7:00 AM

### 3. Comisiones

**Eventos que envían correo (SMTP Portal):**
- Quincena pagada
- Ajuste pagado

### 4. Pendientes (SMTP Tramites)

**Correos automáticos:**
- Caso creado
- Caso actualizado
- Caso aplazado
- Caso cerrado (aprobado/rechazado)

**Digest diario (SMTP Portal):**
- 7:00 AM Panamá
- Solo brokers con casos abiertos
- Resumen de casos urgentes y por estado

### 5. Agenda

**Eventos (SMTP Portal):**
- Evento creado
- Evento actualizado
- Evento eliminado
- Recordatorio (1 día antes)

---

## 🛡️ Deduplicación

El sistema usa `dedupe_key` para evitar envíos duplicados:

```typescript
import { generateDedupeKey } from '@/server/email/dedupe';

// Genera: "user@example.com-renewalReminder-policy-123"
const key = generateDedupeKey(
  'user@example.com',
  'renewalReminder',
  'policy-123'
);
```

Si existe un correo con el mismo `dedupe_key` y status `sent`, NO se reenvía.

---

## 🧪 Testing Manual

### 1. Verificar SMTP

```bash
curl -X GET https://portal.lideresenseguros.com/api/test-email?type=portal
curl -X GET https://portal.lideresenseguros.com/api/test-email?type=tramites
```

### 2. Ejecutar cron manualmente

```bash
curl -X GET "https://portal.lideresenseguros.com/api/cron/renewals" \
  -H "x-cron-secret: YOUR_CRON_SECRET"

curl -X GET "https://portal.lideresenseguros.com/api/cron/birthdays" \
  -H "x-cron-secret: YOUR_CRON_SECRET"

curl -X GET "https://portal.lideresenseguros.com/api/cron/pendientes-digest" \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

### 3. Ver logs de emails

```sql
SELECT 
  to,
  subject,
  template,
  status,
  created_at
FROM email_logs
ORDER BY created_at DESC
LIMIT 50;
```

---

## 📦 Instalación de Dependencias

```bash
npm install nodemailer luxon
npm install -D @types/nodemailer @types/luxon
```

---

## 🗄️ Migraciones SQL

Ejecutar en Supabase:

```bash
supabase/migrations/20260122000001_create_email_system.sql
```

Esto crea:
- Tabla `email_logs`
- Tabla `scheduled_jobs`
- Funciones helper
- RLS policies
- Índices de performance

---

## ✅ Checklist de Deploy

- [x] Migración SQL ejecutada
- [x] Variables de entorno configuradas en Vercel
- [x] `vercel.json` con cron jobs actualizado
- [ ] Instalar dependencias: `npm install nodemailer luxon @types/nodemailer @types/luxon`
- [ ] Push a GitHub (auto-deploy a Vercel)
- [ ] Verificar cron jobs en Vercel Dashboard
- [ ] Testing manual de SMTP
- [ ] Testing manual de cron jobs

---

## 🚨 Troubleshooting

### Error: "Cannot find module 'nodemailer'"
```bash
npm install nodemailer @types/nodemailer
```

### Error: "Cannot find module 'luxon'"
```bash
npm install luxon @types/luxon
```

### Correos no se envían
1. Verificar credenciales SMTP en Vercel
2. Revisar `email_logs` para errores
3. Verificar que `fromType` sea correcto

### Deduplicación no funciona
- Verificar que `dedupe_key` sea único
- Revisar índice en `email_logs`

---

## 📞 Soporte

Para dudas o problemas con el sistema de correos, contactar al equipo de desarrollo.

**Última actualización:** 22 de enero de 2026
