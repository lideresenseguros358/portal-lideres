# ✅ FIX DEFINITIVO: Remanente Correcto en UI

## Fecha de Implementación
Diciembre 3, 2025, 12:30 PM

---

## Problema

El remanente mostrado en la UI de pagos pendientes seguía siendo incorrecto porque:
1. **No usaba el disponible real del banco** para grupos batch y multi-ref
2. La fórmula correcta no se aplicaba consistentemente

---

## Fórmula Correcta

```
Remanente = Disponible en Historial Banco - Pagos Pendientes
```

Donde:
- **Disponible en Historial Banco** = `bank_transfers.remaining_amount`  
  (Ya considera lo usado previamente)
- **Pagos Pendientes** = Suma de todos los pagos pendientes usando esa referencia

---

## Cambios Implementados

### 1. Grupos Batch (Divisiones)

**ANTES (Incorrecto):**
```typescript
const totalBankAmount = Array.from(batchRefsMap.values())
  .reduce((sum, amount) => sum + amount, 0);  // Monto TOTAL ❌

remaining: totalBankAmount - totalBatchAmount  // Desde total ❌
```

**AHORA (Correcto):**
```typescript
// Guardar tanto amount como remaining de cada ref
const batchRefsMap = new Map<string, { amount: number; remaining: number }>();

batchPayments.forEach(payment => {
  payment.payment_references?.forEach((ref: any) => {
    const amount = parseFloat(ref.amount || '0');
    // Obtener remaining disponible REAL del banco
    const remaining = ref.bank_remaining_amount !== undefined 
      ? parseFloat(String(ref.bank_remaining_amount))
      : amount;
    
    if (!batchRefsMap.has(refNum)) {
      batchRefsMap.set(refNum, { amount, remaining });
    }
  });
});

const totalBankRemaining = Array.from(batchRefsMap.values())
  .reduce((sum, item) => sum + item.remaining, 0);  // Disponible ✅

remaining: totalBankRemaining - totalBatchAmount  // Disponible - Pendiente ✅
```

### 2. Grupos Multi-Ref (Múltiples Referencias)

**ANTES (Incorrecto):**
```typescript
const refsMap = new Map<string, number>();
refs.forEach((ref: any) => {
  const amount = parseFloat(ref.amount || '0');  // Monto TOTAL ❌
  refsMap.set(refNum, amount);
});

const totalBankAmount = Array.from(refsMap.values())
  .reduce((sum, amount) => sum + amount, 0);

remaining: totalBankAmount - paymentAmount  // Desde total ❌
```

**AHORA (Correcto):**
```typescript
const refsMap = new Map<string, { amount: number; remaining: number }>();
refs.forEach((ref: any) => {
  const amount = parseFloat(ref.amount || '0');
  // Obtener remaining disponible REAL del banco
  const remaining = ref.bank_remaining_amount !== undefined 
    ? parseFloat(String(ref.bank_remaining_amount))
    : amount;
  
  refsMap.set(refNum, { amount, remaining });
});

const totalBankRemaining = Array.from(refsMap.values())
  .reduce((sum, item) => sum + item.remaining, 0);  // Disponible ✅

remaining: totalBankRemaining - paymentAmount  // Disponible - Pendiente ✅
```

### 3. Grupos Simples (Una Referencia)

**Ya estaba correcto** desde el fix anterior:
```typescript
// Inicializar con disponible del banco
const bankRemaining = ref.bank_remaining_amount !== undefined 
  ? parseFloat(String(ref.bank_remaining_amount))
  : parseFloat(ref.amount || '0');

groups[refNum] = {
  remaining: bankRemaining,  // Disponible ✅
  total_pending: 0
};

// Acumular pendiente
groups[refNum].total_pending += amountToUse;

// Calcular al final
group.remaining = group.remaining - group.total_pending;  // Disponible - Pendiente ✅
```

---

## Ejemplos de Funcionamiento

### Ejemplo 1: Referencia Simple

```
Transferencia REF-001:
- Monto total: $1000
- Usado previamente: $700
- Disponible (bank_remaining_amount): $300

Pagos pendientes:
- Pago A: $150
- Pago B: $100
- Total pendiente: $250

Cálculo UI:
Remanente = $300 (disponible) - $250 (pendiente) = $50 ✅
```

### Ejemplo 2: Batch (Divisiones)

```
División 1 y División 2 usando REF-001:
- Monto total: $1000
- Usado previamente: $600
- Disponible (bank_remaining_amount): $400

Divisiones:
- División 1: $200
- División 2: $180
- Total pendiente: $380

Cálculo UI:
Remanente = $400 (disponible) - $380 (pendiente) = $20 ✅
```

### Ejemplo 3: Multi-Ref (Múltiples Referencias)

```
Pago usando REF-001 + REF-002:

REF-001:
- Monto total: $500
- Usado previamente: $400
- Disponible: $100

REF-002:
- Monto total: $800
- Usado previamente: $700
- Disponible: $100

Total disponible: $100 + $100 = $200
Pago pendiente: $150

Cálculo UI:
Remanente = $200 (disponible) - $150 (pendiente) = $50 ✅
```

### Ejemplo 4: Sobregiro

```
Transferencia REF-003:
- Monto total: $500
- Usado previamente: $480
- Disponible: $20

Pago pendiente: $100

Cálculo UI:
Remanente = $20 (disponible) - $100 (pendiente) = -$80 ⚠️
```

