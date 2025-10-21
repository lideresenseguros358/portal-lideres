# 📧 INGESTA POR CORREO Y APIs

## 🔗 Webhook de Zoho Mail

### Endpoint: `/api/zoho/webhook`

**Método:** POST  
**Autenticación:** API Key de Zoho (validar en headers)

---

### Estructura de Entrada (JSON)

```typescript
interface ZohoWebhookPayload {
  message_id: string;        // ID único del mensaje
  thread_id: string;         // ID del hilo de conversación
  from: string;              // email@example.com
  from_name?: string;        // Nombre del remitente
  to: string[];              // Lista de destinatarios
  cc?: string[];             // CCs
  subject: string;           // Asunto
  text_body: string;         // Cuerpo en texto plano
  html_body?: string;        // Cuerpo en HTML
  date: string;              // ISO 8601
  attachments?: Array<{
    name: string;            // nombre.pdf
    mime_type: string;       // application/pdf
    size: number;            // bytes
    content?: string;        // base64
    url?: string;            // URL de descarga
  }>;
  headers?: Record<string, string>;
}
```

---

### Flujo de Procesamiento

#### 1. Idempotencia

```typescript
// Verificar si ya fue procesado
const existingCase = await supabase
  .from('cases')
  .select('id')
  .or(`
    email_message_id.eq.${message_id},
    and(thread_id.eq.${thread_id},content_hash.eq.${hash(body)})
  `)
  .single();

if (existingCase) {
  // ACTUALIZAR el caso existente
  return updateExistingCase(existingCase.id, payload);
} else {
  // CREAR nuevo caso
  return createNewCase(payload);
}
```

**Regla:** Si `message_id` o `(thread_id + hash(body))` ya fue procesado → **ACTUALIZAR** el mismo case; **NO crear otro.**

---

#### 2. Normalización de Texto

```typescript
function normalizeText(text: string): string {
  // Limpiar Fw:, Re:, FWD:, etc.
  text = text.replace(/^(re|fw|fwd):\s*/gi, '').trim();
  
  // Remover firmas comunes
  const signaturePatterns = [
    /--\s*\n.*$/gis,
    /enviado desde mi iphone/gi,
    /sent from my/gi,
  ];
  signaturePatterns.forEach(pattern => {
    text = text.replace(pattern, '');
  });
  
  // Remover disclaimers legales
  text = text.replace(/este correo es confidencial.*/gis, '');
  
  // Homogeneizar tildes y mayúsculas
  text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  return text.trim();
}
```

---

#### 3. Verificación de Remitente

```typescript
async function verifyEmailSender(email: string) {
  // Buscar en brokers activos
  const broker = await supabase
    .from('brokers')
    .select('id, name, email')
    .eq('email', email)
    .eq('is_active', true)
    .single();
  
  if (broker) {
    return { verified: true, broker_id: broker.id, type: 'broker' };
  }
  
  // Buscar en asistentes (whitelist)
  const assistant = await supabase
    .from('broker_assistants')
    .select('id, broker_id, email')
    .eq('email', email)
    .eq('is_active', true)
    .single();
  
  if (assistant) {
    return { verified: true, broker_id: assistant.broker_id, type: 'assistant' };
  }
  
  // NO VERIFICADO
  return { verified: false };
}
```

**Flujo:**
- ✅ **Broker o Asistente validado:**
  - Crear/actualizar caso normal
  - Adjuntos a `pendientes/<yyyy>/<mm>/<case_id>/`
  
- ❌ **NO validado:**
  - Clasificar a **"Sin clasificar" → "No identificados"**
  - Adjuntos a `pendientes/_unverified/<yyyy>/<mm>/<temp_id>/`
  - **NO descargar automáticamente** adjuntos pesados
  - Master debe revisar y validar

---

#### 4. Clasificación Determinista (SIN IA)

##### Detectar Aseguradora

```typescript
const ASEGURADORAS_KEYWORDS = {
  'ASSA': ['assa', 'assa compañía', 'assa.com'],
  'MAPFRE': ['mapfre', 'mapfre panama'],
  'FEDPA': ['fedpa', 'federación'],
  'VIVIR': ['vivir seguros', 'vivir'],
  'SURA': ['sura', 'seguros sura'],
  'QUALITAS': ['qualitas', 'quálitas'],
  'ACERTA': ['acerta'],
  // ... completar con catálogo existente
};

function detectInsurer(subject: string, body: string): string | null {
  const text = (subject + ' ' + body).toLowerCase();
  
  for (const [insurer, keywords] of Object.entries(ASEGURADORAS_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      return insurer;
    }
  }
  
  return null; // No identificada
}
```

