# Mejoras en Sección de Preliminares - Base de Datos

## Cambios Implementados

### 1. ✅ Badge con Conteo en Botón "PRELIMINARES"

**Ubicación**: Base de Datos → Botón "PRELIMINARES"

**Implementación**:
- Badge circular color ámbar con número de clientes pendientes
- Se actualiza automáticamente al cambiar de vista
- Posición: esquina superior derecha del botón
- Estilo: `bg-amber-500 text-white` con borde blanco

```typescript
{preliminaryCount > 0 && (
  <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center shadow-lg border-2 border-white">
    {preliminaryCount}
  </span>
)}
```

**Visual**:
```
┌─────────────────────┐
│  PRELIMINARES  (5)  │ ← Badge con conteo
└─────────────────────┘
```

---

### 2. ✅ Tooltip en Botón "Migrar a BD" (Cliente Completo)

**Condición**: Se muestra cuando `client.is_complete === true`

**Contenido del Tooltip**:
```
✅ Cliente Listo para Migrar

Este cliente tiene todos los campos obligatorios completados.

────────────────────────────
Al migrar a la base de datos:
• Podrá generar comisiones
• Aparecerá en reportes de morosidad
• Estará en la base de datos oficial
```

**Características**:
- Color: Fondo gris oscuro (`bg-gray-900`)
- Activación: Hover sobre el botón verde "Migrar a BD"
- Posición: Arriba del botón
- Ancho: 288px (w-72)
- Flecha apuntando al botón

---

### 3. ✅ Botón y Tooltip de Advertencia (Cliente Incompleto)

**Condición**: Se muestra cuando `client.is_complete === false`

**Botón**:
- Color ámbar (`bg-amber-500`)
- Deshabilitado (no clickeable)
- Texto: "Datos Incompletos"
- Icono: `FaExclamationTriangle`

**Contenido del Tooltip**:
```
⚠️ Cliente NO se puede migrar

Faltan campos obligatorios. Si se marca como completo sin llenarlos:

────────────────────────────
Consecuencias:
❌ NO se pasará a la base de datos oficial
❌ NO generará comisiones
❌ NO aparecerá en morosidad
❌ NO se podrá usar para trámites

👉 Completa los campos antes de migrar
```

**Características**:
- Color: Fondo rojo oscuro (`bg-red-900`)
- Activación: Hover sobre el botón ámbar
- Posición: Arriba del botón
- Ancho: 320px (w-80)
- Mensajes claros de las consecuencias

---

## Flujo Visual Completo

### Vista Principal: Botón PRELIMINARES

```
┌──────────────────────────────────────┐
│  [CLIENTES]  [PRELIMINARES (5)]  [ASEGURADORAS]  │
│                      ↑                             │
│                   Badge con conteo                 │
└──────────────────────────────────────┘
```

---

### Vista de Cliente Completo

```
┌─────────────────────────────────────────────────┐
│  JUAN PÉREZ                                      │
│  Póliza: ABC-12345                              │
│                                                  │
│  ┌──────────────────┐                           │
│  │  [✓ Migrar a BD] │ ← Hover aquí             │
│  └──────────────────┘                           │
│          ↓                                       │
│  ┌─────────────────────────────────┐            │
│  │ ✅ Cliente Listo para Migrar   │            │
│  │                                 │            │
│  │ Este cliente tiene todos los    │            │
│  │ campos obligatorios             │            │
│  │                                 │            │
│  │ Al migrar a la base de datos:  │            │
│  │ • Podrá generar comisiones     │            │
│  │ • Aparecerá en morosidad       │            │
│  │ • Base de datos oficial        │            │
│  └─────────────────────────────────┘            │
└─────────────────────────────────────────────────┘
```

---

### Vista de Cliente Incompleto

```
┌─────────────────────────────────────────────────┐
│  MARÍA GARCÍA                                    │
│  Póliza: XYZ-67890                              │
│                                                  │
│  ❌ Campos faltantes:                           │
│  • Fecha Renovación                             │
│  • Corredor                                     │
│                                                  │
│  ┌────────────────────────┐                     │
│  │  [⚠ Datos Incompletos] │ ← Hover aquí       │
│  └────────────────────────┘                     │
│          ↓                                       │
│  ┌──────────────────────────────────┐           │
│  │ ⚠️ Cliente NO se puede migrar   │           │
│  │                                  │           │
│  │ Faltan campos obligatorios       │           │
│  │                                  │           │
│  │ Consecuencias:                   │           │
│  │ ❌ NO pasará a BD oficial        │           │
│  │ ❌ NO generará comisiones        │           │
│  │ ❌ NO aparecerá en morosidad     │           │
│  │ ❌ NO se puede usar              │           │
│  │                                  │           │
│  │ 👉 Completa los campos primero   │           │
│  └──────────────────────────────────┘           │
└─────────────────────────────────────────────────┘
```

