# Auditoría DatePickers Cheques

**Fecha**: 2025-10-04  
**Alcance**: Corrección de inputs de fecha + normalización mayúsculas en formularios

---

## Objetivo

Corregir los DatePickers (desde-hasta) en el módulo Cheques para que:
1. Se ajusten al ancho del contenedor (full-width en móvil)
2. Labels compactos y alineados arriba del control
3. Aplicar mayúsculas en todos los inputs de texto

---

## Cambios Implementados

### 1. **BankHistoryTab.tsx** — Filtros de Fecha

**Labels normalizados**:
```tsx
// Antes
<label className="block text-sm font-medium text-gray-700 mb-2">Desde</label>
<label className="block text-sm font-medium text-gray-700 mb-2">Hasta</label>

// Después
<label className="block text-xs sm:text-sm font-semibold text-gray-600 mb-2 uppercase">Desde</label>
<label className="block text-xs sm:text-sm font-semibold text-gray-600 mb-2 uppercase">Hasta</label>
```

**Características**:
- ✅ Labels en MAYÚSCULAS: `DESDE`, `HASTA`, `ESTADO`
- ✅ Tipografía responsive: `text-xs sm:text-sm`
- ✅ Font-weight: `font-semibold` (más visible)
- ✅ Color: `text-gray-600` (consistente con Comisiones)
- ✅ Ya tenían `w-full` (sin cambios necesarios)

**Opciones de filtros**:
```tsx
<option value="all">TODOS</option>
<option value="available">DISPONIBLE</option>
<option value="partial">PARCIAL</option>
<option value="exhausted">AGOTADO</option>
```

---

### 2. **RegisterPaymentWizard.tsx** — Inputs de Texto

**Imports agregados**:
```tsx
import { toUppercasePayload, createUppercaseHandler, uppercaseInputClass } from '@/lib/utils/uppercase';
```

**Inputs normalizados**:

1. **client_name** (Cliente):
```tsx
<input
  onChange={createUppercaseHandler((e) => setFormData({ ...formData, client_name: e.target.value }))}
  className={`w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none ${uppercaseInputClass}`}
/>
```

2. **policy_number** (Número de Póliza):
```tsx
<input
  onChange={createUppercaseHandler((e) => setFormData({ ...formData, policy_number: e.target.value }))}
  className={`w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none ${uppercaseInputClass}`}
/>
```

3. **cuenta_banco** (Cuenta de Banco):
```tsx
<input
  onChange={createUppercaseHandler((e) => setFormData({ ...formData, cuenta_banco: e.target.value }))}
  className={`w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#010139] focus:outline-none ${uppercaseInputClass}`}
/>
```

4. **reference_number** (Número de Referencia):
```tsx
<input
  onChange={createUppercaseHandler((e) => {
    const newRefs = [...references];
    if (newRefs[index]) {
      newRefs[index]!.reference_number = e.target.value;
    }
    setReferences(newRefs);
  })}
  className={`flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none ${uppercaseInputClass}`}
/>
```

5. **notes** (Notas):
```tsx
<textarea
  onChange={createUppercaseHandler((e) => setFormData({ ...formData, notes: e.target.value }))}
  className={`w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none ${uppercaseInputClass}`}
/>
```

---

## Layout Responsive

### Filtros BankHistoryTab

**Grid responsivo existente** (sin cambios):
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Estado, Desde, Hasta */}
</div>
```

**Breakpoints**:
- **Móvil** (<640px): 1 columna vertical
- **Tablet** (640px-1023px): 2 columnas
- **Desktop** (≥1024px): 3 columnas

**Inputs de fecha**:
- Ya tenían `w-full` → Ocupan 100% del contenedor
- No hay overflow horizontal en ninguna resolución

---

## Comparación Visual

### Antes
```
┌─────────────────────────────────┐
│ Estado         Desde      Hasta │  ← Labels pequeños, inconsistentes
│ [Select▼]     [Date]    [Date]  │
└─────────────────────────────────┘
```

### Después
```
┌─────────────────────────────────┐
│ ESTADO         DESDE      HASTA │  ← Labels en mayúsculas, más visibles
│ [TODOS▼]      [Date]    [Date]  │  ← Opciones también en mayúsculas
└─────────────────────────────────┘
```

