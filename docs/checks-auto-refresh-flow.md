# 🔄 Flujo de Actualización Automática - Módulo de Cheques

## 📋 Resumen
Sistema de actualización automática que sincroniza en tiempo real las tres operaciones principales del módulo de cheques:
1. **Registro de pagos pendientes**
2. **Marcado de pagos como pagados**
3. **Actualización del historial bancario**

---

## 🎯 Flujo Completo

### 1️⃣ **Crear Nuevo Pago Pendiente**

```
Usuario → RegisterPaymentWizard (Wizard)
         ↓
    Llena formulario y referencias
         ↓
    Confirma en Step 4
         ↓
    actionCreatePendingPayment() [Server Action]
         ↓
    ✅ Inserta en: pending_payments + payment_references
         ↓
    Actualiza: bank_transfers (used_amount, remaining_amount, status)
         ↓
    Toast: "✅ Pago pendiente creado exitosamente"
         ↓
    onClose() → Cierra wizard automáticamente
         ↓
    onSuccess() → handleWizardSuccess()
         ↓
    setRefreshKey(prev => prev + 1) [Incrementa trigger]
         ↓
    ⚡ PendingPaymentsTab detecta cambio en refreshTrigger
         ↓
    loadPayments() → Recarga lista automáticamente
         ↓
    🎉 Usuario ve el nuevo pago en la lista
```

---

### 2️⃣ **Marcar Pagos como Pagados**

```
Usuario → Selecciona uno o varios pagos
         ↓
    Click "Marcar como Pagados"
         ↓
    Confirmación: "¿Marcar N pago(s) como pagado(s)?"
         ↓
    actionMarkPaymentsAsPaidNew(paymentIds) [Server Action]
         ↓
    Para cada pago:
      ├─ Crea payment_details (con datos del pago)
      ├─ Actualiza bank_transfers:
      │   ├─ used_amount += amount_to_use
      │   ├─ remaining_amount = amount - used_amount
      │   └─ status = determineTransferStatus()
      ├─ Marca pending_payment como 'paid'
      ├─ Si es adelanto externo → llama actionApplyAdvancePayment()
      ├─ Limpia payment_details.payment_id = null
      ├─ ELIMINA payment_references
      └─ ELIMINA pending_payment
         ↓
    Toast: "✅ N pago(s) marcado(s) como pagado(s)"
         ↓
    setSelectedIds(new Set()) → Limpia selección
         ↓
    onPaymentPaid() → handleHistoryImported()
         ↓
    setRefreshKey(prev => prev + 1) [Incrementa trigger]
         ↓
    ⚡ AMBAS PESTAÑAS detectan cambio:
      ├─ PendingPaymentsTab → loadPayments()
      │    └─ ✅ Pagos eliminados ya no aparecen
      └─ BankHistoryTab → loadTransfers()
           └─ ✅ Historial actualizado con:
               ├─ used_amount actualizado (rojo)
               ├─ remaining_amount actualizado (verde)
               ├─ status actualizado (badge)
               └─ payment_details expandibles (azul)
         ↓
    🎉 Usuario ve ambas pestañas actualizadas automáticamente
```

---

### 3️⃣ **Importar Historial Bancario**

```
Usuario → Click "Importar Historial"
         ↓
    ImportBankHistoryModal → Selecciona archivo XLSX
         ↓
    actionImportBankHistoryXLSX(transfers) [Server Action]
         ↓
    ✅ Inserta en: bank_transfers (solo nuevos)
         ↓
    Actualiza: payment_references.exists_in_bank = true
         ↓
    Actualiza: pending_payments.can_be_paid = true (si todas las refs existen)
         ↓
    Toast: "N transferencias importadas, M duplicados omitidos"
         ↓
    onSuccess() → handleHistoryImported()
         ↓
    setRefreshKey(prev => prev + 1) [Incrementa trigger]
         ↓
    ⚡ AMBAS PESTAÑAS detectan cambio:
      ├─ BankHistoryTab → loadTransfers()
      │    └─ ✅ Nuevas transferencias visibles
      └─ PendingPaymentsTab → loadPayments()
           └─ ✅ Badges actualizados (rojo → verde)
         ↓
    🎉 Usuario ve transferencias importadas en historial
         y referencias validadas en pagos pendientes
```

