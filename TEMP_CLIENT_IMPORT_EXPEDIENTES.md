# 📁 Conexión de temp_client_import con Bucket Expediente

## ✅ Estado Actual

- **Bucket:** `expediente` (ya existe y funciona perfectamente)
- **Tabla:** `temp_client_import` (ya existe en BD)
- **Lógica actual:** Funciona para clients y policies oficiales
- **Pendiente:** Conectar temp_client_import al mismo bucket

---

## 🎯 Objetivo

Permitir que los documentos de expediente se mantengan durante todo el flujo:

```
Pendientes (casos IMAP)
       ↓
Preliminar (temp_client_import)
       ↓
Oficial (clients + policies)
```

**Importante:** Los expedientes NO se pierden en ninguna etapa del tránsito.

---

## 📋 Tabla temp_client_import - Campos Relevantes

```typescript
temp_client_import: {
  id: string                    // UUID del registro temporal
  client_id: string | null      // Si ya se vinculó a cliente oficial
  policy_id: string | null      // Si ya se vinculó a póliza oficial
  client_name: string | null    // Nombre del cliente
  national_id: string | null    // Cédula
  broker_id: string | null      // Broker asignado
  insurer_id: string | null     // Aseguradora
  policy_number: string | null  // Número de póliza
  migrated: boolean             // Si ya se oficializó
  migrated_at: string | null    // Cuándo se oficializó
  source: string | null         // Origen: 'email_ingestion', 'commission', etc
  source_id: string | null      // ID del caso/email origen
}
```

---

## 🔗 Implementación - Usar el Mismo Sistema

### ExpedienteManager ya Funciona

El componente `ExpedienteManager.tsx` ya acepta:

```typescript
interface ExpedienteManagerProps {
  clientId: string;           // ✅ Puede ser temp_client_import.id
  policyId?: string | null;   // ✅ Puede ser temp_client_import.id si hay póliza temporal
  showClientDocs?: boolean;   // Cédula, licencia
  showPolicyDocs?: boolean;   // Registro vehicular
  showOtros?: boolean;        // Otros documentos
  readOnly?: boolean;         // Master puede editar, broker solo ver
}
```

### Uso en Pendientes

Cuando un caso pasa a Preliminar:

```typescript
// 1. Crear registro temporal
const { data: tempImport } = await supabase
  .from('temp_client_import')
  .insert({
    client_name: caso.client_name,
    national_id: caso.national_id,
    broker_id: caso.broker_id,
    policy_number: caso.policy_number,
    insurer_id: caso.insurer_id,
    source: 'email_ingestion',
    source_id: caso.id,  // ID del caso
    migrated: false,
  })
  .select()
  .single();

// 2. El expediente usa el mismo bucket
// ExpedienteManager maneja automáticamente la ruta:
// clients/{tempImport.id}/cedula/...
// clients/{tempImport.id}/licencia/...
// clients/{tempImport.id}/policies/{tempPolicyId}/registro_vehicular/...
```

### Función generateFilePath en expediente.ts

La función ya genera rutas correctas:

```typescript
function generateFilePath(
  clientId: string,        // Puede ser temp_client_import.id
  policyId: string | null, // Puede ser temp_client_import.id de póliza temporal
  documentType: DocumentType,
  fileName: string
): string {
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  
  if (documentType === 'registro_vehicular' && policyId) {
    // Ruta: clients/{clientId}/policies/{policyId}/registro_vehicular/{file}
    return `clients/${clientId}/policies/${policyId}/${documentType}/${timestamp}_${sanitizedFileName}`;
  } else {
    // Ruta: clients/{clientId}/{documentType}/{file}
    return `clients/${clientId}/${documentType}/${timestamp}_${sanitizedFileName}`;
  }
}
```

**Resultado:** Los archivos se guardan en el bucket usando el ID temporal como si fuera un clientId oficial.

---

## 🔄 Flujo Completo con Expedientes

### 1. Caso Nuevo desde IMAP (Pendientes)

```
Email ingresado → Caso creado → Estado: "Sin clasificar"
```

**Expediente:** NO se crea aún (caso no tiene datos completos)

