# 📊 ESTRUCTURA REAL DE BD - CASOS

## ⚠️ IMPORTANTE

Las tablas de casos YA EXISTEN en la base de datos con una estructura diferente a la propuesta en la documentación.

## Tablas Existentes

### `cases`
**Columnas reales:**
- `id`, `created_at`, `updated_at`
- `canal` (string) - Tipo de canal
- `section` (enum: case_section_enum)
- `ctype` (enum: case_type_enum) - Tipo de caso
- `status` (enum: case_status_enum)
- `broker_id`, `claimed_by_broker_id`, `created_by`
- `client_id`, `client_name`
- `insurer_id`
- `policy_number`
- `management_type` (string)
- `payment_method`, `premium`
- `discount_to_broker`, `direct_payment` (boolean)
- `sla_date`, `sla_days`
- `postponed_until` - Fecha aplazado
- `seen_by_broker` (boolean)
- `message_id`, `thread_id`, `ticket_ref` - Email tracking
- `is_verified`, `is_deleted` (boolean)
- `deleted_at`
- `notes` (text)

**NO TIENE:**
- `case_number` - Se genera desde función
- `admin_id`, `adelanto_id`, `policy_id`, `content_hash`
- `visto`, `visto_at`, `visto_by`, `aplazar_reason`, `deleted_reason`

### `case_checklist`
**Columnas reales:**
- `id`, `case_id`, `created_at`
- `label` (string) - **NO** `document_name`
- `required` (boolean) - **NO** `is_required`
- `completed` (boolean) - **NO** `status` (string)
- `completed_at`, `completed_by`

**NO TIENE:**
- `document_name`, `is_required`, `is_downloadable`, `download_link`
- `status`, `file_id`, `notes`, `sort_order`, `category`, `updated_at`

### `case_files`
**Columnas reales:**
- `id`, `case_id`, `created_at`
- `storage_path` (string) - **NO** `file_path`
- `original_name` (string | null) - **NO** `file_name`
- `mime_type`, `size_bytes`
- `created_by` (string | null) - **NO** `uploaded_by`

**NO TIENE:**
- `file_name`, `file_path`, `uploaded_by`, `is_verified`, `checklist_item_id`

### `case_comments`
**Columnas reales:**
- `id`, `case_id`, `created_at`
- `channel` (string) - Ya existe
- `content` (string)
- `created_by` (string | null)

✅ Esta tabla está OK

### `case_history`
**Columnas reales:**
- `id`, `case_id`, `created_at`
- `action` (string) - **NO** `event_type`
- `metadata` (json)
- `created_by` (string | null)

**NO TIENE:**
- `event_type`, `description`

### `notifications`
**Columnas reales:**
- `id`, `created_at`
- `target` (string) - **NO** `link`
- `title` (string)
- `body` (string | null) - **NO** `message`
- `broker_id` (string | null) - **NO** `user_id`
- `notification_type` (enum)
- `meta` (json)
- `email_sent` (boolean | null)

**NO TIENE:**
- `link`, `message`, `user_id`, `read`, `type`

## Enums Existentes

### `case_section_enum`
- `'SIN_CLASIFICAR'`
- `'RAMOS_GENERALES'`
- `'VIDA_ASSA'`
- `'OTROS_PERSONAS'`

**FALTA:** `'NO_IDENTIFICADOS'` - Hay que agregarlo con migración

### `case_type_enum`
- `'COTIZACION'`
- `'EMISION_GENERAL'`
- `'EMISION_VIDA_ASSA_WEB'`
- `'REHABILITACION'` (*)
- `'MODIFICACION'` (*)
- `'CANCELACION'` (*)
- `'CAMBIO_CORREDOR'` (*)
- `'RECLAMO'` (*)
- `'EMISION_EXPRESS'` (*)

(*) = Agregar con migración

### `case_status_enum`
- `'PENDIENTE_REVISION'`
- `'EN_PROCESO'`
- `'FALTA_DOC'`
- `'APLAZADO'`
- `'APROBADO_PEND_PAGO'`
- `'EMITIDO'`
- `'CERRADO'`
- `'RESUELTO'`
- `'DESCARTADO'`

**FALTAN:** `'PENDIENTE_DOCUMENTACION'`, `'COTIZANDO'`, `'RECHAZADO'`, `'REVISAR_ORIGEN'` - Agregar con migración

## broker_assistants
**NO EXISTE** - Hay que crearla con migración

---

## 🔧 Acción Requerida

1. ✅ La migración `20251017_update_cases_module.sql` debe agregar:
   - Enums faltantes
   - Tabla `broker_assistants`
   - Columnas faltantes a `cases` (si es necesario)

2. 🔴 **NO crear tablas nuevas** - Ya existen

3. ✏️ **Adaptar código** para usar nombres de columnas correctos

---

**Fecha:** 2025-10-17  
**Propósito:** Documentar estructura real vs propuesta
