# UI/UX Overhaul - Pendientes (Trámites) - PROGRESO

## ✅ COMPLETADO

### 1. Tabs Principales Corregidos
**Estado:** ✅ Implementado y pusheado

**Cambios:**
- ✅ Orden correcto: **Vida ASSA**, **Ramos Generales**, **Ramo Personas**
- ✅ Vida ASSA incluye: Vida Individual, Vida Web
- ✅ Ramos Generales incluye: Auto, Incendio, RC, etc.
- ✅ Ramo Personas: Salud, Accidentes Personales, Colectivos
- ✅ Tab "Sin clasificar" solo visible para Masters

**Archivos:**
- `src/lib/constants/cases.ts` - Actualizado CASE_SECTIONS
- `src/components/cases/CasesMainClient.tsx` - Tabs corregidos

### 2. Bug Crítico de Visibilidad de Casos Resuelto
**Estado:** ✅ Corregido en sesión anterior

**Problema:** Casos existentes no aparecían porque el filtrado de broker usaba `user.id` (profile ID) en lugar de `profile.broker_id` (ID real del broker).

**Solución:** 
- ✅ `actionGetCases` ahora usa `profile.broker_id`
- ✅ `actionGetCaseStats` corregido
- ✅ RLS check en `[id]/page.tsx` arreglado

### 3. UX Tipo Monday - Lista Viva Implementada
**Estado:** ✅ Implementado y pusheado

**Características:**
- ✅ **Agrupación por tipo de trámite** con secciones colapsables
- ✅ **Orden correcto:** Casos por vencer arriba (SLA ASC), nuevos abajo (created_at DESC)
- ✅ **Vista desktop:** Grid de 12 columnas tipo tabla
- ✅ **Vista mobile:** Cards compactos y responsivos

**Nuevo componente:** `src/components/cases/CasesListMonday.tsx`

