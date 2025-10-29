# 🔧 PLAN DE CORRECCIÓN - MÓDULO DE CONFIGURACIÓN (MASTER)

## 📋 PROBLEMAS IDENTIFICADOS

### 1. **BOTONES NO RESPONSIVE** ❌
- Botones en header con `flex-col sm:flex-row` pero algunos no tienen breakpoints
- Tabs de navegación con scroll horizontal funcional ✅
- Botones de acción sin adaptación móvil

### 2. **KANBAN SIN FUNCIÓN** ❌
- Toggle existe pero solo guarda en localStorage
- No hay implementación real de vista Kanban
- Solo es un estado booleano sin uso

### 3. **ACCIONES QUE NO GUARDAN** ❌
- `CasesTab`: Usa localStorage, API existe pero puede fallar silenciosamente
- Configuración se pierde al limpiar caché
- No hay persistencia real en BD para algunos tabs

### 4. **BOTONES OSCUROS SIN TEXTO BLANCO** ⚠️
- Mayoría ya tiene `text-white` correctamente
- Revisar todos los botones para consistencia

### 5. **WIZARDS INCOMPLETOS** ❌
- InsurersTab: "Wizard en desarrollo..."
- Funcionalidad básica faltante

### 6. **ENDPOINTS API FALTANTES** ❌
- Algunos endpoints no existen o no están implementados
- Error handling inconsistente

---

## ✅ SOLUCIONES A IMPLEMENTAR

### FASE 1: BOTONES RESPONSIVE Y LEGIBILIDAD

**Archivos a modificar:**
- `ConfigMainClient.tsx`
- Todos los tabs en `tabs/`

**Cambios:**
1. Agregar `text-sm sm:text-base` a todos los botones
2. Cambiar layout a `flex-col sm:flex-row` donde falte
3. Asegurar `whitespace-nowrap` en botones críticos
4. Garantizar `text-white` en todos los botones oscuros

### FASE 2: REMOVER TOGGLE KANBAN NO FUNCIONAL

**Archivo:** `CasesTab.tsx`

**Acción:**
- Eliminar completamente la sección de Kanban
- O implementar funcionalidad real (requiere más trabajo)
- **DECISIÓN:** Eliminar por ahora, agregar cuando esté listo

### FASE 3: ARREGLAR PERSISTENCIA DE DATOS

**Archivos:**
- `CasesTab.tsx` - Mejorar manejo de errores API
- `CommissionsTab.tsx` - Verificar API
- `GeneralTab.tsx` - Verificar API

**Cambios:**
1. Remover localStorage como fallback principal
2. Mostrar errores claros si API falla
3. Agregar mejor feedback visual
4. Implementar retry logic

### FASE 4: COMPLETAR WIZARDS

**InsurersTab:**
- Implementar wizard completo o remover botón temporalmente
- Alternativa: Crear form simple inline

### FASE 5: MEJORAR UX/UI

**General:**
1. Indicadores de carga más claros
2. Mensajes de error descriptivos
3. Confirmaciones visuales de guardado
4. Tooltips explicativos

---

## 🎯 PRIORIDADES

### ALTA (Hacer Ahora)
1. ✅ Botones responsive y legibilidad
2. ✅ Remover Kanban toggle sin función
3. ✅ Arreglar persistencia de casos

### MEDIA (Próximo)
4. Completar wizards faltantes
5. Mejorar manejo de errores

### BAJA (Futuro)
6. Implementar Kanban real
7. Analytics y métricas

---

## 📝 CHECKLIST DE CAMBIOS

### ConfigMainClient.tsx
- [ ] Botón "Restablecer Todo" responsive
- [ ] Text white en todos los gradientes

### CasesTab.tsx
- [ ] Remover sección de Kanban completa
- [ ] Mejorar manejo de errores de API
- [ ] Agregar loading states claros
- [ ] Botones responsive

### CommissionsTab.tsx
- [ ] Verificar API endpoints
- [ ] Botones responsive
- [ ] Mejorar feedback visual

### GeneralTab.tsx
- [ ] Botones responsive
- [ ] Verificar guardado de logo

### InsurersTab.tsx
- [ ] Wizard completo o form simple
- [ ] Botones responsive

### GuidesTab.tsx
- [ ] Botones responsive
- [ ] Mejorar UX de creación

### Downloads Tab & Agenda Tab
- [ ] Revisar responsive
- [ ] Verificar funcionalidad

### DelinquencyTab.tsx
- [ ] Botones responsive
- [ ] Verificar API

---

## 🚀 IMPLEMENTACIÓN

Ver archivos modificados a continuación...
