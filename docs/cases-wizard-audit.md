# Auditoría Wizard Pendientes (Casos)

**Fecha**: 2025-10-04  
**Alcance**: Corrección stepper responsive + eliminación campos innecesarios + uppercase

---

## Cambios Implementados

### 1. **Stepper Responsive con Horizontal Scroll**

**Problema**: En móvil (<360px), los 5 pasos del wizard se desbordaban del card

**Solución**:
```tsx
<div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-4 sm:p-6 mb-6 overflow-hidden">
  <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
    <div className="flex items-center min-w-max sm:min-w-0 sm:justify-between">
      {/* Steps con títulos abreviados en móvil */}
    </div>
  </div>
</div>
```

**Características**:
- ✅ Horizontal scroll en móvil (`overflow-x-auto`)
- ✅ Títulos abreviados: "Datos", "Clasif.", "Check", "Docs", "Review"
- ✅ Títulos completos en desktop (≥640px): "Datos básicos", "Clasificación", etc.
- ✅ Iconos más pequeños en móvil (w-10 h-10 vs w-12 h-12)
- ✅ Conectores con ancho fijo (w-8 sm:w-16 md:w-24)

**Layout móvil**:
```tsx
// Móvil: scroll horizontal
<div className="flex items-center min-w-max">
  <Step shortLabel="Datos" />
  <Connector />
  <Step shortLabel="Clasif." />
  {/* ... */}
</div>

// Desktop: justify-between (distribuido)
<div className="flex items-center sm:justify-between">
  <Step label="Datos básicos" />
  {/* ... */}
</div>
```

---

### 2. **Eliminación de "Cliente Existente"**

**Campo removido**:
```tsx
// ❌ ELIMINADO
<div>
  <label>Cliente existente (opcional)</label>
  <select>
    <option>Selecciona un cliente o ingresa nuevo abajo</option>
    {/* ... */}
  </select>
</div>
```

**Razón**: El flujo se simplifica permitiendo solo el ingreso manual del nombre del cliente.

**Estado del form**:
```tsx
// client_id se mantiene por compatibilidad pero no se usa en el wizard
const [formData, setFormData] = useState({
  client_id: '',  // Se mantiene para el backend
  client_name: '', // Input directo
  // ...
});
```

---

### 3. **Eliminación de "Ticket de Referencia"**

**Campo removido del Step 1**:
```tsx
// ❌ ELIMINADO
<div>
  <label>Ticket de referencia</label>
  <input
    type="text"
    value={formData.ticket_ref}
    onChange={(e) => setFormData({ ...formData, ticket_ref: e.target.value })}
    placeholder="Ej: TKT-001"
  />
</div>
```

**Campo removido del estado**:
```typescript
// Antes
const [formData, setFormData] = useState({
  ticket_ref: '',  // ❌ ELIMINADO
  // ...
});

// Después
const [formData, setFormData] = useState({
  // ticket_ref eliminado completamente
  // ...
});
```

**Campo removido de la revisión (Step 5)**:
```tsx
// ❌ ELIMINADO
{formData.ticket_ref && (
  <p><span className="font-semibold">Ticket:</span> {formData.ticket_ref}</p>
)}
```

**Razón**: El ticket se llenará automáticamente por webhook, no manualmente.

---

### 4. **Normalización Uppercase**

**Imports agregados**:
```tsx
import { toUppercasePayload, createUppercaseHandler, uppercaseInputClass } from '@/lib/utils/uppercase';
```

**Campos normalizados**:

1. **Nombre del cliente**:
```tsx
<label className="block text-xs sm:text-sm font-semibold text-gray-600 mb-2 uppercase">
  Nombre del cliente *
</label>
<input
  type="text"
  value={formData.client_name}
  onChange={createUppercaseHandler((e) => setFormData({ ...formData, client_name: e.target.value }))}
  placeholder="INGRESA EL NOMBRE DEL CLIENTE"
  className={`w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none ${uppercaseInputClass}`}
/>
```

2. **Número de póliza**:
```tsx
<label className="block text-xs sm:text-sm font-semibold text-gray-600 mb-2 uppercase">
  Número de póliza
</label>
<input
  type="text"
  value={formData.policy_number}
  onChange={createUppercaseHandler((e) => setFormData({ ...formData, policy_number: e.target.value }))}
  placeholder="POL-12345"
  className={`w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none ${uppercaseInputClass}`}
/>
```

**Labels normalizados**:
- `NOMBRE DEL CLIENTE *`
- `NÚMERO DE PÓLIZA`

---

## Comparación Visual

### Stepper - Antes (Problema)

```
[Móvil desbordado]
┌─────────────────────────┐
│ Datos básicos Clasificaci...│ ← Overflow
└─────────────────────────┘
```

### Stepper - Después (Solucionado)

