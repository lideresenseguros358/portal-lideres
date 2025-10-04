# Roadmap de Refactorización: Módulo Producción

**Fecha**: 2025-10-04  
**Alcance**: Paginación, Códigos ASSA, Canceladas editables, Analíticas, KPIs, Uppercase  
**Estimación**: 12-20 horas de desarrollo + testing

---

## Estado Actual

### Archivos Identificados
1. `ProductionMatrixMaster.tsx` (17.1 KB) - Matriz principal MASTER
2. `ProductionMatrix.tsx` (16.1 KB) - Matriz general
3. `ProductionAnalyticsView.tsx` (20.6 KB) - Vista de analíticas y KPIs
4. `ProductionBrokerView.tsx` (18.1 KB) - Vista individual por broker
5. `ContestsConfig.tsx` (15.5 KB) - Configuración de concursos
6. `MonthInputModal.tsx` (6.2 KB) - Modal de input mensual
7. `MetaPersonalModal.tsx` (4.7 KB) - Modal de meta personal
8. `ProductionMainClient.tsx` (4.1 KB) - Cliente principal

**Total**: ~102 KB de código (aprox. 2,800 líneas)

---

## Tareas Requeridas

### 1. **Paginación Anterior/Siguiente** (Complejidad: MEDIA)
**Estimación**: 2-3 horas

**Componente afectado**: `ProductionMatrixMaster.tsx`

**Implementación**:
- [ ] Agregar controles "Anterior" / "Siguiente" dentro del card
- [ ] Layout responsive: botones en fila en desktop, stack en móvil
- [ ] Estado de paginación (página actual, total páginas)
- [ ] Deshabilitar botones en límites (primera/última página)
- [ ] Scroll automático al top al cambiar página
- [ ] Indicador de página actual (ej: "Página 2 de 5")

**Patrón UI**:
```tsx
<div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-gray-200">
  <button
    onClick={handlePrev}
    disabled={currentPage === 1}
    className="w-full sm:w-auto px-6 py-3 ..."
  >
    ← Anterior
  </button>
  
  <span className="text-sm text-gray-600">
    Página {currentPage} de {totalPages}
  </span>
  
  <button
    onClick={handleNext}
    disabled={currentPage === totalPages}
    className="w-full sm:w-auto px-6 py-3 ..."
  >
    Siguiente →
  </button>
</div>
```

---

### 2. **Nueva Columna: Código ASSA** (Complejidad: MEDIA-ALTA)
**Estimación**: 3-4 horas

**Componente afectado**: `ProductionMatrixMaster.tsx`

**Problema**:
- El código ASSA existe en BD pero no se muestra en la matriz
- Necesita ser editable inline

**Implementación**:
- [ ] Verificar estructura de datos actual (query de matriz)
- [ ] Agregar columna "Código ASSA" en la tabla
- [ ] Input inline editable (similar a otras celdas editables)
- [ ] Validación: formato de código (ej: alfanumérico)
- [ ] Guardar cambios con debounce (evitar múltiples requests)
- [ ] Uppercase automático en el input
- [ ] Indicador visual de guardado/error

**Schema a verificar**:
```sql
-- ¿Existe production_matrix.assa_code o similar?
-- ¿O está en otra tabla relacionada?
SELECT * FROM production_matrix LIMIT 1;
```

**Patrón input inline**:
```tsx
<input
  type="text"
  value={row.assa_code || ''}
  onChange={createUppercaseHandler((e) => handleAssaCodeChange(row.id, e.target.value))}
  onBlur={() => saveAssaCode(row.id)}
  className={`w-full px-2 py-1 text-center ${uppercaseInputClass}`}
  placeholder="CÓDIGO"
/>
```

---

### 3. **Canceladas Editable con Validación** (Complejidad: ALTA)
**Estimación**: 4-5 horas

**Componente afectado**: `ProductionMatrixMaster.tsx` + `MonthInputModal.tsx`

**Requisitos**:
1. Hacer editable "Canceladas" por mes
2. Validación: `canceladas_mes <= bruto_mes`
3. Recalcular Neto automáticamente
4. Actualizar KPIs dependientes en tiempo real

**Implementación**:
- [ ] Identificar inputs de canceladas en matriz
- [ ] Hacer editable (actualmente read-only?)
- [ ] Validación al onChange:
  ```typescript
  if (canceladas > bruto) {
    toast.error('Canceladas no puede ser mayor que Bruto');
    return;
  }
  ```
- [ ] Recalcular Neto: `neto = bruto - canceladas`
- [ ] Propagar cambios a:
  - Total neto mensual
  - Totales anuales
  - KPIs relacionados (% logro, promedio, etc.)
  - Gráficas (si las hay)
- [ ] Debounce para evitar cálculos excesivos
- [ ] Indicador visual de recalculando

