# 📋 SETUP COMPLETO DEL MÓDULO DE CASOS/PENDIENTES

## 🎯 OBJETIVO

Tener el módulo de Casos/Pendientes 100% funcional con:
- ✅ Webhook de Zoho Mail conectado
- ✅ Integración con módulo de Descargas
- ✅ Wizard de creación de casos completo
- ✅ Gestión de documentos y checklist

---

## 📧 PARTE 1: CONFIGURACIÓN WEBHOOK ZOHO MAIL

### Paso 1: Crear el Endpoint del Webhook

**Ubicación:** `src/app/api/zoho/webhook/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { createHash } from 'crypto';

// Tipos
interface ZohoAttachment {
  name: string;
  mime_type: string;
  size: number;
  content?: string;  // base64
  url?: string;      // URL de descarga
}

interface ZohoWebhookPayload {
  message_id: string;
  thread_id: string;
  from: string;
  from_name?: string;
  to: string[];
  cc?: string[];
  subject: string;
  text_body: string;
  html_body?: string;
  date: string;
  attachments?: ZohoAttachment[];
  headers?: Record<string, string>;
}

// Keywords para clasificación
const ASEGURADORAS_KEYWORDS = {
  'ASSA': ['assa', 'assa compañía', 'assa.com'],
  'MAPFRE': ['mapfre', 'mapfre panama'],
  'FEDPA': ['fedpa', 'federación'],
  'VIVIR': ['vivir seguros', 'vivir'],
  'SURA': ['sura', 'seguros sura'],
  'QUALITAS': ['qualitas', 'quálitas'],
  'ACERTA': ['acerta'],
  'IFS': ['ifs', 'insurance & financial'],
};

const GESTION_KEYWORDS = {
  'COTIZACION': ['cotizar', 'cotización', 'cot.', 'quote', 'presupuesto'],
  'EMISION': ['emitir', 'emisión', 'nueva póliza', 'nueva poliza'],
  'REHABILITACION': ['rehabilitar', 'rehabilitación', 'reactivar'],
  'MODIFICACION': ['modificar', 'modificación', 'cambio', 'ajuste'],
  'CANCELACION': ['cancelar', 'cancelación', 'anular'],
  'CAMBIO_CORREDOR': ['cambio de corredor', 'cambio corredor'],
  'RECLAMO': ['reclamo', 'siniestro', 'claim', 'reclamación'],
};

// Funciones auxiliares
function normalizeText(text: string): string {
  return text
    .replace(/^(re|fw|fwd):\s*/gi, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function detectInsurer(subject: string, body: string): string | null {
  const text = normalizeText(subject + ' ' + body);
  
  for (const [insurer, keywords] of Object.entries(ASEGURADORAS_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      return insurer;
    }
  }
  
  return null;
}

function detectGestion(subject: string, body: string): string | null {
  const text = normalizeText(subject + ' ' + body);
  
  for (const [gestion, keywords] of Object.entries(GESTION_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      return gestion;
    }
  }
  
  return 'REVISION';
}

function detectAssaTicket(subject: string, body: string): string | null {
  const text = subject + ' ' + body;
  const patterns = [
    /TICKET\s*#?\s*(\d+)/i,
    /Ticket:\s*(\d+)/i,
    /REF:\s*(\d+)/i,
    /Caso\s*#?\s*(\d+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

function generateContentHash(body: string): string {
  return createHash('sha256').update(body).digest('hex').substring(0, 16);
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const authHeader = request.headers.get('authorization');
    const expectedKey = process.env.ZOHO_WEBHOOK_KEY;
    
    if (!expectedKey || authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Parsear payload
    const payload: ZohoWebhookPayload = await request.json();
    
    if (!payload.message_id || !payload.from || !payload.subject) {
      return NextResponse.json(
        { error: 'Invalid payload' },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseAdmin();

    // 3. Verificar idempotencia
    const contentHash = generateContentHash(payload.text_body);
    
    const { data: existingCase } = await supabase
      .from('cases')
      .select('id, status')
      .or(`email_message_id.eq.${payload.message_id},and(thread_id.eq.${payload.thread_id},content_hash.eq.${contentHash})`)
      .single();

    // 4. Verificar remitente
    const { data: broker } = await supabase
      .from('brokers')
      .select('id, name, email')
      .eq('email', payload.from.toLowerCase())
      .eq('active', true)
      .single();

    const { data: assistant } = !broker ? await supabase
      .from('broker_assistants')
      .select('id, broker_id, email')
      .eq('email', payload.from.toLowerCase())
      .eq('is_active', true)
      .single() : { data: null };

    const verified = !!(broker || assistant);
    const brokerId = broker?.id || assistant?.broker_id || null;

    // 5. Clasificación automática
    const detectedInsurer = detectInsurer(payload.subject, payload.text_body);
    const detectedGestion = detectGestion(payload.subject, payload.text_body);
    const detectedTicket = detectAssaTicket(payload.subject, payload.text_body);

    // 6. Crear o actualizar caso
    if (existingCase) {
      // ACTUALIZAR caso existente
      const updateData: any = {
        last_email_at: payload.date,
        updated_at: new Date().toISOString(),
      };

      if (detectedTicket && !existingCase.ticket_ref) {
        updateData.ticket_ref = detectedTicket;
      }

      await supabase
        .from('cases')
        .update(updateData)
        .eq('id', existingCase.id);

      // Manejar adjuntos si hay
      if (payload.attachments && payload.attachments.length > 0) {
        await handleAttachments(payload.attachments, existingCase.id, verified);
      }

      // Agregar comentario con el contenido del email
      await supabase
        .from('case_comments')
        .insert({
          case_id: existingCase.id,
          channel: 'ASEGURADORA',
          content: `[Email recibido]\n\n${payload.text_body}`,
          created_by: brokerId || 'SYSTEM',
        });

      return NextResponse.json({
        ok: true,
        case_id: existingCase.id,
        updated: true,
      });
    } else {
      // CREAR nuevo caso
      const now = new Date().toISOString();
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');

      const caseData = {
        broker_id: brokerId,
        insurer_name: detectedInsurer,
        gestion_type: detectedGestion,
        client_name: payload.from_name || payload.from.split('@')[0],
        status: verified ? 'PENDIENTE_REVISION' : 'REVISAR_ORIGEN',
        section: detectedInsurer === 'ASSA' ? 'VIDA_ASSA' : 'SIN_CLASIFICAR',
        ticket_ref: detectedTicket,
        email_message_id: payload.message_id,
        thread_id: payload.thread_id,
        content_hash: contentHash,
        email_subject: payload.subject,
        email_from: payload.from,
        is_verified: verified,
        visto: false,
        created_at: now,
        last_email_at: payload.date,
      };

      const { data: newCase, error: caseError } = await supabase
        .from('cases')
        .insert(caseData)
        .select('id')
        .single();

      if (caseError) throw caseError;

      // Manejar adjuntos
      if (payload.attachments && payload.attachments.length > 0) {
        await handleAttachments(payload.attachments, newCase.id, verified);
      }

      // Agregar primer comentario
      await supabase
        .from('case_comments')
        .insert({
          case_id: newCase.id,
          channel: 'ASEGURADORA',
          content: payload.text_body,
          created_by: brokerId || 'SYSTEM',
        });

      // Notificar si está verificado
      if (verified && brokerId) {
        await supabase
          .from('notifications')
          .insert({
            user_id: brokerId,
            type: 'NEW_CASE',
            title: 'Nuevo trámite asignado',
            message: `Caso ${newCase.id}: ${detectedGestion} - ${detectedInsurer || 'Sin clasificar'}`,
            link: `/cases/${newCase.id}`,
            read: false,
          });
      }

      return NextResponse.json({
        ok: true,
        case_id: newCase.id,
        updated: false,
        section: caseData.section,
      });
    }
  } catch (error: any) {
    console.error('Error en webhook Zoho:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

async function handleAttachments(
  attachments: ZohoAttachment[],
  caseId: string,
  verified: boolean
) {
  const supabase = await getSupabaseAdmin();
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  
  for (const att of attachments) {
    try {
      const basePath = verified
        ? `pendientes/${year}/${month}/${caseId}`
        : `pendientes/_unverified/${year}/${month}/${caseId}`;
      
      const filePath = `${basePath}/${att.name}`;
      
      // Descargar contenido
      let fileContent: Buffer;
      if (att.content) {
        fileContent = Buffer.from(att.content, 'base64');
      } else if (att.url) {
        const response = await fetch(att.url);
        fileContent = Buffer.from(await response.arrayBuffer());
      } else {
        continue;
      }
      
      // Subir a Storage
      const { error: uploadError } = await supabase.storage
        .from('pendientes')
        .upload(filePath, fileContent, {
          contentType: att.mime_type,
          upsert: false,
        });
      
      if (uploadError) {
        console.error(`Error subiendo ${att.name}:`, uploadError);
        continue;
      }
      
      // Registrar en BD
      await supabase.from('case_files').insert({
        case_id: caseId,
        file_name: att.name,
        file_path: filePath,
        mime_type: att.mime_type,
        size_bytes: att.size,
        uploaded_by: 'EMAIL_WEBHOOK',
        is_verified: verified,
      });
    } catch (error) {
      console.error(`Error procesando adjunto ${att.name}:`, error);
    }
  }
}
```