```
[Móvil con scroll horizontal]
┌─────────────────────────┐
│ Datos→Clasif.→Check→... │ ← Scroll suave
└─────────────────────────┘

[Desktop distribuido]
┌──────────────────────────────────────────┐
│ Datos básicos → Clasificación → ... → Revisión │
└──────────────────────────────────────────┘
```

### Formulario - Antes vs Después

**Antes (5 campos)**:
```
┌─────────────────────────┐
│ Corredor *              │
│ [Select]                │
│                         │
│ Cliente existente       │  ← ELIMINADO
│ [Select]                │
│                         │
│ Nombre del cliente *    │
│ [Input]                 │
│                         │
│ Número de póliza        │
│ [Input]                 │
│                         │
│ Ticket de referencia    │  ← ELIMINADO
│ [Input]                 │
└─────────────────────────┘
```

**Después (3 campos + uppercase)**:
```
┌─────────────────────────┐
│ Corredor *              │
│ [Select]                │
│                         │
│ NOMBRE DEL CLIENTE *    │  ← Uppercase
│ [JUAN PEREZ]            │
│                         │
│ NÚMERO DE PÓLIZA        │  ← Uppercase
│ [POL-12345]             │
└─────────────────────────┘
```

---

## Archivos Modificados

**Componente principal**:
- `src/components/cases/NewCaseWizard.tsx`

**Cambios específicos**:
1. Stepper responsive (líneas 154-195)
2. Eliminación de "Cliente existente" (líneas 225-237)
3. Eliminación de "Ticket de referencia" (campo + estado + revisión)
4. Normalización uppercase en 2 inputs

---

## Testing

### Manual QA Pendiente

**Resoluciones**:
- [ ] **360px**: Stepper con scroll horizontal funcional
- [ ] **375px** (iPhone SE): Títulos abreviados legibles
- [ ] **640px+**: Stepper distribuido (sin scroll)

**Funcionalidad**:
- [ ] Escribir nombre "juan perez" → Ver "JUAN PEREZ"
- [ ] Escribir póliza "pol-123" → Ver "POL-123"
- [ ] Navegar por los 5 pasos
- [ ] Verificar que Step 5 (Revisión) muestre datos correctos
- [ ] Crear caso → Verificar BD con datos en mayúsculas

**Stepper**:
- [ ] En móvil, hacer scroll horizontal debe funcionar suavemente
- [ ] Los 5 círculos deben ser visibles (scroll completo)
- [ ] Cambiar entre pasos actualiza el progreso visual

---

## Consistencia con Diseño Corporativo

### Stepper Colors
- **Completado**: `bg-[#8AAA19]` (oliva)
- **Activo**: `bg-[#010139]` con `ring-4 ring-[#010139] ring-opacity-20`
- **Pendiente**: `bg-gray-200 text-gray-500`

### Conectores
- **Completado**: `bg-[#8AAA19]`
- **Pendiente**: `bg-gray-200`

### Labels
- Tipografía: `text-xs sm:text-sm font-semibold text-gray-600`
- Transform: `uppercase`
- Consistente con Cheques, Comisiones, Morosidad

---

## Notas Técnicas

### Horizontal Scroll Pattern
```tsx
<div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
  <div className="flex items-center min-w-max sm:min-w-0">
    {/* Contenido con flex-shrink-0 */}
  </div>
</div>
```

**Explicación**:
- `-mx-4 px-4`: Extiende el scroll edge-to-edge en móvil
- `min-w-max`: Fuerza que el contenido no se comprima
- `sm:min-w-0 sm:justify-between`: En desktop, distribuye normalmente

### Short Labels Pattern
```tsx
<p className="text-[10px] sm:text-sm">
  <span className="sm:hidden">{step.shortLabel}</span>
  <span className="hidden sm:inline">{step.label}</span>
</p>
```

### Remove Field Checklist
Cuando se elimina un campo del wizard:
1. ✅ Remover del estado inicial
2. ✅ Remover del JSX (Step X)
3. ✅ Remover referencias en Step 5 (Revisión)
4. ✅ Verificar validaciones (no debe bloquear)
5. ✅ Verificar que el backend no lo requiera

---

## Próximos Pasos

1. ⏳ Ejecutar `npm run build` (verificar compilación)
2. ⏳ Probar en navegador con DevTools responsive
3. ⏳ Crear caso con datos en minúsculas
4. ⏳ Verificar mayúsculas en BD (tabla `cases`)
5. ⏳ Screenshot before/after del stepper en 360px

---

**Estado**: ✅ Implementación completa | ✅ Typecheck sin errores | ⏳ Build pendiente | ⏳ QA manual pendiente

**Simplificación lograda**: Wizard reducido de 5 campos a 3 campos principales en Step 1, con normalización automática a mayúsculas y stepper responsive funcional en móvil.