---

##### Detectar Gestión

```typescript
const GESTION_KEYWORDS = {
  'COTIZACION': ['cotizar', 'cotización', 'cot.', 'quote', 'presupuesto'],
  'EMISION': ['emitir', 'emisión', 'nueva póliza', 'nueva poliza', 'emitir póliza'],
  'REHABILITACION': ['rehabilitar', 'rehabilitación', 'reactivar', 'reactivación'],
  'MODIFICACION': ['modificar', 'modificación', 'cambio', 'ajuste', 'actualizar'],
  'CANCELACION': ['cancelar', 'cancelación', 'anular', 'anulación'],
  'CAMBIO_CORREDOR': ['cambio de corredor', 'cambio corredor', 'transfer'],
  'RECLAMO': ['reclamo', 'siniestro', 'claim', 'reclamación'],
  'EMISION_EXPRESS': ['express', 'emisión express', 'urgente emisión'],
};

function detectGestion(subject: string, body: string): string | null {
  const text = (subject + ' ' + body).toLowerCase();
  
  for (const [gestion, keywords] of Object.entries(GESTION_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      return gestion;
    }
  }
  
  return 'REVISION'; // Por defecto requiere revisión
}
```

---

##### Detectar Rama/Tipo de Póliza

```typescript
const TIPO_POLIZA_KEYWORDS = {
  'VIDA_ASSA': ['vida assa', 'seguro de vida assa'],
  'VIDA_WEB': ['vida web', 'web life'],
  'SALUD': ['salud', 'health', 'médico', 'medico'],
  'AUTO': ['auto', 'vehículo', 'vehiculo', 'carro', 'moto'],
  'INCENDIO': ['incendio', 'fire', 'estructura'],
  'MULTIPOLIZA': ['multipóliza', 'multipoliza', 'hogar'],
  'RC': ['responsabilidad civil', 'rc ', 'liability'],
  'AP': ['accidentes personales', 'ap ', 'personal accident'],
  'COLECTIVO': ['colectivo', 'collective', 'grupo'],
  // ... completar
};
```

---

##### ASSA: Detectar Ticket

```typescript
function detectAssaTicket(subject: string, body: string): string | null {
  const text = subject + ' ' + body;
  
  // Patrones conocidos de ASSA
  const patterns = [
    /TICKET\s*#?\s*(\d+)/i,
    /Ticket:\s*(\d+)/i,
    /REF:\s*(\d+)/i,
    /Caso\s*#?\s*(\d+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1]; // Retorna el número de ticket
    }
  }
  
  return null;
}
```

**Flujo ASSA Específico:**

```typescript
// Sin ticket inicial
if (!ticket_ref && insurer === 'ASSA') {
  // Crear/actualizar en tab "Vida ASSA"
  // Estado: PENDIENTE_REVISION
}

// Respuesta con ticket
if (ticket_ref && insurer === 'ASSA') {
  // Buscar caso existente por:
  const existingCase = await findByTicketOrThread(ticket_ref, thread_id);
  
  if (existingCase) {
    // ASOCIAR ticket al caso
    await updateCase(existingCase.id, {
      ticket_ref,
      suggested_status: analyzeStatusFromContent(body)
    });
    
    // Notificar a Master/Broker para CONFIRMAR estado
    await notifyStatusSuggestion(existingCase.id);
  }
}
```

⚠️ **IMPORTANTE:** Humano SIEMPRE confirma cambios de estado sugeridos.

---

#### 5. Agrupación 48h (si NO hay ticket_ref)

```typescript
async function tryGroupWithin48h(payload: ZohoWebhookPayload) {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h atrás
  
  const existingCase = await supabase
    .from('cases')
    .select('id')
    .eq('broker_id', broker_id)
    .eq('gestion_type', detected_gestion)
    .ilike('client_name', `%${guessed_client}%`)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (existingCase) {
    // ACTUALIZAR caso existente (adjuntos + comentario)
    return updateExistingCase(existingCase.id, payload);
  } else {
    // CREAR nuevo caso
    return createNewCase(payload);
  }
}
```

---

#### 6. Manejo de Adjuntos

