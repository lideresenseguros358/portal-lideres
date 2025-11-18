# 🔧 FIX: Visualización de Divisiones con Descuento a Corredor

## 📍 Problema Reportado

En la página **Cheques → Pagos Pendientes**, cuando se crea un pago con **"Descontar a Corredor" + "Dividir"**:

### ❌ Problemas:
1. **Badge/Slip de Referencias**: Solo mostraba 1 discount_id genérico en ambas divisiones (en el listado UI)
2. **Contadores**: Parecía que solo incluía una división (falta de claridad visual)
3. **PDF**: Funcionaba correctamente mostrando ambas divisiones

### ✅ En Adelantos:
- Se crean correctamente 2 deudas separadas
- Cada una con su propio ID

---

## 🎯 Solución Implementada

**Archivo modificado:** `src/components/checks/PendingPaymentsTab.tsx`

### **1. Badges Individuales Mejorados**

#### Antes:
```tsx
{payment.metadata?.advance_id && (
  <span>Adelanto externo</span>
)}
```
❌ Problema: Badge genérico sin identificar cuál adelanto

#### Ahora:
```tsx
{isDescuentoACorredor(payment) && (() => {
  const brokerId = payment.metadata?.broker_id;
  const broker = brokers.find(b => b.id === brokerId);
  const brokerName = broker?.name;
  const advanceId = payment.metadata?.advance_id;
  const batchId = getBatchId(payment);
  
  return (
    <>
      <span>💰 Descuento a corredor – {brokerName}</span>
      {advanceId && (
        <span className="font-mono">
          🆔 Adelanto: {advanceId.slice(0, 8)}...
        </span>
      )}
      {batchId && (
        <span>🔗 División del pago</span>
      )}
    </>
  );
})()}
```
✅ Ahora muestra:
- Nombre del broker
- **ID específico del adelanto** (primeros 8 caracteres)
- Badge de "División del pago" si está en un batch

---

### **2. Vista Agrupada Mejorada**

#### Header del Grupo de Divisiones:

##### Antes:
```
🔗 Pago con 2 divisiones
Referencias: ABC123
```

##### Ahora:
```
🔗 Pago dividido en 2 partes (Descuentos a corredor)
Referencias: ABC123
💡 Cada división tiene su propio ID de adelanto
```

✅ **Claridad Mejorada:**
- Indica claramente que son descuentos a corredor
- Mensaje informativo sobre IDs únicos

---

### **3. Indicador de División Individual**

#### Antes:
```
┌────────────────────────────────────┐
│ División 1 de 2                    │
├────────────────────────────────────┤
│ Cliente: Juan Pérez                │
│ Monto: $600.00                     │
└────────────────────────────────────┘
```

#### Ahora:
```
┌────────────────────────────────────────────────────────┐
│ 🔸 División 1 de 2    [60% del total]                 │
│ ID Adelanto: abc12345...                               │
├────────────────────────────────────────────────────────┤
│ Cliente: Juan Pérez                                    │
│ Monto: $600.00                                         │
└────────────────────────────────────────────────────────┘
```

✅ **Información Nueva:**
- **Porcentaje del total** que representa cada división
- **ID específico del adelanto** (primeros 12 caracteres)
- Badge con gradiente y mejor jerarquía visual

---

## 📊 Ejemplo Visual Completo

### Escenario: Pago de $1000 dividido (60% / 40%) con descuento a corredor

#### **Vista Agrupada por Referencia:**

