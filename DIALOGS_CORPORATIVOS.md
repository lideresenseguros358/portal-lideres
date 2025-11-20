# Sistema de Diálogos Corporativos

## 📋 Descripción

Sistema de diálogos personalizados con branding corporativo de Líderes en Seguros para reemplazar los popups nativos de JavaScript (`alert`, `confirm`).

## 🎨 Características

✅ **Diseño corporativo**: Header con gradiente azul (#010139 → #020270)
✅ **Iconos según tipo**: Success, Error, Warning, Info, Confirm
✅ **Colores consistentes**: Azul corporativo #010139 y verde #8AAA19
✅ **Responsive**: Funciona en mobile y desktop
✅ **Accesible**: Tecla ESC para cerrar, enfoque automático en botón principal
✅ **Promesas**: Retorna Promise<boolean> para fácil manejo async/await

## 📦 Componentes

### 1. ConfirmDialog (Componente Visual)
**Ubicación**: `src/components/shared/ConfirmDialog.tsx`

Componente React que renderiza el diálogo modal.

### 2. useConfirmDialog (Hook)
**Ubicación**: `src/hooks/useConfirmDialog.tsx`

Hook personalizado para manejar el estado y lógica de los diálogos.

## 🚀 Uso Básico

### 1. Importar el Hook y Componente

```tsx
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
```

### 2. Usar el Hook en tu Componente

```tsx
export default function MiComponente() {
  const { dialogState, closeDialog, confirm, alert, success, error, warning } = useConfirmDialog();
  
  // ... resto del código
  
  return (
    <>
      {/* Tu componente */}
      <button onClick={handleAction}>Hacer algo</button>
      
      {/* Dialog al final */}
      <ConfirmDialog
        isOpen={dialogState.isOpen}
        onClose={() => closeDialog(false)}
        onConfirm={() => closeDialog(true)}
        title={dialogState.title}
        message={dialogState.message}
        type={dialogState.type}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
      />
    </>
  );
}
```

## 📚 Ejemplos de Uso

### Confirm (Confirmar acción)

```tsx
const handleDelete = async () => {
  const confirmed = await confirm(
    '¿Está seguro de eliminar este elemento?',
    'Confirmar eliminación'
  );
  
  if (confirmed) {
    // Usuario confirmó
    await deleteItem();
  } else {
    // Usuario canceló
    return;
  }
};
```

### Alert de Información

```tsx
const handleInfo = async () => {
  await alert('Esta es una información importante', 'Información');
  // Continúa después de que el usuario cierre el diálogo
};
```

### Success

```tsx
const handleSave = async () => {
  const result = await saveData();
  
  if (result.ok) {
    await success('Los datos se guardaron correctamente', 'Éxito');
  }
};
```

### Error

```tsx
const handleLoad = async () => {
  try {
    await loadData();
  } catch (err) {
    await error(
      `Error al cargar datos: ${err.message}`,
      'Error'
    );
  }
};
```

### Warning

```tsx
const handleRiskyAction = async () => {
  await warning(
    'Esta acción puede tener consecuencias importantes',
    'Advertencia'
  );
};
```

## 🎭 Tipos de Diálogo

| Tipo | Icono | Color Botón | Uso |
|------|-------|-------------|-----|
| `confirm` | ⚠️ Verde | Azul corporativo | Confirmar acciones |
| `success` | ✅ Verde | Verde #8AAA19 | Acciones exitosas |
| `error` | ⚠️ Rojo | Rojo | Errores |
| `warning` | ⚠️ Naranja | Naranja | Advertencias |
| `info` | ℹ️ Azul | Azul corporativo | Información general |

## 🔧 API del Hook

### Métodos Disponibles

#### `confirm(message: string, title?: string): Promise<boolean>`
Muestra un diálogo de confirmación con botones "Aceptar" y "Cancelar".

**Retorna**: `true` si confirma, `false` si cancela.

#### `alert(message: string, title?: string, type?: DialogType): Promise<boolean>`
Muestra un diálogo informativo con solo botón "Aceptar".

#### `success(message: string, title?: string): Promise<boolean>`
Diálogo de éxito con icono verde.

#### `error(message: string, title?: string): Promise<boolean>`
Diálogo de error con icono rojo.

#### `warning(message: string, title?: string): Promise<boolean>`
Diálogo de advertencia con icono naranja.

### Estado del Diálogo

```tsx
interface DialogState {
  isOpen: boolean;
  message: string;
  title?: string;
  type?: 'success' | 'error' | 'warning' | 'info' | 'confirm';
  confirmText?: string;
  cancelText?: string;
}
```

## 🔄 Migración desde Popups Nativos

### Antes (Popup Nativo)

```tsx
// ❌ No usar
if (confirm('¿Eliminar elemento?')) {
  deleteItem();
}

alert('Error al guardar');
```

### Después (Dialog Corporativo)

```tsx
// ✅ Usar
const confirmed = await confirm('¿Eliminar elemento?', 'Confirmar');
if (confirmed) {
  deleteItem();
}

await error('Error al guardar', 'Error');
```

## 🎨 Personalización

### Textos de Botones

```tsx
const confirmed = await showDialog({
  message: '¿Continuar con la acción?',
  title: 'Confirmar',
  type: 'confirm',
  confirmText: 'Sí, continuar',  // Personalizado
  cancelText: 'No, cancelar'      // Personalizado
});
```

### Mensajes Multi-línea

```tsx
await alert(
  'Primera línea\nSegunda línea\nTercera línea',
  'Información'
);
```

## 📋 Componentes Ya Actualizados

✅ `src/components/commissions/ImportForm.tsx`
✅ `src/components/commissions/PaymentActions.tsx`
✅ `src/components/commissions/NewFortnightTab.tsx`

## 🔍 Dónde Aplicar

Busca en tu código:
- `alert(`
- `confirm(`
- `window.alert(`
- `window.confirm(`

Y reemplázalos con el sistema de diálogos corporativos.

## 💡 Mejores Prácticas

1. **Siempre usar await**: Los métodos retornan Promises
2. **Títulos descriptivos**: Proporciona contexto claro
3. **Mensajes concisos**: Evita textos muy largos
4. **Tipo apropiado**: Usa el tipo correcto según la situación
5. **Un diálogo a la vez**: No abras múltiples diálogos simultáneamente

## 🐛 Troubleshooting

### El diálogo no se muestra

Verifica que:
- Agregaste el componente `<ConfirmDialog>` en tu JSX
- El hook está declarado dentro del componente
- No hay otros z-index bloqueando

### ESC no cierra el diálogo

El diálogo maneja ESC automáticamente. Si no funciona, verifica que no haya otros event listeners interfiriendo.

### Estilos incorrectos

Asegúrate de que Tailwind CSS esté correctamente configurado en tu proyecto.

## 📱 Responsive

El diálogo es completamente responsive:
- **Mobile**: Padding reducido, texto adaptado
- **Desktop**: Máximo ancho 448px (max-w-md)
- **Todos**: Scroll automático si el contenido es muy largo

## 🎯 Branding

Colores corporativos aplicados:
- **Azul primario**: #010139
- **Azul secundario**: #020270  
- **Verde corporativo**: #8AAA19
- **Gradientes**: from-[#010139] to-[#020270]

---

**Actualizado**: Noviembre 2025
**Versión**: 1.0.0