---

### Paso 2: Configurar Variables de Entorno

Agregar en `.env.local`:

```env
# Zoho Mail Webhook
ZOHO_WEBHOOK_KEY=tu_clave_secreta_aqui_generar_con_openssl
```

**Generar clave segura:**
```bash
openssl rand -base64 32
```

---

### Paso 3: Configurar en Zoho Mail

1. **Ir a Zoho Mail Admin Console**
   - URL: `https://mailadmin.zoho.com`
   - Login con cuenta admin

2. **Navegar a Integraciones**
   - Mail Settings → Webhooks
   - Click "Add Webhook"

3. **Configurar Webhook**
   ```
   Name: Portal Líderes - Casos
   URL: https://tu-dominio.com/api/zoho/webhook
   Method: POST
   
   Headers:
   Authorization: Bearer TU_ZOHO_WEBHOOK_KEY
   Content-Type: application/json
   
   Events:
   ✅ New Email Received
   ✅ Email Replied
   
   Filters:
   To Contains: casos@lideresenseguros.com
   OR
   To Contains: tramites@lideresenseguros.com
   ```

4. **Guardar y Probar**
   - Zoho enviará un email de prueba
   - Verificar que llegue al endpoint
   - Revisar logs en servidor

---

### Paso 4: Crear Tabla broker_assistants (si no existe)

