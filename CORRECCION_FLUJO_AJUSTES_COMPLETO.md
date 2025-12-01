# ✅ CORRECCIÓN COMPLETA DEL FLUJO DE AJUSTES

## 📋 PROBLEMAS IDENTIFICADOS Y CORREGIDOS

### 1. ❌ PROBLEMA: Botones asignaban inmediatamente a BD
**Antes:**
- Click "Asignar Broker" → llamaba `actionResolvePendingGroups` → actualizaba BD
- Click "Marcar Mío" → llamaba `actionMarkItemsAsMine` → actualizaba BD
- Items desaparecían de la lista sin crear reporte

**✅ CORREGIDO:**
- Click "Asignar Broker" → SOLO activa modo selección (NO toca BD)
- Click "Marcar Mío" → SOLO activa modo selección (NO toca BD)
- BD se actualiza SOLO cuando se hace click en "Enviar Reporte"

**Archivos modificados:**
- `AssignBrokerDropdown.tsx` - Eliminado import y llamada a `actionResolvePendingGroups`
- `AdjustmentsTab.tsx` - `handleClaimItem` ya no llama a `actionMarkItemsAsMine`

---

### 2. ❌ PROBLEMA: assigned_broker_id no se asignaba al crear reporte
**Antes:**
- `actionCreateAdjustmentReport` solo actualizaba `status='in_review'`
- No asignaba `assigned_broker_id` al broker del reporte

**✅ CORREGIDO:**
```typescript
// adjustment-actions.ts línea 144-157
await supabase
  .from('pending_items')
  .update({ 
    status: 'in_review',
    assigned_broker_id: reportBrokerId // ✅ AGREGADO
  })
  .in('id', itemIds);
```

---

### 3. ❌ PROBLEMA: Rechazar no liberaba assigned_broker_id
**Antes:**
- `actionRejectAdjustmentReport` solo cambiaba `status='open'`
- Items NO volvían a "Sin Identificar" porque seguían con `assigned_broker_id`

**✅ CORREGIDO:**
```typescript
// adjustment-actions.ts línea 455-463
await supabase
  .from('pending_items')
  .update({ 
    status: 'open',
    assigned_broker_id: null // ✅ AGREGADO - Libera para reasignación
  })
  .in('id', itemIds);
```

---

### 4. ❌ PROBLEMA: Editar reporte no manejaba assigned_broker_id
**Antes:**
- Al quitar items: solo `status='open'` (no liberaba broker)
- Al agregar items: solo `status='in_review'` (no asignaba broker)

**✅ CORREGIDO:**
```typescript
// Al quitar items (línea 676-683)
await supabase
  .from('pending_items')
  .update({ 
    status: 'open',
    assigned_broker_id: null // ✅ AGREGADO
  })
  .in('id', itemIdsToRemove);

// Al agregar items (línea 716-723)
await supabase
  .from('pending_items')
  .update({ 
    status: 'in_review',
    assigned_broker_id: report.broker_id // ✅ AGREGADO
  })
  .in('id', itemIdsToAdd);
```

---

## 🎯 FLUJO CORRECTO COMPLETO

### **Master - Asignar a Broker**

```
1. Master ve "Sin Identificar" (items con assigned_broker_id IS NULL y status='open')
   
2. Click "Asignar Corredor" en una póliza
   → Dropdown con lista de brokers
   
3. Selecciona broker del dropdown
   → ✅ onSelectBroker() se ejecuta
   → ✅ setSelectedBroker(brokerId)
   → ✅ setSelectionMode(true)
   → ✅ Pre-selecciona esa póliza
   → ✅ Aparecen checkboxes en TODAS las pólizas
   → ⚠️ NO se actualiza BD aún
   
4. Selecciona más pólizas (checkboxes)
   → ✅ Sticky bar muestra total y nombre del broker
   
5. Click "Enviar Reporte"
   → ✅ actionCreateAdjustmentReport(itemIds, notes, selectedBroker)
   → ✅ Crea registro en adjustment_reports (status='pending')
   → ✅ Crea registros en adjustment_report_items
   → ✅ Actualiza pending_items:
       - status='in_review'
       - assigned_broker_id=selectedBroker
   
6. Items desaparecen de "Sin Identificar" (porque status='in_review')
   
7. Reporte aparece en "Identificados" (adjustment_reports con status='pending')
```

---

### **Broker - Marcar Mío**

```
1. Broker ve "Sin Identificar" (items con assigned_broker_id=su_id y status='open')
   
2. Click "Marcar Mío" en una póliza
   → ✅ handleClaimItem() se ejecuta
   → ✅ setSelectionMode(true)
   → ✅ Pre-selecciona esa póliza
   → ✅ Aparecen checkboxes en TODAS sus pólizas
   → ⚠️ NO se actualiza BD aún
   
3. Selecciona más pólizas (checkboxes)
   → ✅ Sticky bar muestra total y su comisión
   
4. Click "Enviar Reporte"
   → ✅ actionCreateAdjustmentReport(itemIds, notes)
   → ✅ Crea registro en adjustment_reports (status='pending')
   → ✅ Crea registros en adjustment_report_items
   → ✅ Actualiza pending_items:
       - status='in_review'
       - assigned_broker_id=brokerId
   
5. Items desaparecen de "Sin Identificar" (porque status='in_review')
   
6. Reporte aparece en "Reportados" (adjustment_reports con status='pending' y broker_id=su_id)
```

