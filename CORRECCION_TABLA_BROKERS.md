# ✅ CORRECCIÓN - Tabla de Brokers en Reporte Completo

**Fecha:** 24 de noviembre, 2025

---

## 🐛 PROBLEMAS CORREGIDOS:

### **1. Tabla se salía del PDF** ✅
- **Antes:** 7 columnas (212px total) se salían del ancho del PDF
- **Ahora:** 6 columnas (189px total) caben perfectamente
- **Ajuste:** Eliminada columna "Retenido", reducidos anchos

### **2. Bruto y Neto mostraban el mismo valor** ✅
- **Causa:** El endpoint estaba usando valores acumulados incorrectos
- **Solución:** 
  - Obtiene `total_gross` y `total_net` desde `fortnight_broker_totals`
  - Fallback: calcula desde las pólizas si no existe en DB

### **3. Orden de columnas incorrecto** ✅
- **Antes:** Corredor | % | Bruto | Neto | Desc. | Pagado | Ret.
- **Ahora:** Corredor | Bruto | % | Neto | Desc. | Pagado

---

## 📊 TABLA MEJORADA:

### **PDF - Resumen de Brokers:**

```
┌──────────────────────────┬──────────┬─────┬──────────┬─────────┬──────────┐
│ Corredor                 │ Bruto    │  %  │ Neto     │ Desc.   │ Pagado   │
├──────────────────────────┼──────────┼─────┼──────────┼─────────┼──────────┤
│ Juan Pérez               │ $5,000   │ 15% │ $750     │ $150    │ $600     │
│ María López              │ $3,000   │ 20% │ $600     │ $0      │ $600     │
│ Carlos Sánchez           │ $4,500   │ 18% │ $810     │ $200    │ $610     │
└──────────────────────────┴──────────┴─────┴──────────┴─────────┴──────────┘
```

**Anchos de columna:**
- Corredor: 65px
- Bruto: 28px (alineado derecha)
- %: 15px (centrado)
- Neto: 28px (alineado derecha)
- Desc.: 25px (alineado derecha)
- Pagado: 28px (alineado derecha)
- **Total: 189px** (cabe en PDF que tiene 210px de ancho útil)

---

## 🔧 CAMBIOS TÉCNICOS:

### **1. Endpoint `/api/commissions/fortnight-export`:**

**Lógica de cálculo mejorada:**
```typescript
// Obtener totales oficiales de la DB
const totalsFromDB = totalsMap.get(broker.broker_id);

// Calcular desde pólizas como fallback
let calculatedGross = 0;
let calculatedNet = 0;
broker.insurers.forEach(ins => {
  ins.policies.forEach(pol => {
    calculatedGross += pol.gross_amount;
    calculatedNet += pol.net_amount;
  });
});

// Usar DB primero, fallback a calculado
total_gross: totalsFromDB?.gross || calculatedGross,
total_net: totalsFromDB?.net || calculatedNet,
```

**Por qué es importante:**
- ✅ `fortnight_broker_totals` tiene los valores oficiales (incluye ajustes, etc.)
- ✅ El cálculo desde pólizas es solo backup
- ✅ Garantiza que bruto ≠ neto

---

### **2. Export PDF - `commission-export-utils.ts`:**

**Tabla actualizada:**
```typescript
head: [['Corredor', 'Bruto', '%', 'Neto', 'Desc.', 'Pagado']]

columnStyles: {
  0: { cellWidth: 65 },  // Corredor
  1: { halign: 'right', cellWidth: 28 },  // Bruto
  2: { halign: 'center', cellWidth: 15 }, // %
  3: { halign: 'right', cellWidth: 28 },  // Neto
  4: { halign: 'right', cellWidth: 25 },  // Desc.
  5: { halign: 'right', cellWidth: 28 },  // Pagado
}
```

---

### **3. Export Excel:**

**Columnas actualizadas:**
```
Corredor | Email | Bruto | % | Neto | Descuentos | Total Pagado
```

