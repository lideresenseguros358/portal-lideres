# ESTÁNDAR GLOBAL DE MODALES Y WIZARDS

## 🎯 Objetivo
Garantizar que todos los modales y wizards del portal tengan márgenes verticales adecuados para evitar que se corten con:
- Header del navegador
- Header del AppLayout
- Footer del navegador/sistema

## 📐 Estructura Estándar

### Contenedor Exterior (Backdrop)
```tsx
<div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
```

**Clases obligatorias:**
- `fixed inset-0` - Cubre toda la pantalla
- `bg-black bg-opacity-50` - Fondo oscuro semi-transparente
- `z-50` - Z-index alto (ajustar según necesidad: z-[9999] para casos especiales)
- `flex items-center justify-center` - Centra el modal
- `p-4` - Padding para separación de bordes
- `overflow-y-auto` - Permite scroll si el contenido es muy alto

### Contenedor del Modal
```tsx
<div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] sm:max-h-[85vh] flex flex-col my-4 sm:my-8">
```

**Clases CRÍTICAS:**
- `my-4 sm:my-8` - ⚠️ **OBLIGATORIO** - Margen vertical para evitar cortes
  - Mobile: `my-4` (16px arriba y abajo)
  - Desktop: `sm:my-8` (32px arriba y abajo)
- `max-h-[90vh]` o `max-h-[85vh]` - Limita altura máxima
- `flex flex-col` - Estructura flexbox vertical (si tiene header/body/footer)

### Estructura Interna (Opcional pero recomendada)

#### Header (fijo)
```tsx
<div className="... flex-shrink-0">
  {/* Contenido del header */}
</div>
```
- `flex-shrink-0` - Mantiene tamaño fijo

#### Body (scrolleable)
```tsx
<div className="p-6 overflow-y-auto flex-1">
  {/* Contenido principal */}
</div>
```
- `overflow-y-auto` - Permite scroll interno
- `flex-1` - Ocupa espacio disponible

#### Footer (fijo)
```tsx
<div className="... flex-shrink-0">
  {/* Botones de acción */}
</div>
```
- `flex-shrink-0` - Mantiene tamaño fijo

## 📝 Ejemplo Completo

```tsx
'use client';

import { FaTimes } from 'react-icons/fa';

interface MiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MiModal({ isOpen, onClose }: MiModalProps) {
  if (!isOpen) return null;

  return (
    {/* Backdrop */}
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      
      {/* Contenedor del Modal */}
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] sm:max-h-[85vh] flex flex-col my-4 sm:my-8">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#010139] to-[#020270] text-white p-6 rounded-t-xl flex items-center justify-between flex-shrink-0">
          <h2 className="text-2xl font-bold">Título del Modal</h2>
          <button onClick={onClose} className="text-white hover:text-gray-300">
            <FaTimes size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Contenido aquí */}
          <p>Este contenido puede ser muy largo y tendrá scroll interno.</p>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-xl flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg">
            Cancelar
          </button>
          <button className="px-4 py-2 bg-[#8AAA19] text-white rounded-lg">
            Confirmar
          </button>
        </div>

      </div>
    </div>
  );
}
```

## ⚠️ ERRORES COMUNES A EVITAR

### ❌ Sin margen vertical
```tsx
{/* INCORRECTO - Se cortará con headers/footers */}
<div className="bg-white rounded-xl max-w-2xl w-full">
```

### ✅ Con margen vertical
```tsx
{/* CORRECTO */}
<div className="bg-white rounded-xl max-w-2xl w-full my-4 sm:my-8">
```

### ❌ Sin overflow en backdrop
```tsx
{/* INCORRECTO - No se podrá hacer scroll si el modal es alto */}
<div className="fixed inset-0 ... p-4">
```

### ✅ Con overflow en backdrop
```tsx
{/* CORRECTO */}
<div className="fixed inset-0 ... p-4 overflow-y-auto">
```

### ❌ Sin max-height
```tsx
{/* INCORRECTO - Modal puede exceder la altura de la pantalla */}
<div className="bg-white rounded-xl w-full">
```

### ✅ Con max-height
```tsx
{/* CORRECTO */}
<div className="bg-white rounded-xl w-full max-h-[90vh] sm:max-h-[85vh]">
```

## 📱 Responsive

### Mobile (< 640px)
- Margen vertical: `my-4` (16px)
- Max height: `max-h-[90vh]`
- Padding externo: `p-2` o `p-4`

### Desktop (>= 640px)
- Margen vertical: `sm:my-8` (32px)
- Max height: `sm:max-h-[85vh]`
- Padding externo: `sm:p-4`

## 🎨 Variantes de Tamaño

### Modal Pequeño (Confirmación)
```tsx
<div className="... max-w-md w-full my-4 sm:my-8">
```

### Modal Mediano (Formularios)
```tsx
<div className="... max-w-2xl w-full my-4 sm:my-8">
```

### Modal Grande (Wizards/Listas)
```tsx
<div className="... max-w-4xl w-full my-4 sm:my-8">
```

### Modal Extra Grande (Comparaciones/Tablas)
```tsx
<div className="... max-w-6xl w-full my-4 sm:my-8">
```

## 🔧 Componente Base

El proyecto tiene un componente base `Modal.tsx` que ya implementa este estándar:

```tsx
import Modal from '@/components/Modal';

<Modal title="Mi Modal" onClose={handleClose}>
  {/* Contenido aquí */}
</Modal>
```

**Usar este componente cuando sea posible para mantener consistencia.**

## ✅ Checklist de Implementación

Al crear o modificar un modal, verificar:

- [ ] Tiene `my-4 sm:my-8` en el contenedor del modal
- [ ] Tiene `overflow-y-auto` en el backdrop
- [ ] Tiene `max-h-[90vh]` o similar
- [ ] Tiene `flex flex-col` si usa estructura header/body/footer
- [ ] Header y footer tienen `flex-shrink-0`
- [ ] Body tiene `overflow-y-auto flex-1`
- [ ] Se prueba en mobile y desktop
- [ ] No se corta con headers ni footers

## 📚 Archivos de Referencia

**Componentes que YA cumplen el estándar:**
- `src/components/Modal.tsx` - Componente base ✅
- `src/components/requests/InviteModal.tsx` ✅
- `src/components/requests/ApproveModal.tsx` ✅
- `src/components/shared/UploadFileModal.tsx` ✅
- `src/components/shared/SearchModal.tsx` ✅
- `src/components/production/MonthInputModal.tsx` ✅
- `src/components/insurers/ContactsModal.tsx` ✅
- `src/components/checks/RegisterPaymentWizard.tsx` ✅

**Archivos que necesitan actualización:**
(Ver lista de pendientes en el plan de implementación)

## 🎯 Regla de Oro

> **NUNCA crear un modal sin margen vertical `my-4 sm:my-8`**

Esta regla aplica a TODOS los modales sin excepción, independientemente de su tamaño o propósito.
