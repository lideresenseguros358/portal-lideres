# Flujo de Conciliación Automática de Pagos Pendientes

**Fecha:** 2025-10-27  
**Objetivo:** Explicar cómo funciona la conciliación automática de referencias bancarias

---

## 🎯 CONCEPTO CLAVE

El sistema permite **registrar pagos pendientes SIN que las referencias estén conciliadas**, pero **bloquea marcarlos como pagados** hasta que se importe el historial del banco. La conciliación es **100% automática**.

---

## 📋 FLUJO COMPLETO

### **1. Registrar Pago Pendiente (Sin Bloqueo)** ✅

**Usuario puede:**
- ✅ Ingresar número de referencia
- ✅ Ingresar monto y fecha manualmente
- ✅ Continuar aunque referencia NO exista en banco
- ✅ Guardar el pago pendiente

**Sistema valida:**
- ✅ Número de referencia presente
- ✅ Monto presente
- ✅ Fecha presente
- ⚠️ Advertencia si referencia no conciliada (pero **NO bloquea**)

**Código:** `RegisterPaymentWizard.tsx` - Paso 2

```typescript
// ANTES: Bloqueaba si no estaba conciliada ❌
if (invalidReferences.length > 0) {
  toast.error('Referencias no encontradas');
  return false; // ❌ Bloqueaba
}

// AHORA: Solo advierte, pero deja continuar ✅
if (!r.exists_in_bank) {
  toast.warning('Referencia sin conciliar');
  // ✅ Continúa y guarda el pago
}
```

---

### **2. Importar Historial Banco (Conciliación Automática)** 🤖

**Cuando Master importa Excel del banco:**

1. **Se insertan nuevas transferencias** en `bank_transfers`
2. **Se actualizan automáticamente** las referencias:
   ```sql
   -- Marcar referencias como existentes
   UPDATE payment_references 
   SET exists_in_bank = true 
   WHERE reference_number IN (nuevas_referencias);
   ```

3. **Se habilitan automáticamente** los pagos pendientes:
   ```sql
   -- Habilitar pagos donde TODAS las referencias ahora existen
   UPDATE pending_payments 
   SET can_be_paid = true 
   WHERE all_references_exist;
   ```

**Código:** `actions.ts` - `actionImportBankHistoryXLSX`

```typescript
// Líneas 193-223
// Update payment_references to mark as existing in bank
await supabase
  .from('payment_references')
  .update({ exists_in_bank: true })
  .in('reference_number', newRefs)
  .eq('exists_in_bank', false);

// Update pending_payments.can_be_paid where all references now exist
const toUpdate: string[] = [];
(pendingWithRefs || []).forEach((p: any) => {
  const allExist = p.payment_references?.every((ref: any) => ref.exists_in_bank);
  if (allExist && p.payment_references?.length > 0) {
    toUpdate.push(p.id);
  }
});

if (toUpdate.length > 0) {
  await supabase
    .from('pending_payments')
    .update({ can_be_paid: true }) // ✨ AUTOMÁTICO
    .in('id', toUpdate);
}
```

---

### **3. Marcar Como Pagado (Con Bloqueo)** 🔒

**Usuario intenta marcar como pagado:**

**Sistema valida ESTRICTAMENTE:**
- ✅ `can_be_paid` debe ser `true`
- ✅ Todas las referencias deben existir en banco
- ✅ Saldo disponible suficiente
- ❌ Si falla → mensaje claro

**Código:** `actions.ts` - `actionMarkPaymentsAsPaidNew`

```typescript
// Líneas 755-761 y 769-774
// BLOQUEO ESTRICTO al marcar como pagado
const invalidReferences = payments.flatMap((payment: any) =>
  (payment.payment_references || [])
    .filter((ref: any) => !transferMap.has(String(ref.reference_number)))
    .map((ref: any) => ref.reference_number)
);

if (invalidReferences.length > 0) {
  return {
    ok: false,
    error: `Las referencias ${labels} no existen en el historial de banco.` // ❌ BLOQUEA
  };
}

if (!payment.can_be_paid) {
  return {
    ok: false,
    error: `El pago tiene referencias inválidas. Actualice historial banco primero.` // ❌ BLOQUEA
  };
}
```