### 2. Master Clasifica y Pasa a Preliminar

```typescript
// Master revisa caso, completa datos, decide "pasar a preliminar"
const { data: tempImport } = await supabase
  .from('temp_client_import')
  .insert({
    client_name: "JUAN PÉREZ",
    national_id: "8-123-4567",
    broker_id: caso.broker_id,
    policy_number: "POL-2024-001",
    insurer_id: "uuid-aseguradora",
    source: 'email_ingestion',
    source_id: caso.id,
    migrated: false,
  })
  .select()
  .single();

// Vincular caso con temp_import
await supabase
  .from('cases')
  .update({ temp_import_id: tempImport.id })
  .eq('id', caso.id);
```

**Expediente:** Master puede subir documentos usando `ExpedienteManager`:

```tsx
<ExpedienteManager
  clientId={tempImport.id}  // ID temporal
  policyId={null}
  showClientDocs={true}     // Cédula, licencia
  showPolicyDocs={false}    // Aún no hay póliza temporal
  showOtros={true}
  readOnly={false}          // Master puede subir
/>
```

**Bucket:** `expediente/clients/{tempImport.id}/cedula/...`

### 3. Master Completa y Oficializa

```typescript
// Master verifica que todo esté correcto
// Crea cliente y póliza oficiales
const { data: client } = await supabase
  .from('clients')
  .insert({
    name: tempImport.client_name,
    national_id: tempImport.national_id,
    broker_id: tempImport.broker_id,
  })
  .select()
  .single();

const { data: policy } = await supabase
  .from('policies')
  .insert({
    client_id: client.id,
    policy_number: tempImport.policy_number,
    insurer_id: tempImport.insurer_id,
    broker_id: tempImport.broker_id,
  })
  .select()
  .single();

// Actualizar temp_import como migrado
await supabase
  .from('temp_client_import')
  .update({
    client_id: client.id,
    policy_id: policy.id,
    migrated: true,
    migrated_at: new Date().toISOString(),
  })
  .eq('id', tempImport.id);
```

**Expediente:** Los archivos YA ESTÁN en el bucket:
- `expediente/clients/{tempImport.id}/cedula/...`
- `expediente/clients/{tempImport.id}/licencia/...`

**NO se mueven ni copian.** La tabla `expediente_documents` tiene:

```sql
SELECT * FROM expediente_documents WHERE client_id = '{tempImport.id}';
```

**Resultado:** Los documentos siguen en el mismo lugar, solo se marca el registro como "migrado".

### 4. Vista en Base de Datos Oficial

```tsx
// En /db, al ver el cliente oficial
<ExpedienteManager
  clientId={client.id}  // ID oficial
  policyId={policy.id}
  showClientDocs={true}
  showPolicyDocs={true}
  showOtros={true}
/>
```

**El componente carga documentos de:**
1. `client_id = {client.id}` (documentos del cliente oficial)
2. **Y también** de `client_id = {tempImport.id}` (documentos que se subieron en preliminar)

**Query en expediente.ts:**

```typescript
export async function getClientDocuments(clientId: string): Promise<ExpedienteDocument[]> {
  const supabase = supabaseClient();
  
  // Buscar por client_id (puede ser oficial o temporal)
  const { data, error } = await supabase
    .from('expediente_documents')
    .select('*')
    .eq('client_id', clientId)
    .order('uploaded_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching client documents:', error);
    return [];
  }
  
  return data || [];
}
```

**Entonces:** Si subiste documentos en preliminar con `client_id = tempImport.id`, esos documentos se ven cuando accedes con el `client.id` oficial **SI** el componente busca también en temp_import.

---

## 🔧 Ajuste Necesario en ExpedienteManager

Para que los documentos de preliminar se vean en oficial, agregar lógica:

```typescript
// En ExpedienteManager.tsx, al cargar documentos:

const loadDocuments = async () => {
  setLoading(true);
  try {
    let docs: ExpedienteDocument[] = [];
    
    // 1. Cargar documentos del clientId actual (oficial o temporal)
    const clientDocs = await getClientDocuments(clientId);
    docs.push(...clientDocs);
    
    // 2. Si es un cliente oficial, buscar si vino de temp_import
    if (clientId.length === 36) { // UUID oficial
      const { data: tempImport } = await supabase
        .from('temp_client_import')
        .select('id')
        .eq('client_id', clientId)
        .single();
      
      if (tempImport) {
        // Cargar documentos del registro temporal
        const tempDocs = await getClientDocuments(tempImport.id);
        docs.push(...tempDocs);
      }
    }
    
    // 3. Si hay policyId, cargar documentos de póliza
    if (policyId) {
      const policyDocs = await getPolicyDocuments(policyId);
      docs.push(...policyDocs);
    }
    
    // Eliminar duplicados por ID
    const uniqueDocs = Array.from(new Map(docs.map(d => [d.id, d])).values());
    setDocuments(uniqueDocs);
  } catch (error) {
    console.error('Error loading documents:', error);
  } finally {
    setLoading(false);
  }
};
```

---

## 📊 Ventajas de Este Enfoque

### ✅ Sin Copiar Archivos
- Los archivos se suben una sola vez al bucket
- No hay duplicación de storage
- Path permanece constante

### ✅ Sin Mover Archivos
- No hay operaciones de move/copy costosas
- Menor tiempo de procesamiento
- Menor riesgo de errores

### ✅ Historial Completo
- Todos los documentos visibles en oficial
- Auditoría de cuándo se subieron (en preliminar vs oficial)
- Trazabilidad completa del flujo

### ✅ Mismo Componente
- `ExpedienteManager` funciona igual para temporal y oficial
- No hay código duplicado
- Mantenimiento sencillo

---

## 🚀 Implementación Inmediata

### Paso 1: Ajustar ExpedienteManager

Agregar la lógica de búsqueda en temp_import cuando se carga un cliente oficial.

### Paso 2: Agregar Campo a Cases

```sql
-- Migración adicional
ALTER TABLE cases ADD COLUMN temp_import_id UUID NULL;
ALTER TABLE cases ADD CONSTRAINT cases_temp_import_fkey 
  FOREIGN KEY (temp_import_id) REFERENCES temp_client_import(id);
```

Esto permite vincular casos de Pendientes con registros de Preliminar.

### Paso 3: UI en Pendientes

Agregar botón "Pasar a Preliminar" en el modal de detalle de caso:

```typescript
const handleMoveToPreliminar = async () => {
  // Crear registro temporal
  const { data: tempImport } = await supabase
    .from('temp_client_import')
    .insert({
      client_name: caso.detected_client_name,
      broker_id: caso.broker_id,
      source: 'email_ingestion',
      source_id: caso.id,
      migrated: false,
    })
    .select()
    .single();
  
  // Vincular caso
  await supabase
    .from('cases')
    .update({ 
      temp_import_id: tempImport.id,
      estado_simple: 'En proceso',
    })
    .eq('id', caso.id);
  
  // Navegar a preliminar
  router.push(`/db/preliminary/${tempImport.id}`);
};
```

---

## ✅ Conclusión

**No se requiere crear un bucket nuevo.** El bucket `expediente` existente funciona perfectamente para:

1. ✅ Clientes oficiales (`clients`)
2. ✅ Pólizas oficiales (`policies`)
3. ✅ **Registros temporales (`temp_client_import`)**

**El mismo sistema de rutas funciona:**
- `clients/{id}/cedula/...` donde `id` puede ser oficial o temporal
- `clients/{id}/policies/{policyId}/registro_vehicular/...`

**Los expedientes nunca se pierden porque:**
1. Se suben al bucket usando el ID temporal
2. La tabla `expediente_documents` registra `client_id = temp_import_id`
3. Cuando se oficializa, el expediente sigue accesible usando ese ID
4. El componente carga documentos de ambos IDs (temporal + oficial)

**Todo está listo. Solo falta:**
- Ajustar `ExpedienteManager` para buscar también en temp_import
- Agregar campo `temp_import_id` a tabla `cases`
- Implementar botón "Pasar a Preliminar" en UI de Pendientes

El bucket `expediente` maneja todo el flujo sin necesidad de cambios adicionales. 🎉