```sql
CREATE TABLE IF NOT EXISTS broker_assistants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_broker_assistants_email ON broker_assistants(email);
CREATE INDEX idx_broker_assistants_broker_id ON broker_assistants(broker_id);
```

---

## 📥 PARTE 2: INTEGRACIÓN CON MÓDULO DE DESCARGAS

### Paso 1: Agregar Botón de Descarga en el Wizard

Actualizar `src/components/cases/NewCaseWizard.tsx`:

En el paso de documentos del checklist, agregar botón para descargar desde Descargas:

```tsx
{checklistItem.is_downloadable && (
  <button
    onClick={() => handleDownloadFromLibrary(checklistItem.id)}
    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
  >
    <FaDownload />
    Descargar desde Biblioteca
  </button>
)}
```

---

### Paso 2: Crear Función para Descargar desde Biblioteca

```tsx
const handleDownloadFromLibrary = async (checklistItemId: string) => {
  try {
    // Buscar el documento en la biblioteca de descargas
    const { data: downloadDoc, error } = await supabaseClient()
      .from('download_docs')
      .select(`
        *,
        download_sections!inner(
          insurer_id,
          policy_type,
          scope
        )
      `)
      .eq('download_sections.insurer_id', selectedInsurerId)
      .eq('download_sections.policy_type', selectedPolicyType)
      .single();

    if (error || !downloadDoc) {
      toast.error('Documento no encontrado en la biblioteca');
      return;
    }

    // Descargar el archivo
    const { data: fileData } = await supabaseClient()
      .storage
      .from('downloads')
      .download(downloadDoc.file_path);

    if (!fileData) {
      toast.error('Error al descargar el archivo');
      return;
    }

    // Crear enlace de descarga
    const blob = new Blob([fileData], { type: downloadDoc.mime_type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = downloadDoc.file_name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Documento descargado correctamente');
  } catch (error) {
    console.error('Error descargando desde biblioteca:', error);
    toast.error('Error al descargar documento');
  }
};
```