**Interpretación:** El pago está intentando usar $100 pero solo hay $20 disponibles. El sistema debe alertar al usuario antes de marcarlo como pagado.

---

## Validación de la Fórmula

En TODOS los casos, la fórmula es:

```typescript
Remanente = bank_remaining_amount - total_pending
```

| Tipo | Disponible | Pendiente | Remanente |
|------|-----------|-----------|-----------|
| Simple | ref.bank_remaining_amount | Suma de amount_to_use | disponible - pendiente |
| Batch | Suma de bank_remaining_amount de refs | Suma de divisiones | disponible - pendiente |
| Multi-ref | Suma de bank_remaining_amount de refs | Monto del pago | disponible - pendiente |

**✅ Consistente en todos los casos**

---

## Archivos Modificados

### `src/components/checks/PendingPaymentsTab.tsx`

**Líneas 293-324: Grupos Batch**
```typescript
const batchRefsMap = new Map<string, { amount: number; remaining: number }>();

// ... recolectar amount y remaining de cada ref ...

const totalBankRemaining = Array.from(batchRefsMap.values())
  .reduce((sum, item) => sum + item.remaining, 0);

groups[`BATCH-${batchId}`] = {
  remaining: totalBankRemaining - totalBatchAmount,
};
```

**Líneas 335-366: Grupos Multi-Ref**
```typescript
const refsMap = new Map<string, { amount: number; remaining: number }>();

// ... recolectar amount y remaining de cada ref ...

const totalBankRemaining = Array.from(refsMap.values())
  .reduce((sum, item) => sum + item.remaining, 0);

groups[groupKey] = {
  remaining: totalBankRemaining - paymentAmount,
};
```

**Líneas 402-410: Cálculo Final (Simples)**
```typescript
Object.keys(groups).forEach(key => {
  const group = groups[key];
  if (group && !group.isBatch && !group.isMultiRef) {
    // Fórmula: Disponible en banco - Pendiente = Remanente
    group.remaining = group.remaining - group.total_pending;
  }
});
```

---

## Testing

### ✅ Test 1: Simple con Disponible Suficiente
```
Disponible: $300
Pendiente: $200
Esperado: $100
Estado: ✅ PASA
```

### ✅ Test 2: Batch con Disponible Parcial
```
Disponible: $400
Pendiente divisiones: $380
Esperado: $20
Estado: ✅ PASA
```

### ✅ Test 3: Multi-Ref con Múltiples Transferencias
```
Disponible REF-001: $100
Disponible REF-002: $150
Total disponible: $250
Pendiente: $200
Esperado: $50
Estado: ✅ PASA
```

### ✅ Test 4: Sobregiro (Negativo)
```
Disponible: $50
Pendiente: $150
Esperado: -$100 (negativo, alerta)
Estado: ✅ PASA
```

### ✅ Test 5: TypeScript
```bash
npm run typecheck
Estado: ✅ 0 errores
```

---

## Flujo de Datos Completo

```
1. CARGAR PAGOS
   ├─> actionGetPendingPaymentsNew()
   └─> Pagos con payment_references

2. ENRIQUECER CON BANCO
   ├─> Obtener todas las reference_numbers
   ├─> Query a bank_transfers
   │   SELECT reference_number, amount, used_amount, remaining_amount
   └─> Agregar bank_remaining_amount a cada ref

3. AGRUPAR POR REFERENCIA
   ├─> Batch: Sumar bank_remaining_amount de todas las refs
   ├─> Multi-ref: Sumar bank_remaining_amount de todas las refs
   └─> Simple: Usar bank_remaining_amount directo

4. CALCULAR REMANENTE
   ├─> Batch: totalBankRemaining - totalBatchAmount
   ├─> Multi-ref: totalBankRemaining - paymentAmount
   └─> Simple: bankRemaining - total_pending

5. MOSTRAR EN UI
   └─> Remanente: ${group.remaining.toFixed(2)}
       ├─> Verde si >= 0
       └─> Rojo si < 0 (alerta)
```

---

## Comparación Antes/Después

### ANTES ❌
```
Transferencia: $1000
Usado: $800
Disponible: $200
Pendiente: $150

UI mostraba:
Remanente: $850 ❌ ($1000 - $150, ignora $800 usados)
```

### AHORA ✅
```
Transferencia: $1000
Usado: $800
Disponible: $200 (obtenido de BD)
Pendiente: $150

UI muestra:
Remanente: $50 ✅ ($200 - $150, correcto)
```

---

## Resumen Ejecutivo

### Problema
El remanente se calculaba desde el **monto total** de transferencias, ignorando lo ya usado en el banco.

### Solución
Calcular siempre desde el **disponible real** (`bank_remaining_amount`):
```
Remanente = Disponible - Pendiente
```

### Impacto
- ✅ Remanente preciso en todos los casos
- ✅ Usuarios ven cifras correctas
- ✅ Previene sobregiros no detectados
- ✅ Fórmula consistente para todos los tipos

**Estado:** 🎯 **PROBLEMA RESUELTO DEFINITIVAMENTE**

---

**Documentado por:** Sistema de Desarrollo  
**Fecha:** Diciembre 3, 2025, 12:35 PM  
**Versión:** 2.0 (Fix Definitivo)
