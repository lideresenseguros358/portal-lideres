# LÓGICA DE CÁLCULO - GANANCIA OFICINA

## 📊 PROBLEMA IDENTIFICADO

**Antes:** Total importado mostraba $8,354.93 en lugar de $10,681.22
**Causa:** Los datos de `comm_imports` no estaban completos o se filtraban incorrectamente

---

## ✅ NUEVA LÓGICA IMPLEMENTADA

### **1. Total Comisiones Importadas**
```typescript
// Suma de TODOS los reportes reales de aseguradoras
const total_imported = commImports.reduce((sum, imp) => sum + imp.total_amount, 0);
```
**Esperado:** $10,681.22 (suma de todos los reportes que proporcionaste)

---

### **2. Total Pagado a Corredores**
```typescript
// SOLO brokers EXTERNOS (sin incluir LISSA)
const total_paid_external = brokerTotals
  .filter(bt => bt.broker_id !== officeBroker.id)  // Excluir LISSA
  .reduce((sum, bt) => sum + bt.net_amount, 0);
```
**Nota:** Este total NO incluye las comisiones de LISSA (broker de oficina)

---

### **3. Ganancia Oficina (CORREGIDO)**

```typescript
// Fórmula completa
const total_office_profit = total_imported - total_paid_external;

// Esto equivale a:
// = Reportes de aseguradoras
// - Pagado a brokers externos
// = Comisiones LISSA + Huérfanos ASSA + Diferencia reportes vs importado
```

**Componentes de la Ganancia Oficina:**

| Componente | Descripción | Incluido |
|------------|-------------|----------|
| **Comisiones LISSA** | Comisiones asignadas al broker contacto@lideresenseguros.com | ✅ Automático |
| **Códigos Huérfanos ASSA** | Items sin broker asignado que van a oficina | ✅ Si están en comm_items |
| **Diferencia Reportes** | Diferencia entre reportado e importado al sistema | ✅ Automático |

---

## 📐 EJEMPLO DE CÁLCULO

### **Datos de Ejemplo:**

```
Total Reportado (comm_imports):    $10,681.22

Brokers Externos:
  - Broker A (neto):                $2,500.00
  - Broker B (neto):                $1,800.00
  - Broker C (neto):                $1,200.00
  Subtotal Externos:                $5,500.00

Broker Oficina (LISSA):
  - Comisiones LISSA (neto):        $800.00
  - Códigos huérfanos ASSA:         $300.00
  Subtotal LISSA:                   $1,100.00

────────────────────────────────────────────
CÁLCULO:
Total Importado:                    $10,681.22
- Pagado a Externos:                -$5,500.00
────────────────────────────────────────────
= Ganancia Oficina:                 $5,181.22

DESGLOSE GANANCIA:
  Comisiones LISSA:                 $1,100.00
  Diferencia (no importado):        $4,081.22
────────────────────────────────────────────
```

---

## 🔍 VERIFICACIÓN

### **Para verificar que los cálculos son correctos:**

1. **Total Importado debe ser $10,681.22**
   ```sql
   SELECT SUM(total_amount) FROM comm_imports;
   -- Debe dar: 10681.22
   ```

2. **Buscar broker LISSA**
   ```sql
   SELECT id, name FROM brokers WHERE email = 'contacto@lideresenseguros.com';
   ```

3. **Ver distribución de comisiones**
   ```sql
   SELECT 
     b.name,
     fbt.net_amount,
     fbt.gross_amount
   FROM fortnight_broker_totals fbt
   JOIN brokers b ON b.id = fbt.broker_id
   ORDER BY fbt.net_amount DESC;
   ```

---

## 🎯 CASOS ESPECIALES

### **Códigos Huérfanos de ASSA:**

Los códigos huérfanos se manejan de 2 formas:

1. **Si están asignados a LISSA:**
   - Ya están incluidos en `fortnight_broker_totals` de LISSA
   - Se cuentan automáticamente en ganancia de oficina

