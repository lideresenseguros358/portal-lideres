# Patrón de Validación Visual para Wizards

## ✅ Implementado en:
- `RegisterPaymentWizard` (src/components/checks/RegisterPaymentWizard.tsx)

## 🎯 Pendientes de implementar:
1. `NewCaseWizard` - src/components/cases/NewCaseWizard.tsx
2. `ClientPolicyWizard` - src/components/db/ClientPolicyWizard.tsx
3. Formulario de Request - src/components/requests/ApproveModal.tsx (o formulario público)
4. `AddAdvanceModal` - src/components/commissions/AddAdvanceModal.tsx
5. Formulario nuevo corredor - Buscar en src/components/brokers o src/components/config
6. Formulario nueva aseguradora - src/components/config/tabs/InsurersTab.tsx

## 📋 Patrón Implementado

### 1. Agregar Estado para Errores
```typescript
const [validationErrors, setValidationErrors] = useState<string[]>([]);
```

### 2. Función Helper para Detectar Errores en Campos
```typescript
const hasFieldError = (fieldName: string) => {
  return validationErrors.some(error => error.toLowerCase().includes(fieldName.toLowerCase()));
};

const getInputClassName = (baseClass: string, fieldName: string) => {
  const hasError = hasFieldError(fieldName);
  return `${baseClass} ${hasError ? 'border-red-500 focus:border-red-600' : 'border-gray-300 focus:border-[#8AAA19]'}`;
};
```

### 3. Modificar Función de Validación
En lugar de retornar inmediatamente `false`, acumular errores en un array:

```typescript
const validateStep = () => {
  const errors: string[] = [];
  
  // Validar campos
  if (!formData.client_name) errors.push('• Nombre del cliente');
  if (!formData.amount_to_pay) errors.push('• Monto a pagar');
  
  // Si hay errores, mostrarlos y retornar false
  if (errors.length > 0) {
    setValidationErrors(errors);
    toast.error('Complete los campos requeridos');
    return false;
  }
  
  // Limpiar errores si todo está correcto
  setValidationErrors([]);
  return true;
};
```

### 4. Componente Visual de Lista de Errores
Agregar al inicio del contenido de cada step:

```tsx
{validationErrors.length > 0 && (
  <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-4">
    <div className="flex items-start gap-2">
      <FaExclamationTriangle className="text-red-600 mt-1 flex-shrink-0" />
      <div className="flex-1">
        <p className="font-semibold text-red-800 mb-2">Campos requeridos:</p>
        <ul className="text-sm text-red-700 space-y-1">
          {validationErrors.map((error, idx) => (
            <li key={idx}>{error}</li>
          ))}
        </ul>
      </div>
    </div>
  </div>
)}
```

### 5. Aplicar Clases Condicionales a Inputs
Para cada campo requerido:

```tsx
<input
  type="text"
  value={formData.field_name}
  onChange={(e) => {
    setFormData({ ...formData, field_name: e.target.value });
    if (validationErrors.length > 0) setValidationErrors([]); // Limpiar errores al escribir
  }}
  className={getInputClassName('w-full px-4 py-2 border-2 rounded-lg focus:outline-none', 'nombre_campo')}
  placeholder="..."
/>
```

## 🎨 Estilos de Error
- **Border rojo**: `border-red-500`
- **Focus rojo**: `focus:border-red-600`
- **Fondo de alerta**: `bg-red-50 border-2 border-red-200`
- **Texto de error**: `text-red-700` (lista), `text-red-800` (título)

## 📝 Notas Importantes
1. El nombre del campo en `getInputClassName()` debe coincidir con palabras en el mensaje de error
2. Limpiar errores cuando el usuario empieza a escribir mejora UX
3. Usar `• ` al inicio de cada mensaje de error para mejor legibilidad
4. Mantener consistencia en colores: rojo para errores, igual que `text-red-500` de asteriscos `*`

## 🔧 Personalización por Wizard
Cada wizard puede tener validaciones específicas:
- **Paso múltiple**: Validar cada paso por separado
- **Referencias/Items dinámicos**: Incluir número de referencia/item en el error
- **Validaciones complejas**: Combinar múltiples condiciones

Ejemplo para referencias:
```typescript
references.forEach((r, idx) => {
  if (!r.reference_number) errors.push(`• Referencia ${idx + 1}: Número requerido`);
  if (!r.amount) errors.push(`• Referencia ${idx + 1}: Monto requerido`);
});
```
