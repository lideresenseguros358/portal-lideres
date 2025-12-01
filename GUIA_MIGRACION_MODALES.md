# 🔄 Guía de Migración Masiva de Modales

## ✅ Sistema Estandarizado Creado

He creado un sistema completo para estandarizar TODOS los modales del proyecto:

1. **`src/components/ui/StandardModal.tsx`** - Componente React reutilizable
2. **`src/styles/modals.css`** - Estilos CSS globales
3. **Importación automática** - Ya incluido en `globals.css`

---

## 🎯 Opción 1: Usar el Componente `<StandardModal>`

### ✨ Ventajas:
- Más fácil y rápido
- Cero configuración de estilos
- Mantenimiento centralizado
- TypeScript type-safe

### 📝 Ejemplo de Uso:

#### ANTES (Modal antiguo):
```tsx
export default function MiModal({ onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full shadow-2xl">
        <div className="bg-gradient-to-r from-[#010139] to-[#020270] p-6 flex justify-between">
          <h2 className="text-2xl font-bold text-white">Mi Modal</h2>
          <button onClick={onClose}><FaTimes /></button>
        </div>
        
        <div className="p-6">
          {/* Contenido aquí */}
        </div>
        
        <div className="p-6 bg-gray-50 flex justify-between">
          <button onClick={onClose}>Cancelar</button>
          <button onClick={handleSubmit}>Guardar</button>
        </div>
      </div>
    </div>
  );
}
```

#### DESPUÉS (Con StandardModal):
```tsx
import { StandardModal, StandardModalFooter } from '@/components/ui/StandardModal';

export default function MiModal({ onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  
  return (
    <StandardModal
      isOpen={true}
      onClose={onClose}
      title="Mi Modal"
      subtitle="Descripción opcional"
      maxWidth="2xl"
      footer={
        <StandardModalFooter
          onCancel={onClose}
          onSubmit={handleSubmit}
          loading={loading}
          submitText="Guardar"
        />
      }
    >
      {/* Contenido aquí - solo el contenido, sin wrappers */}
      <div className="space-y-4">
        {/* Tus campos aquí */}
      </div>
    </StandardModal>
  );
}
```

---

## 🎨 Opción 2: Usar Solo las Clases CSS

### ✨ Ventajas:
- Control total sobre la estructura
- Fácil migrar modales existentes
- No requiere refactorización profunda

### 📝 Template de HTML:

```tsx
export default function MiModal({ onClose }: Props) {
  return (
    <div 
      className="standard-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="standard-modal-container max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="standard-modal-header">
          <div>
            <h2 className="standard-modal-title">Mi Modal</h2>
            <p className="standard-modal-subtitle">Subtítulo opcional</p>
          </div>
          <button onClick={onClose} className="standard-modal-close">
            <FaTimes size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="standard-modal-content">
          {/* Tu contenido aquí */}
        </div>

        {/* Footer */}
        <div className="standard-modal-footer">
          <div></div> {/* Espacio izquierdo opcional */}
          
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="standard-modal-button-secondary"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSubmit}
              className="standard-modal-button-primary"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 📋 Clases CSS Disponibles

### Estructura Base:
- `.standard-modal-backdrop` - Fondo oscuro con overlay
- `.standard-modal-container` - Card principal del modal
- `.standard-modal-header` - Header con gradiente corporativo
- `.standard-modal-content` - Contenido con scroll
- `.standard-modal-footer` - Footer con botones

### Elementos del Header:
- `.standard-modal-title` - Título principal
- `.standard-modal-subtitle` - Subtítulo
- `.standard-modal-close` - Botón de cerrar

### Botones:
- `.standard-modal-button-primary` - Botón principal (verde/azul)
- `.standard-modal-button-secondary` - Botón secundario (blanco/gris)

### Progress (Para Wizards):
- `.standard-modal-progress` - Contenedor de progreso
- `.standard-modal-progress-steps` - Pasos del wizard
- `.standard-modal-progress-circle` - Círculo numerado
- `.standard-modal-progress-line` - Línea conectora

### Utilidades:
- `.standard-modal-section` - Sección dentro del contenido
- `.standard-modal-section-title` - Título de sección
- `.standard-modal-alert` - Alerta (error/success/warning/info)

---

## 🚀 Migración Rápida Paso a Paso

### Paso 1: Identificar el Modal
```bash
# Encuentra todos los modales
grep -r "fixed inset-0" src/components --include="*.tsx"
```

### Paso 2: Reemplazar Clases

| Buscar | Reemplazar |
|--------|-----------|
| `className="fixed inset-0 bg-black..."` | `className="standard-modal-backdrop"` |
| `className="bg-white rounded-xl max-w-..."` | `className="standard-modal-container max-w-..."` |
| Header con `bg-gradient-to-r from-[#010139]...` | `className="standard-modal-header"` |
| Content con `p-6 overflow-y-auto flex-1` | `className="standard-modal-content"` |
| Footer con `bg-gray-50 border-t...` | `className="standard-modal-footer"` |

### Paso 3: Actualizar Botones

```tsx
// ANTES:
<button className="px-6 py-2 bg-[#8AAA19] text-white...">
  Guardar
</button>

// DESPUÉS:
<button className="standard-modal-button-primary">
  Guardar
</button>
```

### Paso 4: Verificar Estructura

Tu modal debe seguir este patrón:
```
├── standard-modal-backdrop
│   └── standard-modal-container
│       ├── standard-modal-header (flex-shrink-0)
│       ├── standard-modal-content (overflow-y-auto flex-1)
│       └── standard-modal-footer (flex-shrink-0)
```

---

## 🔍 Modales que Requieren Migración

### Prioritarios (Mencionados por el usuario):
- [x] ✅ `ImportBankHistoryModal.tsx` - Ya corregido
- [x] ✅ `ClientForm.tsx` - Ya corregido
- [x] ✅ `ClientPolicyWizard.tsx` - Ya corregido
- [ ] `AddAdvanceModal.tsx` - Adelantos comisiones
- [ ] `RegisterPaymentWizard.tsx` - **Ya perfecto, usar de referencia**

### Por Categoría:

#### Base de Datos (`/components/db/`):
- [ ] `PolicyForm.tsx`
- [ ] `SearchModal.tsx`
- [ ] `ImportModal.tsx`
- [ ] `ExportFormatModal.tsx`

#### Cheques (`/components/checks/`):
- [ ] `EditPaymentModal.tsx`
- [ ] `UnpaidReferenceModal.tsx`

#### Comisiones (`/components/commissions/`):
- [ ] `AddAdvanceModal.tsx`
- [ ] `EditAdvanceModal.tsx`
- [ ] `PayAdvanceModal.tsx`
- [ ] `AdvancesModal.tsx`
- [ ] `AdvanceHistoryModal.tsx`
- [ ] `BrokerDetailModal.tsx`
- [ ] `DiscountModal.tsx`
- [ ] `AdjustmentReportModal.tsx`
- [ ] `RecurrencesManagerModal.tsx`

#### Expedientes (`/components/expediente/`):
- [ ] `ExpedienteManager.tsx` (múltiples modales internos)

#### Otros:
- [ ] `UploadFileModal.tsx`
- [ ] `SearchModal.tsx` (shared)
- [ ] `ContactsModal.tsx`
- [ ] `InviteModal.tsx`
- [ ] `ApproveModal.tsx`
- [ ] `MetaPersonalModal.tsx`
- [ ] `MonthInputModal.tsx`
- [ ] `ProductionTableModal.tsx`
- [ ] `SuccessModal.tsx`

---

## ⚡ Script de Búsqueda y Reemplazo

Si usas VS Code, puedes hacer búsqueda/reemplazo masiva:

### Buscar:
```regex
className="fixed inset-0 bg-black(?:\/\d+)? (?:backdrop-blur-sm )?flex items-(?:center|start)(?: sm:items-center)? justify-center z-(?:\d+|50|\[9999\]) p-(?:2|4)(?: sm:p-4)?(?: overflow-y-auto)?"
```

### Reemplazar:
```
className="standard-modal-backdrop"
```

---

## 🎨 Tamaños Disponibles

Al usar `<StandardModal>` o `.standard-modal-container`:

```tsx
maxWidth="sm"   // max-w-sm  (384px)
maxWidth="md"   // max-w-md  (448px)
maxWidth="lg"   // max-w-lg  (512px)
maxWidth="xl"   // max-w-xl  (576px)
maxWidth="2xl"  // max-w-2xl (672px) - Default
maxWidth="3xl"  // max-w-3xl (768px)
maxWidth="4xl"  // max-w-4xl (896px)
maxWidth="5xl"  // max-w-5xl (1024px)
```

---

## ✅ Checklist de Verificación

Después de migrar un modal, verifica:

- [ ] Header no tiene bordes blancos
- [ ] Footer no tiene bordes blancos
- [ ] Content hace scroll correctamente
- [ ] Header y footer permanecen fijos al hacer scroll
- [ ] Modal no se corta en pantallas pequeñas
- [ ] Cierra al hacer clic fuera
- [ ] Botones tienen colores corporativos
- [ ] Responsive funciona en mobile

---

## 💡 Tips y Mejores Prácticas

### 1. **Formularios Dentro de Modales**
```tsx
<StandardModal {...props}>
  <form id="my-form" onSubmit={handleSubmit}>
    {/* Campos aquí */}
  </form>
</StandardModal>

// En el footer, usar form attribute:
<button type="submit" form="my-form" className="standard-modal-button-primary">
  Guardar
</button>
```

### 2. **Contenido Extra en el Footer**
```tsx
<StandardModalFooter
  leftContent={
    <button className="standard-modal-button-secondary">
      Acción Adicional
    </button>
  }
  onCancel={onClose}
  onSubmit={handleSubmit}
/>
```

### 3. **Alertas y Mensajes**
```tsx
<div className="standard-modal-alert error">
  ❌ Ocurrió un error al guardar
</div>

<div className="standard-modal-alert success">
  ✅ Guardado exitosamente
</div>

<div className="standard-modal-alert warning">
  ⚠️ Advertencia: Revisa los datos
</div>

<div className="standard-modal-alert info">
  💡 Información adicional
</div>
```

### 4. **Secciones Dentro del Contenido**
```tsx
<div className="standard-modal-section">
  <h3 className="standard-modal-section-title">📝 Información Básica</h3>
  {/* Campos aquí */}
</div>

<div className="standard-modal-section">
  <h3 className="standard-modal-section-title">💰 Detalles Financieros</h3>
  {/* Campos aquí */}
</div>
```

---

## 🔥 Resultado Esperado

Con este sistema estandarizado:

✅ **Todos los modales tendrán**:
- Mismo diseño y comportamiento
- Colores corporativos consistentes
- Header y footer sin bordes blancos
- Scroll correcto sin cortes
- Responsive perfecto

✅ **Beneficios**:
- Actualización centralizada (cambios en 1 lugar)
- Código más limpio y mantenible
- Menor tiempo de desarrollo
- Experiencia de usuario consistente

---

## 📞 Soporte

Si encuentras algún modal que no funciona correctamente con este sistema, verifica:

1. Que tenga la estructura correcta (backdrop → container → header/content/footer)
2. Que el content tenga `overflow-y-auto flex-1`
3. Que header y footer tengan `flex-shrink-0`
4. Que el container tenga `flex flex-col max-h-[90vh]`

**Referencia Perfecta**: `RegisterPaymentWizard.tsx` - Es el único que ya está 100% correcto.