**Flujo de cálculo**:
```typescript
const recalculateMetrics = (brokerId: string, month: number, canceladas: number) => {
  const bruto = getMonthlyBruto(brokerId, month);
  
  // Validar
  if (canceladas > bruto) {
    throw new Error('Invalid canceladas');
  }
  
  // Recalcular
  const neto = bruto - canceladas;
  const netoAnual = calculateYearlyNeto(brokerId);
  const metaLogro = (netoAnual / meta) * 100;
  
  // Actualizar estado
  updateBrokerMetrics(brokerId, { neto, netoAnual, metaLogro });
};
```

---

### 4. **Tab Analíticas: Dropdown Corredores** (Complejidad: MEDIA)
**Estimación**: 2-3 horas

**Componente afectado**: `ProductionAnalyticsView.tsx`

**Problema**:
- Dropdown se corta en viewport (overflow)
- Necesita positioning correcto

**Implementación**:
- [ ] Cambiar de `<select>` nativo a componente custom con portal
- [ ] Usar Radix UI Select (ya usado en otros módulos):
  ```tsx
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
  
  <Select value={selectedBroker} onValueChange={setSelectedBroker}>
    <SelectTrigger className="w-full sm:w-64">
      <SelectValue placeholder="SELECCIONAR CORREDOR" />
    </SelectTrigger>
    <SelectContent>
      {brokers.map(broker => (
        <SelectItem key={broker.id} value={broker.id}>
          {broker.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
  ```
- [ ] Portal automático (Radix UI lo maneja)
- [ ] Normalizar opciones a mayúsculas
- [ ] Responsive width

---

### 5. **KPI "Meta Personal"** (Complejidad: MEDIA-ALTA)
**Estimación**: 2-3 horas

**Componente afectado**: `ProductionAnalyticsView.tsx` + `MetaPersonalModal.tsx`

**Problema actual**:
- Al seleccionar broker, se suma la meta (incorrecto)
- Debe leer la meta individual guardada en matriz

**Implementación**:
- [ ] Verificar dónde se guarda la meta personal
  - ¿En tabla `production_matrix`?
  - ¿En tabla `brokers`?
  - ¿En tabla separada `broker_goals`?
- [ ] Al seleccionar broker:
  ```typescript
  const loadBrokerMeta = async (brokerId: string) => {
    const result = await actionGetBrokerMeta(brokerId);
    if (result.ok) {
      setMetaPersonal(result.data.meta_personal);
      // Recalcular % de logro
      const logro = (netoAnual / result.data.meta_personal) * 100;
      setMetaLogro(logro);
    }
  };
  ```
- [ ] Actualizar KPI display:
  ```tsx
  <div className="bg-white p-6 rounded-xl shadow-lg">
    <h3 className="text-sm text-gray-600 font-semibold">Meta Personal</h3>
    <p className="text-3xl font-bold text-[#010139]">
      ${formatCurrency(metaPersonal)}
    </p>
    <p className="text-sm text-gray-500 mt-1">
      Logro: {metaLogro.toFixed(1)}%
    </p>
  </div>
  ```
- [ ] Gráfica de progreso (si existe)

---

### 6. **Normalización Uppercase** (Complejidad: BAJA-MEDIA)
**Estimación**: 2-3 horas

**Componentes afectados**: 
- `ProductionMatrixMaster.tsx`
- `MonthInputModal.tsx`
- `MetaPersonalModal.tsx`
- `ProductionAnalyticsView.tsx`

**Campos a normalizar**:
- Código ASSA (nuevo campo)
- Notas/Comentarios (si existen)
- Nombres de concursos (ContestsConfig.tsx)
- Cualquier input de texto libre

**Implementación**:
```tsx
import { createUppercaseHandler, uppercaseInputClass } from '@/lib/utils/uppercase';

// En cada input de texto
<input
  onChange={createUppercaseHandler((e) => setState(e.target.value))}
  className={`base-classes ${uppercaseInputClass}`}
/>
```

**Estimación**:
- 10-15 inputs aproximadamente
- Labels normalizar a uppercase
- Placeholders en mayúsculas

---

## Testing Requerido

### Unit Tests
- [ ] Validación canceladas <= bruto
- [ ] Recalculo de neto y KPIs
- [ ] Carga de meta personal por broker

### Integration Tests
- [ ] Editar canceladas → Verificar recalculo inmediato
- [ ] Cambiar broker → Verificar KPI meta personal actualiza
- [ ] Paginación → Navegar entre páginas sin errores

### E2E Tests
- [ ] Flow completo: seleccionar broker → editar canceladas → ver KPIs actualizados
- [ ] Agregar código ASSA → Guardar → Verificar en BD
- [ ] Responsive: probar paginación en 360px y 1024px

### Manual QA
**Resoluciones**:
- [ ] **360px**: Paginación stacked, inputs dentro del card
- [ ] **768px**: Tabla responsive, dropdown funcional
- [ ] **1024px**: Layout completo sin problemas

**Funcionalidad**:
- [ ] Editar canceladas de $1000 con bruto $5000 → Neto = $4000
- [ ] Editar canceladas de $6000 con bruto $5000 → Error de validación
- [ ] Seleccionar broker "Juan" → Meta personal $50,000
- [ ] Seleccionar broker "María" → Meta personal $75,000 (diferente)