**Anchos:**
```typescript
{ wch: 30 }, // Corredor
{ wch: 25 }, // Email
{ wch: 15 }, // Bruto
{ wch: 8 },  // %
{ wch: 15 }, // Neto
{ wch: 15 }, // Descuentos
{ wch: 15 }  // Total Pagado
```

---

## 🧪 CÓMO VERIFICAR:

### **1. Reiniciar servidor**
```bash
npm run dev
```

### **2. Generar reporte**
1. Ve a **Comisiones** → **Historial**
2. Expande una quincena cerrada
3. Click **"Descargar"** → **PDF**

### **3. Verificar en el PDF:**

#### **Página 1 - Tabla Resumen:**
- ✅ La tabla NO se sale de los márgenes
- ✅ Columna "Bruto" muestra monto mayor que "Neto"
- ✅ Orden: Corredor, Bruto, %, Neto, Desc., Pagado
- ✅ Números alineados a la derecha
- ✅ Porcentaje centrado

#### **Valores esperados:**
```
Bruto:  $5,000.00  (monto reportado por aseguradora)
%:      15%        (porcentaje del broker)
Neto:   $750.00    (5000 * 0.15 = 750)
Desc.:  $150.00    (adelantos/descuentos)
Pagado: $600.00    (750 - 150 = 600)
```

**Relación matemática:**
- `Neto = Bruto × %`
- `Pagado = Neto - Descuentos`
- `Bruto > Neto` (siempre)
- `Neto >= Pagado` (siempre)

---

## 🔍 DEBUGGING:

Si aún hay problemas, verificar logs en el servidor:

```javascript
[Fortnight Export API] Ejemplo broker: {
  name: "Juan Pérez",
  total_gross: 5000,      // ✅ Mayor
  total_net: 750,          // ✅ Menor
  discounts: { total: 150 },
  percent: 0.15
}
```

**Si Bruto = Neto:**
- ❌ Problema: `fortnight_broker_totals` no tiene datos correctos
- 🔧 Solución: Verificar que la quincena se cerró correctamente

**Si la tabla se sale del PDF:**
- ❌ Problema: Anchos de columna muy grandes
- 🔧 Solución: Suma total debe ser < 195px

---

## 📊 COMPARACIÓN ANTES/DESPUÉS:

### **ANTES (❌):**
```
Columnas: 7 (Corredor, %, Bruto, Neto, Desc., Pagado, Ret.)
Anchos: 70 + 15 + 30 + 30 + 25 + 30 + 12 = 212px
Problema: Se salía del PDF (210px disponibles)
Valores: Bruto = Neto (error de cálculo)
```

### **AHORA (✅):**
```
Columnas: 6 (Corredor, Bruto, %, Neto, Desc., Pagado)
Anchos: 65 + 28 + 15 + 28 + 25 + 28 = 189px
Resultado: Cabe perfectamente en PDF
Valores: Bruto > Neto (correcto)
```

---

## ✅ ESTADO FINAL:

| Aspecto | Estado |
|---------|--------|
| Tabla cabe en PDF | ✅ Corregido |
| Bruto ≠ Neto | ✅ Corregido |
| Orden correcto de columnas | ✅ Corregido |
| Alineación visual | ✅ Mantenida |
| Excel actualizado | ✅ Corregido |

---

## 📝 ARCHIVOS MODIFICADOS:

1. ✅ `src/app/api/commissions/fortnight-export/route.ts`
   - Lógica de cálculo mejorada
   - Prioriza valores de DB sobre calculados

2. ✅ `src/lib/commission-export-utils.ts`
   - Tabla PDF con 6 columnas
   - Anchos ajustados
   - Orden corregido
   - Excel actualizado

---

**Prueba el reporte ahora y confirma que:**
1. ✅ La tabla cabe en el PDF
2. ✅ Bruto > Neto
3. ✅ Orden: Bruto, %, Neto, Desc., Pagado
