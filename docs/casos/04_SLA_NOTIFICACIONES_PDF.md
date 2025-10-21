# ⏱️ SLA, NOTIFICACIONES Y GENERACIÓN DE PDF

## 📊 Sistema de SLA (Service Level Agreement)

### Configuración por Defecto

**Ramos Generales:**
- Default: 7-15 días (editable)

**Ramos de Personas:**
- Default: 8-20 días (editable)

**Gestiones Específicas:**
```typescript
const SLA_DEFAULTS = {
  'COTIZACION': 7,
  'EMISION': 15,
  'EMISION_EXPRESS': 3,
  'REHABILITACION': 10,
  'MODIFICACION': 8,
  'CANCELACION': 10,
  'CAMBIO_CORREDOR': 5,
  'RECLAMO': 20,
};
```

**Al crear caso:**
- SLA se precarga desde Configuración
- Master puede editar antes de crear
- Se calcula `sla_date = created_at + sla_days`

---

### Semáforo de SLA

#### 🟢 En Tiempo
**Condición:** Días restantes > 5

```typescript
const daysRemaining = daysBetween(today, sla_date);
if (daysRemaining > 5) {
  return { status: 'ON_TIME', color: 'green', icon: '🟢' };
}
```

**Visualización:**
- Chip verde
- Texto: "En tiempo (X días restantes)"

---

#### 🟡 Por Vencer
**Condición:** 0 < Días restantes ≤ 5

```typescript
if (daysRemaining > 0 && daysRemaining <= 5) {
  return { status: 'DUE_SOON', color: 'yellow', icon: '🟡' };
}
```

**Visualización:**
- Chip amarillo
- Texto: "Por vencer (X días)"

**Acciones:**
- Notificación diaria a broker asignado
- Badge especial en lista

---

#### 🔴 Vencido
**Condición:** Días restantes ≤ 0

```typescript
if (daysRemaining <= 0) {
  return { status: 'OVERDUE', color: 'red', icon: '🔴' };
}
```

**Visualización:**
- Chip rojo
- Texto: "Vencido (hace X días)"

**Acciones:**
- Notificación urgente a broker y Master
- Si vencido + sin actualización por 7 días → Auto a Papelera

---

### Auto-Limpieza (Papelera)

```typescript
// Cron job diario (1:00 AM)
async function autoMoveToPapalera() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 días
  
  const overdueStale = await supabase
    .from('cases')
    .select('id, case_number, broker_id')
    .lt('sla_date', new Date())
    .lt('updated_at', cutoff)
    .is('deleted_at', null)
    .neq('status', 'CERRADO')
    .neq('status', 'EMITIDO');
  
  for (const case of overdueStale.data) {
    // Mover a papelera
    await supabase
      .from('cases')
      .update({ 
        deleted_at: new Date().toISOString(),
        deleted_reason: 'Auto-limpieza: 7 días vencido sin actualización'
      })
      .eq('id', case.id);
    
    // Notificar
    await notifyBroker(case.broker_id, {
      title: 'Caso movido a Papelera',
      message: `El caso ${case.case_number} fue movido automáticamente a Papelera por inactividad.`,
      link: `/cases/${case.id}`
    });
  }
}
```

**Papelera:**
- Casos visibles por 30 días
- Después de 30 días → purga automática (eliminación permanente)
- Master puede restaurar antes de la purga

---

### Estado APLAZADO

**Al marcar como Aplazado:**

```typescript
interface AplazarCaseData {
  target_date: string;     // ISO date - fecha objetivo
  reason: string;          // Motivo del aplazamiento
  reminder_days: number;   // Default: 5 (notificar 5 días antes)
}
```

**Comportamiento:**
- SLA se pausa (no cuenta días)
- `sla_date` se actualiza a `target_date`
- 5 días antes de `target_date` → notificación
- Puede re-aplazarse múltiples veces

