# 🚀 PASOS FINALES PARA COMPLETAR MÓDULO DE CASOS

## 📋 RESUMEN EJECUTIVO

**Estado Actual:**
- ✅ Estructura de BD completa
- ✅ Documentación completa en `docs/casos/`
- ✅ Wizard de creación de casos existente
- ✅ Skeleton del webhook de Zoho Mail
- ✅ Módulo de Descargas funcional

**Pendiente:**
- ⏳ Completar implementación del webhook
- ⏳ Integrar descargas en el wizard
- ⏳ Configurar Zoho Mail webhook
- ⏳ Testing end-to-end

---

## ✅ PASO 1: COMPLETAR WEBHOOK DE ZOHO MAIL

### 1.1 Agregar Variable de Entorno

En `.env.local`:
```env
ZOHO_WEBHOOK_KEY=genera_esto_con_openssl_rand_base64_32
```

### 1.2 Completar Función de Adjuntos

En `src/app/api/zoho/webhook/route.ts`, reemplazar el TODO con:

```typescript
async function handleAttachments(
  caseId: string,
  attachments: ZohoAttachment[],
  verified: boolean
) {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  for (const att of attachments) {
    try {
      // Ruta según verificación
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

### 1.3 Descomentar Llamada a handleAttachments

Buscar en `route.ts` (línea ~126):
```typescript
// TODO: Handle attachments
// if (payload.attachments && payload.attachments.length > 0) {
//   await handleAttachments(result.data.id, payload.attachments);
// }
```

Reemplazar con:
```typescript
// Handle attachments
if (payload.attachments && payload.attachments.length > 0) {
  await handleAttachments(
    result.data!.id,
    payload.attachments,
    senderVerification.verified
  );
}
```

### 1.4 Actualizar Autenticación

Línea ~46-50, reemplazar:
```typescript
// TODO: Verify webhook secret
// const webhookSecret = request.headers.get('x-zoho-webhook-secret');
// if (webhookSecret !== process.env.ZOHO_WEBHOOK_SECRET) {
//   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
// }
```

Con:
```typescript
// Verify webhook secret
const authHeader = request.headers.get('authorization');
const expectedKey = process.env.ZOHO_WEBHOOK_KEY;