```typescript
async function handleAttachments(
  attachments: ZohoAttachment[],
  caseId: string,
  verified: boolean
) {
  const uploadedFiles = [];
  
  for (const att of attachments) {
    // Ruta según verificación
    const basePath = verified
      ? `pendientes/${year}/${month}/${caseId}`
      : `pendientes/_unverified/${year}/${month}/${tempId}`;
    
    const filePath = `${basePath}/${att.name}`;
    
    // Descargar contenido (si es base64 o URL)
    const fileContent = att.content
      ? Buffer.from(att.content, 'base64')
      : await downloadFromUrl(att.url);
    
    // Subir a Supabase Storage
    const { data, error } = await supabase.storage
      .from('pendientes')
      .upload(filePath, fileContent, {
        contentType: att.mime_type,
        upsert: false
      });
    
    if (error) {
      console.error(`Error subiendo ${att.name}:`, error);
      continue;
    }
    
    // Registrar en case_files
    await supabase.from('case_files').insert({
      case_id: caseId,
      file_name: att.name,
      file_path: filePath,
      mime_type: att.mime_type,
      size_bytes: att.size,
      uploaded_by: 'EMAIL_WEBHOOK',
      is_verified: verified,
      created_at: new Date().toISOString()
    });
    
    uploadedFiles.push({ name: att.name, path: filePath });
  }
  
  return uploadedFiles;
}
```

**Reglas de Storage:**
- ✅ Guardar **nombre original**
- ✅ Guardar **mime type**
- ❌ **NO renombrar** automáticamente
- ❌ **NO** poner marca de agua

---

#### 7. Auto-Respuesta

```typescript
async function sendAutoReply(to: string, caseId: string, section: string) {
  const subject = `Confirmación de Recepción - Caso ${caseId}`;
  const body = `
Estimado/a,

Hemos recibido su correo correctamente.

**ID del Caso:** ${caseId}
**Sección:** ${section}
**Estado:** En revisión

Podrá dar seguimiento a este trámite ingresando al Portal de Líderes en Seguros.

Saludos cordiales,
Portal Líderes en Seguros
  `.trim();
  
  await sendEmail({
    to,
    subject,
    body,
    template: 'simple_notification'
  });
}
```

---

#### 8. Notificaciones

```typescript
// Campanita (in-app)
await supabase.from('notifications').insert({
  user_id: broker_id,
  type: 'NEW_CASE',
  title: 'Nuevo trámite asignado',
  message: `Caso ${caseId}: ${gestion_type} - ${insurer_name}`,
  link: `/cases/${caseId}`,
  read: false
});

// Badge "Nuevos"
// Query: status = 'PENDIENTE_REVISION' AND visto = false
```

---

#### 9. Respuesta del Webhook

```typescript
return Response.json({
  ok: true,
  case_id: createdCase.id,
  updated: isUpdate,
  section: determinedSection,
  status: determinedStatus,
  attachments_count: attachments.length
}, { status: 200 });
```

---

## 🔌 APIs del Módulo Casos

### Cases CRUD

#### `POST /api/cases`
**Permisos:** Master  
**Body:**
```typescript
{
  ambito: 'GENERALES' | 'PERSONAS',
  policy_type_id: string,
  insurer_id: string,
  gestion_type: 'COTIZACION' | 'EMISION' | ...,
  broker_id: string,
  admin_id?: string,
  sla_days: number,
  client_name?: string,
  client_id?: string,
  policy_number?: string,
  forma_pago?: string,
  prima?: number,
  checklist_items?: ChecklistItem[]
}
```
**Respuesta:**
```typescript
{ ok: true, case_id: string }
```

---

#### `PUT /api/cases/:id`
**Permisos:** Master  
**Body:** (campos a actualizar)  
**Respuesta:** `{ ok: true }`

---

#### `DELETE /api/cases/:id`
**Permisos:** Master  
**Acción:** Mueve a Papelera (30 días)  
**Respuesta:** `{ ok: true, deleted_at: ISO_DATE }`

---

### Estados

#### `POST /api/cases/:id/status`
**Permisos:** Master  
**Body:**
```typescript
{
  new_status: CaseStatus,
  policy_number?: string  // Requerido si new_status = 'EMITIDO'
}
```
**Validaciones:**
- Si `new_status = 'EMITIDO'` → validar `policy_number`
- Si NO existe en BD y NO es VIDA ASSA WEB → retornar:
  ```typescript
  {
    ok: false,
    requires_preliminar: true,
    client_name: string,
    policy_number: string
  }
  ```

