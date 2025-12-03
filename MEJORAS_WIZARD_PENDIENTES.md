# 🚧 MEJORAS DEL WIZARD - EN PROGRESO

## Estado Actual

⚠️ **Archivo con errores de sintaxis:** `src/components/checks/RegisterPaymentWizard.tsx`

El archivo tiene múltiples errores de JSX debido a ediciones incompletas. Necesita ser restaurado y aplicar las mejoras de forma limpia.

---

## Mejoras Implementadas Correctamente

### ✅ 1. Funciones de Sanitización (COMPLETO)

**Archivo:** `src/lib/utils/uppercase.ts`

**Nuevas funciones agregadas:**
- `sanitizeForBank(text)` - Quita ñ, acentos y caracteres especiales
- `sanitizePolicyNumber(text, insurerName)` - Sanitiza número de póliza según aseguradora
  - **La Regional**: No permite guiones (-)
  - **Otras**: Permite guiones
- `generateEmisionWebPolicy()` - Genera "EMISION WEB DD/MM/YYYY"
- `createBankSafeHandler()` - Handler para inputs seguros para banco

---

## Mejoras Pendientes de Aplicar

### 2. Wizard - Paso 1 (Info Básica)

#### Campo: Cliente
```tsx
<input
  type="text"
  value={formData.client_name}
  onChange={createBankSafeHandler((e) => {
    setFormData({ ...formData, client_name: e.target.value });
  })}
  placeholder="NOMBRE DEL CLIENTE"
/>
<p className="text-xs text-gray-500 mt-1">
  ⚠️ Sin ñ, acentos ni caracteres especiales (requisito bancario)
</p>
```

#### Orden de Campos para Póliza (Mobile-First)
1. **Aseguradora** (primero - importante para validar número)
2. **Checkbox Emisión Web** (si se activa, autocompleta número)
3. **Número de Póliza** (con validación dinámica según aseguradora)

#### Checkbox Emisión Web
```tsx
<div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
  <label className="flex items-start gap-3 cursor-pointer">
    <input
      type="checkbox"
      checked={isEmisionWeb}
      onChange={(e) => {
        const checked = e.target.checked;
        setIsEmisionWeb(checked);
        if (checked) {
          setFormData({ ...formData, policy_number: generateEmisionWebPolicy() });
        } else {
          setFormData({ ...formData, policy_number: '' });
        }
      }}
      className="w-5 h-5 text-[#8AAA19] rounded"
    />
    <div>
      <span className="text-sm font-medium">🌐 Emisión Web</span>
      <p className="text-xs text-gray-600 mt-0.5">
        Autocompleta con "EMISION WEB" y la fecha de hoy
      </p>
    </div>
  </label>
</div>
```

#### Número de Póliza con Validación Dinámica
```tsx
<input
  type="text"
  value={formData.policy_number}
  onChange={(e) => {
    const sanitized = sanitizePolicyNumber(e.target.value, formData.insurer_name);
    setFormData({ ...formData, policy_number: sanitized });
  }}
  disabled={isEmisionWeb}
  placeholder={
    formData.insurer_name?.toUpperCase().includes('LA REGIONAL') || 
    formData.insurer_name?.toUpperCase().includes('REGIONAL')
      ? 'POL2024001 (sin guiones)'
      : 'POL-2024-001'
  }
/>
{(formData.insurer_name?.toUpperCase().includes('LA REGIONAL') || 
  formData.insurer_name?.toUpperCase().includes('REGIONAL')) && (
  <p className="text-xs text-amber-600 mt-1 font-medium">
    ⚠️ La Regional: No permite guiones (-)
  </p>
)}
```

#### Devolución a Cliente - Layout Grid
```tsx
<div>
  <label>Banco</label>
  <input
    value={formData.banco_nombre}
    onChange={createBankSafeHandler((e) => setFormData({ ...formData, banco_nombre: e.target.value }))}
  />
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <div>
    <label>Tipo de Cuenta</label>
    <select value={formData.tipo_cuenta} ...>
      <option value="">Seleccionar...</option>
      <option value="CORRIENTE">Corriente</option>
      <option value="AHORRO">Ahorro</option>
    </select>
  </div>

  <div>
    <label>Número de Cuenta</label>
    <input
      value={formData.cuenta_banco}
      onChange={createBankSafeHandler((e) => setFormData({ ...formData, cuenta_banco: e.target.value }))}
    />
  </div>
</div>

<p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded p-2">
  📝 <strong>Titular:</strong> {formData.client_name || '(ingrese cliente arriba)'}
</p>
```

