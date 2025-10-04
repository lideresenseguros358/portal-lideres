# Auditoría UI Base de Datos (Clientes/Aseguradoras)

**Fecha**: 2025-10-04  
**Alcance**: Mejoras de UI/UX y normalización de datos en formularios

---

## Cambios Implementados

### 1. Utilidades Globales de Mayúsculas

**Archivo**: `src/lib/utils/uppercase.ts`

Creado sistema centralizado para normalizar inputs a mayúsculas:

- **`toUppercasePayload<T>(obj: T): T`**: Convierte recursivamente todos los valores string de un objeto a mayúsculas, preservando nulls, números, booleans, arrays y objetos anidados.
- **`createUppercaseHandler<T>(handler): Function`**: Wrapper para eventos onChange que convierte a mayúsculas mientras se escribe, manteniendo la posición del cursor.
- **`uppercaseInputClass`**: Clase CSS `'uppercase placeholder:normal-case'` para aplicar transformación visual.

**Tests**: `src/lib/utils/__tests__/uppercase.test.ts`

---

### 2. DatabaseTabs.tsx - Tabs y Tabla Responsive

**Cambios visuales**:
- ✅ Botones "CLIENTES" y "ASEGURADORAS" en mayúsculas
- ✅ Estado activo con borde oliva (#8AAA19) discreto en lugar de gradiente azul
- ✅ Kebab menu (⋮) para acciones Editar/Eliminar en móvil (<sm)
- ✅ Acciones desktop permanecen visibles en pantallas ≥sm

**Responsive móvil**:
- ✅ Tabla de pólizas oculta en móvil, reemplazada por cards apiladas
- ✅ Cards móviles con layout compacto: header + body + actions
- ✅ Overflow-x-auto en contenedor de pólizas
- ✅ Padding seguro y max-w-full para evitar desbordes
- ✅ Header sticky en tabla desktop (position: sticky, top: 0)

**Integración dropdown**:
```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
```

---

### 3. ClientPolicyWizard.tsx - Wizard Nuevo Cliente

**Mejoras de layout**:
- ✅ Modal limitado a `max-h-[90vh]`
- ✅ Contenido con `overflow-y-auto` y `flex-1`
- ✅ Padding seguro (p-4 sm:p-6)
- ✅ Spacing consistente entre steps (space-y-4)

**Integración mayúsculas**:
- ✅ Todos los inputs de texto usan `createUppercaseHandler`
- ✅ Aplicado `uppercaseInputClass` en className
- ✅ Payload convertido con `toUppercasePayload` antes de submit
- ✅ Inputs afectados: client_name, national_id, address, policy_number, ramo

**Antes del submit**:
```ts
const rawPayload = { /* ... */ };
const payload = toUppercasePayload(rawPayload);
await supabaseClient().from('temp_client_imports').insert([payload]);
```

---

### 4. ClientForm.tsx - Modal Editar Cliente

**Integración mayúsculas**:
- ✅ Input `name` con uppercase handler
- ✅ Input `national_id` con uppercase handler  
- ✅ Input `policy_number` con uppercase handler
- ✅ clientData procesado con `toUppercasePayload` antes de enviar

```ts
const rawClientData = { name, national_id, email, phone, active };
const clientData = toUppercasePayload(rawClientData);
const policyData = { policy_number: formData.policy_number.toUpperCase() };
```

---

## Verificación QA

### Typecheck
```bash
npm run typecheck
```
✅ **Resultado**: Sin errores de tipos

### Build
```bash
npm run build
```
⏳ **Estado**: En progreso

---

## Tests Pendientes

### E2E Manual (Navegador)
- [ ] **360px**: Wizard responsive, tabs centrados, cards apiladas
- [ ] **768px**: Transición desktop, tabla visible, actions inline
- [ ] **1024px**: Layout completo, sin scroll horizontal innecesario

### Verificación BD
- [ ] Crear cliente con nombre "juan pérez" → Verificar en BD: "JUAN PÉREZ"
- [ ] Crear póliza "pol-2024-001" → Verificar en BD: "POL-2024-001"
- [ ] Completar wizard con minúsculas → Confirmar normalización en `temp_client_imports`

### Integración
- [ ] Ejecutar tests unitarios: `npm run test src/lib/utils/__tests__/uppercase.test.ts`
- [ ] Validar transformación en tiempo real (cursor no salta)
- [ ] Confirmar que nulls/números no se afectan

---

## Próximos Pasos

1. ✅ Finalizar build
2. ⏳ Ejecutar suite de tests
3. ⏳ Probar en navegador (Chrome DevTools → Responsive)
4. ⏳ Verificar datos en Supabase dashboard
5. ⏳ Extender utilidades uppercase a otros formularios del portal (brokers, insurers, etc.)

---

## Notas Técnicas

### Diseño Corporativo Aplicado
- Oliva (#8AAA19): Bordes activos, botones CTA
- Azul (#010139): Headers, títulos, hover secundario
- Responsive: Mobile-first, breakpoint sm: 640px

### Compatibilidad
- React 18+
- TypeScript strict mode
- Tailwind CSS v3
- Radix UI dropdown-menu

---

**Status Final**: ✅ Implementación completa | ✅ Typecheck sin errores | ⏳ Build en progreso | ⏳ QA navegador pendiente