if (!expectedKey || authHeader !== `Bearer ${expectedKey}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

---

## ✅ PASO 2: INTEGRAR DESCARGAS EN WIZARD

### 2.1 Actualizar NewCaseWizard.tsx

Buscar el paso de checklist y agregar:

```tsx
import { FaDownload, FaUpload, FaFile } from 'react-icons/fa';

// Definir documentos que son del cliente (no descargables)
const DOCUMENTOS_CLIENTE = [
  'CEDULA',
  'LICENCIA',
  'RUC',
  'PASAPORTE',
  'TARJETA_RESIDENCIA',
  'FOTO_VEHICULO',
  'INSPECCION',
  'FOTO',
];

function esDocumentoDescargable(nombreDocumento: string): boolean {
  const nombreNormalizado = nombreDocumento.toUpperCase();
  return !DOCUMENTOS_CLIENTE.some(doc => nombreNormalizado.includes(doc));
}
```

### 2.2 Agregar Función de Descarga

```tsx
const handleDownloadFromLibrary = async (
  documentName: string,
  insurerId: string,
  policyType: string
) => {
  try {
    const client = supabaseClient();
    
    // Buscar documento en biblioteca
    const { data: downloadDoc, error } = await client
      .from('download_docs')
      .select(`
        *,
        download_sections!inner(
          insurer_id,
          policy_type,
          scope,
          name
        )
      `)
      .eq('download_sections.insurer_id', insurerId)
      .eq('download_sections.policy_type', policyType)
      .ilike('download_sections.name', `%${documentName}%`)
      .single();

    if (error || !downloadDoc) {
      toast.error('Documento no encontrado en la biblioteca');
      return;
    }

    // Descargar archivo
    const { data: fileData } = await client.storage
      .from('downloads')
      .download(downloadDoc.file_path);

    if (!fileData) {
      toast.error('Error al descargar el archivo');
      return;
    }

    // Crear enlace de descarga
    const blob = new Blob([fileData], { type: downloadDoc.mime_type || 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = downloadDoc.file_name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`${downloadDoc.file_name} descargado correctamente`);
  } catch (error) {
    console.error('Error descargando desde biblioteca:', error);
    toast.error('Error al descargar documento');
  }
};
```

### 2.3 Actualizar UI del Checklist

Reemplazar el render de cada ítem del checklist con:

```tsx
{checklistItems.map((item, index) => (
  <div
    key={index}
    className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg hover:border-blue-300 transition"
  >
    <div className="flex items-center gap-3 flex-1">
      <input
        type="checkbox"
        checked={item.completed}
        onChange={() => toggleChecklistItem(index)}
        className="w-5 h-5 text-blue-600"
      />
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{item.name}</span>
          {item.required && (
            <span className="text-red-500 text-sm">*</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {esDocumentoDescargable(item.name) ? (
            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full flex items-center gap-1">
              <FaDownload className="text-xs" />
              Descargable
            </span>
          ) : (
            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full flex items-center gap-1">
              <FaFile className="text-xs" />
              Documento del Cliente
            </span>
          )}
        </div>
      </div>
    </div>
    
    <div className="flex gap-2">
      {esDocumentoDescargable(item.name) && (
        <button
          onClick={() => handleDownloadFromLibrary(
            item.name,
            formData.insurer_id,
            formData.policy_type
          )}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 text-sm"
        >
          <FaDownload />
          Descargar
        </button>
      )}
      
      <button
        onClick={() => handleUploadDocument(index)}
        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 text-sm"
      >
        <FaUpload />
        Adjuntar
      </button>
    </div>
  </div>
))}
```

---

## ✅ PASO 3: CONFIGURAR ZOHO MAIL

### 3.1 Acceder a Zoho Admin Console

1. Ir a: `https://mailadmin.zoho.com`
2. Login con cuenta admin de Líderes en Seguros

### 3.2 Configurar Webhook

1. **Navegar a:**
   - Settings → Integrations → Webhooks
   - Click "Add Webhook"

2. **Configuración:**
   ```
   Name: Portal Líderes - Casos
   
   URL: https://portal-lideres.com/api/zoho/webhook
   
   Method: POST
   
   Headers:
   Authorization: Bearer [TU_ZOHO_WEBHOOK_KEY]
   Content-Type: application/json
   
   Events a escuchar:
   ✅ New Email Received
   ✅ Email Replied
   
   Filtros:
   To Contains: casos@lideresenseguros.com
   OR
   To Contains: tramites@lideresenseguros.com
   ```

3. **Guardar y Probar:**
   - Click "Test Webhook"
   - Verificar que el endpoint responda 200 OK
   - Revisar logs en Vercel/servidor

### 3.3 Crear Email de Prueba

Enviar desde tu email personal a `casos@lideresenseguros.com`:

```
Asunto: Cotización Auto - Juan Pérez - ASSA
Cuerpo:
Buenas tardes,

Solicito cotización para seguro de auto:
- Cliente: Juan Pérez
- Cédula: 8-123-456
- Vehículo: Toyota Corolla 2020
- Uso: Particular

Saludos

Adjuntos: (opcional) cedula.pdf, licencia.pdf
```

Verificar que:
- ✅ Se crea el caso en BD
- ✅ Aparece en `/cases`
- ✅ Adjuntos se guardaron en Storage
- ✅ Clasificación es correcta

---

## ✅ PASO 4: TESTING COMPLETO

### Test 1: Email → Caso Automático
```
✅ Email de broker verificado → Caso PENDIENTE_REVISION
✅ Email de broker no verificado → Caso REVISAR_ORIGEN
✅ Email con adjuntos → Archivos en Storage
✅ Email con ticket ASSA → ticket_ref asignado
✅ Email reply a hilo existente → Actualiza caso
```

### Test 2: Creación Manual
```
✅ Wizard abre correctamente
✅ Checklist se genera dinámicamente
✅ Botón "Descargar" funciona
✅ Botón "Adjuntar" sube archivos
✅ Documentos cliente vs descargables identificados
✅ Caso se crea con todos los datos
```

### Test 3: Flujo Completo ASSA
```
✅ Email inicial sin ticket → Caso creado
✅ Email de respuesta con ticket → Caso actualizado
✅ Ticket asignado correctamente
✅ Notificación al broker
```

### Test 4: Marcado como EMITIDO
```
✅ Validación de policy_number
✅ Modal de preliminar aparece
✅ Creación de preliminar en BD
✅ Notificación al broker
```

---

## 📊 VERIFICACIÓN FINAL

### Base de Datos
```sql
-- Verificar casos creados
SELECT id, client_name, status, broker_id, insurer_name, created_at
FROM cases
ORDER BY created_at DESC
LIMIT 10;

-- Verificar archivos adjuntos
SELECT cf.id, cf.file_name, cf.case_id, cf.uploaded_by
FROM case_files cf
JOIN cases c ON c.id = cf.case_id
ORDER BY cf.created_at DESC
LIMIT 10;

-- Verificar checklist
SELECT cc.id, cc.case_id, cc.document_name, cc.status
FROM case_checklist cc
ORDER BY cc.created_at DESC
LIMIT 20;
```

### Storage
```bash
# Verificar bucket 'pendientes' existe
# Verificar estructura: pendientes/YYYY/MM/case_id/archivo.pdf
# Verificar permisos RLS
```

### Frontend
```
✅ /cases carga correctamente
✅ /cases/new abre wizard
✅ /cases/[id] muestra detalle
✅ Descargas desde biblioteca funcionan
✅ Notificaciones aparecen
```

---

## 🔧 TROUBLESHOOTING

### Webhook no responde
```
1. Verificar variable ZOHO_WEBHOOK_KEY en .env.local
2. Verificar que el endpoint está desplegado
3. Revisar logs en Vercel/servidor
4. Verificar headers de autenticación
```

### Archivos no se suben
```
1. Verificar bucket 'pendientes' existe
2. Verificar RLS policies permiten INSERT
3. Revisar tamaño máximo de archivos
4. Verificar mime_type válido
```

### Checklist no genera
```
1. Verificar tabla case_checklist existe
2. Verificar catálogo de documentos requeridos
3. Revisar función de generación automática
```

### Descargas no funcionan
```
1. Verificar tabla download_docs tiene datos
2. Verificar relación download_sections
3. Verificar insurer_id y policy_type coinciden
4. Revisar permisos de Storage bucket 'downloads'
```

---

## 📚 DOCUMENTACIÓN RELACIONADA

- **Guía Completa:** `docs/SETUP_CASOS_COMPLETO.md`
- **Documentación Módulo:** `docs/casos/`
- **README Ejecutivo:** `CASOS_README.md`
- **Flujo Completo:** `docs/casos/02_FLUJO_MODULO_CASOS.md`
- **APIs:** `docs/casos/03_INGESTA_CORREO_Y_APIS.md`

---

## ✅ CHECKLIST DE ENTREGA

- [ ] `.env.local` tiene `ZOHO_WEBHOOK_KEY`
- [ ] Webhook completo con manejo de adjuntos
- [ ] Autenticación del webhook funcionando
- [ ] NewCaseWizard tiene integración de descargas
- [ ] Botones Descargar/Adjuntar en checklist
- [ ] Filtro de documentos cliente vs descargables
- [ ] Zoho Mail webhook configurado
- [ ] Email de prueba enviado y procesado
- [ ] Caso creado correctamente en BD
- [ ] Archivos guardados en Storage
- [ ] Notificaciones funcionando
- [ ] Testing completo ejecutado
- [ ] Documentación revisada

---

**Una vez completados todos los pasos, el módulo de Casos estará 100% funcional y listo para producción.** 🎉

**Estimado de tiempo:** 2-3 horas
**Prioridad:** Alta
**Dependencias:** Acceso a Zoho Mail Admin Console