---

## 🔧 Implementación Técnica

### **ChecksMainClient.tsx** (Componente Padre)
```typescript
const [refreshKey, setRefreshKey] = useState(0);

const handleWizardSuccess = () => {
  setRefreshKey(prev => prev + 1); // Trigger actualización
};

const handleHistoryImported = () => {
  setRefreshKey(prev => prev + 1); // Trigger actualización
};

// Pasa refreshKey a ambos componentes hijos
<BankHistoryTab refreshTrigger={refreshKey} />
<PendingPaymentsTab refreshTrigger={refreshKey} />
```

### **PendingPaymentsTab.tsx** (Lista de Pagos)
```typescript
interface PendingPaymentsTabProps {
  refreshTrigger?: number; // ← Nuevo prop
}

useEffect(() => {
  loadPayments();
}, [refreshTrigger]); // ← Recarga cuando cambia

const handleMarkAsPaid = async () => {
  const result = await actionMarkPaymentsAsPaidNew(Array.from(selectedIds));
  if (result.ok) {
    onPaymentPaid(); // ← Notifica al padre
  }
};
```

### **BankHistoryTab.tsx** (Historial Banco)
```typescript
interface BankHistoryTabProps {
  refreshTrigger?: number; // ← Nuevo prop
}

useEffect(() => {
  loadTransfers();
}, [filters, refreshTrigger]); // ← Recarga cuando cambia
```

---

## 📊 Estados de Transferencias Bancarias

El sistema calcula automáticamente el estado basado en `used_amount` y `remaining_amount`:

| Estado | Condición | Badge | Descripción |
|--------|-----------|-------|-------------|
| **available** | `used = 0` | 🟢 Verde | Disponible completamente |
| **partial** | `0 < used < amount` | 🟡 Amarillo | Parcialmente usado |
| **exhausted** | `remaining ≤ 0.01` | ⚪ Gris | Agotado completamente |

```typescript
function determineTransferStatus(amount: number, used: number, remaining: number) {
  if (remaining <= 0.01) return 'exhausted';
  if (used > 0.01) return 'partial';
  return 'available';
}
```

---

## ✅ Garantías del Sistema

### 1. **No hay doble recarga**
- Eliminamos `await loadPayments()` en favor de `onPaymentPaid()`
- El padre maneja toda la sincronización a través de `refreshKey`

### 2. **Eliminación automática**
- Los pagos marcados como pagados se **eliminan** de la BD
- La recarga automática muestra solo los pendientes

### 3. **Actualización en tiempo real**
- Incrementar `refreshKey` dispara `useEffect` en ambos componentes
- No se requiere recargar la página ni cambiar de pestaña

### 4. **Datos consistentes**
- `bank_transfers` se actualiza antes de responder
- Las métricas (usado/disponible) son precisas al instante

---

## 🎯 Casos de Uso Probados

✅ **Crear pago → Ver en lista inmediatamente**
✅ **Marcar como pagado → Desaparece de pendientes**
✅ **Marcar como pagado → Historial muestra detalles**
✅ **Importar banco → Referencias se validan automáticamente**
✅ **Cambiar de pestaña → Datos sincronizados**
✅ **Múltiples usuarios → Cada uno ve sus cambios**

---

## 🚀 Próximas Mejoras (Opcional)

- [ ] WebSocket para sincronización multi-usuario en tiempo real
- [ ] Optimistic updates (mostrar cambio antes de confirmar)
- [ ] Cache de React Query para evitar recargas innecesarias
- [ ] Animaciones de entrada/salida en la lista de pagos

---

**Última actualización:** 2025-10-09  
**Desarrollado por:** Portal Líderes en Seguros