---

## Orden de Implementación Recomendado

### Fase 1: Foundation (4-5 horas)
1. ✅ Normalización uppercase (base para todo)
2. ✅ Paginación responsive (mejora UX inmediata)
3. ✅ Dropdown analíticas con portal (fix visual)

### Fase 2: Core Features (6-8 horas)
4. ⏳ Canceladas editable con validación (crítico para datos)
5. ⏳ Recalculo automático de Neto y KPIs
6. ⏳ KPI Meta Personal por broker (fix lógico)

### Fase 3: New Features (3-4 horas)
7. ⏳ Columna Código ASSA
8. ⏳ Testing exhaustivo
9. ⏳ QA y capturas before/after

---

## Riesgos y Consideraciones

### Recalculo de KPIs en Tiempo Real
**Riesgo ALTO**: Performance issues con muchos corredores

**Mitigación**:
- Debounce en inputs (500ms)
- Calcular solo fila afectada, no toda la matriz
- Memoizar cálculos pesados
- Indicador visual de "calculando..."

### Validación de Canceladas
**Riesgo MEDIO**: Datos inconsistentes en BD

**Mitigación**:
- Validación en frontend Y backend
- No permitir guardar si validación falla
- Toast descriptivo con el error
- Opción de "revertir cambios"

### Meta Personal
**Riesgo MEDIO**: Confusión si no está claro de dónde viene

**Mitigación**:
- Tooltip explicativo: "Meta individual del corredor"
- Link a "Editar meta" si es posible
- Mostrar fecha de última actualización

---

## Dependencias de BD

### Tablas Involucradas (Verificar Schema)
```sql
-- ¿Existe esta estructura?
production_matrix {
  id
  broker_id
  year
  month
  bruto_mes
  canceladas_mes  -- ¿Editable?
  neto_mes        -- Calculado
  assa_code       -- ¿Existe? ¿O está en brokers?
  ...
}

broker_goals {
  broker_id
  year
  meta_personal   -- ¿O está en production_matrix?
  ...
}
```

**Acción**: Revisar schema actual antes de implementar

---

## Estimación Final

### Tiempo de Desarrollo
- **Mínimo**: 12 horas (sin imprevistos)
- **Realista**: 16 horas
- **Con buffer**: 20 horas

### Tiempo de Testing
- Unit/Integration: 2 horas
- E2E: 1 hora
- Manual QA + Screenshots: 2 horas

**Total**: 17-25 horas (3-5 días de trabajo)

---

## Estado Actual del Proyecto

### ✅ Completado Hoy (Sesión Extendida)
1. Base de Datos
2. Aseguradoras
3. Comisiones
4. Cheques
5. Morosidad
6. Pendientes
7. Agenda (Fase 1)

**Total**: 7 módulos, 17 componentes con uppercase, 9 documentos

### ⏳ Pendiente
8. **Producción** (Este roadmap)
9. Agenda (Fases 2-3)

---

## Recomendaciones

### Opción A: Implementación Completa
**Pros**: Módulo completamente funcional con todas las features  
**Contras**: 17-25 horas de trabajo adicional  
**Cuándo**: Si hay sprint dedicado

### Opción B: Implementación Parcial (Prioridades)
**Fase 1 solamente** (4-5 horas):
1. ✅ Uppercase
2. ✅ Paginación
3. ✅ Dropdown con portal

**Fase 2 como siguiente sprint**:
4. Canceladas editable
5. Recalculo KPIs
6. Meta Personal

**Fase 3 como nice-to-have**:
7. Código ASSA

### Opción C: Solo Quick Wins
**Estimación**: 2-3 horas  
**Incluye**:
- Uppercase en inputs existentes
- Fix dropdown con portal
- Labels normalizados

**Excluye**:
- Paginación
- Canceladas editable
- Código ASSA
- KPI Meta Personal

---

## Próximos Pasos Inmediatos

Si decides proceder:

1. **Leer archivos actuales** (1 hora)
   - ProductionMatrixMaster.tsx
   - ProductionAnalyticsView.tsx
   - Entender estructura de datos

2. **Verificar schema BD** (30 min)
   - production_matrix table
   - Campos existentes vs requeridos
   - Relaciones con brokers

3. **Decisión de scope** (15 min)
   - ¿Opción A, B o C?
   - ¿Cuánto tiempo disponible?

4. **Setup inicial** (15 min)
   - Crear branch: `feature/production-refactor`
   - Backup de archivos actuales

5. **Implementación según opción elegida**

---

**Conclusión**: El módulo Producción es TAN complejo como Agenda (o más). Requiere análisis profundo de lógica de negocio (KPIs, metas, matrices), validaciones críticas (canceladas), y features nuevas (código ASSA). Recomiendo dividir en fases según urgencia.

**Estado**: 📋 Roadmap completo | ⏳ Awaiting decision on scope | 🎯 Ready to implement