**Notificación 5 días antes:**
```typescript
// Cron job diario
const fiveDaysFromNow = addDays(new Date(), 5);

const upcomingAplazados = await supabase
  .from('cases')
  .select('*')
  .eq('status', 'APLAZADO')
  .eq('target_date', fiveDaysFromNow.toISOString().split('T')[0]);

for (const case of upcomingAplazados.data) {
  await notifyBroker(case.broker_id, {
    title: 'Caso aplazado próximo a vencer',
    message: `El caso ${case.case_number} vence en 5 días (${case.target_date}).`,
    link: `/cases/${case.id}`
  });
}
```

---

## 🔔 Sistema de Notificaciones

### Eventos que Disparan Notificación

| Evento | Destinatario | Tipo | Prioridad |
|--------|--------------|------|-----------|
| Nuevo trámite asignado | Broker | Campanita + Email | Alta |
| Actualización de estado | Broker | Campanita | Media |
| Nuevo comentario | Broker/Master | Campanita | Media |
| "Mío" marcado | Master | Campanita | Alta |
| SLA por vencer (5d) | Broker | Campanita + Email | Alta |
| SLA vencido | Broker + Master | Campanita + Email | Crítica |
| Re-aplazar | Master | Campanita | Baja |
| Documento faltante | Broker | Campanita | Media |
| Nuevo doc en Descargas | Broker (relevante) | Campanita | Baja |
| Preliminar BD creado | Broker | Campanita + Email | Alta |
| Caso fusionado | Broker origen | Campanita | Media |
| Auto a Papelera | Broker + Master | Email | Alta |

---

### Campanita (In-App)

**Estructura:**
```typescript
interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  created_at: string;
  metadata?: Record<string, any>;
}
```

**Tipos:**
```typescript
type NotificationType = 
  | 'NEW_CASE'
  | 'STATUS_CHANGE'
  | 'NEW_COMMENT'
  | 'MIO_MARKED'
  | 'SLA_WARNING'
  | 'SLA_OVERDUE'
  | 'DOCUMENT_UPLOADED'
  | 'PRELIMINAR_CREATED'
  | 'CASE_MERGED'
  | 'AUTO_ARCHIVED';
```

**Componente:**
```tsx
<NotificationBell>
  {/* Badge con contador de no leídas */}
  <Badge count={unreadCount} />
  
  {/* Dropdown con lista */}
  <NotificationList>
    {notifications.map(notif => (
      <NotificationItem
        key={notif.id}
        title={notif.title}
        message={notif.message}
        time={notif.created_at}
        read={notif.read}
        onClick={() => {
          markAsRead(notif.id);
          navigate(notif.link);
        }}
      />
    ))}
  </NotificationList>
</NotificationBell>
```

---

### Correo Diario (7:00 AM)

**Resumen personalizado por usuario:**

```typescript
// Cron job: 7:00 AM diario
async function sendDailySummary() {
  const users = await getAllActiveUsers();
  
  for (const user of users) {
    const cases = await getUserCases(user.id);
    
    // Broker: solo sus casos
    if (user.role === 'BROKER') {
      const summary = {
        nuevos: cases.filter(c => c.status === 'PENDIENTE_REVISION').length,
        porVencer: cases.filter(c => c.sla_status === 'DUE_SOON').length,
        vencidos: cases.filter(c => c.sla_status === 'OVERDUE').length,
        enProceso: cases.filter(c => c.status === 'EN_PROCESO').length,
        pendienteDocs: cases.filter(c => c.status === 'FALTA_DOC').length,
      };
      
      await sendEmail({
        to: user.email,
        subject: `Resumen Diario de Trámites - ${formatDate(new Date())}`,
        template: 'daily_summary_broker',
        data: { user, summary, cases }
      });
    }
    
    // Master: Oficina + No identificados
    if (user.role === 'MASTER') {
      const oficinaCases = cases.filter(c => c.broker_id === 'OFICINA');
      const noIdentificados = cases.filter(c => c.section === 'NO_IDENTIFICADOS');
      
      const summary = {
        oficina: oficinaCases.length,
        noIdentificados: noIdentificados.length,
        total: cases.length,
        vencidos: cases.filter(c => c.sla_status === 'OVERDUE').length,
      };
      
      await sendEmail({
        to: user.email,
        subject: `Resumen Diario Master - ${formatDate(new Date())}`,
        template: 'daily_summary_master',
        data: { user, summary, oficinaCases, noIdentificados }
      });
    }
  }
}
```