**Columnas visibles en desktop:**
1. Checkbox
2. Ticket (#)
3. Cliente
4. Aseguradora
5. Estado (dropdown inline para Master)
6. SLA/Plazo con semáforo
7. Acciones (Correos, Editar, Expediente, Ticket)

### 4. Acciones Inline (Quick Edit)
**Estado:** ✅ Implementado y pusheado

**Acciones disponibles:**
- ✅ **Cambiar estado:** Dropdown inline (solo Master)
- ✅ **Ver correos:** Botón morado abre modal de historial
- ✅ **Editar:** Abre QuickEditModal existente
- ✅ **Ver expediente:** Link directo a detalle del caso
- ✅ **Ver ticket:** Botón para casos con ticket_ref

**Handlers agregados:**
- `handleChangeStatus(caseId, newStatus)` - Actualiza estado inline
- `handleChangeSLA(caseId, newDate)` - Actualiza plazo (preparado)

### 5. Modal de Historial de Correos
**Estado:** ✅ Implementado y pusheado

**Características:**
- ✅ **Lista cronológica** de correos del lado izquierdo
- ✅ **Detalle completo** del lado derecho
- ✅ **Indicadores de dirección:** 
  - 📨 Entrante (IMAP) - Azul
  - 📤 Saliente (SMTP) - Verde
  - 📧 Sistema - Gris
- ✅ **Información mostrada:**
  - Remitente y destinatario
  - Fecha y hora formateada
  - Asunto (sin repetir si es el del ticket)
  - Contenido HTML o texto plano
  - Lista de adjuntos con tamaños
- ✅ **Vista responsiva:** Desktop split, mobile stacked
- ✅ **Botón de descarga** para adjuntos (preparado)

**Nuevo archivo:** `src/components/cases/EmailHistoryModal.tsx`

### 6. Estados Simplificados en Dropdown
**Estado:** ✅ Implementado

**Estados visibles (dropdown Master):**
1. Nuevo (PENDIENTE_REVISION)
2. En proceso (EN_PROCESO)
3. Pendiente cliente (FALTA_DOC)
4. Pendiente broker (APROBADO_PEND_PAGO)
5. Enviado (EMITIDO)
6. Aplazado (APLAZADO)
7. Cerrado aprobado (CERRADO)
8. Cerrado rechazado (RECHAZADO)

## 🔄 EN PROGRESO

### 7. Lógica de Aplazado con Selector de Meses
**Estado:** 🔄 Parcial

**Pendiente:**
- Crear modal específico para Aplazado que pida:
  - Seleccionar 1-6 meses
  - Motivo de aplazamiento
  - Fecha de notificación

### 8. Indicadores Visuales de Correos
**Estado:** 🔄 Pendiente

**Por implementar:**
- Badge/icono en cada caso indicando si tiene correos
- Contador de correos entrantes vs salientes
- Indicador de "correo enviado recientemente"

## ⏳ PENDIENTE

### 9. Gestión de Expediente UI
**Estado:** ⏳ Revisar existente

**Requisitos:**
- ✅ Vista de adjuntos (ya existe en detalle)
- ✅ Checklist de requisitos (ya existe)
- ⏳ Reuso de expediente si cliente existe
- ⏳ Permisos: Master edita, Broker solo lectura

**Acción:** Verificar UI actual en `/cases/[id]`

### 10. Separación Historial vs Logs
**Estado:** ⏳ No implementado

**Requisitos:**
- **Historial (visible a broker):**
  - Cambios de estado
  - Cambios de plazo
  - Correos vinculados
  - Notas internas
  - Master puede ocultar eventos

- **Logs (SOLO MASTER):**
  - Todas las ediciones
  - Before/after de cada cambio
  - Usuario o sistema que hizo el cambio
  - Inmutable, no editable

**Ubicación:** Tab en `/cases/[id]`

### 11. Permisos UI Estrictos
**Estado:** ⏳ Verificar

**Broker:**
- ❓ Solo ve SUS casos (RLS ya corregido)
- ❓ NO puede editar nada
- ❓ Puede ver historial (sin logs)
- ❓ Puede adjuntar archivos
- ❓ Puede comentar

**Master:**
- ❓ Ve todos los casos
- ❓ Puede editar todo
- ❓ Puede reasignar casos
- ❓ Puede ocultar eventos en historial
- ❓ Ve logs completos

### 12. Indicadores SMTP/IMAP
**Estado:** ⏳ No implementado

**Requisitos:**
- Badge indicando "Correo enviado" en casos con email system
- Indicador de última actualización por correo
- Diferenciación visual entre correos entrantes y salientes

### 13. Mobile-First Verification
**Estado:** ⏳ Pendiente testing

**Por verificar:**
- Responsive en móviles pequeños (320px)
- Tabs scrollables horizontalmente
- Cards compactos en mobile
- Acciones accesibles con dedos
- Modales no cortados en mobile

## 📊 RESUMEN DE PROGRESO

**Completado:** 6/13 items principales (46%)

**Archivos creados:**
- `src/components/cases/CasesListMonday.tsx` ✅
- `src/components/cases/EmailHistoryModal.tsx` ✅

**Archivos modificados:**
- `src/lib/constants/cases.ts` ✅
- `src/components/cases/CasesMainClient.tsx` ✅
- `src/app/(app)/cases/actions.ts` ✅ (sesión anterior)
- `src/app/(app)/cases/actions-details.ts` ✅ (sesión anterior)

**Commits realizados:**
1. "Fix: Corregir tabs de Pendientes - orden correcto"
2. "Feat: Implementar UX tipo Monday - agrupación por trámite, acciones inline, orden SLA"
3. "Feat: Agregar modal Historial de Correos con vista cronológica y adjuntos"

## 🎯 PRÓXIMOS PASOS PRIORITARIOS

1. **Agregar indicadores de correos** en lista principal
2. **Implementar modal de Aplazado** con selector 1-6 meses
3. **Verificar permisos UI** en todo el módulo
4. **Separar Historial vs Logs** en detalle de caso
5. **Testing mobile-first** completo
6. **Documentación final** y confirmación con usuario

## 🚫 NO HACER (hasta que UI esté completa)

- ❌ Pruebas de cron jobs
- ❌ Pruebas SMTP
- ❌ Pruebas IMAP
- ❌ Testing de endpoints
- ❌ Optimizaciones de backend

**Prioridad absoluta:** UI funcional, visible y usable.
