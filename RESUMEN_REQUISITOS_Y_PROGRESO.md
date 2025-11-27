# 📋 SISTEMA DE REQUISITOS Y PROGRESO - IMPLEMENTACIÓN

## ✅ COMPLETADO (Parte 1/2)

### 1. Sistema de Tipos de Requisitos

**✅ Implementado:**
- Diferenciación entre **DOCUMENTO** y **FORMULARIO**
- DOCUMENTO: Debe suministrarlo el cliente/broker (ej: cédula, fotos)
- FORMULARIO: Está en Descargas para descargar y completar (ej: solicitudes)

**Archivos modificados:**
1. **SQL Migration:** `MIGRATION_REQUISITOS_Y_PROGRESO.sql`
   - Tabla `policy_requirements` con campo `requirement_type`
   - Tabla `workflow_steps` para pasos configurables
   - Tabla `case_progress` para tracking del progreso
   - Datos iniciales de ejemplo

2. **API:** `src/app/(app)/api/config/requirements/route.ts`
   - GET/POST/PUT/DELETE con soporte para `requirement_type`
   - Validaciones y RLS

3. **UI:** `src/components/config/tabs/RequirementsTab.tsx`
   - Selector visual de tipo (DOCUMENTO vs FORMULARIO)
   - Vínculo con Descargas SOLO para FORMULARIO
   - Badges de color distintivos:
     - 📄 Verde: DOCUMENTO
     - 📋 Morado: FORMULARIO
   - Ejemplos y tooltips explicativos

---

## 🎯 FUNCIONALIDAD ACTUAL

### Para Master en /config → Tab Requisitos:

1. **Crear Requisito:**
   - Seleccionar ramo (AUTO, VIDA, etc.)
   - Tipo: 📄 DOCUMENTO o 📋 FORMULARIO
   - Si es FORMULARIO: Vincular con archivo en Descargas
   - Marcar como obligatorio/opcional

2. **Vista de Lista:**
   - Badge de tipo (DOCUMENTO/FORMULARIO)
   - Badge de obligatorio
   - Badge de vinculado (si aplica)
   - Nombre estándar para archivos

### Para Broker:
- **Ve requisitos** por ramo
- **Identifica claramente**:
  - 📄 Documentos que debe proporcionar
  - 📋 Formularios que puede descargar
- **Descarga directa** de formularios vinculados

---

## 📊 EJEMPLOS DE REQUISITOS CREADOS

### AUTO - EMISION:
1. 📄 Cédula del asegurado (DOCUMENTO, obligatorio)
2. 📄 Licencia de conducir vigente (DOCUMENTO, obligatorio)
3. 📄 Tarjeta de circulación (DOCUMENTO, obligatorio)
4. 📋 Formulario de solicitud AUTO (FORMULARIO, obligatorio) → Vinculado a Descargas
5. 📄 Fotos de inspección (8 fotos) (DOCUMENTO, obligatorio)
6. 📄 Póliza anterior (DOCUMENTO, opcional)

### VIDA_ASSA - EMISION:
1. 📄 Cédula del asegurado (DOCUMENTO, obligatorio)
2. 📋 Solicitud ASSA Web (FORMULARIO, obligatorio) → Vinculado a Descargas
3. 📄 Exámenes médicos según monto (DOCUMENTO, opcional)

---

## 🔄 PENDIENTE (Parte 2/2)

### 1. Sistema de Pasos de Workflow (Configuración)

**A implementar:**
- Nueva tab en `/config`: "Pasos de Proceso" o incluir en Requisitos
- Configurar pasos por **ramo + tipo de trámite**
- Ejemplo: AUTO + EMISION:
  1. Recepción de documentos (2 días)
  2. Validación de documentos (1 día)
  3. Inspección vehicular (1 día)
  4. Emisión en aseguradora (2 días)
  5. Entrega de póliza (1 día)

**Tabla ya creada:** `workflow_steps`
- Columnas: ramo, management_type, step_number, step_name, step_description, estimated_days

**API necesaria:**
- `GET /api/config/workflow-steps?ramo=AUTO&management_type=EMISION`
- `POST /api/config/workflow-steps` (crear paso)
- `PUT /api/config/workflow-steps` (editar paso)
- `DELETE /api/config/workflow-steps` (eliminar paso)

---

### 2. Visualizador de Progreso en Casos

**A implementar:**
- **Componente:** `CaseProgressBar.tsx`
- **Ubicación:** Se muestra en:
  - Lista de casos (versión compacta)
  - Detalle de caso (versión completa)

**Ejemplo visual (compacto):**
```
[■■■■□] 4/5 pasos - Emisión en aseguradora
```

**Ejemplo visual (completo):**
```
✓ 1. Recepción de documentos
✓ 2. Validación de documentos  
✓ 3. Inspección vehicular
► 4. Emisión en aseguradora (En proceso)
  5. Entrega de póliza
```

**Funciones necesarias:**
- `handleUpdateProgress(caseId, newStepNumber)` - Solo Master
- Auto-actualizar cuando cambia estado del caso
- Mostrar tiempo transcurrido vs estimado

