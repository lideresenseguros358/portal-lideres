# Plan de Implementación: Sistema de Pendientes/Trámites

## Estado Actual vs Requerido

### ✅ YA IMPLEMENTADO
- [x] Wizard de creación (4 pasos)
- [x] Tipos de póliza con documentos dinámicos
- [x] Renombrado automático de archivos
- [x] Fotos de inspección para autos
- [x] PDFs múltiples con metadata
- [x] Página de detalle `/cases/[id]`
- [x] Permisos: Master puede todo, Broker solo sus casos
- [x] Upload/Download de archivos
- [x] Checklist con toggle
- [x] RLS básico (broker solo ve sus casos)
- [x] Link "Ver detalle" en lista

### ❌ FALTA IMPLEMENTAR

#### 1. PÁGINA PRINCIPAL `/cases`
- [ ] **Tabs de navegación** (actualmente hay tabs pero falta funcionalidad completa)
  - [ ] Ramos Generales
  - [ ] Vida ASSA (prioridad #1 en Broker)
  - [ ] Otros Personas
  - [ ] Sin clasificar (con sub-sección "No identificados" solo Master)
- [ ] **Toggle Lista/Kanban**
  - [ ] Conectar con configuración de Master
  - [ ] Vista Kanban con columnas de estado
  - [ ] Drag & drop entre columnas
- [ ] **Selección múltiple**
  - [ ] Enviar correo a brokers
  - [ ] Descargar PDF consolidado
- [ ] **Búsqueda avanzada** (modal)
- [ ] **Badges "Nuevos"** (status PENDIENTE_REVISION y visto=false)
- [ ] **Acciones por ítem**:
  - [ ] Reclasificar
  - [ ] Fusionar
  - [ ] "Mío" (Broker en pendientes sin identificar)

#### 2. WIZARD MEJORADO `/cases/new`
- [ ] **Paso 1 mejorado**:
  - [ ] Ámbito: Generales | Personas
  - [ ] Administrativo interno (select)
  - [ ] SLA prellenado desde config (editable)
- [ ] **Paso 2 (Cliente y Póliza)**:
  - [ ] Búsqueda de cliente existente (client_id)
  - [ ] Permitir Nº póliza vacío al crear
  - [ ] Validar Nº póliza obligatorio al cambiar a "Emitido"
- [ ] **Paso 3 (Checklist dinámico)**:
  - [ ] Autogenerar desde tabla maestra
  - [ ] Ítems descargables (link a Descargas)
  - [ ] Reordenables (drag)
  - [ ] Agregar ítem ad-hoc
  - [ ] Popup "¿Recurrente?" al subir archivo fuera del checklist
- [ ] **Paso 4 (Pagos)**:
  - [ ] Emisión express (oficina) → marca deuda a corredor
  - [ ] "Descontar a corredor" → genera pendiente en Cheques
  - [ ] Pago recibido (transferencia) → preliminar para Cheques
  - [ ] Pago directo del corredor → marcar sin generar deuda

#### 3. DETALLE DEL TRÁMITE `/cases/[id]`
- [ ] **Header mejorado**:
  - [ ] Chips SLA (En tiempo / Por vencer / Vencido)
  - [ ] Mostrar ticket_ref si existe
  - [ ] Acciones Master: reclasificar, fusionar, aplazar, cerrar, eliminar
- [ ] **Comentarios con canales**:
  - [ ] Canal: Aseguradora | Oficina
  - [ ] Visibilidad según canal
- [ ] **Emisión → Preliminar BD**:
  - [ ] Al cambiar a "Emitido" exigir policy_number
  - [ ] Si no existe en BD y no es VIDA ASSA Web → popup Master
  - [ ] Crear preliminar y notificar broker
- [ ] **Estados adicionales**:
  - [ ] REVISAR_ORIGEN
  - [ ] Aplazado con fecha objetivo
  - [ ] Cerrar con pendientes
  - [ ] Eliminar → Papelera 30 días
- [ ] **Pagos/Comisiones**:
  - [ ] Botón "Descontar a corredor" (Master)
  - [ ] Botón "Pago directo"

#### 4. INGESTA POR CORREO
- [ ] **Endpoint `/api/zoho/webhook`**
  - [ ] Recibir webhook de Zoho
  - [ ] Idempotencia (message_id, thread_id)
  - [ ] Normalizar texto (limpiar Fw:/Re:, firmas)
  - [ ] Verificación de remitente (whitelist)
  - [ ] Clasificación determinista (keywords)
  - [ ] Detección de aseguradora y rama
  - [ ] Detección ASSA ticket
  - [ ] Vida ASSA: sin ticket → con ticket (asociación)
  - [ ] Agrupación 48h
  - [ ] Adjuntos: verificados vs _unverified
  - [ ] Auto-respuesta
  - [ ] Notificaciones

#### 5. ACCIONES API ADICIONALES
- [ ] `POST /api/cases/:id/reclassify` - Reclasificar
- [ ] `POST /api/cases/merge` - Fusionar casos
- [ ] `POST /api/cases/:id/discount` - Descontar a corredor
- [ ] `POST /api/cases/:id/direct-payment` - Pago directo
- [ ] `POST /api/cases/:id/create-db-preliminar` - Crear preliminar BD
- [ ] `POST /api/cases/:id/aplazar` - Aplazar con fecha
- [ ] `PUT /api/cases/:id/checklist/:item` - Actualizar checklist item

#### 6. PDF Y CORREO
- [ ] **Selección múltiple → Enviar correo**
  - [ ] Modal con preview
  - [ ] Plantilla institucional
  - [ ] Links a cada caso
- [ ] **Selección múltiple → Descargar PDF**
  - [ ] PDF consolidado con branding
  - [ ] Logo, Arial, azul #010139, oliva #8AAA19
  - [ ] Tabla con: ID, aseguradora, gestión, cliente, estado, SLA, ticket
- [ ] **PDF individual del caso**
  - [ ] Botón "Descargar PDF del trámite"
  - [ ] Checklist/adjuntos/estado/timeline

#### 7. NOTIFICACIONES
- [ ] **Campanita (in-app)**
  - [ ] Nuevo trámite asignado
  - [ ] Actualización de estado
  - [ ] Nuevo comentario
  - [ ] "Mío" marcado
  - [ ] SLA por vencer
  - [ ] SLA vencido
  - [ ] Documento faltante
  - [ ] Nuevo documento en Descargas
- [ ] **Correo diario 7:00 AM**
  - [ ] Resumen por broker (sus pendientes)
  - [ ] Master solo Oficina y "No identificados"

#### 8. SLA Y SEMÁFORO
- [ ] **SLA por tipo** (desde Configuración)
  - [ ] Generales: 7-15 días (editable)
  - [ ] Personas: 8-20 días (editable)
- [ ] **Semáforo**:
  - [ ] En tiempo (verde)
  - [ ] Por vencer 5 días antes (amarillo)
  - [ ] Vencido (rojo)
  - [ ] Auto-papelera 7 días sin actualización
- [ ] **Aplazado**:
  - [ ] Guardar fecha objetivo
  - [ ] Notificar 5 días antes
  - [ ] Permitir re-aplazar

#### 9. "MÍO" Y PENDIENTES SIN IDENTIFICAR
- [ ] **Broker marca "mío"** en casos sin identificar
- [ ] **Master aprueba asignación**
- [ ] **Decidir pago**: ahora (ajuste) o próxima quincena

#### 10. BÚSQUEDA Y FILTROS
- [ ] **Buscador modal**:
  - [ ] Por cliente, aseguradora, tipo, gestión, ticket_ref, broker, estado
- [ ] **Filtros dropdown**:
  - [ ] Estado, tipo, aseguradora, broker (Master)

#### 11. CONFIGURACIÓN
- [ ] **Toggle Kanban/Lista**
  - [ ] Crear/actualizar setting en tabla config
  - [ ] Conectar con página de casos
- [ ] **SLA por tipo**
  - [ ] Configuración editable
  - [ ] Defaults para wizard

---

## PLAN DE IMPLEMENTACIÓN POR FASES

### FASE 1: CORE FEATURES (PRIORIDAD ALTA)
1. Conectar toggle Kanban en configuración
2. Mejorar wizard con SLA y pagos
3. Implementar estados adicionales y validaciones
4. Agregar acciones de reclasificar/fusionar
5. Implementar "Mío" para brokers

### FASE 2: INGESTA Y AUTOMATIZACIÓN
1. Webhook Zoho
2. Clasificación determinista
3. ASSA sin ticket → con ticket
4. Adjuntos verificados/_unverified

### FASE 3: NOTIFICACIONES Y COMUNICACIÓN
1. Sistema de campanita
2. Correos diarios 7:00 AM
3. Envío de correos desde lista
4. PDF consolidado

### FASE 4: SLA Y CLEANUP
1. Semáforo SLA
2. Auto-papelera
3. Aplazados con notificación
4. Bitácora 30 días

### FASE 5: UX Y POLISH
1. Búsqueda avanzada
2. Vista Kanban funcional
3. Drag & drop
4. Badges "Nuevos"

---

## PROGRESO ACTUAL

### ✅ COMPLETADO
- Wizard de creación con 4 pasos
- Tipo de póliza con documentos dinámicos
- Renombrado automático de archivos
- Fotos de inspección para autos
- Página de detalle `/cases/[id]`
- Permisos: Master/Broker correctos
- Upload/Download de archivos
- Toggle checklist
- RLS básico
- Toggle Kanban en configuración (UI existe, falta persistencia BD)

### 🔍 DESCUBIERTO
- El API `/api/config/cases` existe pero tiene TODO para persistencia en BD
- La UI del toggle Kanban ya está en configuración
- Falta conectar el toggle con la página principal de casos
- Falta implementar vista Kanban

## PRÓXIMOS PASOS INMEDIATOS

### FASE 1A: CONFIGURACIÓN Y KANBAN (1-2 horas)
1. ✅ Revisar configuración actual
2. ✅ Implementar persistencia de configuración (localStorage por ahora)
   - Guardar `kanban_enabled`, `deferred_reminder_days`, etc.
   - TODO: Migrar a tabla BD cuando esté disponible
3. ✅ Conectar toggle con página de casos
   - Leer configuración en `CasesMainClient`
   - Agregar botón toggle Lista/Kanban
4. 🔄 Implementar vista Kanban básica
   - ⏳ Columnas por estado
   - ⏳ Cards de casos
   - ⏳ Click abre detalle (sin drag&drop por ahora)

### FASE 1B: ACCIONES CRÍTICAS (2-3 horas)
5. ⏳ Implementar cambio de estado con validaciones
   - Validar Nº póliza en "Emitido"
   - Modal de confirmación
6. ⏳ Implementar "Aplazar" con fecha
   - Modal con date picker
   - Guardar `postponed_until`
7. ⏳ Implementar "Cerrar" caso
   - Con/sin pendientes
   - Comentario automático
8. ⏳ Implementar "Eliminar" → Papelera
   - Soft delete (`is_deleted = true`)
   - `deleted_at` timestamp
9. ⏳ Implementar "Mío" para brokers
   - Botón en casos sin identificar
   - Master aprueba/rechaza

### FASE 1C: WIZARD MEJORADO (2-3 horas)
10. ⏳ Agregar campo SLA editable (prellenado desde config)
11. ⏳ Agregar campo Administrativo interno
12. ⏳ Mejorar validaciones de póliza
13. ⏳ Agregar paso de Pagos
    - Descontar a corredor
    - Pago directo
    - Emisión express

### FASE 2: WEBHOOKS Y AUTOMATIZACIÓN (4-6 horas)
14. ⏳ Crear `/api/zoho/webhook`
15. ⏳ Implementar clasificación determinista
16. ⏳ Manejo ASSA sin ticket → con ticket
17. ⏳ Adjuntos verificados/_unverified

### FASE 3: NOTIFICACIONES (3-4 horas)
18. ⏳ Sistema de campanita in-app
19. ⏳ Correos diarios 7:00 AM
20. ⏳ Notificaciones por eventos

### FASE 4: PDFs Y CORREOS (3-4 horas)
21. ⏳ Selección múltiple en lista
22. ⏳ Enviar correo masivo
23. ⏳ PDF consolidado
24. ⏳ PDF individual del caso

### FASE 5: SLA Y CLEANUP (2-3 horas)
25. ⏳ Semáforo SLA con colores
26. ⏳ Auto-papelera 7 días sin actualización
27. ⏳ Recordatorios de aplazados
28. ⏳ Bitácora 30 días

## PROGRESO DE HOY

### ✅ COMPLETADO (Última sesión)
1. **Toggle Kanban conectado**:
   - Configuración guarda en localStorage
   - Botón toggle Lista/Kanban aparece en `/cases` cuando está habilitado
   - Placeholder para vista Kanban (próximo paso)

2. **Wizard rediseñado**:
   - 4 pasos funcionando
   - Tipo de póliza con documentos dinámicos
   - Renombrado automático de archivos
   - Fotos de inspección para autos
   - Opción PDF múltiple

3. **Página de detalle**:
   - `/cases/[id]` funcionando
   - Permisos Master/Broker correctos
   - Upload/Download archivos
   - Checklist toggle
   - 4 tabs (Info, Archivos, Checklist, Historial)

4. **Compilación exitosa**:
   - `npm run typecheck` ✅
   - `npm run build` ✅
   - Sin errores

## SIGUIENTE SESIÓN

### PRIORIDAD INMEDIATA
Dado que tienes un documento extenso con requerimientos, sugiero estas prioridades:

1. **Primero: Probar en navegador** lo ya implementado
   - Wizard completo
   - Toggle Kanban
   - Página de detalle
   - Confirmar que todo funciona

2. **Segundo: Implementar acciones críticas** (FASE 1B)
   - Cambio de estado con validaciones
   - Aplazar con fecha
   - Cerrar caso
   - Eliminar → Papelera

3. **Tercero: Mejorar wizard** (FASE 1C)
   - Campo SLA editable
   - Paso de Pagos
   - Validaciones de póliza

4. **Cuarto: Webhooks Zoho** (FASE 2)
   - Ingesta automática por correo
   - Clasificación determinista
   - ASSA con/sin ticket

5. **Quinto: Resto de features**
   - Notificaciones
   - PDFs
   - SLA automático

---

## NOTAS TÉCNICAS

- **Storage paths**:
  - Verificados: `pendientes/<yyyy>/<mm>/<case_id>/...`
  - No verificados: `pendientes/_unverified/<yyyy>/<mm>/<temp_id>/...`

- **Estados**:
  - PENDIENTE_REVISION, EN_PROCESO, FALTA_DOC, APLAZADO, RECHAZADO, 
  - APROBADO_PEND_PAGO, EMITIDO, CERRADO, REVISAR_ORIGEN

- **Clasificación determinista**:
  - Arrays de keywords por aseguradora
  - Keywords por tipo de gestión
  - Detección de ticket ASSA

- **Branding PDF**:
  - Logo institucional
  - Arial
  - Azul #010139
  - Oliva #8AAA19