### Móvil (<640px)
```
┌──────────────────┐
│ ESTADO           │
│ [TODOS▼]         │
│                  │
│ DESDE            │
│ [Date]           │
│                  │
│ HASTA            │
│ [Date]           │
└──────────────────┘
```

---

## Integración con Sistema Uppercase

### Inputs de Texto
**Patrón aplicado**:
1. Import de utilidades
2. Wrapper `createUppercaseHandler` en onChange
3. Clase `uppercaseInputClass` en className
4. Conversión en tiempo real mientras se escribe

**Resultado**:
- Usuario escribe: `juan perez`
- Se muestra: `JUAN PEREZ`
- Se guarda: `JUAN PEREZ`

### DatePickers
**No requieren normalización**:
- Los inputs `type="date"` no admiten texto libre
- El formato es controlado por el navegador (YYYY-MM-DD)
- Solo se normalizaron los labels para consistencia visual

---

## Testing

### Manual QA Pendiente

**Resoluciones**:
- [ ] **360px** (iPhone SE): Filtros stacked, sin overflow
- [ ] **375px** (Pixel 5): DatePickers full-width
- [ ] **768px** (iPad): Grid 2 columnas
- [ ] **1024px+**: Grid 3 columnas

**Funcionalidad**:
- [ ] Escribir nombre cliente "juan perez" → Ver "JUAN PEREZ"
- [ ] Escribir póliza "pol-2024-001" → Ver "POL-2024-001"
- [ ] Escribir referencia "ref123" → Ver "REF123"
- [ ] Filtrar por fecha → Resultados correctos
- [ ] Guardar pago → Verificar mayúsculas en BD

**E2E Sugerido**:
1. Filtrar historial: Desde 2024-10-01, Hasta 2024-10-31
2. Verificar resultados filtrados
3. Crear pago: Cliente "test client" → Verificar "TEST CLIENT" en BD
4. Agregar referencia "abc123" → Verificar "ABC123"

---

## Archivos Modificados

**Componentes principales**:
1. `src/components/checks/BankHistoryTab.tsx`
   - Labels de filtros normalizados a mayúsculas
   - Opciones de select en mayúsculas
   - Tipografía responsive aplicada

2. `src/components/checks/RegisterPaymentWizard.tsx`
   - Imports de uppercase utilities
   - 5 inputs de texto con uppercase handler
   - Todas las clases con uppercaseInputClass

**Utilidades reutilizadas**:
- `src/lib/utils/uppercase.ts` (sin cambios, ya existente)

---

## Consistencia Corporativa

### Tipografía Labels
```css
/* Estándar aplicado */
text-xs sm:text-sm    /* Responsive */
font-semibold         /* Peso medio-alto */
text-gray-600         /* Color corporativo secundario */
uppercase             /* Mayúsculas */
mb-2                  /* Margen inferior */
```

### Colores
- **Labels**: `text-gray-600`
- **Inputs focus**: `border-[#8AAA19]` (oliva)
- **Inputs focus alt**: `border-[#010139]` (azul profundo)

---

## Próximos Pasos

1. ⏳ Ejecutar `npm run build` (verificar compilación)
2. ⏳ Probar en navegador con DevTools responsive
3. ⏳ E2E: Crear pago con minúsculas → Verificar BD
4. ⏳ Considerar extender a otros módulos si hay DatePickers similares

---

## Notas Técnicas

### CreateUppercaseHandler con Estado Complejo
En referencias (array state):
```tsx
onChange={createUppercaseHandler((e) => {
  const newRefs = [...references];
  if (newRefs[index]) {
    newRefs[index]!.reference_number = e.target.value;
  }
  setReferences(newRefs);
})}
```

El wrapper respeta la lógica interna del handler, solo transforma el value antes.

### DatePicker Full-Width
```tsx
className="w-full px-4 py-2.5 ..."
```

Ya estaba correcto, no requirió cambios. Los DatePickers nativos se adaptan automáticamente.

---

**Estado**: ✅ Implementación completa | ✅ Typecheck sin errores | ⏳ Build pendiente | ⏳ QA manual pendiente

**Consistencia aplicada**: Labels en mayúsculas en Cheques ahora coinciden con el estándar de Comisiones (AÑO, MES, QUINCENA) y todos los inputs de texto normalizan a mayúsculas automáticamente.
