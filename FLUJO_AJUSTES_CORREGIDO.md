# 🔄 FLUJO DE AJUSTES - CORRECCIÓN SEGÚN ESPECIFICACIÓN

**Fecha:** 24 de noviembre, 2025

---

## 📋 FLUJO CORRECTO ESPECIFICADO POR EL USUARIO

### **BROKER - Vista de Pendientes:**

1. **Broker ve lista de pendientes sin identificar**
2. **Marca "Mío" en UNO** → Esto activa automáticamente:
   - ✅ Modo selección múltiple
   - ✅ Checkboxes aparecen en TODOS los clientes
   - ✅ El cliente marcado queda seleccionado automáticamente

3. **Puede seguir marcando más clientes** (checkboxes activos)
4. **Sistema calcula automáticamente:**
   - Comisión neta por cliente (con % del broker)
   - Sumatoria total del reporte

5. **Botón "Enviar Reporte"** agrupa todos los seleccionados

---

### **MASTER - Recibiendo Reportes:**

1. **Master recibe reporte con toda la información**
2. **Opciones disponibles:**
   - ✅ **Aceptar** → Modal: "¿Pagar Ya o Siguiente Quincena?"
   - ✅ **Editar** → Puede modificar items del reporte
   - ✅ **Rechazar** → Con razón

---

### **MASTER - Asignando Clientes:**

1. **Master ve lista de pendientes**
2. **Escoge UN cliente y le asigna un broker** → Esto activa:
   - ✅ Modo selección múltiple
   - ✅ Checkboxes aparecen en todos los clientes
   - ✅ El cliente asignado queda seleccionado

3. **Puede seguir sumando más clientes al mismo broker**
4. **Botón "Enviar Reporte"** crea el reporte
5. **Master lo ve en lista de reportes** (mismo proceso)
6. **Aceptar/Editar/Rechazar**

---

## 🔧 IMPLEMENTACIÓN ACTUAL VS REQUERIDA

### **Estado Actual:**

#### **BrokerPendingTab.tsx** ✅
- ✅ Checkboxes siempre visibles
- ✅ Selección múltiple
- ✅ Cálculo automático
- ✅ Botón "Enviar Reporte"

#### **AdjustmentsTab.tsx** ❌
- ✅ Botón "Marcar Mío" individual
- ❌ NO activa modo selección múltiple
- ❌ NO hay checkboxes
- ❌ NO agrupa múltiples clientes

#### **MasterAdjustmentReportReview.tsx** ⚠️
- ✅ Aceptar reporte
- ✅ Rechazar reporte
- ❌ NO tiene botón "Editar"
- ✅ Modal pagar ya/siguiente quincena

#### **AssignBrokerDropdown** ❌
- ✅ Asigna UN grupo a un broker
- ❌ NO activa modo selección múltiple
- ❌ NO permite agrupar múltiples clientes al mismo broker

---

## 🎯 CAMBIOS NECESARIOS

### **1. AdjustmentsTab.tsx - Vista Broker**

**Agregar:**
```typescript
const [selectionMode, setSelectionMode] = useState(false);
const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
const [selectedBroker, setSelectedBroker] = useState<string | null>(null);

// Cuando hace click en "Marcar Mío"
const handleMarkMine = (groupItems: any[]) => {
  // Activar modo selección
  setSelectionMode(true);
  
  // Seleccionar estos items automáticamente
  setSelectedItems(new Set(groupItems.map(i => i.id)));
  
  // Mostrar checkboxes en TODOS los grupos
};

// Modo selección activo → mostrar checkboxes
{selectionMode && (
  <Checkbox
    checked={selectedItems.has(item.id)}
    onCheckedChange={() => toggleItem(item.id)}
  />
)}

// Botón enviar reporte
{selectionMode && (
  <Button onClick={handleSubmitReport}>
    Enviar Reporte ({selectedItems.size})
  </Button>
)}
```

---

### **2. AdjustmentsTab.tsx - Vista Master**

