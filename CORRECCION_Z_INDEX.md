# Corrección de Z-Index - Dropdowns y Modales

## 📋 **PROBLEMAS IDENTIFICADOS**

### **1. Dropdowns no se despliegan en modales y wizards**
**Causa:** El `SelectContent` de shadcn/ui tenía `z-50`, el mismo z-index que muchos modales y wizards, causando que los dropdowns quedaran ocultos detrás de los modales.

### **2. Botones "Incluir Cédula" y "Agregar Documento" no funcionan en modal de expediente**
**Causa:** El `ExpedienteManager` está envuelto por un `Modal` con `z-index: 9999`, pero los modales internos (preview y upload) del `ExpedienteManager` tenían `z-50` y `z-[60]`, quedando debajo del backdrop del modal padre y bloqueando los clicks.

---

## ✅ **SOLUCIONES APLICADAS**

### **1. Aumentar Z-Index de SelectContent**

**Archivo:** `src/components/ui/select.tsx`

**Cambio:**
```tsx
// ANTES:
className="relative z-50 max-h-96 min-w-[8rem]..."

// DESPUÉS:
className="relative z-[9999] max-h-96 min-w-[8rem]..."
```

**Resultado:** Los dropdowns ahora se despliegan correctamente por encima de todos los modales y wizards.

---

### **2. Aumentar Z-Index de Modales en ExpedienteManager**

**Archivo:** `src/components/expediente/ExpedienteManager.tsx`

#### **Upload Modal:**
```tsx
// ANTES:
className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50..."

// DESPUÉS:
className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10000]..."
```

#### **Preview Modal:**
```tsx
// ANTES:
className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60]..."

// DESPUÉS:
className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[10000]..."
```

**Resultado:** Los botones "Incluir Cédula" y "Agregar Documento" ahora abren correctamente sus modales por encima del modal padre, permitiendo la interacción completa.

---

## 🎯 **JERARQUÍA DE Z-INDEX FINAL**

```
z-[10000]  → Modales de ExpedienteManager (Preview y Upload)
z-[9999]   → SelectContent (Dropdowns de shadcn/ui)
z-9999     → Modal estándar wrapper (.standard-modal-backdrop)
z-50       → Otros componentes de menor prioridad
```

---

## 📂 **ARCHIVOS MODIFICADOS**

1. ✅ `src/components/ui/select.tsx`
   - Línea 59: `z-50` → `z-[9999]`

2. ✅ `src/components/expediente/ExpedienteManager.tsx`
   - Línea 469 (Preview Modal): `z-[60]` → `z-[10000]`
   - Línea 542 (Upload Modal): `z-50` → `z-[10000]`

---

## ✅ **VERIFICACIÓN**

### **Dropdowns:**
- ✅ Dropdowns en modales ahora se despliegan correctamente
- ✅ Dropdowns en wizards funcionan sin problemas
- ✅ No interfieren con otros elementos de la UI

### **Modal de Expediente:**
- ✅ Botón "Incluir Cédula" abre el modal de upload
- ✅ Botón "Agregar Documento" (Nuevo Documento) abre el modal de upload
- ✅ Modales internos son completamente interactuables
- ✅ No hay conflictos con el modal padre

---

## 🎉 **ESTADO: COMPLETADO**

Todos los problemas de z-index han sido resueltos. Los dropdowns y modales ahora funcionan correctamente en toda la aplicación.
