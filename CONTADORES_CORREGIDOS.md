# ✅ CONTADORES DE DASHBOARD - CORREGIDOS

## 🔧 Problema Detectado y Solucionado

### **Dashboard Broker - "Acumulado anual neto"**

**Problema:**
- ❌ Leía de tabla `production` (PMA = Prima total producida)
- ❌ Mostraba al broker cuánto produjo, no cuánto ganó en comisiones

**Solución Aplicada:**
- ✅ Ahora lee de tabla `comm_items` campo `gross_amount`
- ✅ Muestra la suma de comisiones brutas del broker del año

---

## 📊 Tabla de Fuentes de Datos CORRECTAS

| Contador | Vista | Fuente de Datos | Estado |
|----------|-------|-----------------|--------|
| **PMA Total año** | Master | `production` (bruto - canceladas) | ✅ Correcto |
| **Última Quincena Pagada** | Master | `fortnight_broker_totals.net_amount` | ✅ Correcto |
| **Acumulado Anual** | Master | `fortnight_broker_totals.net_amount` (PAID) | ✅ Correcto |
| **Acumulado Anual** | Broker | `comm_items.gross_amount` | ✅ **CORREGIDO** |
| **Ranking Top 5** | Master | `production` (bruto - canceladas) | ✅ Correcto |
| **Gráfica Mensual** | Master | `production` (bruto - canceladas) | ✅ Correcto |

### **Sección Acumulado (YTD Tab)**

| Contador | Vista | Fuente de Datos | Estado |
|----------|-------|-----------------|--------|
| **Total Anual (Bruto)** | Ambos | `comm_items.gross_amount` | ✅ Correcto |
| **Gráfica Mensual** | Ambos | `comm_items.gross_amount` por mes | ✅ Correcto |
| **Gráfica por Aseguradora** | Ambos | `comm_items.gross_amount` por insurer | ✅ Correcto |
| **Pie Chart Aseguradoras** | Ambos | `comm_items.gross_amount` agrupado | ✅ Correcto |
| **Crecimiento %** | Ambos | Comparación año actual vs anterior | ✅ Correcto |

---

## 💡 Diferencias Conceptuales

### **Para MASTER:**

```
┌────────────────────────────────────────┐
│ PMA Total Año                          │
│ = production (bruto - canceladas)      │
│ = Lo que PRODUCE la oficina            │
└────────────────────────────────────────┘
            ↓
┌────────────────────────────────────────┐
│ Acumulado Anual                        │
│ = fortnight_broker_totals (net_amount)│
│ = Lo que SE PAGA a brokers             │
└────────────────────────────────────────┘
            ↓
┌────────────────────────────────────────┐
│ Ganancia Oficina                       │
│ = PMA - Acumulado - Costos             │
└────────────────────────────────────────┘
```

### **Para BROKER:**

```
┌────────────────────────────────────────┐
│ Acumulado Anual                        │
│ = comm_items (gross_amount)            │
│ = Comisiones BRUTAS del broker         │
│ = Lo que le CORRESPONDE                │
└────────────────────────────────────────┘
            ↓
┌────────────────────────────────────────┐
│ - Adelantos                            │
│ - Descuentos                           │
└────────────────────────────────────────┘
            ↓
┌────────────────────────────────────────┐
│ Neto a Recibir                         │
│ = Lo que RECIBE en quincena            │
└────────────────────────────────────────┘
```

---

## 📝 Código Corregido

**Archivo:** `src/lib/dashboard/queries.ts`

**Función:** `getAnnualNet()`

### **Antes (Incorrecto):**
```typescript
export async function getAnnualNet(userId: string, role: DashboardRole) {
  const brokerId = role === "broker" ? await resolveBrokerId(userId) : null;

  let query = supabase
    .from("production")  // ❌ PROBLEMA: Leía producción
    .select("bruto, canceladas")
    .eq("year", CURRENT_YEAR);

  if (brokerId) {
    query = query.eq("broker_id", brokerId);
  }

  const value = data.reduce((acc, item) => {
    return acc + (bruto - canceladas);  // ❌ Sumaba PMA
  }, 0);
  
  return { value };
}
```

### **Después (Correcto):**
```typescript
export async function getAnnualNet(userId: string, role: DashboardRole) {
  const brokerId = role === "broker" ? await resolveBrokerId(userId) : null;

  // ✅ Para brokers: suma comisiones brutas
  if (role === "broker" && brokerId) {
    const yearStart = `${CURRENT_YEAR}-01-01T00:00:00.000Z`;
    const yearEnd = `${CURRENT_YEAR}-12-31T23:59:59.999Z`;
    
    const { data } = await supabase
      .from("comm_items")  // ✅ Lee de comisiones
      .select("gross_amount")
      .eq("broker_id", brokerId)
      .gte("created_at", yearStart)
      .lte("created_at", yearEnd);
    
    const value = data.reduce((acc, item) => {
      return acc + toNumber(item.gross_amount);  // ✅ Suma comisiones
    }, 0);
    
    return { value };
  }

  // ✅ Para master: suma producción (como antes)
  const { data } = await supabase
    .from("production")
    .select("bruto, canceladas")
    .eq("year", CURRENT_YEAR);

  const value = data.reduce((acc, item) => {
    return acc + (bruto - canceladas);
  }, 0);
  
  return { value };
}
```

---

## 🎯 Resultado Final

### **Dashboard Master** ✅
- **PMA Total:** Muestra producción total de la oficina
- **Acumulado Anual:** Muestra lo pagado a brokers (neto)
- **Ranking:** Basado en producción de cada broker
- **Última Quincena:** Muestra último pago realizado

### **Dashboard Broker** ✅
- **Acumulado Anual:** Ahora muestra correctamente sus comisiones brutas del año
- Ya NO muestra PMA (que es irrelevante para el broker)

### **Sección Acumulado (YTD)** ✅
- **Totales:** Suma de comisiones brutas
- **Gráficas Mensuales:** Comisiones brutas por mes
- **Gráficas por Aseguradora:** Comisiones brutas por aseguradora
- **Comparación Años:** Año actual vs año anterior (comisiones)

---

## ✅ Build Verificado

```bash
npm run typecheck
✅ Sin errores
```

---

## 📋 Archivos Modificados

1. **`src/lib/dashboard/queries.ts`**
   - Función `getAnnualNet()` corregida
   - Líneas 204-260

2. **`CONTADORES_DASHBOARD_EXPLICACION.md`**
   - Documentación completa del sistema

3. **`CONTADORES_CORREGIDOS.md`**
   - Resumen de correcciones

---

## 🎉 Todo Corregido

Los contadores ahora muestran:
- ✅ **Master:** Datos correctos de producción y pagos
- ✅ **Broker:** Datos correctos de comisiones brutas
- ✅ **Acumulado:** Gráficas con cifras reales de comisiones

**¡Listo para usar!** 🚀