---

## 🔄 DIAGRAMA DE FLUJO

```
┌─────────────────────────────────────────────────────────────┐
│  PASO 1: REGISTRAR PAGO PENDIENTE                           │
├─────────────────────────────────────────────────────────────┤
│  Usuario ingresa:                                           │
│  - Cliente: Juan Pérez                                      │
│  - Monto: $500                                              │
│  - Referencia: REF12345 ⚠️ (NO existe en banco)            │
│  - Fecha: 2025-10-25                                        │
│                                                             │
│  Sistema:                                                   │
│  ⚠️  Advertencia: "Referencias sin conciliar"              │
│  ✅ Guarda el pago con can_be_paid = false                 │
│  ✅ Guarda payment_references con exists_in_bank = false   │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  PASO 2: IMPORTAR HISTORIAL BANCO (Automático)             │
├─────────────────────────────────────────────────────────────┤
│  Master importa Excel del banco:                            │
│  - REF12345, $500, 2025-10-25 ✅                           │
│                                                             │
│  Sistema AUTOMÁTICAMENTE:                                   │
│  ✨ Inserta en bank_transfers                              │
│  ✨ UPDATE payment_references                              │
│     SET exists_in_bank = true                              │
│     WHERE reference_number = 'REF12345'                    │
│                                                             │
│  ✨ UPDATE pending_payments                                │
│     SET can_be_paid = true                                 │
│     WHERE all_references_exist                             │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  PASO 3: MARCAR COMO PAGADO (Con validación estricta)      │
├─────────────────────────────────────────────────────────────┤
│  Usuario selecciona pago y click "Marcar como Pagado"      │
│                                                             │
│  Sistema valida:                                            │
│  ✅ can_be_paid = true                                     │
│  ✅ Referencias existen en banco                           │
│  ✅ Saldo disponible suficiente                            │
│                                                             │
│  SI TODO OK:                                                │
│  ✅ Marca como pagado                                      │
│  ✅ Actualiza bank_transfers.used_amount                   │
│  ✅ Crea payment_details                                   │
│                                                             │
│  SI FALLA:                                                  │
│  ❌ Error: "Referencias no existen en historial banco"     │
└─────────────────────────────────────────────────────────────┘
```

---

## 💡 VENTAJAS DEL SISTEMA

### **1. No Bloquea el Trabajo** ✅
- Usuario puede registrar pagos inmediatamente
- No necesita esperar a que llegue la transferencia
- Workflow más fluido

### **2. Conciliación Automática** 🤖
- No requiere intervención manual
- Al importar Excel → todo se actualiza automáticamente
- Reduce errores humanos

### **3. Control de Calidad** 🔒
- Bloquea marcar como pagado hasta que esté conciliado
- Previene pagos duplicados
- Garantiza que el dinero realmente existe en banco

### **4. Trazabilidad Completa** 📊
- Cada referencia tiene estado claro
- Auditoría completa de cambios
- Histórico de validaciones

---

## 🎨 EXPERIENCIA DE USUARIO

### **Escenario 1: Referencias Conciliadas** ✅

```
Usuario → Ingresa REF12345
Sistema → ✅ "Referencia válida" (200ms)
Usuario → Continúa y guarda
Sistema → ✅ Pago guardado
Usuario → Click "Marcar como Pagado"
Sistema → ✅ Marcado como pagado
```

### **Escenario 2: Referencias NO Conciliadas** ⚠️

```
Usuario → Ingresa REF99999
Sistema → ⚠️ "Referencia sin conciliar" (200ms)
        → "El pago se guardará pero no podrá marcarse como pagado"
Usuario → Continúa y guarda
Sistema → ✅ Pago guardado (can_be_paid = false)

... Tiempo después ...

Master → Importa Excel con REF99999
Sistema → ✨ AUTOMÁTICO: can_be_paid = true

Usuario → Click "Marcar como Pagado"
Sistema → ✅ Ahora SÍ se puede marcar como pagado
```

---

## 📝 TABLAS INVOLUCRADAS

