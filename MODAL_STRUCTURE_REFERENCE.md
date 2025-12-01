# 📐 Estructura Estándar de Modales

## ✅ Estructura Perfecta (Referencia: RegisterPaymentWizard)

### 1. **Backdrop** (Contenedor externo)
```tsx
<div 
  className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4 overflow-y-auto"
  onClick={(e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }}
>
```

**Características:**
- `fixed inset-0` - Ocupa toda la pantalla
- `bg-black bg-opacity-50` - Fondo oscuro semitransparente
- `flex items-center justify-center` - Centra el modal
- `z-[9999]` - Asegura que esté por encima de todo
- `p-4` - Padding para que no toque los bordes en mobile
- `overflow-y-auto` - Permite scroll en el backdrop si el modal es muy alto

---

### 2. **Modal Container** (Card principal)
```tsx
<div 
  className="bg-white rounded-2xl max-w-5xl w-full my-8 shadow-2xl flex flex-col max-h-[90vh]"
  onClick={(e) => e.stopPropagation()}
>
```

**Características CRÍTICAS:**
- `bg-white rounded-2xl` - Fondo blanco con bordes redondeados
- `max-w-5xl w-full` - Ancho responsivo
- `my-8` - Margen vertical para separar del borde
- `shadow-2xl` - Sombra profunda
- `flex flex-col` - **CRÍTICO:** Permite que el contenido se distribuya correctamente
- `max-h-[90vh]` - **CRÍTICO:** Altura máxima del 90% del viewport (evita que se salga de la pantalla)

---

### 3. **Header** (Fijo, NO se mueve con scroll)
```tsx
<div className="bg-gradient-to-r from-[#010139] to-[#020270] text-white p-6 flex items-center justify-between rounded-t-2xl">
  <div>
    <h2 className="text-2xl font-bold">Título del Modal</h2>
    <p className="text-white/80 text-sm mt-1">Subtítulo opcional</p>
  </div>
  <button onClick={onClose} className="text-white hover:text-gray-200 transition">
    <FaTimes size={24} />
  </button>
</div>
```

**Características:**
- `bg-gradient-to-r from-[#010139] to-[#020270]` - Gradiente azul corporativo
- `text-white p-6` - Texto blanco con padding generoso
- `flex items-center justify-between` - Título a la izquierda, botón cerrar a la derecha
- `rounded-t-2xl` - Bordes redondeados superiores

---

### 4. **Content** (Con scroll, crece para ocupar espacio)
```tsx
<div className="p-6 overflow-y-auto flex-1">
  {/* Contenido del modal aquí */}
</div>
```

**Características CRÍTICAS:**
- `p-6` - Padding interno
- `overflow-y-auto` - **CRÍTICO:** Permite scroll vertical dentro del content
- `flex-1` - **CRÍTICO:** Crece para ocupar todo el espacio disponible entre header y footer

---

### 5. **Footer** (Fijo, NO se mueve con scroll)
```tsx
<div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-between rounded-b-2xl flex-shrink-0">
  <button
    type="button"
    onClick={onCancel}
    className="px-6 py-2 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
  >
    Cancelar
  </button>
  
  <button
    type="button"
    onClick={onSubmit}
    className="px-6 py-2 bg-[#8AAA19] text-white rounded-lg hover:bg-[#010139] transition font-medium disabled:opacity-50"
    disabled={loading}
  >
    {loading ? 'Guardando...' : 'Guardar'}
  </button>
</div>
```

**Características CRÍTICAS:**
- `px-6 py-4` - Padding consistente con el content
- `bg-gray-50 border-t` - Fondo gris claro con borde superior
- `flex items-center justify-between` - Botones separados
- `rounded-b-2xl` - Bordes redondeados inferiores
- `flex-shrink-0` - **CRÍTICO:** Evita que el footer se comprima

---

## 🚫 Errores Comunes a Evitar

### ❌ Error 1: No usar `flex flex-col` en el container
```tsx
// MAL:
<div className="bg-white rounded-2xl">
  
// BIEN:
<div className="bg-white rounded-2xl flex flex-col max-h-[90vh]">
```

### ❌ Error 2: No usar `flex-1` en el content
```tsx
// MAL:
<div className="p-6 overflow-y-auto">
  
// BIEN:
<div className="p-6 overflow-y-auto flex-1">
```

### ❌ Error 3: No usar `flex-shrink-0` en el footer
```tsx
// MAL:
<div className="px-6 py-4 bg-gray-50">
  
// BIEN:
<div className="px-6 py-4 bg-gray-50 flex-shrink-0">
```

### ❌ Error 4: Poner `overflow-y-auto` en el container principal
```tsx
// MAL:
<div className="bg-white rounded-2xl overflow-y-auto">
  
// BIEN:
<div className="bg-white rounded-2xl flex flex-col">
  <div className="overflow-y-auto flex-1">
```

### ❌ Error 5: No usar `max-h-[90vh]` en el container
```tsx
// MAL:
<div className="bg-white rounded-2xl">
  
// BIEN:
<div className="bg-white rounded-2xl max-h-[90vh]">
```

### ❌ Error 6: Dejar espacio blanco en los bordes del header/footer
```tsx
// MAL (header):
<div className="bg-gradient-to-r from-[#010139] to-[#020270] text-white p-6 rounded-lg">
  
// BIEN (header):
<div className="bg-gradient-to-r from-[#010139] to-[#020270] text-white p-6 rounded-t-2xl">

// MAL (footer):
<div className="px-6 py-4 bg-gray-50 rounded-lg">
  
// BIEN (footer):
<div className="px-6 py-4 bg-gray-50 rounded-b-2xl">
```

---

## 📱 Comportamiento Esperado

### Desktop:
- Modal aparece centrado
- Header y footer fijos
- Content con scroll si es necesario
- No se corta con los bordes

### Mobile:
- Modal ocupa casi toda la pantalla
- Padding de 1rem en los bordes
- Header y footer siempre visibles
- Content con scroll suave

---

## 🎨 Colores Corporativos

### Header:
```tsx
className="bg-gradient-to-r from-[#010139] to-[#020270] text-white"
```

### Footer:
```tsx
className="bg-gray-50 border-t"
```

### Botón Primario:
```tsx
className="bg-[#8AAA19] text-white hover:bg-[#010139]"
```

### Botón Secundario:
```tsx
className="text-gray-700 bg-white border-2 border-gray-300 hover:bg-gray-50"
```

---

## ✅ Checklist de Validación

Antes de dar por terminado un modal, verificar:

- [ ] `flex flex-col` en el container principal
- [ ] `max-h-[90vh]` en el container principal
- [ ] Header con `rounded-t-2xl` (sin bordes blancos)
- [ ] Content con `overflow-y-auto flex-1`
- [ ] Footer con `rounded-b-2xl flex-shrink-0` (sin bordes blancos)
- [ ] Botones con colores corporativos correctos
- [ ] Header y footer NO se mueven al hacer scroll
- [ ] Content hace scroll correctamente
- [ ] Modal no se corta en pantallas pequeñas
- [ ] Backdrop cierra el modal al hacer click fuera