```
┌───────────────────────────────────────────────────────────────┐
│ 🔗 Pago dividido en 2 partes (Descuentos a corredor)         │
│ Referencias: TRANS-2024-001                                   │
│ 💡 Cada división tiene su propio ID de adelanto              │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🔸 División 1 de 2    [60% del total]                   │ │
│ │ ID Adelanto: adv-abc12345...                            │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ☑ Juan Pérez - Póliza 12345                            │ │
│ │                                      $600.00            │ │
│ │ Referencias: ✅ TRANS-2024-001 ($1000.00)              │ │
│ │ 💰 Descuento a corredor – BROKER A                     │ │
│ │ 🆔 Adelanto: adv-abc1...                               │ │
│ │ 🔗 División del pago                                   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🔸 División 2 de 2    [40% del total]                   │ │
│ │ ID Adelanto: adv-xyz67890...                            │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ☑ Juan Pérez - Póliza 12345                            │ │
│ │                                      $400.00            │ │
│ │ Referencias: ✅ TRANS-2024-001 ($1000.00)              │ │
│ │ 💰 Descuento a corredor – BROKER A                     │ │
│ │ 🆔 Adelanto: adv-xyz6...                               │ │
│ │ 🔗 División del pago                                   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## 📈 Contadores

### **¿Cómo funcionan los contadores con divisiones?**

#### **1. Total a Pagar:**
```typescript
${payments.reduce((sum, p) => sum + Number(p.amount_to_pay || 0), 0).toFixed(2)}
```
✅ **Correcto**: Suma CADA división como un pago separado
- División 1: $600
- División 2: $400
- **Total: $1000** ✓

#### **2. Total Recibido:**
```typescript
// Deduplica referencias bancarias por reference_number
const uniqueReferences = new Map<string, number>();
payments.forEach(p => {
  p.payment_references?.forEach((ref: any) => {
    const refNum = ref.reference_number;
    const amount = Number(ref.amount || 0);
    if (!uniqueReferences.has(refNum) && amount > 0) {
      uniqueReferences.set(refNum, amount);
    }
  });
});
```
✅ **Correcto**: Deduplica referencias bancarias compartidas
- Ambas divisiones comparten referencia "TRANS-2024-001" por $1000
- **Total Recibido: $1000** ✓ (no se duplica)

**Nota:** Los descuentos a corredor NO son transferencias bancarias reales, son deducciones internas que se reflejan en la tabla de adelantos.

---

## 🔍 Diferencias Clave

### **Antes (Confuso):**
- Badge genérico: "Adelanto externo"
- Sin indicar cuál adelanto específico
- Sin mostrar porcentajes de división
- Parecía que solo había 1 adelanto

### **Ahora (Claro):**
- ✅ Badge con ID específico: "🆔 Adelanto: adv-abc1..."
- ✅ Porcentaje de división: "60% del total"
- ✅ Badge de división: "🔗 División del pago"
- ✅ Mensaje informativo: "💡 Cada división tiene su propio ID de adelanto"
- ✅ Nombre del broker: "💰 Descuento a corredor – BROKER A"

---

## 🎨 Diseño Visual

### **Colores y Estilos:**

```css
/* Badge de descuento a corredor */
bg-[#010139]/5 text-[#010139] border border-[#010139]/30

/* Badge de ID de adelanto */
bg-[#8AAA19]/10 text-[#8AAA19] border border-[#8AAA19]/40
font-mono

/* Badge de división */
bg-blue-50 text-blue-700 border border-blue-300

/* Indicador de división */
bg-gradient-to-r from-blue-50 to-white
border-b-2 border-gray-200

/* Porcentaje */
bg-blue-100 text-blue-700

/* ID de adelanto en indicador */
bg-white text-[#8AAA19] border border-[#8AAA19]/30
font-mono
```

---

## ✅ Resultado

### **Claridad Lograda:**

1. **Cada división es claramente identificable**
   - Número de división (1 de 2, 2 de 2)
   - Porcentaje del total (60%, 40%)
   - ID específico del adelanto

2. **Contadores funcionan correctamente**
   - Total a Pagar: Suma ambas divisiones
   - Total Recibido: Deduplica referencias bancarias compartidas

3. **Consistencia con PDF**
   - La UI ahora muestra la misma información que el PDF
   - Ambas divisiones son claramente visibles

4. **Trazabilidad completa**
   - Cada adelanto tiene su ID único visible
   - Fácil de relacionar con la página de Adelantos
   - Nombre del broker visible

---

## 🧪 Cómo Probar

### **1. Crear un pago dividido con descuento a corredor:**
```bash
1. Ir a /checks → Pagos Pendientes
2. Click "Nuevo Pago"
3. Tipo: Pago a cliente
4. Marcar "Descontar a Corredor"
5. Marcar "Dividir Pago"
6. Configurar divisiones (ej: 60% / 40%)
7. Guardar
```

### **2. Verificar en Pagos Pendientes:**
```bash
✅ Se ven 2 pagos separados
✅ Cada uno muestra su ID de adelanto específico (🆔 Adelanto: ...)
✅ Cada uno muestra "🔗 División del pago"
✅ En vista agrupada, se ve "Pago dividido en 2 partes"
✅ Cada división muestra su porcentaje (60%, 40%)
```

### **3. Verificar Contadores:**
```bash
✅ Total a Pagar = División 1 + División 2
✅ Total Recibido = Referencia bancaria única (no duplicada)
✅ Pagos Pendientes = 2 (cada división cuenta)
```

### **4. Verificar en Adelantos:**
```bash
✅ Se crearon 2 adelantos separados
✅ Cada adelanto tiene su propio ID
✅ Los IDs coinciden con los mostrados en Pagos Pendientes
```

---

## 📝 Cambios en el Código

### **Líneas modificadas:**

#### **1. Badges individuales (líneas 1258-1282):**
- Agregado: Extracción de `advanceId` y `batchId`
- Agregado: Badge con ID específico del adelanto
- Agregado: Badge de "División del pago"

#### **2. Header de grupo batch (líneas 1034-1054):**
- Mejorado: Título indica "descuentos a corredor"
- Agregado: Mensaje informativo sobre IDs únicos

#### **3. Indicador de división (líneas 1122-1151):**
- Agregado: Cálculo de porcentaje
- Agregado: Display del porcentaje
- Agregado: Display del ID de adelanto completo (12 caracteres)
- Mejorado: Diseño visual con gradiente

---

## 🎯 Beneficios

### **Para el Usuario:**
- ✅ **Claridad visual**: Cada división es fácilmente identificable
- ✅ **Trazabilidad**: IDs de adelantos visibles y copiables
- ✅ **Confianza**: Los contadores muestran números correctos
- ✅ **Eficiencia**: No hay confusión sobre qué adelanto corresponde a qué división

### **Para el Sistema:**
- ✅ **Consistencia**: UI y PDF muestran la misma información
- ✅ **Mantenibilidad**: Código más claro y documentado
- ✅ **Debugging**: Fácil identificar problemas con IDs visibles

---

**Última actualización:** Nov 18, 2025, 4:30pm  
**Estado:** ✅ Implementado y funcionando  
**Archivo modificado:** `src/components/checks/PendingPaymentsTab.tsx`  
**Líneas modificadas:** ~50 líneas (mejoras en badges, indicadores y headers)