---

### Paso 3: Filtrar Documentos Descargables

Crear función que identifica qué documentos son descargables vs documentos del cliente:

```tsx
const DOCUMENTOS_CLIENTE = [
  'CEDULA',
  'LICENCIA',
  'RUC',
  'PASAPORTE',
  'TARJETA_RESIDENCIA',
  'FOTO_VEHICULO',
  'INSPECCION',
];

function esDocumentoDescargable(nombreDocumento: string): boolean {
  const nombreNormalizado = nombreDocumento.toUpperCase();
  return !DOCUMENTOS_CLIENTE.some(doc => nombreNormalizado.includes(doc));
}
```

---

### Paso 4: Actualizar Checklist con Indicador

```tsx
{checklistItems.map((item, index) => (
  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
    <div className="flex items-center gap-3">
      <input
        type="checkbox"
        checked={item.completed}
        onChange={() => toggleChecklistItem(index)}
      />
      <span>{item.name}</span>
      {esDocumentoDescargable(item.name) ? (
        <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
          📥 Descargable
        </span>
      ) : (
        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full">
          📄 Cliente
        </span>
      )}
    </div>
    
    <div className="flex gap-2">
      {esDocumentoDescargable(item.name) && (
        <button
          onClick={() => handleDownloadFromLibrary(item.id)}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <FaDownload className="inline mr-1" />
          Descargar
        </button>
      )}
      
      <button
        onClick={() => handleUploadDocument(index)}
        className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
      >
        <FaUpload className="inline mr-1" />
        Adjuntar
      </button>
    </div>
  </div>
))}
```

---

## 🔄 PARTE 3: FLUJO COMPLETO DE TRABAJO

### Caso 1: Email de Broker → Creación Automática

```
1. Broker envía email a casos@lideresenseguros.com
   Asunto: "Cotización Auto - Juan Pérez - ASSA"
   Adjuntos: cedula.pdf, solicitud.pdf

2. Zoho Mail recibe el email
   ↓
3. Zoho activa webhook → POST a /api/zoho/webhook
   ↓
4. Sistema valida:
   ✅ Email del broker está registrado
   ✅ Detecta aseguradora: ASSA
   ✅ Detecta gestión: COTIZACION
   ✅ Detecta tipo: AUTO
   ↓
5. Sistema crea caso:
   - Section: SIN_CLASIFICAR (hasta que Master clasifique)
   - Status: PENDIENTE_REVISION
   - Broker asignado: Auto-detectado
   - Adjuntos guardados en Storage
   ↓
6. Notificación al broker:
   "Tu solicitud fue recibida. Caso #123"
```

---

### Caso 2: Creación Manual por Master

```
1. Master → /cases/new

2. Wizard Paso 1: Datos Básicos
   - Ámbito: GENERALES
   - Tipo póliza: AUTO
   - Aseguradora: ASSA
   - Gestión: EMISION
   - Broker: Juan Pérez
   - SLA: 5 días (auto-calculado)

3. Wizard Paso 2: Cliente
   - Cliente: Pedro González
   - Cédula: 8-123-456
   - Póliza: (opcional por ahora)

4. Wizard Paso 3: Checklist Dinámico
   ✅ Sistema genera checklist automático:
      - Cédula (📄 Cliente) [REQUERIDO]
      - Licencia (📄 Cliente) [REQUERIDO]
      - Solicitud (📥 Descargable) [REQUERIDO]
      - Inspección (📄 Cliente) [REQUERIDO]
      - Cotización (📥 Descargable) [OPCIONAL]
   
   Master puede:
   - Descargar solicitud desde Biblioteca
   - Adjuntar archivo local
   - Agregar documentos adicionales
   - Reordenar ítems

5. Wizard Paso 4: Revisión
   - Resumen completo
   - Validaciones
   [CREAR CASO]

6. Sistema:
   - Crea caso en BD
   - Genera checklist en case_checklist
   - Notifica al broker
   - Redirige a /cases/[id]
```

