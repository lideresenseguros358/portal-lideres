# 🎨 ESTÁNDAR DE BRANDING - Portal Líderes

**Fecha:** 2025-10-02  
**Versión:** 1.0  
**Aplicar a:** TODAS las páginas

---

## 🎯 PRINCIPIOS DE DISEÑO

### 1. BOTONES CONSERVADORES
```tsx
// ❌ MALO (exagerado):
className="px-8 py-4 text-xl"

// ✅ BUENO (conservador):
className="px-4 py-2 text-base"

// Tamaños estándar:
- Botón normal: px-4 py-2
- Botón pequeño: px-3 py-1.5
- Botón grande (solo principales): px-6 py-3
```

### 2. CARDS CON FONDO
```tsx
// Todas las páginas deben tener card wrapper:
<div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-50 p-6">
  <div className="max-w-7xl mx-auto">
    <div className="bg-white rounded-2xl shadow-lg p-8">
      {/* Contenido aquí */}
    </div>
  </div>
</div>
```

**Características:**
- `rounded-2xl` (esquinas redondeadas)
- `shadow-lg` (sombra pronunciada)
- `bg-white` (fondo blanco)
- `p-8` (padding generoso)

### 3. TÍTULOS CON ICONO
```tsx
<h1 className="text-4xl font-bold text-[#010139] mb-2">
  💰 Título de la Página
</h1>
<p className="text-gray-600 text-lg">
  Descripción breve
</p>
```

**Reglas:**
- Icono emoji al inicio
- `text-4xl` para h1
- Color `#010139` (azul corporativo)
- Descripción en `text-gray-600`

### 4. ANIMACIONES DE HOVER
```tsx
// Botones:
className="transform hover:scale-105 transition-all duration-300"

// Cards:
className="hover:-translate-y-2 transition-all duration-500"

// Enlaces:
className="hover:text-[#8AAA19] transition-colors duration-200"
```

**Tipos de animaciones:**
- **Scale:** botones principales
- **Translate:** cards interactivos
- **Color:** enlaces y texto
- **Shadow:** cards al hover (`hover:shadow-2xl`)

### 5. COLORES CORPORATIVOS

```css
/* Primarios */
--azul-profundo: #010139;    /* Títulos, headers, botones principales */
--oliva: #8AAA19;            /* Acentos, valores positivos, hover */

/* Secundarios */
--gris-texto: #6b7280;       /* Texto secundario */
--gris-fondo: #f9fafb;       /* Fondos claros */
--rojo: #ef4444;             /* Valores negativos, errores */
--verde: #10b981;            /* Success, disponible */
--amarillo: #f59e0b;         /* Warnings, parcial */
```

### 6. RESPONSIVE

```tsx
// Siempre usar breakpoints:
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"

// Flex responsive:
className="flex flex-col lg:flex-row gap-4"

// Texto responsive:
className="text-2xl lg:text-4xl"
```

---

## 📐 COMPONENTES ESTÁNDAR

### Botón Principal
```tsx
<button className="px-4 py-2 bg-gradient-to-r from-[#010139] to-[#020270] text-white rounded-xl hover:shadow-lg transition-all transform hover:scale-105 font-medium">
  Acción Principal
</button>
```

### Botón Secundario
```tsx
<button className="px-4 py-2 bg-[#8AAA19] text-white rounded-xl hover:bg-[#010139] transition-all font-medium">
  Acción Secundaria
</button>
```

### Botón Terciario
```tsx
<button className="px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-xl hover:border-[#8AAA19] hover:text-[#8AAA19] transition-all font-medium">
  Acción Terciaria
</button>
```

### Card Interactivo
```tsx
<div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 border-2 border-transparent hover:border-[#8AAA19] cursor-pointer">
  <h3 className="text-xl font-bold text-[#010139] mb-2">Título</h3>
  <p className="text-gray-600">Descripción</p>
</div>
```

### Badge de Estado
```tsx
// Success
<span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold border-2 border-green-300">
  Disponible
</span>

// Warning
<span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold border-2 border-yellow-300">
  Parcial
</span>

// Error/Agotado
<span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-semibold border-2 border-gray-300">
  Agotado
</span>
```

### Input Estándar
```tsx
<input
  type="text"
  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition-colors"
  placeholder="Ingrese valor..."
/>
```

### Select Estándar
```tsx
<select className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none bg-white transition-colors">
  <option value="">Seleccionar...</option>
  <option value="1">Opción 1</option>
</select>
```

### Tabla Estándar
```tsx
<div className="overflow-x-auto rounded-xl border-2 border-gray-100">
  <table className="w-full">
    <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
      <tr>
        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
          Columna
        </th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-200">
      <tr className="hover:bg-gray-50 transition-colors">
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          Dato
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## 🔄 ANIMACIONES ESPECÍFICAS

### Loading Spinner
```tsx
<div className="animate-spin w-8 h-8 border-4 border-[#010139] border-t-transparent rounded-full mx-auto"></div>
```

### FadeIn (custom CSS)
```tsx
<style jsx>{`
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fadeIn {
    animation: fadeIn 0.3s ease-out;
  }
`}</style>

<div className="animate-fadeIn">
  Contenido
</div>
```

### Scale on Hover
```tsx
className="transform hover:scale-105 transition-transform duration-300"
```

### Shadow on Hover
```tsx
className="shadow-lg hover:shadow-2xl transition-shadow duration-300"
```

---

## 📱 RESPONSIVE BREAKPOINTS

```tsx
// Mobile first:
sm: 640px   // tablets pequeñas
md: 768px   // tablets
lg: 1024px  // laptops
xl: 1280px  // desktops
2xl: 1536px // pantallas grandes

// Uso:
className="text-base md:text-lg lg:text-xl"
className="p-4 md:p-6 lg:p-8"
className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
```

---

## ✅ CHECKLIST POR PÁGINA

Cada página debe tener:
- [ ] Card wrapper con `rounded-2xl shadow-lg`
- [ ] Título con icono emoji `text-4xl font-bold`
- [ ] Botones conservadores `px-4 py-2`
- [ ] Animaciones hover en elementos interactivos
- [ ] Colores corporativos (#010139, #8AAA19)
- [ ] Responsive en todos los layouts
- [ ] Gradientes sutiles en headers
- [ ] Transiciones suaves (`transition-all duration-300`)

---

## 🎯 PÁGINAS A ACTUALIZAR

1. **Base de Datos** - Ajustar botones, agregar "Filtrar por"
2. **Cheques** - Ajustar botones, ya tiene buen diseño
3. **Comisiones** - Rediseño completo con estándar
4. **Aseguradoras** - Rediseño completo con estándar

---

**Este documento es la guía maestra de diseño.**  
**Aplicar consistentemente en TODAS las páginas.**  
**Actualizar si se agregan nuevos componentes estándar.**
