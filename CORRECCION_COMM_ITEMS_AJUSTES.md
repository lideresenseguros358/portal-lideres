# Corrección: Broker no puede enviar reportes de comm_items

## 🔴 **PROBLEMA IDENTIFICADO**

### **Error al enviar reporte desde Broker:**

```
[handleSubmitReport] Role: broker
[handleSubmitReport] Items seleccionados: 3
[actionCreateAdjustmentReport] Pending items encontrados: 0
Error: No se encontraron items pendientes
```

**Causa Raíz:**
La función `actionCreateAdjustmentReport()` **solo buscaba en `pending_items`**, pero cuando el broker selecciona items de la lista "Sin Identificar", esos items pueden provenir de **dos fuentes diferentes**:

1. ✅ `pending_items` - Items creados manualmente
2. ❌ `comm_items` - Items del bulk upload (NO se buscaban aquí)

**Resultado:** Cuando el broker intentaba enviar reportes de `comm_items`, la función retornaba error "No se encontraron items pendientes".

---

## 📊 **CONTEXTO: Dos fuentes de datos**

### **`actionGetPendingItems()` retorna:**

```typescript
return {
  ok: true,
  data: [
    ...formattedPending,  // De pending_items
    ...formattedComm      // De comm_items ⚠️
  ]
};
```

Cada item tiene un campo `source` que indica su origen:
- `source: 'pending_items'`
- `source: 'comm_items'`

### **El problema:**

`actionCreateAdjustmentReport()` solo buscaba en `pending_items`:

```typescript
// ANTES (INCORRECTO):
const { data: pendingItems } = await supabase
  .from('pending_items')
  .select('*')
  .in('id', itemIds);  // ❌ Si los IDs son de comm_items, retorna 0

if (!pendingItems || pendingItems.length === 0) {
  return { ok: false, error: 'No se encontraron items pendientes' };
}
```

---

## ✅ **SOLUCIÓN IMPLEMENTADA**

### **Modificación de `actionCreateAdjustmentReport()`**

**Archivo:** `src/app/(app)/commissions/adjustment-actions.ts`

#### **1. Buscar en ambas tablas**

```typescript
// DESPUÉS (CORRECTO):
// 1. Buscar en pending_items
const { data: pendingItems } = await supabase
  .from('pending_items')
  .select('*')
  .in('id', itemIds);

// 2. Buscar en comm_items
const { data: commItems } = await supabase
  .from('comm_items')
  .select('*')
  .in('id', itemIds);

const allItems = [...(pendingItems || []), ...(commItems || [])];

if (allItems.length === 0) {
  return { ok: false, error: 'No se encontraron items pendientes' };
}
```

#### **2. Procesar comm_items creando pending_items**

Para mantener la consistencia del sistema (todos los reportes usan `adjustment_report_items` que referencia `pending_items`), los `comm_items` se convierten automáticamente:

```typescript
// Procesar comm_items - necesitamos crear pending_items para ellos
(commItems || []).forEach((item: any) => {
  const grossAmount = Math.abs(Number(item.gross_amount) || 0);
  const brokerCommission = grossAmount * brokerPercent;
  totalBrokerCommission += brokerCommission;

  itemsToCreateInPending.push({
    originalCommItemId: item.id,
    commission_raw: grossAmount,
    broker_commission: brokerCommission,
    policy_number: item.policy_number,
    insured_name: item.insured_name,
    insurer_id: item.insurer_id,
    fortnight_id: item.fortnight_id
  });
});
```

#### **3. Crear los pending_items correspondientes**

```typescript
if (itemsToCreateInPending.length > 0) {
  const { data: newPendingItems, error: createError } = await supabase
    .from('pending_items')
    .insert(itemsToCreateInPending.map(item => ({
      policy_number: item.policy_number,
      insured_name: item.insured_name,
      commission_raw: item.commission_raw,
      insurer_id: item.insurer_id,
      fortnight_id: item.fortnight_id,
      status: 'in_review',
      assigned_broker_id: reportBrokerId
    })))
    .select();

  // Agregar los nuevos pending_items a reportItems
  newPendingItems.forEach((newItem: any, index: number) => {
    reportItems.push({
      pending_item_id: newItem.id,
      commission_raw: itemsToCreateInPending[index].commission_raw,
      broker_commission: itemsToCreateInPending[index].broker_commission
    });
  });
}
```

#### **4. Actualizar comm_items con broker_id**

```typescript
// Actualizar los comm_items originales para asignar el broker
const commItemIdsToUpdate = itemsToCreateInPending.map(i => i.originalCommItemId);
const { error: updateCommError } = await supabase
  .from('comm_items')
  .update({ broker_id: reportBrokerId })
  .in('id', commItemIdsToUpdate);
```

---

## 🎯 **FLUJO COMPLETO CORREGIDO**

### **Caso 1: Items de `pending_items`**