### **1. `bank_transfers`**
```sql
CREATE TABLE bank_transfers (
  id UUID PRIMARY KEY,
  reference_number VARCHAR UNIQUE NOT NULL,
  amount DECIMAL NOT NULL,
  date DATE NOT NULL,
  used_amount DECIMAL DEFAULT 0,
  remaining_amount DECIMAL GENERATED,
  status VARCHAR GENERATED,
  imported_at TIMESTAMP
);
```

### **2. `pending_payments`**
```sql
CREATE TABLE pending_payments (
  id UUID PRIMARY KEY,
  client_name VARCHAR NOT NULL,
  amount DECIMAL NOT NULL,
  can_be_paid BOOLEAN DEFAULT false, -- ✨ Clave
  status VARCHAR DEFAULT 'pending'
);
```

### **3. `payment_references`**
```sql
CREATE TABLE payment_references (
  id UUID PRIMARY KEY,
  payment_id UUID REFERENCES pending_payments(id),
  reference_number VARCHAR NOT NULL,
  amount DECIMAL NOT NULL,
  exists_in_bank BOOLEAN DEFAULT false -- ✨ Clave
);
```

---

## 🔍 QUERIES CLAVE

### **1. Ver pagos pendientes de conciliar:**
```sql
SELECT 
  pp.id,
  pp.client_name,
  pp.amount,
  pp.can_be_paid,
  COUNT(pr.id) as total_refs,
  SUM(CASE WHEN pr.exists_in_bank THEN 1 ELSE 0 END) as conciliadas
FROM pending_payments pp
LEFT JOIN payment_references pr ON pr.payment_id = pp.id
WHERE pp.status = 'pending'
GROUP BY pp.id
HAVING COUNT(pr.id) > SUM(CASE WHEN pr.exists_in_bank THEN 1 ELSE 0 END);
```

### **2. Ver referencias sin conciliar:**
```sql
SELECT 
  pr.reference_number,
  pr.amount,
  pr.exists_in_bank,
  pp.client_name,
  pp.amount as pago_total
FROM payment_references pr
JOIN pending_payments pp ON pp.id = pr.payment_id
WHERE pr.exists_in_bank = false
  AND pp.status = 'pending';
```

---

## ✅ CHECKLIST DE VERIFICACIÓN

Para confirmar que el sistema está funcionando correctamente:

- [ ] Usuario puede registrar pago con referencia no conciliada
- [ ] Sistema muestra advertencia amarilla (no error rojo)
- [ ] Pago se guarda con `can_be_paid = false`
- [ ] Al importar Excel, `exists_in_bank` cambia a `true`
- [ ] Al importar Excel, `can_be_paid` cambia a `true` automáticamente
- [ ] Usuario puede marcar como pagado después de importar
- [ ] Sistema bloquea marcar como pagado si falta conciliar

---

## 🚀 TESTING

### **Test 1: Registrar sin conciliar**
```bash
1. Ir a /checks → Tab "Pagos Pendientes"
2. Click "Registrar Pago Pendiente"
3. Ingresar: Cliente, Monto, Referencia que NO existe
4. Resultado esperado: ⚠️ Advertencia pero deja guardar
```

### **Test 2: Conciliación automática**
```bash
1. Tener pago pendiente con REF no conciliada
2. Ir a tab "Historial Banco" → Importar Excel con esa REF
3. Volver a tab "Pagos Pendientes"
4. Resultado esperado: ✅ Pago ahora tiene botón "Marcar como Pagado" habilitado
```

### **Test 3: Bloqueo al marcar pagado**
```bash
1. Seleccionar pago con referencia no conciliada
2. Click "Marcar como Pagado"
3. Resultado esperado: ❌ Error "Referencias no existen en historial banco"
```

---

## 📚 DOCUMENTACIÓN RELACIONADA

- `OPTIMIZACION_VALIDACION_REFERENCIAS.md` - Performance de validación
- `src/app/(app)/checks/actions.ts` - Lógica de conciliación
- `src/components/checks/RegisterPaymentWizard.tsx` - UI del wizard
- `src/components/checks/PendingPaymentsTab.tsx` - Lista de pagos

---

**✨ RESUMEN:** El sistema es inteligente y no bloquea el trabajo del usuario. Permite registrar pagos sin esperar la conciliación, pero garantiza la integridad al momento de marcar como pagado. Todo el proceso de actualización es automático al importar el historial del banco.