**Agregar:**
```typescript
const [assignMode, setAssignMode] = useState(false);
const [selectedForAssign, setSelectedForAssign] = useState<Set<string>>(new Set());
const [assigningToBroker, setAssigningToBroker] = useState<string | null>(null);

// Cuando asigna UN cliente a un broker
const handleAssign = (brokerId: string, groupItems: any[]) => {
  // Activar modo asignación
  setAssignMode(true);
  setAssigningToBroker(brokerId);
  
  // Seleccionar estos items
  setSelectedForAssign(new Set(groupItems.map(i => i.id)));
};

// Modo asignación activo → mostrar checkboxes
{assignMode && (
  <Checkbox
    checked={selectedForAssign.has(item.id)}
    onCheckedChange={() => toggleAssignItem(item.id)}
  />
)}

// Botón crear reporte
{assignMode && (
  <Button onClick={() => handleCreateReportForBroker(assigningToBroker)}>
    Crear Reporte ({selectedForAssign.size})
  </Button>
)}
```

---

### **3. MasterAdjustmentReportReview.tsx**

**Agregar botón "Editar":**
```typescript
<Button
  size="sm"
  variant="outline"
  onClick={(e) => {
    e.stopPropagation();
    setEditingReport(report);
  }}
  className="bg-white border-yellow-500 text-yellow-700 hover:bg-yellow-50"
>
  <FaEdit className="mr-2" />
  Editar
</Button>

// Modal de edición
<Dialog open={!!editingReport} onOpenChange={() => setEditingReport(null)}>
  <DialogContent>
    <DialogTitle>Editar Reporte</DialogTitle>
    {/* Lista de items con checkboxes para agregar/quitar */}
    {/* Botón guardar cambios */}
  </DialogContent>
</Dialog>
```

---

### **4. Nueva Función: actionEditAdjustmentReport**

```typescript
export async function actionEditAdjustmentReport(
  reportId: string,
  itemIdsToAdd: string[],
  itemIdsToRemove: string[]
) {
  // 1. Eliminar items del reporte
  await supabase
    .from('adjustment_report_items')
    .delete()
    .in('pending_item_id', itemIdsToRemove)
    .eq('report_id', reportId);
  
  // 2. Agregar nuevos items
  const itemsToInsert = itemIdsToAdd.map(itemId => ({
    report_id: reportId,
    pending_item_id: itemId,
    // calcular commission_raw y broker_commission
  }));
  
  await supabase
    .from('adjustment_report_items')
    .insert(itemsToInsert);
  
  // 3. Recalcular total del reporte
  const { data: items } = await supabase
    .from('adjustment_report_items')
    .select('broker_commission')
    .eq('report_id', reportId);
  
  const newTotal = items.reduce((sum, i) => sum + i.broker_commission, 0);
  
  await supabase
    .from('adjustment_reports')
    .update({ total_amount: newTotal })
    .eq('id', reportId);
}
```

---

## 📊 COMPARACIÓN

| Aspecto | Antes ❌ | Ahora ✅ |
|---------|----------|----------|
| Broker marca 1 → activa checkboxes | NO | SÍ |
| Modo selección múltiple | Siempre activo | Se activa al marcar primero |
| Master asigna múltiples a broker | NO | SÍ, con mismo flujo |
| Editar reporte recibido | NO | SÍ |
| Cálculo automático neto | SÍ | SÍ (mantener) |
| Sumatoria visible | SÍ | SÍ (mantener) |

---

## 🎯 PRÓXIMOS PASOS

1. ✅ Modificar `AdjustmentsTab.tsx` para ambos flujos (Broker y Master)
2. ✅ Agregar botón "Editar" en `MasterAdjustmentReportReview.tsx`
3. ✅ Crear `actionEditAdjustmentReport`
4. ✅ Probar flujo completo end-to-end

---

**Archivo:** `FLUJO_AJUSTES_CORREGIDO.md`