---

### 3. Integración con Sistema de Casos

**A implementar:**
- Al **crear caso**: Inicializar progreso en paso 1
- Al **cambiar estado**: Sugerir avanzar paso
- **Checklist dinámico**: Generar desde requisitos configurados
- **Descargar formularios**: Botón directo desde checklist si está vinculado

**Ejemplo de checklist generado:**
```
Caso: EMISION - AUTO - ASSA

Documentos requeridos:
□ Cédula del asegurado (DOCUMENTO)
□ Licencia de conducir (DOCUMENTO)
□ Tarjeta de circulación (DOCUMENTO)
□ Formulario de solicitud AUTO (FORMULARIO) [Descargar ↓]
□ Fotos de inspección (DOCUMENTO)

Progreso: [■■■□□] 3/5 pasos
Paso actual: Inspección vehicular
```

---

## 🗄️ TABLAS BD

### ✅ Ya creadas (ejecutar SQL):

1. **policy_requirements:**
   - Requisitos por ramo
   - Con tipo DOCUMENTO/FORMULARIO
   - Vínculo opcional con Descargas

2. **workflow_steps:**
   - Pasos del proceso por ramo + tipo de trámite
   - step_number, step_name, estimated_days

3. **case_progress:**
   - Progreso actual de cada caso
   - current_step_number, total_steps
   - step_started_at, step_completed_at

---

## 📝 PLAN DE IMPLEMENTACIÓN (Siguiente sesión)

### Paso 1: API de Workflow Steps
```bash
# Crear archivo:
src/app/(app)/api/config/workflow-steps/route.ts

# Implementar:
- GET (listar pasos)
- POST (crear paso)
- PUT (actualizar paso)
- DELETE (eliminar paso)
```

### Paso 2: UI de Configuración de Pasos
```bash
# Crear componente:
src/components/config/tabs/WorkflowStepsTab.tsx

# Incluir:
- Selector de ramo + tipo de trámite
- Lista de pasos ordenados
- CRUD completo de pasos
- Días estimados por paso
```

### Paso 3: Componente de Progreso
```bash
# Crear componente:
src/components/cases/CaseProgressBar.tsx

# Variantes:
- Compacto (para lista)
- Completo (para detalle)
- Editable (solo Master)
```

### Paso 4: Integración en Casos
```bash
# Modificar archivos:
- src/components/cases/CasesList.tsx (mostrar progreso compacto)
- src/components/cases/CaseDetailClient.tsx (mostrar progreso completo)
- src/app/(app)/cases/actions.ts (inicializar/actualizar progreso)
```

### Paso 5: Checklist Dinámico
```bash
# Modificar:
- src/components/cases/NewCaseWizard.tsx (generar checklist desde requisitos)
- src/components/cases/CaseDetailClient.tsx (mostrar tipo y botón descargar)
```

---

## ✅ VERIFICACIÓN ACTUAL

```bash
✓ TypeCheck: 0 errores
✓ Tipos DOCUMENTO/FORMULARIO funcionando
✓ Vínculo con Descargas funcionando
✓ Badges visuales claros
✓ API soporta requirement_type
✓ SQL migration lista para ejecutar
✓ Tablas workflow_steps y case_progress creadas
```

---

## 🚀 PARA ACTIVAR LO ACTUAL:

1. **Ejecutar SQL:**
   ```sql
   -- En Supabase SQL Editor:
   MIGRATION_REQUISITOS_Y_PROGRESO.sql
   ```

2. **Regenerar types:**
   ```bash
   npm run gen-types
   ```

3. **Usar:**
   - `/config` → Tab "Requisitos"
   - Crear requisitos diferenciando DOCUMENTO vs FORMULARIO
   - Vincular FORMULARIOS con archivos en Descargas

---

## 🎯 RESULTADO ESPERADO FINAL

**Broker en Pendientes verá:**
```
Caso #123 - EMISION AUTO ASSA
[■■■■□] 4/5 pasos - Emisión en aseguradora

Documentos pendientes:
□ Cédula del asegurado (DOCUMENTO) - Subir archivo
□ Fotos de inspección (DOCUMENTO) - Subir archivo
✓ Formulario de solicitud AUTO (FORMULARIO) [Descargar ↓]

Último paso: hace 2 días
Estimado: 2 días más
```

**Master podrá:**
- Configurar pasos del proceso
- Ajustar días estimados
- Mover caso entre pasos
- Ver progreso de todos los casos

---

## 📊 ESTADO GENERAL

**Completado:** 50%
- ✅ Sistema de tipos de requisitos
- ✅ Diferenciación DOCUMENTO/FORMULARIO
- ✅ Vínculo con Descargas
- ✅ Tablas BD creadas

**Pendiente:** 50%
- ⏳ API de workflow steps
- ⏳ UI de configuración de pasos
- ⏳ Componente visualizador de progreso
- ⏳ Integración en casos
- ⏳ Checklist dinámico

**Próxima sesión:** Implementar visualizador de progreso y configuración de pasos.