---

## Archivos Modificados

### 1. `src/components/db/DatabaseTabs.tsx`

**Agregado**:
- Import de `useEffect` de React
- Import de `actionGetPreliminaryClients`
- State para `preliminaryCount`
- useEffect para cargar conteo
- Badge visual en botón PRELIMINARES

**Líneas clave**:
```typescript
// Imports
import React, { useMemo, useState, useEffect } from 'react';
import { actionGetPreliminaryClients } from '@/app/(app)/db/preliminary-actions';

// State
const [preliminaryCount, setPreliminaryCount] = useState<number>(0);

// Load count
useEffect(() => {
  const loadCount = async () => {
    const result = await actionGetPreliminaryClients();
    if (result.ok) {
      setPreliminaryCount(result.data.length);
    }
  };
  loadCount();
}, [view]);

// Badge
{preliminaryCount > 0 && (
  <span className="absolute -top-2 -right-2 bg-amber-500...">
    {preliminaryCount}
  </span>
)}
```

---

### 2. `src/components/db/PreliminaryClientsTab.tsx`

**Agregado**:

#### A. Tooltip para Cliente Completo (líneas 194-219)
```typescript
{client.is_complete && (
  <div className="relative group">
    <button onClick={() => handleManualMigration(client.id)} ...>
      <FaCheckCircle />
      Migrar a BD
    </button>
    <div className="absolute bottom-full ... bg-gray-900 ...">
      ✅ Cliente Listo para Migrar
      ...
    </div>
  </div>
)}
```

#### B. Botón y Tooltip para Cliente Incompleto (líneas 221-249)
```typescript
{!client.is_complete && (
  <div className="relative group">
    <button disabled className="bg-amber-500 ... opacity-75">
      <FaExclamationTriangle />
      Datos Incompletos
    </button>
    <div className="absolute bottom-full ... bg-red-900 ...">
      ⚠️ Cliente NO se puede migrar
      ...
      Consecuencias: ❌ NO generará comisiones...
    </div>
  </div>
)}
```

---

## Comportamiento

### Badge de Conteo
- **Carga inicial**: Al entrar a la página de Base de Datos
- **Actualización**: Cada vez que cambias de vista (clients ↔ preliminary ↔ insurers)
- **Visibilidad**: Solo se muestra si `preliminaryCount > 0`

### Tooltips
- **Activación**: Hover del mouse sobre el botón
- **Transición**: `opacity-0` → `opacity-100` (suave)
- **Z-index**: 50 (aparece sobre otros elementos)
- **Pointer events**: `none` (no interfiere con clics)
- **Flecha**: Apunta hacia el botón desde arriba

---

## Mensajes Clave

### ✅ Cliente Listo
> "Este cliente tiene todos los campos obligatorios completados. Al migrar podrá generar comisiones, aparecerá en morosidad y estará en la base de datos oficial."

### ⚠️ Cliente Incompleto
> "Faltan campos obligatorios. Si no se completan: NO se pasará a la base de datos oficial, NO generará comisiones, NO aparecerá en morosidad, NO se podrá usar para trámites."

---

## Testing

### Para Probar Badge

1. Ir a Base de Datos
2. Crear un cliente preliminar (desde trámites o ajustes)
3. Click en pestaña "PRELIMINARES"
4. ✅ Debe aparecer badge con número (ej: 5)
5. Migrar un cliente
6. ✅ Badge debe actualizar a 4

### Para Probar Tooltips

#### Cliente Completo:
1. Ir a PRELIMINARES
2. Editar un cliente y llenar todos los campos obligatorios
3. Hover sobre botón verde "Migrar a BD"
4. ✅ Debe aparecer tooltip verde con mensaje positivo

#### Cliente Incompleto:
1. Ir a PRELIMINARES
2. Cliente con campos faltantes
3. ✅ Debe aparecer botón ámbar "Datos Incompletos"
4. Hover sobre el botón
5. ✅ Debe aparecer tooltip rojo con advertencias

---

## Verificación

✅ **TypeCheck**: Sin errores  
✅ **Badge funcional**: Conteo dinámico  
✅ **Tooltip completo**: Mensaje positivo  
✅ **Tooltip incompleto**: Advertencias claras  
✅ **Responsive**: Funciona en móvil y desktop  

---

**Fecha**: 15 de Octubre, 2025  
**Estado**: IMPLEMENTADO Y FUNCIONANDO ✅