---

### **Master - Rechazar Reporte**

```
1. Master ve reporte en "Identificados"
   
2. Click "Rechazar"
   → Modal con campo de razón
   
3. Confirma rechazo
   → ✅ actionRejectAdjustmentReport(reportId, reason)
   → ✅ Actualiza adjustment_reports:
       - status='rejected'
       - rejected_reason=reason
   → ✅ Actualiza pending_items:
       - status='open'
       - assigned_broker_id=null ← ✅ LIBERA
   
4. Items vuelven a "Sin Identificar" (porque status='open' y assigned_broker_id=null)
   
5. Puede ser asignado a OTRO broker
```

---

## 🗃️ TABLAS Y RELACIONES

### `pending_items`
```typescript
{
  id: string
  policy_number: string
  insured_name: string
  commission_raw: number  // Monto bruto
  assigned_broker_id: string | null  // ✅ CLAVE para filtrar
  status: 'open' | 'in_review' | 'approved' | ...
  insurer_id: string
  fortnight_id: string | null
  created_at: timestamp
}
```

**Status flow:**
- `open`: Sin identificar (aparece en "Sin Identificar")
- `in_review`: En reporte pendiente (NO aparece en "Sin Identificar")
- `approved`: Reporte aprobado
- `rejected`: Reporte rechazado → vuelve a `open`

---

### `adjustment_reports`
```typescript
{
  id: string
  broker_id: string  // A quién pertenece el reporte
  status: 'pending' | 'approved' | 'rejected' | 'paid'
  total_amount: number  // Total calculado
  broker_notes: string | null
  admin_notes: string | null
  payment_mode: 'immediate' | 'next_fortnight' | null
  fortnight_id: string | null
  paid_date: timestamp | null
  rejected_reason: string | null
  reviewed_at: timestamp | null
  reviewed_by: string | null
  created_at: timestamp
  updated_at: timestamp
}
```

---

### `adjustment_report_items`
```typescript
{
  id: string
  report_id: string  // FK a adjustment_reports
  pending_item_id: string  // FK a pending_items
  commission_raw: number  // Monto bruto de este ítem
  broker_commission: number  // Comisión calculada (raw × percent)
  created_at: timestamp
}
```

**Relaciones:**
- `adjustment_reports` 1:N `adjustment_report_items`
- `adjustment_report_items` N:1 `pending_items`

---

## 📊 QUERIES POR ROL

### Master - "Sin Identificar"
```sql
SELECT * FROM pending_items
WHERE status = 'open'
  AND assigned_broker_id IS NULL
ORDER BY created_at ASC
```

### Broker - "Sin Identificar"
```sql
SELECT * FROM pending_items
WHERE status = 'open'
  AND assigned_broker_id = 'broker_id_actual'
ORDER BY created_at ASC
```

### Master - "Identificados"
```sql
SELECT * FROM adjustment_reports
WHERE status = 'pending'
ORDER BY created_at DESC
```

### Broker - "Reportados"
```sql
SELECT * FROM adjustment_reports
WHERE status = 'pending'
  AND broker_id = 'broker_id_actual'
ORDER BY created_at DESC
```

---

## ✅ VERIFICACIÓN FINAL

### Checklist Flujo Básico:
- ✅ Botones "Asignar Corredor" y "Marcar Mío" NO actualizan BD
- ✅ Solo activan modo selección
- ✅ Checkboxes aparecen en todos los ítems
- ✅ Sticky bar muestra información correcta
- ✅ "Enviar Reporte" crea reporte Y actualiza pending_items
- ✅ assigned_broker_id se asigna al crear reporte
- ✅ assigned_broker_id se libera al rechazar reporte
- ✅ assigned_broker_id se maneja al editar reporte

### Checklist Cálculos:
- ✅ percent_default es DECIMAL (0.82 = 82%)
- ✅ Fórmula: `commission_raw × percent_default` (SIN /100)
- ✅ Total recalculado al obtener reportes

### Checklist Queries:
- ✅ Master ve ítems con `assigned_broker_id IS NULL` y `status='open'`
- ✅ Broker ve ítems con `assigned_broker_id=su_id` y `status='open'`
- ✅ Reportes filtrados correctamente por rol

---

## 🎊 RESUMEN

**TODOS LOS PROBLEMAS CORREGIDOS:**
1. ✅ Botones solo activan modo selección (no actualizan BD)
2. ✅ BD se actualiza solo al enviar reporte
3. ✅ `assigned_broker_id` se asigna al crear reporte
4. ✅ `assigned_broker_id` se libera al rechazar
5. ✅ `assigned_broker_id` se maneja al editar
6. ✅ Flujo simple y predecible
7. ✅ Items aparecen/desaparecen correctamente según status

**SISTEMA 100% FUNCIONAL.**