**Template de Email:**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .header { background: #010139; color: white; padding: 20px; }
    .summary { padding: 20px; }
    .stat { display: inline-block; margin: 10px; padding: 15px; border-radius: 8px; }
    .stat.nuevos { background: #E3F2FD; }
    .stat.vencidos { background: #FFEBEE; }
    .stat.proceso { background: #FFF3E0; }
    .case-list { margin-top: 20px; }
    .case-item { 
      border-left: 4px solid #8AAA19; 
      padding: 10px; 
      margin: 10px 0; 
      background: #F5F5F5; 
    }
    .button { 
      background: #8AAA19; 
      color: white; 
      padding: 10px 20px; 
      text-decoration: none; 
      border-radius: 5px; 
      display: inline-block; 
      margin: 10px 0; 
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Resumen Diario de Trámites</h1>
    <p>{{date}}</p>
  </div>
  
  <div class="summary">
    <h2>Hola {{user_name}},</h2>
    
    <div class="stats">
      <div class="stat nuevos">
        <strong>{{nuevos}}</strong> Nuevos
      </div>
      <div class="stat proceso">
        <strong>{{porVencer}}</strong> Por vencer
      </div>
      <div class="stat vencidos">
        <strong>{{vencidos}}</strong> Vencidos
      </div>
    </div>
    
    <div class="case-list">
      <h3>Casos Prioritarios:</h3>
      {{#each priorityCases}}
      <div class="case-item">
        <strong>{{case_number}}</strong> - {{client_name}}<br>
        {{gestion_type}} | {{insurer_name}}<br>
        <span style="color: {{sla_color}}">{{sla_text}}</span>
      </div>
      {{/each}}
    </div>
    
    <a href="{{portal_url}}/cases" class="button">
      Ver Todos los Trámites
    </a>
  </div>
</body>
</html>
```

**⚠️ IMPORTANTE:**
- Toggle de Comisiones (notificaciones ON/OFF) **NO afecta** a Trámites
- Trámites **SIEMPRE** envían notificaciones

---

## 📄 Generación de PDF

### PDF Individual (Detalle del Caso)

**Botón:** "Descargar PDF del trámite"  
**Ubicación:** `/cases/[id]` - Header

**Contenido:**

```typescript
interface CasePDFData {
  // Header
  logo: string;
  case_number: string;
  created_at: string;
  
  // Resumen
  client_name: string;
  broker_name: string;
  insurer_name: string;
  policy_type: string;
  gestion_type: string;
  status: string;
  sla_status: string;
  policy_number?: string;
  
  // Checklist
  checklist: Array<{
    document_name: string;
    is_required: boolean;
    status: 'DONE' | 'PENDING' | 'NA';
    completed_at?: string;
    completed_by?: string;
  }>;
  
  // Adjuntos
  attachments: Array<{
    file_name: string;
    uploaded_by: string;
    uploaded_at: string;
    size_bytes: number;
  }>;
  
  // Timeline (compacto - últimos 10 eventos)
  timeline: Array<{
    event_type: string;
    description: string;
    user_name: string;
    created_at: string;
  }>;
}
```

**Estilo:**
- **Tipografía:** Arial
- **Colores:**
  - Azul #010139 (headers, títulos)
  - Oliva #8AAA19 (acentos, highlights)
  - Gris #666 (texto secundario)
- **Logo:** Top left
- **Secciones:** Separadas con líneas oliva

---

### PDF Consolidado (Selección Múltiple)

**Botón:** "Descargar PDF" (en lista con selección múltiple)  
**Ubicación:** `/cases` - Toolbar

**Contenido:**

```typescript
interface ConsolidatedPDFData {
  // Header
  logo: string;
  title: string; // "Reporte de Trámites Seleccionados"
  generated_at: string;
  generated_by: string;
  total_cases: number;
  
  // Tabla de casos
  cases: Array<{
    case_number: string;
    insurer_name: string;
    gestion_type: string;
    client_name: string;
    status: string;
    sla_days_remaining: number;
    sla_status: string;
    ticket_ref?: string;
    broker_name: string;
  }>;
  
  // Resumen por estado
  summary: {
    by_status: Record<string, number>;
    by_insurer: Record<string, number>;
    by_gestion: Record<string, number>;
    overdue: number;
    due_soon: number;
  };
}
```

**Layout:**
- Página 1: Resumen con gráficas
- Páginas siguientes: Tabla detallada
- Footer: Paginación y fecha de generación

---

### Generador (Librería)

```typescript
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

async function generateCasePDF(caseData: CasePDFData): Promise<Blob> {
  const doc = new jsPDF();
  
  // Header
  doc.addImage(LOGO_BASE64, 'PNG', 10, 10, 40, 10);
  doc.setFontSize(20);
  doc.setTextColor(1, 1, 57); // #010139
  doc.text(`Caso ${caseData.case_number}`, 60, 15);
  
  // Resumen
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  let y = 30;
  
  doc.text(`Cliente: ${caseData.client_name}`, 10, y); y += 7;
  doc.text(`Broker: ${caseData.broker_name}`, 10, y); y += 7;
  doc.text(`Aseguradora: ${caseData.insurer_name}`, 10, y); y += 7;
  doc.text(`Estado: ${caseData.status}`, 10, y); y += 7;
  doc.setTextColor(138, 170, 25); // #8AAA19
  doc.text(`SLA: ${caseData.sla_status}`, 10, y); y += 10;
  
  // Checklist
  doc.setFontSize(14);
  doc.setTextColor(1, 1, 57);
  doc.text('Checklist', 10, y); y += 7;
  
  doc.autoTable({
    startY: y,
    head: [['Documento', 'Obligatorio', 'Estado']],
    body: caseData.checklist.map(item => [
      item.document_name,
      item.is_required ? 'Sí' : 'No',
      item.status === 'DONE' ? '✅' : item.status === 'NA' ? '🚫' : '⏳'
    ]),
    theme: 'striped',
    headStyles: { fillColor: [1, 1, 57] },
  });
  
  // ... más secciones
  
  return doc.output('blob');
}
```

---

### Envío por Correo

**Modal:** "Enviar por Correo" (selección múltiple)

```typescript
interface SendEmailData {
  to_brokers: string[]; // IDs de brokers destinatarios
  subject: string;
  message: string;
  include_pdf: boolean;
  case_ids: string[];
}
```

**Template:**
```html
<div class="email-template">
  <div class="header">
    <img src="{{logo_url}}" alt="Logo" />
    <h2>Reporte de Trámites</h2>
  </div>
  
  <div class="message">
    {{custom_message}}
  </div>
  
  <div class="cases-list">
    <h3>Casos Incluidos:</h3>
    {{#each cases}}
    <div class="case-link">
      <a href="{{portal_url}}/cases/{{id}}">
        <strong>{{case_number}}</strong> - {{client_name}}
      </a>
      <br>
      <small>{{gestion_type}} | {{insurer_name}} | {{status}}</small>
    </div>
    {{/each}}
  </div>
  
  {{#if include_pdf}}
  <p>
    <em>Ver archivo PDF adjunto para más detalles.</em>
  </p>
  {{/if}}
  
  <div class="footer">
    <p>Portal Líderes en Seguros</p>
    <a href="{{portal_url}}">Ir al Portal</a>
  </div>
</div>
```

---

**Fecha de creación:** 2025-10-17  
**Versión:** 1.0