#### Monto y Notas - Layout Mejorado
```tsx
<div className="bg-gradient-to-br from-[#8AAA19]/5 to-[#8AAA19]/10 border-2 border-[#8AAA19]/30 rounded-xl p-4 space-y-4">
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      💵 Monto a Pagar <span className="text-red-500">*</span>
    </label>
    <div className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-lg">$</span>
      <input
        type="number"
        step="0.01"
        value={formData.amount_to_pay}
        onChange={(e) => {
          setFormData({ ...formData, amount_to_pay: e.target.value });
          if (validationErrors.length > 0) setValidationErrors([]);
        }}
        className="w-full pl-10 pr-4 py-3 border-2 rounded-lg text-lg font-bold"
        placeholder="0.00"
      />
    </div>
  </div>

  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">📝 Notas</label>
    <textarea
      value={formData.notes}
      onChange={createBankSafeHandler((e) => setFormData({ ...formData, notes: e.target.value }))}
      className="w-full px-4 py-2 border-2 rounded-lg uppercase"
      rows={2}
      placeholder="INFORMACION ADICIONAL (OPCIONAL)"
    />
  </div>
</div>
```

---

## Estado de Variables

### Agregar al Estado (useState)
```tsx
const [isEmisionWeb, setIsEmisionWeb] = useState(false);
```

### Imports Necesarios
```tsx
import { 
  createUppercaseHandler, 
  createBankSafeHandler, 
  sanitizePolicyNumber, 
  generateEmisionWebPolicy, 
  uppercaseInputClass 
} from '@/lib/utils/uppercase';
```

---

## Validaciones y Comportamientos

### 1. Cliente
- ✅ Sin ñ
- ✅ Sin acentos
- ✅ Sin caracteres especiales
- ✅ Solo letras, números, espacios y guiones

### 2. Número de Póliza
**La Regional:**
- ❌ No permite guiones (-)
- ✅ Permite letras, números, espacios y barras (/)

**Otras Aseguradoras:**
- ✅ Permite guiones (-)
- ✅ Permite letras, números, espacios y barras (/)

### 3. Emisión Web
- Al activar checkbox:
  - Autocompleta: `EMISION WEB DD/MM/YYYY`
  - Deshabilita input de número de póliza
- Al desactivar checkbox:
  - Limpia el campo
  - Habilita input de nuevo

### 4. Banco y Cuenta
- ✅ Sanitizados para compatibilidad bancaria
- ✅ Sin ñ ni acentos

---

## Mejoras UX Mobile-First

### Paso 1
1. **Campo Cliente** - Con advertencia clara de restricciones
2. **Tipo de Pago** - Selector simple
3. **Si es Póliza:**
   - Aseguradora (primero)
   - Checkbox Emisión Web (destacado en azul)
   - Número de Póliza (con validación dinámica)
4. **Si es Devolución:**
   - Tipo de devolución
   - Grid 2 columnas en desktop para tipo cuenta + número
5. **Monto y Notas** - Agrupados en card verde destacado

### Ventajas Mobile
- Campos agrupados lógicamente
- Menos scroll vertical
- Inputs más grandes y táctiles
- Advertencias claras e inline
- Grid responsive en inputs relacionados

---

## Testing Recomendado

### Test 1: La Regional
1. Seleccionar aseguradora "LA REGIONAL"
2. Intentar escribir "POL-2024-001"
3. Debe quedar como "POL2024001" (sin guiones)

### Test 2: Emisión Web
1. Seleccionar cualquier aseguradora
2. Activar checkbox "Emisión Web"
3. Debe autocompletar: "EMISION WEB 03/12/2024"
4. Input debe estar deshabilitado
5. Al desactivar, debe limpiar y habilitar

### Test 3: Cliente con Ñ
1. Escribir "PEÑA"
2. Debe quedar como "PENA"

### Test 4: Cliente con Acentos
1. Escribir "JOSÉ GARCÍA"
2. Debe quedar como "JOSE GARCIA"

---

## Archivos a Modificar

### ✅ Completado
- `src/lib/utils/uppercase.ts` - Funciones agregadas

### 🚧 Pendiente
- `src/components/checks/RegisterPaymentWizard.tsx` - Aplicar cambios en UI

---

## Próximos Pasos

1. **Restaurar archivo wizard** sin errores de sintaxis
2. **Aplicar cambios** uno por uno verificando sintaxis
3. **Probar en browser** cada mejora
4. **Ajustar estilos** si es necesario para mobile

---

**Nota:** Las funciones de utilidad ya están listas y funcionan. Solo falta aplicarlas correctamente en el wizard con la sintaxis JSX correcta.

**Fecha:** Diciembre 3, 2025
**Estado:** ⚠️ Funciones listas, aplicación en wizard pendiente
