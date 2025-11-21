# LÓGICA FINAL DE CONTADORES - CORRECTA

## ✅ CÁLCULOS IMPLEMENTADOS

### **1. Total Comisiones Importadas**

**Fuente:** `comm_imports` (reportes reales de aseguradoras)

**Cálculo:**
```typescript
const total_imported = commImports.reduce((sum, imp) => sum + imp.total_amount, 0);
```

**Valor Esperado:** $10,681.22 (suma de los 10 reportes que insertaste)

**Qué muestra:** El total que reportaron las aseguradoras en sus reportes.

---

### **2. Total Pagado a Corredores**

**Fuente:** `fortnight_broker_totals` (totales precalculados de la quincena)

**Cálculo:**
```typescript
const total_paid_net = brokerTotals
  .filter(bt => bt.broker_id !== lissaBroker.id)  // EXCLUIR LISSA
  .reduce((sum, bt) => sum + bt.net_amount, 0);
```

**Qué muestra:** El total NETO pagado a brokers EXTERNOS (sin incluir LISSA).

**Por qué excluir LISSA:** Porque las comisiones de LISSA son parte de la ganancia de la oficina.

---

### **3. Ganancia Oficina**

**Cálculo:**
```typescript
const total_office_profit = total_imported - total_paid_net;
```

**Qué incluye automáticamente:**
- ✅ Comisiones de LISSA (porque no se restaron)
- ✅ Códigos sin broker / huérfanos (porque no están en brokerTotals)
- ✅ Diferencia entre reportes e importado

**Ejemplo:**
```
Total Reportado:     $10,681.22
- Brokers Externos:  $6,000.00
─────────────────────────────────
= Ganancia Oficina:  $4,681.22

Incluye:
- LISSA:             $1,200.00
- Huérfanos:         $500.00
- Diferencia:        $2,981.22
```

---

### **4. Tabla por Aseguradora**

**Columnas:**

| Columna | Fuente | Cálculo |
|---------|--------|---------|
| **Total Reporte** | `comm_imports` | Suma de `total_amount` |
| **Pagado a Corredores** | `comm_items` | Suma de `gross_amount` de TODOS los items |
| **Total Oficina** | Cálculo | `Total Reporte - Pagado` |
| **% Oficina** | Cálculo | `(Total Oficina / Total Reporte) × 100` |

**Código:**
```typescript
// Totales por aseguradora (reportes)
const totalsByInsurer = commImports.reduce((acc, imp) => {
  acc[imp.insurers.name] = imp.total_amount;
  return acc;
}, {});

// Pagado por aseguradora (de TODOS los comm_items)
const paidByInsurer = allCommItems.reduce((acc, item) => {
  acc[item.insurers.name] += item.gross_amount;
  return acc;
}, {});

// Construir tabla
totalsByInsurer.map(({ name, total }) => ({
  name,
  total,                              // Reporte
  paid: paidByInsurer[name] || 0,     // Pagado
  office_total: total - (paidByInsurer[name] || 0)  // Ganancia
}));
```

---

## 🔍 VERIFICACIÓN CON LOGS

Abre la consola del navegador (F12) y verás:

```
📊 Quincena XXXXX: {
  total_imported: 10681.22,          ← Debe ser $10,681.22
  total_paid_net: XXXX.XX,           ← Neto a externos (sin LISSA)
  total_office_profit: XXXX.XX,      ← Debe ser positivo
  lissaId: "xxxx-xxxx-xxxx",         ← ID de LISSA
  commImportsTotal: 10681.22,
  commItemsCount: XXX,
  brokerTotalsCount: X
}
```

**Si ves:**
- `total_imported: 0` → Los reportes NO se insertaron en comm_imports
- `lissaId: undefined` → El broker LISSA no existe
- `total_office_profit` negativo → Hay un problema con los datos

---

## ✅ CHECKLIST DE VERIFICACIÓN

- [ ] Ejecuté el SQL para insertar reportes en comm_imports
- [ ] `SELECT SUM(total_amount) FROM comm_imports` = 10681.22
- [ ] Broker LISSA existe (email: contacto@lideresenseguros.com)
- [ ] LISSA tiene comisiones en fortnight_broker_totals
- [ ] Total Importado muestra $10,681.22
- [ ] Total Pagado NO incluye LISSA
- [ ] Ganancia Oficina es positiva
- [ ] Tabla por aseguradora muestra valores en "Pagado"

---

## 🎯 RESULTADO ESPERADO

```
┌─────────────────────────────────────────┐
│ Total Comisiones Importadas             │
│ $10,681.22                              │ ← Reportes
├─────────────────────────────────────────┤
│ Total Pagado a Corredores               │
│ $6,000.00                               │ ← Sin LISSA
├─────────────────────────────────────────┤
│ Ganancia Oficina                        │
│ $4,681.22                               │ ← Con LISSA + huérfanos
└─────────────────────────────────────────┘

TABLA POR ASEGURADORA:
┌──────────┬─────────┬──────────┬─────────┬────────┐
│ Aseg.    │ Reporte │ Pagado   │ Oficina │ %      │
├──────────┼─────────┼──────────┼─────────┼────────┤
│ ASSA     │ 4108.37 │ 3000.00  │ 1108.37 │ 27.0%  │ ✅
│ FEDPA    │ 1754.25 │ 1200.00  │  554.25 │ 31.6%  │ ✅
│ ...      │ ...     │ ...      │ ...     │ ...    │
└──────────┴─────────┴──────────┴─────────┴────────┘
```