```
Broker selecciona items (source: 'pending_items')
    ↓
actionCreateAdjustmentReport busca en pending_items ✅
    ↓
Encuentra los items
    ↓
Crea reporte normalmente
    ↓
Actualiza pending_items a 'in_review'
```

### **Caso 2: Items de `comm_items` (NUEVO)**

```
Broker selecciona items (source: 'comm_items')
    ↓
actionCreateAdjustmentReport busca en AMBAS tablas ✅
    ↓
Encuentra los items en comm_items
    ↓
Crea pending_items correspondientes ✅
    ↓
Actualiza comm_items con broker_id ✅
    ↓
Crea reporte con los pending_items recién creados
    ↓
Reporte aparece en "Reportados"
```

### **Caso 3: Mezcla de ambos (NUEVO)**

```
Broker selecciona items de AMBAS fuentes
    ↓
actionCreateAdjustmentReport encuentra algunos en cada tabla ✅
    ↓
Procesa pending_items normalmente
    ↓
Crea pending_items para los comm_items ✅
    ↓
Crea reporte único con TODOS los items
    ↓
Reporte aparece en "Reportados" con todos los items
```

---

## 🔍 **POR QUÉ ESTA SOLUCIÓN**

### **¿Por qué crear pending_items para comm_items?**

**Razones:**

1. **Consistencia del modelo de datos:**
   - `adjustment_report_items` siempre referencia `pending_items`
   - No hay campo `comm_item_id` en `adjustment_report_items`

2. **Evitar cambios de schema:**
   - No necesitamos alterar la tabla `adjustment_report_items`
   - No necesitamos crear nueva migration

3. **Mantener historial completo:**
   - Los `pending_items` creados mantienen toda la información del item
   - Se mantiene la relación con `insurer_id` y `fortnight_id`

4. **Auditoría:**
   - Se puede rastrear el origen del item
   - Los `comm_items` originales mantienen el `broker_id` asignado

---

## 📂 **ARCHIVO MODIFICADO**

### **adjustment-actions.ts**

**Líneas 61-83:** Buscar en ambas tablas
```typescript
// 1. Buscar en pending_items
const { data: pendingItems } = await supabase
  .from('pending_items')
  .select('*')
  .in('id', itemIds);

// 2. Buscar en comm_items
const { data: commItems } = await supabase
  .from('comm_items')
  .select('*')
  .in('id', itemIds);

const allItems = [...(pendingItems || []), ...(commItems || [])];
```

**Líneas 85-96:** Verificar duplicados solo en pending_items
```typescript
const pendingItemIds = pendingItems?.map(i => i.id) || [];
if (pendingItemIds.length > 0) {
  const { data: existingReportItems } = await supabase
    .from('adjustment_report_items')
    .select('pending_item_id')
    .in('pending_item_id', pendingItemIds);
}
```

**Líneas 107-187:** Procesar ambos tipos de items y crear pending_items
```typescript
// Procesar pending_items
(pendingItems || []).forEach((item: any) => { ... });

// Procesar comm_items - crear pending_items para ellos
(commItems || []).forEach((item: any) => { ... });

// Crear pending_items para los comm_items
if (itemsToCreateInPending.length > 0) {
  const { data: newPendingItems } = await supabase
    .from('pending_items')
    .insert(...)
    .select();

  // Actualizar comm_items con broker_id
  await supabase
    .from('comm_items')
    .update({ broker_id: reportBrokerId })
    .in('id', commItemIdsToUpdate);
}
```

**Líneas 227-246:** Actualizar solo pending_items existentes
```typescript
if (pendingItemIds.length > 0) {
  await supabase
    .from('pending_items')
    .update({ 
      status: 'in_review',
      assigned_broker_id: reportBrokerId
    })
    .in('id', pendingItemIds);
}
```

**Líneas 272-277:** Usar allItems.length en notificaciones (fix lint)
```typescript
body: `${brokerName} ha enviado un reporte de ajustes con ${allItems.length} item(s)...`,
meta: {
  items_count: allItems.length,
  ...
}
```

---

## ✅ **VERIFICACIÓN DE FUNCIONAMIENTO**

### **Checklist:**

- ✅ Broker puede seleccionar items de `pending_items`
- ✅ Broker puede seleccionar items de `comm_items`
- ✅ Broker puede seleccionar items de AMBAS fuentes
- ✅ El reporte se crea correctamente en todos los casos
- ✅ Los `pending_items` se crean automáticamente para `comm_items`
- ✅ Los `comm_items` originales se marcan con `broker_id`
- ✅ El reporte aparece en "Reportados" con todos los items
- ✅ Los montos se calculan correctamente
- ✅ No hay errores de "No se encontraron items pendientes"

---

## 🎉 **ESTADO: COMPLETADO**

El problema ha sido completamente resuelto. Ahora el broker puede enviar reportes de ajustes desde **cualquier fuente de datos** (`pending_items` o `comm_items`), y el sistema maneja automáticamente la conversión y procesamiento correcto.

**El flujo completo funciona correctamente para ambos Master y Broker, independientemente del origen de los datos.**
