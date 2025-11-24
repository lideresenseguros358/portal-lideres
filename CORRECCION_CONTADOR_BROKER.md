# ✅ CORRECCIÓN - CONTADOR DE COMISIONES EN DASHBOARD BROKER

**Fecha:** 24 de noviembre, 2025

---

## 🐛 PROBLEMA IDENTIFICADO:

En el **Dashboard del Broker**, pestaña **"Ajustes y Pendientes"**, el contador de **"Tu Comisión"** no estaba calculando correctamente las comisiones.

### **Error:**
```typescript
// ❌ ANTES: Siempre calculaba con porcentaje sobre prima
const totalBroker = Math.abs(totalRaw) * (brokerPercent / 100);
```

**Problema:**
- ❌ Multiplicaba `gross_amount` (prima) por el porcentaje
- ❌ No usaba `net_amount` (comisión ya calculada) cuando estaba disponible
- ❌ Duplicaba el cálculo que ya se hizo en el servidor

---

## ✅ SOLUCIÓN IMPLEMENTADA:

### **Usar `net_amount` cuando está disponible:**
```typescript
// ✅ AHORA: Usa net_amount si existe, sino calcula
const totalBroker = selected.reduce((sum, item) => {
  if (item.net_amount) {
    return sum + Math.abs(Number(item.net_amount) || 0);
  }
  return sum + (Math.abs(Number(item.gross_amount) || 0) * (brokerPercent / 100));
}, 0);
```

**Beneficios:**
- ✅ Prioriza `net_amount` (comisión ya calculada)
- ✅ Evita duplicar cálculos
- ✅ Consistente con el resto del sistema
- ✅ Fallback a cálculo manual si no hay `net_amount`

---

## 📊 CONTADOR AFECTADO:

### **Panel de "Items Seleccionados":**

**ANTES (❌):**
```
Items Seleccionados: 3

Monto Crudo:           $15,000  ✅
Tu Porcentaje:         15%      ✅
Monto Bruto (Tu Comisión): $2,250  ❌ (calculado incorrecto)
```

**AHORA (✅):**
```
Items Seleccionados: 3

Monto Crudo:           $15,000  ✅
Tu Porcentaje:         15%      ✅
Monto Bruto (Tu Comisión): $2,250  ✅ (usa net_amount)
```

---

## 🔍 UBICACIÓN DEL PROBLEMA:

**Componente:** `BrokerPendingTab.tsx`  
**Pestaña:** "Ajustes y Pendientes" → "Sin Identificar"

### **Dos lugares corregidos:**

#### **1. Totales de Selección (líneas 86-98)**
```typescript
const selectionTotals = useMemo(() => {
  const selected = pendingItems.filter(item => selectedItems.has(item.id));
  const totalRaw = selected.reduce(...);
  
  // ✅ Corregido: Usa net_amount si está disponible
  const totalBroker = selected.reduce((sum, item) => {
    if (item.net_amount) {
      return sum + Math.abs(Number(item.net_amount) || 0);
    }
    return sum + (Math.abs(Number(item.gross_amount) || 0) * (brokerPercent / 100));
  }, 0);
  
  return { count, totalRaw, totalBroker, percent };
}, [selectedItems, pendingItems, brokerPercent]);
```

#### **2. Comisión Individual por Fila (líneas 319-323)**
```typescript
{pendingItems.map((item) => {
  const rawAmount = Number(item.gross_amount) || 0;
  
  // ✅ Corregido: Usa net_amount si está disponible
  const brokerAmount = item.net_amount 
    ? Math.abs(Number(item.net_amount) || 0)
    : Math.abs(rawAmount) * (brokerPercent / 100);
  
  return (
    <TableRow>
      <TableCell>{formatMoney(brokerAmount)}</TableCell>
    </TableRow>
  );
})}
```

---

## 💡 LÓGICA CORRECTA:

### **Flujo de datos:**

```
1. Item pendiente tiene:
   - gross_amount: $10,000 (prima de aseguradora)
   - net_amount: $1,500 (comisión calculada con % aplicado)
   - broker_percent: 15%

2. Al mostrar "Tu Comisión":
   ✅ Primero verifica: ¿Existe net_amount?
      → SÍ: Usar $1,500 ✅
      → NO: Calcular $10,000 × 15% = $1,500

3. Resultado:
   - Monto Crudo: $10,000
   - Tu Comisión: $1,500 ✅
```

---

## 📝 EJEMPLO PRÁCTICO:

### **Selección de 3 items:**

**Item 1:**
- Prima: $10,000
- Comisión calculada: $1,500
- **Usa:** $1,500 ✅

**Item 2:**
- Prima: $5,000
- Comisión calculada: $750
- **Usa:** $750 ✅

**Item 3:**
- Prima: $8,000
- Comisión calculada: N/A
- **Calcula:** $8,000 × 15% = $1,200 ✅

**Total Tu Comisión:** $1,500 + $750 + $1,200 = $3,450 ✅

---

## 🧪 PARA PROBAR:

```bash
npm run dev
```

1. **Inicia sesión como Broker**
2. **Ve a pestaña "Ajustes y Pendientes"**
3. **Tab "Sin Identificar"**
4. **Selecciona algunos items**
5. **Verifica el panel de "Items Seleccionados":**
   - ✅ **Monto Bruto (Tu Comisión)** debe mostrar la suma correcta
   - ✅ Si seleccionas/deseleccionas, debe actualizar correctamente
   - ✅ El monto debe coincidir con la suma de las comisiones individuales

---

## 📊 COMPARACIÓN:

| Aspecto | Antes ❌ | Ahora ✅ |
|---------|----------|----------|
| Fuente de datos | Solo `gross_amount` | `net_amount` primero |
| Cálculo | Siempre calcula % | Usa valor si existe |
| Precisión | Aproximada | Exacta |
| Consistencia | Variable | Consistente |

---

## ✅ ARCHIVOS MODIFICADOS:

**`src/components/commissions/broker/BrokerPendingTab.tsx`**
- ✅ Líneas 86-98: `selectionTotals` useMemo
- ✅ Líneas 319-327: Cálculo de `brokerAmount` por fila

---

## 🎯 RESULTADO FINAL:

### **Panel de Items Seleccionados:**
```
┌──────────────────────────────────────────────────┐
│ Items Seleccionados: 3                           │
│                                                  │
│ Monto Crudo          Tu Porcentaje   Tu Comisión│
│ $23,000              15%             $3,450 ✅   │
└──────────────────────────────────────────────────┘
```

### **Tabla Individual:**
```
☑ Póliza      Cliente      Monto Crudo  Tu Comisión
☑ AUTO-123    Cliente A    $10,000      $1,500 ✅
☑ VIDA-456    Cliente B     $5,000        $750 ✅
☑ CASA-789    Cliente C     $8,000      $1,200 ✅
```

**Total mostrado:** $3,450 ✅  
**Suma individual:** $1,500 + $750 + $1,200 = $3,450 ✅

---

**¡El contador ahora muestra la comisión correcta del broker!** ✅
