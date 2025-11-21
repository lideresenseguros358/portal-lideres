# 📊 CONTADORES Y GRÁFICAS - EXPLICACIÓN COMPLETA

## 🎯 Conceptos Clave

### 1. **Production (PMA)**
- **Fuente:** Tabla `production` 
- **Fórmula:** `bruto - canceladas`
- **Qué representa:** Total de prima anual que PRODUCE la oficina
- **Quién lo ve:** Master (principalmente)

### 2. **Commissions Gross (Comisiones Brutas a Brokers)**
- **Fuente:** Tabla `comm_items` campo `gross_amount`
- **Fórmula:** `commission_raw * percent_broker`
- **Qué representa:** Monto de comisión que RECIBE cada broker (después de aplicar su %)
- **Quién lo ve:** Master y Broker

### 3. **Commissions Net (Comisiones Netas)**
- **Fuente:** Tabla `fortnight_broker_totals` campo `net_amount`
- **Fórmula:** `gross_amount - adelantos - descuentos`
- **Qué representa:** Monto FINAL que se paga al broker
- **Quién lo ve:** Master y Broker

---

## 📱 DASHBOARD MASTER

### **Bloque 1: Producción**

#### **KPI: "PMA Total año en curso"**
```typescript
// Archivo: src/lib/dashboard/queries.ts
// Función: getProductionData()
const totalPMA = production.reduce((acc, item) => {
  const bruto = toNumber(item.bruto);
  const canceladas = toNumber(item.canceladas);
  return acc + (bruto - canceladas);
}, 0);
```
✅ **CORRECTO** - Suma la producción total (bruto - canceladas)

#### **Gráfica: "Barras Mensuales YTD"**
```typescript
// Archivo: src/lib/dashboard/queries.ts
// Función: getYtdComparison()
// Fuente: production (bruto - canceladas) por mes
```
✅ **CORRECTO** - Muestra producción mensual

#### **Ranking: "Top 5 Corredores"**
```typescript
// Archivo: src/lib/dashboard/queries.ts
// Función: getBrokerRanking()
// Fuente: production (bruto - canceladas) acumulado
```
✅ **CORRECTO** - Ranking basado en producción

---

### **Bloque 2: Finanzas**

#### **KPI: "Última Quincena Pagada"**
```typescript
// Archivo: src/lib/dashboard/queries.ts
// Función: getFinanceData()
const lastPaidAmount = fortnight_broker_totals
  .filter(f => fortnight_id === lastPaidFortnightId)
  .reduce((sum, t) => sum + net_amount, 0);
```
✅ **CORRECTO** - Suma neto pagado en última quincena

#### **KPI: "Acumulado anual"**
```typescript
// Archivo: src/lib/dashboard/queries.ts
// Función: getFinanceData()
const annualAccumulated = fortnight_broker_totals
  .filter(f => fortnight.status === 'PAID' && fortnight.year === currentYear)
  .reduce((sum, t) => sum + net_amount, 0);
```
✅ **CORRECTO** - Suma neto pagado de quincenas PAID del año

---

## 📱 DASHBOARD BROKER

### **KPI: "Acumulado anual neto"**
```typescript
// Archivo: src/lib/dashboard/queries.ts
// Función: getAnnualNet(userId, 'broker')
const value = production
  .filter(p => broker_id === userBrokerId)
  .reduce((acc, item) => acc + (bruto - canceladas), 0);
```
⚠️ **PROBLEMA DETECTADO** - Está leyendo de `production` (PMA total) en lugar de comisiones

**Debería ser:**
```typescript
const value = comm_items
  .filter(c => broker_id === userBrokerId && year === currentYear)
  .reduce((acc, item) => acc + gross_amount, 0);
```

---

## 📊 SECCIÓN ACUMULADO (YTD Tab)

### **Gráficas en YTDTab.tsx**

#### **Total Anual (Bruto)**
```typescript
// Archivo: src/components/commissions/YTDTab.tsx
// Acción: actionGetYTDCommissions()
// Fuente: comm_items.gross_amount
const totalCurrent = comm_items
  .filter(year === selected_year && broker_id === user_broker)
  .reduce((sum, item) => sum + gross_amount, 0);
```
✅ **CORRECTO** - Suma comisiones brutas del broker

#### **Gráfica Mensual**
```typescript
// Agrupado por mes de created_at
monthlyData = comm_items
  .groupBy(month(created_at))
  .sum(gross_amount);
```
✅ **CORRECTO** - Muestra comisiones brutas mensuales

