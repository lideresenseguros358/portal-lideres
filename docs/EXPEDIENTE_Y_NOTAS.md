# Sistema de Expediente y Notas

**Fecha:** 29 de octubre de 2025  
**Versión:** 1.0

## Descripción General

Este documento describe las mejoras al sistema de gestión de pólizas y clientes, incluyendo:
1. **Columna "notas"** en la tabla `policies` para información personalizada
2. **Bucket "expediente"** en storage para documentos de clientes y pólizas
3. **Integración automática** con el sistema de trámites/pendientes

---

## 1. Columna "notas" en Pólizas

### Propósito
Permitir a los corredores agregar información personalizada sobre cada póliza.

### Implementación

**Migración SQL:**
```sql
-- Archivo: 20251029_add_notas_column_to_policies.sql
ALTER TABLE policies ADD COLUMN IF NOT EXISTS notas TEXT;
```

**Características:**
- ✅ Campo de texto libre (TEXT)
- ✅ Opcional (permite NULL)
- ✅ Índice de búsqueda full-text en español
- ✅ Visible en toda la interfaz de base de datos

**Ubicaciones en la UI:**
- Wizard de nuevo cliente/póliza
- Modal de edición de póliza
- Tabla de pólizas (expandible)
- Vista detallada de cliente

---

## 2. Storage "expediente"

### Propósito
Almacenar documentos importantes de clientes y pólizas de forma organizada y segura.

### Estructura

**Bucket:** `expediente` (privado)

**Organización de archivos:**
```
expediente/
├── clients/
│   ├── {client_id}/
│   │   ├── cedula/
│   │   │   └── cedula_{timestamp}.pdf
│   │   └── licencia/
│   │       └── licencia_{timestamp}.pdf
│   └── {client_id}/
│       └── policies/
│           └── {policy_id}/
│               └── registro_vehicular/
│                   └── registro_{timestamp}.pdf
```

### Tipos de Documentos

#### Por Cliente (una vez por cliente)
1. **Cédula** (`cedula`)
   - Documento de identidad
   - Requerido para todos los clientes
   - Path: `clients/{client_id}/cedula/`

2. **Licencia** (`licencia`)
   - Licencia de conducir
   - Opcional, pero recomendado para pólizas de auto
   - Path: `clients/{client_id}/licencia/`

#### Por Póliza (específico de cada póliza)
3. **Registro Vehicular** (`registro_vehicular`)
   - Registro del vehículo asegurado
   - Solo para pólizas de auto
   - Path: `clients/{client_id}/policies/{policy_id}/registro_vehicular/`

### Formatos Permitidos
- PDF (`.pdf`)
- Imágenes: JPEG (`.jpg`, `.jpeg`), PNG (`.png`), WebP (`.webp`)
- Límite de tamaño: **10 MB** por archivo

---

## 3. Tabla `expediente_documents`

### Propósito
Registrar metadatos de todos los documentos subidos al expediente.

### Estructura
```sql
CREATE TABLE expediente_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  policy_id UUID REFERENCES policies(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('cedula', 'licencia', 'registro_vehicular')),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Constraint Importante
```sql
CONSTRAINT valid_document_type_policy CHECK (
  (document_type IN ('cedula', 'licencia') AND policy_id IS NULL) OR
  (document_type = 'registro_vehicular' AND policy_id IS NOT NULL)
)
```

**Esto asegura que:**
- Cédula y Licencia NO tienen `policy_id` (son del cliente)
- Registro Vehicular SÍ tiene `policy_id` (es de la póliza)

---

## 4. Permisos (RLS Policies)

### Storage Bucket "expediente"

**Permisos por rol:**

| Acción | Master | Broker (propios clientes) | Broker (otros clientes) |
|--------|--------|---------------------------|-------------------------|
| Ver    | ✅ Todo | ✅ Sí                     | ❌ No                   |
| Subir  | ✅ Todo | ✅ Sí                     | ❌ No                   |
| Actualizar | ✅ Todo | ✅ Sí                 | ❌ No                   |
| Eliminar | ✅ Todo | ✅ Sí                   | ❌ No                   |

### Tabla `expediente_documents`

Las mismas políticas aplican:
- **Masters**: Acceso total
- **Brokers**: Solo sus propios clientes

---

## 5. Integración con Trámites/Pendientes

### Flujo Automático

Cuando un trámite es marcado como **"Emitido"**:

1. **Verificar si el cliente existe**
   - Si NO existe → Crear cliente automáticamente
   - Si SÍ existe → Continuar

2. **Verificar si tiene documentos actualizados**
   - Revisar en `expediente_documents`
   - Verificar fechas de subida

3. **Si faltan documentos o están desactualizados**
   - Extraer archivos del trámite (cédula, licencia, registro)
   - Subir a bucket `expediente`
   - Registrar en `expediente_documents`
   - Vincular con `client_id` y `policy_id` correspondientes

4. **Actualizar base de datos**
   - Cliente actualizado con documentos
   - Póliza vinculada con registro vehicular
   - Expediente completo

### Páginas Afectadas
- `/requests` - Sistema de trámites
- `/db` - Base de datos de clientes
- Modal de edición de cliente
- Wizard de nuevo cliente

---

## 6. Migraciones SQL

### Ejecutar migraciones

**Orden de ejecución:**
```bash
# 1. Agregar columna notas
npx supabase migration up --file 20251029_add_notas_column_to_policies.sql