**Respuesta:**
```typescript
{ ok: true, status: string }
```

---

### Checklist

#### `POST /api/cases/:id/checklist`
**Permisos:** Master  
**Body:**
```typescript
{
  document_name: string,
  is_required: boolean,
  is_downloadable: boolean,
  download_link?: string,
  is_recurrent?: boolean  // Si sí, también guardar en Descargas
}
```
**Respuesta:** `{ ok: true, item_id: string }`

---

#### `PUT /api/cases/:id/checklist/:item_id`
**Permisos:** Master y Broker (solo sus casos)  
**Body:**
```typescript
{
  status: 'DONE' | 'PENDING' | 'NA',
  file_id?: string,  // Opcional si se marca DONE sin archivo (solo Master)
  notes?: string
}
```
**Respuesta:** `{ ok: true }`

---

### Adjuntos

#### `POST /api/cases/:id/files`
**Permisos:** Master y Broker (solo sus casos)  
**Body:** FormData con archivo  
**Proceso:**
1. Subir a Storage: `pendientes/<yyyy>/<mm>/<case_id>/<filename>`
2. Registrar en `case_files`
3. Si no está en checklist → preguntar si es recurrente

**Respuesta:**
```typescript
{
  ok: true,
  file_id: string,
  file_path: string,
  prompt_recurrent: boolean
}
```

---

#### `DELETE /api/cases/:id/files/:file_id`
**Permisos:** Solo Master  
**Acción:** Elimina de Storage y BD  
**Respuesta:** `{ ok: true }`

---

### Comentarios

#### `POST /api/cases/:id/comments`
**Permisos:** Master y Broker (solo sus casos)  
**Body:**
```typescript
{
  channel: 'ASEGURADORA' | 'OFICINA',
  content: string
}
```
**Respuesta:** `{ ok: true, comment_id: string }`

---

### Reclasificar

#### `POST /api/cases/:id/reclassify`
**Permisos:** Solo Master  
**Body:**
```typescript
{
  new_section?: string,
  new_policy_type_id?: string,
  new_broker_id?: string,
  new_gestion_type?: string,
  reason?: string
}
```
**Acciones:**
- Actualizar campos
- Registrar en historial
- Notificar nuevo broker si cambió

**Respuesta:** `{ ok: true }`

---

### Fusionar

#### `POST /api/cases/merge`
**Permisos:** Solo Master  
**Body:**
```typescript
{
  from_ids: string[],  // IDs de casos a fusionar
  to_id: string        // ID del caso destino
}
```
**Acciones:**
1. Mover todos los adjuntos a `to_id`
2. Copiar todos los comentarios a `to_id`
3. Concatenar checklists (evitar duplicados)
4. Cerrar casos origen con nota "Fusionado a caso X"
5. Registrar en historial

**Respuesta:** `{ ok: true, merged_count: number }`

---

### Pagos/Comisiones

#### `POST /api/cases/:id/discount`
**Permisos:** Solo Master  
**Body:**
```typescript
{
  amount: number,
  notes?: string
}
```
**Acciones:**
- Marca "descontar a corredor"
- Crea pendiente en módulo Cheques
- Genera deuda en Adelantos

**Respuesta:** `{ ok: true, adelanto_id: string }`

---

#### `POST /api/cases/:id/direct-payment`
**Permisos:** Solo Master  
**Body:**
```typescript
{
  amount: number,
  notes?: string
}
```
**Acciones:**
- Marca como "pago directo"
- Elimina deuda si existía

**Respuesta:** `{ ok: true }`

---

### Preliminar BD

#### `POST /api/cases/:id/create-db-preliminar`
**Permisos:** Solo Master  
**Body:**
```typescript
{
  client_data: {
    name: string,
    national_id?: string,
    // ... otros campos
  },
  policy_data: {
    policy_number: string,
    insurer_id: string,
    policy_type_id: string,
    // ... otros campos
  }
}
```
**Acciones:**
1. Crear en `clients` (is_preliminary = true)
2. Crear en `policies` (is_preliminary = true)
3. Vincular al caso
4. Notificar al broker:
   ```
   "Tienes un preliminar para completar"
   [IR A COMPLETAR]
   ```

**Respuesta:**
```typescript
{
  ok: true,
  client_id: string,
  policy_id: string
}
```

---

**Continúa en archivo siguiente...**