2. **Si NO están asignados a nadie:**
   - NO están en `comm_items` activos
   - Están en la diferencia entre reporte e importado
   - También se cuentan en ganancia de oficina

**Ambos casos están cubiertos por la fórmula actual.**

---

## 📊 UI - LO QUE VERÁS

### **Tarjetas Resumen:**

```
┌──────────────────────────────────┐
│ Total Comisiones Importadas      │
│ $10,681.22                       │ ← Reportes aseguradoras
│ De reportes de aseguradoras      │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ Total Pagado a Corredores        │
│ $X,XXX.XX                        │ ← Solo externos (sin LISSA)
│ Monto neto pagado                │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ Ganancia Oficina                 │
│ $X,XXX.XX                        │ ← Incluye todo
│ Incluye LISSA + huérfanos + dif  │
└──────────────────────────────────┘
```

---

## 🔧 PASOS PARA CORREGIR EL PROBLEMA

### **1. Ejecutar Script de Actualización**

Primero, asegúrate de que `comm_imports` tenga todos los reportes:

```bash
node scripts/update-insurer-reports.mjs
```

Este script debe insertar:
```
ASSA:          $4,108.37
FEDPA:         $1,754.25
ANCON:         $1,295.97
SURA:          $1,244.54
INTERNACIONAL: $1,043.01
REGIONAL:      $511.92
VIVIR:         $424.53
OPTIMA:        $172.59
ACERTA:        $89.39
BANESCO:       $36.65
──────────────────────
TOTAL:         $10,681.22
```

### **2. Verificar en Supabase**

```sql
-- Debe devolver 10681.22
SELECT SUM(total_amount) as total_reportado FROM comm_imports;

-- Ver por aseguradora
SELECT 
  i.name,
  ci.total_amount,
  ci.period_label
FROM comm_imports ci
JOIN insurers i ON i.id = ci.insurer_id
ORDER BY ci.total_amount DESC;
```

### **3. Verificar Broker LISSA**

```sql
-- Ver comisiones de LISSA
SELECT 
  fbt.net_amount,
  fbt.gross_amount,
  f.period_start,
  f.period_end
FROM fortnight_broker_totals fbt
JOIN brokers b ON b.id = fbt.broker_id
JOIN fortnights f ON f.id = fbt.fortnight_id
WHERE b.email = 'contacto@lideresenseguros.com'
ORDER BY f.period_end DESC;
```

---

## 📝 NOTAS IMPORTANTES

1. **Los códigos huérfanos de ASSA** pueden estar:
   - Asignados a LISSA → Ya en `fortnight_broker_totals`
   - Sin asignar → En la diferencia entre reporte e importado
   - **Ambos casos se reflejan correctamente en ganancia de oficina**

2. **Si ves diferencia muy grande:**
   - Verificar que todos los items están en `comm_items`
   - Verificar que los reportes están completos en `comm_imports`
   - Verificar que la quincena está cerrada correctamente

3. **Broker LISSA debe existir:**
   - Email: `contacto@lideresenseguros.com`
   - Debe tener registros en `fortnight_broker_totals`
   - Si no existe, crear primero

---

## ✅ CHECKLIST DE VERIFICACIÓN

- [ ] Script ejecutado sin errores
- [ ] `SELECT SUM(total_amount) FROM comm_imports` = $10,681.22
- [ ] Broker LISSA existe en BD
- [ ] Broker LISSA tiene comisiones en `fortnight_broker_totals`
- [ ] Total Importado muestra $10,681.22 en UI
- [ ] Ganancia Oficina es positiva y razonable
- [ ] Tabla por aseguradora muestra % en verde

---

**Si todo está correcto, la Ganancia Oficina debe ser:**
```
Ganancia = Total Reportado - Pagado a Externos
         = $10,681.22 - $X,XXX.XX (externos)
         = $X,XXX.XX (positivo y mayor a comisiones LISSA)
```