# 2. Crear expediente storage
npx supabase migration up --file 20251029_create_expediente_storage.sql
```

**O ejecutar todas las pendientes:**
```bash
npx supabase db push
```

### Regenerar tipos TypeScript
```bash
npx supabase gen types typescript --local > src/lib/supabase/database.types.ts
```

---

## 7. Componentes de UI a Actualizar

### Frontend Components

1. **`ClientPolicyWizard.tsx`**
   - Agregar input "notas"
   - Agregar sección de carga de documentos

2. **`PolicyForm.tsx` / `PolicyEditModal.tsx`**
   - Campo de notas (textarea)
   - Gestión de documentos (si es póliza de auto)

3. **`DatabaseTabs.tsx`**
   - Mostrar notas en panel expandible de pólizas
   - Icono de expediente si tiene documentos

4. **`ClientForm.tsx`**
   - Sección de expediente
   - Carga de cédula y licencia

5. **Nuevo: `ExpedienteManager.tsx`**
   - Componente para gestionar documentos
   - Vista previa de archivos
   - Carga y eliminación

6. **`RequestsList.tsx` / Trámites**
   - Botón de "Actualizar Expediente"
   - Extracción automática al marcar como emitido

---

## 8. Utilidades a Crear

### `src/lib/storage/expediente.ts`

Funciones auxiliares:
```typescript
// Upload document
uploadExpedienteDocument(
  clientId: string,
  policyId: string | null,
  documentType: 'cedula' | 'licencia' | 'registro_vehicular',
  file: File
): Promise<string>

// Get documents
getClientDocuments(clientId: string): Promise<ExpedienteDocument[]>
getPolicyDocuments(policyId: string): Promise<ExpedienteDocument[]>

// Delete document
deleteExpedienteDocument(documentId: string): Promise<void>

// Get public URL (signed URL for private bucket)
getExpedienteDocumentUrl(filePath: string): Promise<string>
```

---

## 9. Testing

### Checklist de Pruebas

**Columna notas:**
- [ ] Crear póliza con notas
- [ ] Editar notas de póliza existente
- [ ] Ver notas en tabla expandible
- [ ] Búsqueda de texto en notas

**Expediente storage:**
- [ ] Subir cédula (cliente)
- [ ] Subir licencia (cliente)
- [ ] Subir registro vehicular (póliza)
- [ ] Ver documentos subidos
- [ ] Descargar documentos
- [ ] Eliminar documentos
- [ ] Verificar permisos (broker solo ve sus clientes)

**Integración con trámites:**
- [ ] Marcar trámite como emitido
- [ ] Verificar creación automática de cliente (si no existe)
- [ ] Verificar subida automática de documentos
- [ ] Verificar actualización de base de datos

---

## 10. Notas Técnicas

### Consideraciones de Seguridad
- ✅ Bucket privado (no acceso público)
- ✅ RLS activado en todas las tablas
- ✅ Validación de tipos MIME
- ✅ Límite de tamaño de archivo
- ✅ Signed URLs con expiración

### Performance
- ✅ Índices en `client_id`, `policy_id`, `document_type`
- ✅ Índice full-text en columna `notas`
- ✅ Carga diferida de documentos (lazy loading)

### Backup
- Los documentos en storage se incluyen en backups automáticos de Supabase
- La tabla `expediente_documents` se incluye en dumps de BD

---

## 11. Roadmap Futuro

### Mejoras Potenciales
- [ ] OCR automático de documentos
- [ ] Validación automática de cédulas (formato)
- [ ] Alertas de documentos próximos a vencer
- [ ] Compresión automática de imágenes grandes
- [ ] Versioning de documentos (historial)
- [ ] Firma digital de documentos
- [ ] Integración con API de Registro Público

---

## Resumen

Este sistema proporciona:
1. ✅ **Notas personalizadas** en cada póliza
2. ✅ **Expediente digital** seguro y organizado
3. ✅ **Automatización** de actualización desde trámites
4. ✅ **Permisos granulares** por rol
5. ✅ **Trazabilidad** completa de documentos

**Estado:** ✅ Listo para implementación
