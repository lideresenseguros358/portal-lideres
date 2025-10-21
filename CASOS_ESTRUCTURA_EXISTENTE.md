# 🔍 ANÁLISIS - ESTRUCTURA EXISTENTE vs NUEVA

## ⚠️ HALLAZGO CRÍTICO

El módulo de Casos/Pendientes **YA EXISTE** con implementación funcional.

---

## ✅ LO QUE YA EXISTE (Implementado)

### Páginas (100% completas)
```
src/app/(app)/cases/
├── page.tsx                  ✅ Lista principal de casos
├── [id]/page.tsx            ✅ Detalle de caso
├── new/page.tsx             ✅ Crear nuevo caso
├── actions.ts               ✅ Server actions (18KB)
└── actions-details.ts       ✅ Actions adicionales (14KB)
```

### Componentes (100% completos)
```
src/components/cases/
├── CasesMainClient.tsx      ✅ Cliente principal (13KB)
├── CasesList.tsx            ✅ Lista de casos (14KB)
├── CaseDetailClient.tsx     ✅ Detalle cliente (19KB)
├── NewCaseWizard.tsx        ✅ Wizard creación (36KB)
└── SearchModal.tsx          ✅ Modal búsqueda (2KB)
```

### Server Actions Existentes

**En `actions.ts`:**
- ✅ `actionGetCases()` - Lista con filtros
- ✅ `actionGetCase()` - Detalle individual
- ✅ `actionCreateCase()` - Crear caso (Master)
- ✅ `actionUpdateCase()` - Actualizar
- ✅ `actionDeleteCase()` - Eliminar/papelera
- ✅ `actionUploadFile()` - Upload archivos
- ✅ `actionAddChecklistItem()` - Agregar item
- ✅ `actionUpdateChecklistItem()` - Actualizar item

**En `actions-details.ts`:**
- ✅ `actionAddComment()` - Agregar comentario
- ✅ `actionGetComments()` - Obtener comentarios
- ✅ `actionGetHistory()` - Historial
- ✅ `actionUpdateStatus()` - Cambiar estado
- ✅ Más acciones específicas

### Estructura de Base de Datos (Existente)

**Tablas ya creadas:**
```sql
✅ cases
✅ case_checklist
✅ case_files
✅ case_comments
✅ case_history
```

**Enums existentes:**
```sql
✅ case_section_enum: SIN_CLASIFICAR, RAMOS_GENERALES, VIDA_ASSA, OTROS_PERSONAS
✅ case_type_enum: COTIZACION, EMISION_GENERAL, EMISION_VIDA_ASSA_WEB, etc.
✅ case_status_enum: PENDIENTE_REVISION, EN_PROCESO, FALTA_DOC, etc.
```

---

## 🆕 LO QUE CREÉ (Duplicado/Innecesario)

### APIs REST (DUPLICADAS) ❌
```
src/app/api/cases/              ❌ DUPLICA actions.ts
src/app/api/cases/[id]/         ❌ DUPLICA actions.ts
src/app/api/cases/[id]/status/  ❌ DUPLICA actions-details.ts
src/app/api/cases/[id]/files/   ❌ DUPLICA actions.ts
etc...
```

**Problema:** Creé 8 endpoints REST cuando ya existen Server Actions que hacen lo mismo.

### Tipos (DUPLICADOS) ❌
```
src/types/cases.ts              ❌ DUPLICA database.types.ts
```

**Problema:** Los tipos ya están en `database.types.ts` y se usan con `Tables<'cases'>`.

---

## ✅ LO QUE SÍ ES ÚTIL (Conservar)

### 1. Migraciones SQL ✅
```
supabase/migrations/20251017_update_cases_module.sql
supabase/migrations/20251017_create_pendientes_bucket.sql
```
**Razón:** Agrega enums faltantes y tabla broker_assistants

### 2. Utilidades ✅
```
src/lib/cases/classifier.ts    ✅ Clasificación determinista
src/lib/cases/sla.ts           ✅ Cálculo de SLA
src/lib/cases/utils.ts         ✅ Funciones auxiliares
```
**Razón:** Funcionalidades nuevas no implementadas

### 3. Webhook de Zoho ✅
```
src/app/api/zoho/webhook/route.ts  ✅ Ingesta de emails
```
**Razón:** Funcionalidad completamente nueva

### 4. Documentación ✅
```
docs/casos/                     ✅ 6 archivos de documentación
CASOS_README.md                 ✅ Resumen
CASOS_ESTRUCTURA_BD.md          ✅ Estructura BD
CASOS_IMPLEMENTACION_STATUS.md  ✅ Estado
```
**Razón:** Documentación valiosa del flujo

---

## 🗑️ ARCHIVOS A ELIMINAR

```bash
# APIs REST duplicadas (usar Server Actions existentes)
rm -rf src/app/api/cases/

# Tipos duplicados
rm src/types/cases.ts
```

---

## 🔧 ACCIONES CORRECTIVAS

### 1. Usar Server Actions Existentes

**EN LUGAR DE:**
```typescript
// ❌ NO USAR
fetch('/api/cases', { ... })
```

**USAR:**
```typescript
// ✅ USAR
import { actionGetCases } from '@/app/(app)/cases/actions';
const result = await actionGetCases(filters);
```

### 2. Integrar Utilidades Nuevas

**Agregar a `actions.ts`:**
```typescript
import { classifyEmail } from '@/lib/cases/classifier';
import { getSlaInfo } from '@/lib/cases/sla';
```

### 3. Agregar Webhook a Flujo Existente

El webhook de Zoho puede crear casos usando `actionCreateCase()` existente.

---

## 📋 FLUJO CORRECTO

### Para Crear Caso:
```typescript
import { actionCreateCase } from '@/app/(app)/cases/actions';

const result = await actionCreateCase({
  section: 'RAMOS_GENERALES',
  ctype: 'COTIZACION',
  insurer_id: '...',
  broker_id: '...',
  // ...
});
```

### Para Webhook de Zoho:
```typescript
// src/app/api/zoho/webhook/route.ts
import { classifyEmail } from '@/lib/cases/classifier';
import { getSlaInfo } from '@/lib/cases/sla';
// Usar clasificación y luego actionCreateCase
```

---

## 🎯 RESUMEN EJECUTIVO

### ✅ Lo que ya funciona:
- **Frontend:** 5 componentes React completos
- **Backend:** 15+ Server Actions funcionales
- **Páginas:** Lista, Detalle, Wizard
- **Base de Datos:** Todas las tablas creadas

### ❌ Lo que creé de más:
- 8 endpoints REST (duplican Server Actions)
- Archivo de tipos (duplica database.types.ts)

### ✅ Lo útil que agregué:
- Utilidades de clasificación y SLA
- Webhook de Zoho
- Documentación completa
- Migraciones SQL pendientes

---

## 🚀 PRÓXIMOS PASOS

1. ✅ **Ejecutar migraciones SQL**
2. ✅ **Integrar utilidades nuevas con actions existentes**
3. ✅ **Conectar webhook de Zoho**
4. ❌ **Eliminar APIs REST duplicadas**
5. ❌ **Eliminar types/cases.ts**
6. ✅ **Probar flujo completo**

---

**Conclusión:** El módulo ya estaba 95% implementado. Solo faltaba:
- Enums adicionales (migración)
- Tabla broker_assistants (migración)
- Clasificación automática (utils)
- Webhook de Zoho (nuevo)
- Documentación (nueva)