---

### Caso 3: Marcado como EMITIDO → Preliminar BD

```
1. Master abre caso #456
   Status actual: EN_PROCESO

2. Master completa documentación:
   ✅ Todos los documentos adjuntos
   ✅ Póliza emitida: POL-2025-001

3. Master → "Marcar como EMITIDO"

4. Sistema valida:
   ✅ Tiene número de póliza
   ❌ NO existe en Base de Datos
   ❌ NO es VIDA ASSA WEB

5. Modal aparece:
   ┌────────────────────────────────────┐
   │ ¿Crear preliminar en BD?          │
   │                                    │
   │ Cliente: Pedro González            │
   │ Póliza: POL-2025-001              │
   │ Aseguradora: ASSA                 │
   │                                    │
   │ [SÍ, CREAR]  [NO, SOLO EMITIR]   │
   └────────────────────────────────────┘

6. Si Master elige SÍ:
   - Crea client (is_preliminary: true)
   - Crea policy (is_preliminary: true)
   - Vincula al caso
   - Notifica al broker:
     "Tienes un preliminar pendiente"
   - Cambia status: EMITIDO

7. Broker recibe notificación:
   "Completar datos de POL-2025-001"
   [IR A COMPLETAR] → /database/policies/edit/[id]
```

---

## ✅ CHECKLIST DE VERIFICACIÓN

### Backend
- [ ] Endpoint `/api/zoho/webhook` creado
- [ ] Variables de entorno configuradas
- [ ] Tabla `broker_assistants` creada
- [ ] Tabla `cases` tiene columnas necesarias
- [ ] Tabla `case_files` creada
- [ ] Tabla `case_comments` creada
- [ ] Storage bucket `pendientes` creado
- [ ] RLS policies configuradas

### Frontend
- [ ] NewCaseWizard funcional
- [ ] Integración con Descargas implementada
- [ ] Botones de descarga en checklist
- [ ] Filtro de documentos cliente vs descargables
- [ ] CaseDetail muestra todos los paneles
- [ ] Notificaciones funcionando

### Zoho Mail
- [ ] Webhook configurado en Zoho Admin
- [ ] Headers de autenticación correctos
- [ ] Filtros de email aplicados
- [ ] Email de prueba enviado y procesado

### Testing
- [ ] Enviar email de prueba → caso creado
- [ ] Crear caso manual → checklist generado
- [ ] Descargar desde biblioteca → archivo descargado
- [ ] Adjuntar documento → storage guardado
- [ ] Marcar EMITIDO → modal preliminar aparece
- [ ] Notificaciones llegan al broker

---

## 🚀 DEPLOYMENT

### 1. Subir cambios a producción
```bash
git add .
git commit -m "feat: módulo casos completo con webhook Zoho"
git push origin main
```

### 2. Configurar en Vercel/Servidor
- Agregar variable `ZOHO_WEBHOOK_KEY`
- Verificar que Storage esté configurado
- Probar endpoint público

### 3. Configurar Zoho Mail
- Usar URL de producción
- Probar con email real
- Monitorear logs

---

## 📚 DOCUMENTACIÓN RELACIONADA

- `docs/casos/` - Documentación completa del módulo
- `CASOS_README.md` - README ejecutivo
- `docs/casos/03_INGESTA_CORREO_Y_APIS.md` - Detalles del webhook

---

**¡Módulo de Casos 100% Funcional!** 🎉
