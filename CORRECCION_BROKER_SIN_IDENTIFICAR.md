# Corrección: Brokers no veían reportes "Sin Identificar"

## 🔴 **PROBLEMA IDENTIFICADO**

En la vista de broker para comisiones/ajustes, la pestaña "Sin Identificar" no mostraba ningún reporte, impidiendo que los brokers pudieran "marcar mío" los reportes que les corresponden.

### **Causa Raíz:**

La función `actionGetPendingItems()` tenía una lógica incorrecta que **bloqueaba completamente** el acceso de los brokers a los reportes sin identificar:

```typescript
// ANTES (INCORRECTO):
if (role === 'broker') {
  // Broker NO ve items 'open' sin asignar - solo ve sus reportes en otra vista
  pendingQuery = pendingQuery.eq('id', '00000000-0000-0000-0000-000000000000'); 
  // ☝️ Esto filtraba con un UUID imposible, retornando 0 resultados
}
```

Además, los `comm_items` (items del bulk upload) solo eran visibles para master:

```typescript
// ANTES (INCORRECTO):
if (role === 'master') {
  const result = await supabase
    .from('comm_items')
    .select(...)
    .is('broker_id', null)
  // ☝️ Los brokers NO podían ver estos items
}
```

---

## ✅ **SOLUCIÓN APLICADA**

### **Cambio 1: Permitir que brokers vean `pending_items` sin identificar**

**Archivo:** `src/app/(app)/commissions/actions.ts`

**Antes (líneas 2673-2698):**
```typescript
// Broker NO ve items 'open' sin asignar
if (role === 'broker') {
  pendingQuery = pendingQuery.eq('id', '00000000-0000-0000-0000-000000000000');
}
```

**Después:**
```typescript
// TANTO MASTER COMO BROKER ven items status='open' SIN assigned_broker_id (sin identificar)
// Los brokers pueden "marcar mío" seleccionándolos y enviando reporte de ajuste
let pendingQuery = supabase
  .from('pending_items')
  .select(...)
  .eq('status', 'open')
  .is('assigned_broker_id', null)
  .order('created_at', { ascending: true });

// Tanto master como broker ven todos los items sin identificar
```

---

### **Cambio 2: Permitir que brokers vean `comm_items` sin identificar**

**Archivo:** `src/app/(app)/commissions/actions.ts`

**Antes (líneas 2701-2729):**
```typescript
let commData = null;
let commError = null;

if (role === 'master') {
  const result = await supabase
    .from('comm_items')
    .select(...)
    .is('broker_id', null)
  
  commData = result.data;
  commError = result.error;
}
```

**Después:**
```typescript
// TANTO MASTER COMO BROKER ven items SIN broker_id (sin identificar)
// Los brokers pueden "marcar mío" seleccionándolos y enviando reporte de ajuste
const result = await supabase
  .from('comm_items')
  .select(...)
  .is('broker_id', null)  // Todos ven items SIN broker asignado
  .order('created_at', { ascending: true });

const commData = result.data;
const commError = result.error;
```

---

## 🎯 **FLUJO CORRECTO AHORA**

### **Para Brokers:**

1. ✅ **Ver "Sin Identificar":** El broker accede a su vista de comisiones/ajustes
2. ✅ **Ver TODOS los reportes:** En la pestaña "Sin Identificar" ve TODOS los reportes sin broker asignado (tanto de `pending_items` como de `comm_items`)
3. ✅ **Seleccionar suyos:** El broker selecciona los reportes que considera suyos (checkboxes)
4. ✅ **Enviar reporte:** Click en "Enviar Reporte" crea un `adjustment_report` automáticamente asignado al broker
5. ✅ **Esperar aprobación:** El reporte aparece en "Mis Solicitudes" con estado "pending"
6. ✅ **Master revisa:** Master ve el reporte en "Identificados" y puede aprobar/rechazar

### **Para Master:**

1. ✅ **Ver "Sin Identificar":** Master sigue viendo todos los reportes sin identificar
2. ✅ **Asignar manualmente:** Master puede asignar directamente a brokers desde "Sin Identificar"
3. ✅ **O esperar reportes:** Master puede esperar a que los brokers envíen sus reportes
4. ✅ **Revisar y aprobar:** Master revisa los reportes en "Identificados" y aprueba/rechaza

---

## 📂 **ARCHIVOS MODIFICADOS**

1. ✅ `src/app/(app)/commissions/actions.ts`
   - Función: `actionGetPendingItems()`
   - Líneas modificadas: 2673-2693 y 2701-2719

---

## ✅ **VERIFICACIÓN**

### **Pruebas realizadas:**

- ✅ Broker puede ver la pestaña "Sin Identificar"
- ✅ Broker ve todos los reportes sin broker asignado
- ✅ Broker puede seleccionar múltiples reportes
- ✅ Broker puede enviar reporte de ajuste
- ✅ El reporte se crea correctamente con el broker asignado
- ✅ Master puede ver y aprobar los reportes enviados por brokers
- ✅ Master sigue pudiendo asignar manualmente si lo desea

---

## 🎉 **ESTADO: COMPLETADO**

El problema ha sido completamente resuelto. Los brokers ahora pueden ver y marcar como suyos los reportes sin identificar, tal como se esperaba en el flujo original del sistema.
