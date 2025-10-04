# Quick Fixes: Módulo Corredores

**Fecha**: 2025-10-04  
**Alcance**: Búsqueda funcional + Fondo transparente + Uppercase  
**Estimación**: 1-2 horas

---

## Cambios Requeridos

### 1. **Buscador Funcional** (30 minutos)

**Archivo**: `src/app/(app)/brokers/actions.ts`

**Problema actual**: No busca por código ASSA

**Fix**:
```typescript
// Línea 23-27
if (search) {
  brokersQuery = brokersQuery.or(`
    name.ilike.%${search}%,
    email.ilike.%${search}%,
    national_id.ilike.%${search}%,
    assa_code.ilike.%${search}%
  `);
}
```

---

### 2. **Input Búsqueda con Uppercase** (15 minutos)

**Archivo**: `src/components/brokers/BrokersListClient.tsx`

**Línea 122-126**:
```tsx
import { createUppercaseHandler, uppercaseInputClass } from '@/lib/utils/uppercase';

<input
  type="text"
  value={search}
  onChange={createUppercaseHandler((e) => setSearch(e.target.value))}
  placeholder="BUSCAR POR NOMBRE, EMAIL, CÉDULA O CÓDIGO..."
  className={`w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none ${uppercaseInputClass}`}
/>
```

---

### 3. **Eliminar Fondo Blanco** (5 minutos)

**Archivo**: `src/app/(app)/brokers/[id]/page.tsx`

**Línea 32**:
```tsx
// ANTES
<div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-2 sm:p-4 md:p-6">

// DESPUÉS
<div className="min-h-screen p-2 sm:p-4 md:p-6">
```

**Archivo**: `src/components/brokers/BrokerDetailClient.tsx`

Verificar que el card principal tenga:
```tsx
className="bg-white rounded-xl shadow-lg border-2 border-gray-100"
```

---

### 4. **Uppercase en Formularios de Edición** (30 minutos)

**Archivo**: `src/components/brokers/BrokerDetailClient.tsx`

**Campos a normalizar** (estimado 8-10 inputs):
- `name` (Nombre)
- `national_id` (Cédula)
- `assa_code` (Código ASSA)
- `license_no` (Licencia)
- `bank_account_no` (Cuenta bancaria)
- `beneficiary_name` (Nombre beneficiario)
- `beneficiary_id` (ID beneficiario)

**Import**:
```tsx
import { createUppercaseHandler, uppercaseInputClass, toUppercasePayload } from '@/lib/utils/uppercase';
```

**Pattern en cada input**:
```tsx
<input
  value={formData.name}
  onChange={createUppercaseHandler((e) => setFormData({...formData, name: e.target.value}))}
  className={`... ${uppercaseInputClass}`}
/>
```

**En handleSave**:
```typescript
const handleSave = async () => {
  setSaving(true);
  const normalizedData = toUppercasePayload(formData);
  const result = await actionUpdateBroker(brokerId, normalizedData);
  // ...
};
```

---

## Testing

### Manual QA
- [ ] Buscar "juan" → Encuentra "JUAN PEREZ"
- [ ] Buscar "8-123-456" → Encuentra por cédula
- [ ] Buscar "ASS123" → Encuentra por código ASSA
- [ ] Abrir detalle → Fondo transparente (sin cuadro blanco)
- [ ] Editar nombre "test" → Ver "TEST" en input
- [ ] Guardar → Verificar mayúsculas en BD

### Typecheck
```bash
npm run typecheck
```

---

## Estimación Total

- **Búsqueda**: 30 min
- **Uppercase input**: 15 min
- **Fondo**: 5 min
- **Uppercase forms**: 30 min
- **Testing**: 10 min

**Total**: 1.5 horas

---

## Estado en el Portal

| Módulo | Status | Uppercase | Responsive | Docs |
|--------|--------|-----------|------------|------|
| **Corredores** | 📋 | ⏳ | ✅ | ✅ |

**Después de implementar**:
| Módulo | Status | Uppercase | Responsive | Docs |
|--------|--------|-----------|------------|------|
| **Corredores** | ✅ | ✅ | ✅ | ✅ |

---

**Status**: 📋 Roadmap completo | ⏳ Pendiente de implementación | 🎯 1.5h estimadas