#### **Gráfica por Aseguradora**
```typescript
// Agrupado por insurer_name
insurerData = comm_items
  .groupBy(insurer_name)
  .sum(gross_amount);
```
✅ **CORRECTO** - Muestra comisiones brutas por aseguradora

---

## 🔧 CORRECCIONES NECESARIAS

### **1. Dashboard Broker - "Acumulado anual neto"**

**Ubicación:** `src/lib/dashboard/queries.ts` línea 204-235

**Problema:** Lee de `production` (PMA) en lugar de comisiones

**Solución:** Cambiar para leer de `comm_items`

```typescript
// ANTES (INCORRECTO):
export async function getAnnualNet(userId: string, role: DashboardRole): Promise<AnnualNet> {
  let query = supabase
    .from("production")
    .select("bruto, canceladas")
    .eq("year", CURRENT_YEAR);
  
  if (brokerId) {
    query = query.eq("broker_id", brokerId);
  }
  
  const value = data.reduce((acc, item) => {
    return acc + (bruto - canceladas);
  }, 0);
}

// DESPUÉS (CORRECTO):
export async function getAnnualNet(userId: string, role: DashboardRole): Promise<AnnualNet> {
  const brokerId = role === "broker" ? await resolveBrokerId(userId) : null;
  
  if (role === "broker" && brokerId) {
    // Para brokers: suma comisiones brutas del año
    const yearStart = `${CURRENT_YEAR}-01-01T00:00:00.000Z`;
    const yearEnd = `${CURRENT_YEAR}-12-31T23:59:59.999Z`;
    
    const { data } = await supabase
      .from("comm_items")
      .select("gross_amount")
      .eq("broker_id", brokerId)
      .gte("created_at", yearStart)
      .lte("created_at", yearEnd);
    
    const value = (data || []).reduce((acc, item) => {
      return acc + toNumber(item.gross_amount);
    }, 0);
    
    return { value };
  }
  
  // Para master: suma producción total (como antes)
  let query = supabase
    .from("production")
    .select("bruto, canceladas")
    .eq("year", CURRENT_YEAR);
  
  const value = data.reduce((acc, item) => {
    return acc + (toNumber(item.bruto) - toNumber(item.canceladas));
  }, 0);
  
  return { value };
}
```

---

## ✅ RESUMEN DE FUENTES DE DATOS

| Contador | Fuente | Rol | Correcto |
|----------|--------|-----|----------|
| **PMA Total** | production (bruto - canceladas) | Master | ✅ |
| **Última Quincena Pagada** | fortnight_broker_totals (net_amount) | Master | ✅ |
| **Acumulado Anual (Master)** | fortnight_broker_totals (net_amount PAID) | Master | ✅ |
| **Acumulado Anual (Broker)** | production (bruto - canceladas) | Broker | ❌ Debe ser comm_items |
| **YTD Total** | comm_items (gross_amount) | Ambos | ✅ |
| **YTD Mensual** | comm_items (gross_amount) | Ambos | ✅ |
| **YTD por Aseguradora** | comm_items (gross_amount) | Ambos | ✅ |
| **Ranking Brokers** | production (bruto - canceladas) | Master | ✅ |

---

## 📋 DIFERENCIAS CONCEPTUALES

### **Para MASTER:**
1. **PMA** = Lo que produce la oficina (bruto - canceladas)
2. **Comisiones Pagadas** = Lo que se paga a brokers (net_amount)
3. **Diferencia** = Ganancia oficina + costos

### **Para BROKER:**
1. **Producción** = Lo que el broker produce (bruto - canceladas)
2. **Comisiones Brutas** = Lo que le corresponde (gross_amount después de %)
3. **Comisiones Netas** = Lo que recibe (después de adelantos)

---

## 🎯 Qué Mostrar en Cada Vista

### **Dashboard Master:**
- **PMA Total**: Muestra producción total ✅
- **Acumulado Anual**: Muestra lo PAGADO a brokers (net) ✅
- **Ranking**: Basado en producción (PMA) ✅

### **Dashboard Broker:**
- **Acumulado Anual**: Debe mostrar comisiones BRUTAS del broker ❌ (necesita corrección)

### **Sección Acumulado (ambos roles):**
- **Total Anual**: Comisiones brutas (gross_amount) ✅
- **Gráficas**: Comisiones brutas agrupadas ✅

---

¿Aplicamos la corrección al Dashboard Broker?
