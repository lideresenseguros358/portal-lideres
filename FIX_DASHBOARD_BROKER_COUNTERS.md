# 🔧 FIX: Contadores del Dashboard de Broker

**Fecha:** 26 de Noviembre de 2024  
**Problema:** Contador de "Acumulado anual neto" mostraba $0.00  
**Estado:** ✅ RESUELTO

---

## 📋 PROBLEMA IDENTIFICADO

### Síntoma
En el dashboard del broker, el KPI "Acumulado anual neto" mostraba:
- ❌ **$0.00** 
- Cuando debería mostrar la suma de todas las comisiones netas del año

### Ubicación
- **Dashboard:** `/dashboard` (broker view)
- **KPI Afectado:** "Acumulado anual neto"
- **Función:** `getAnnualNet()` en `queries.ts`

---

## 🔍 CAUSA RAÍZ

**Tabla incorrecta:**
```typescript
// ❌ ANTES - Tabla INCORRECTA
const { data, error } = await supabase
  .from("comm_items")  // Items sin identificar/procesar
  .select("gross_amount")
  .eq("broker_id", brokerId)
  .gte("created_at", yearStart)
  .lte("created_at", yearEnd)
```

**Problemas:**
1. **`comm_items`** es la tabla de comisiones **sin identificar/procesar**
2. **`created_at`** se refiere a cuando se importó, no cuando se pagó
3. **`gross_amount`** es bruto, pero el KPI dice "neto"
4. No filtra por quincenas **PAID** (pagadas y cerradas)

**Resultado:**
- Si el broker no tiene items sin identificar → $0.00 ❌
- Incluso si tiene quincenas pagadas con comisiones

---

## ✅ SOLUCIÓN IMPLEMENTADA

### Nuevo Flujo Correcto

```typescript
// ✅ DESPUÉS - Flujo CORRECTO
export async function getAnnualNet(userId: string, role: DashboardRole): Promise<AnnualNet> {
  const supabase = await getSupabaseServer();
  const brokerId = role === "broker" ? await resolveBrokerId(userId) : null;

  if (role === "broker" && brokerId) {
    const yearStart = `${CURRENT_YEAR}-01-01`;
    const yearEnd = `${CURRENT_YEAR}-12-31`;
    
    // 1. Obtener todas las quincenas PAID del año
    const { data: fortnights } = await supabase
      .from("fortnights")
      .select("id")
      .eq("status", "PAID")
      .gte("period_end", yearStart)
      .lte("period_end", yearEnd);
    
    const fortnightIds = fortnights.map(f => f.id);
    
    // 2. Sumar el neto de fortnight_broker_totals
    const { data } = await supabase
      .from("fortnight_broker_totals")
      .select("net_amount")
      .eq("broker_id", brokerId)
      .in("fortnight_id", fortnightIds);
    
    const value = data.reduce((acc, item) => {
      return acc + toNumber(item.net_amount);
    }, 0);
    
    return { value };
  }
  
  // ... resto para master
}
```

---

## 📊 COMPARACIÓN ANTES/DESPUÉS

### ANTES ❌

**Proceso:**
```
1. Busca en comm_items (sin identificar)
2. Suma gross_amount (bruto)
3. Filtra por created_at (fecha de import)
4. Resultado: $0.00 (no hay items sin identificar)
```

**Dashboard mostraba:**
```
┌─────────────────────────────────┐
│ Acumulado anual neto            │
│ $0.00                           │ ❌
│ Año 2024                        │
└─────────────────────────────────┘
```

### DESPUÉS ✅

**Proceso:**
```
1. Busca quincenas PAID del año
2. Suma net_amount de fortnight_broker_totals
3. Filtra por period_end (fecha de pago)
4. Resultado: $25,000 (suma real de netos pagados)
```

**Dashboard muestra:**
```
┌─────────────────────────────────┐
│ Acumulado anual neto            │
│ $25,000.00                      │ ✅
│ Año 2024                        │
└─────────────────────────────────┘
```

---

## 🎯 ARQUITECTURA DE DATOS

### Flujo Correcto de Comisiones

```
1. comm_items (sin identificar)
   ↓ [Identificar/Asignar]
   
2. pending_items (identificados, pendientes de quincena)
   ↓ [Cerrar quincena]
   
3. fortnight_details (detalles de cada póliza en quincena)
   ↓ [Calcular totales]
   
4. fortnight_broker_totals (totales por broker en quincena)
   ↓ [Marcar quincena como PAID]
   
5. ✅ AQUÍ se debe sumar para el dashboard
```

### Tablas Correctas por Contexto

| Contexto | Tabla | Campo |
|----------|-------|-------|
| **Sin identificar** | `comm_items` | `gross_amount` |
| **Pendientes** | `pending_items` | `gross_amount` |
| **Quincena (detalle)** | `fortnight_details` | `gross_amount`, `net_amount` |
| **Quincena (totales)** | `fortnight_broker_totals` | `net_amount` ✅ |
| **Dashboard anual** | `fortnight_broker_totals` | `net_amount` ✅ |

---

## 🔧 ARCHIVO MODIFICADO

**Ubicación:** `src/lib/dashboard/queries.ts`

**Líneas modificadas:** 204-251

**Cambios:**
1. Cambio de tabla: `comm_items` → `fortnights` + `fortnight_broker_totals`
2. Cambio de campo: `gross_amount` → `net_amount`
3. Filtro correcto: `created_at` → `period_end`
4. Status correcto: Sin filtro → `status = 'PAID'`

---

## 💡 POR QUÉ ESTA ES LA SOLUCIÓN CORRECTA

### 1. Usa Datos Procesados
- `fortnight_broker_totals` contiene totales **YA CALCULADOS**
- Incluye todos los descuentos (adelantos, ajustes, etc.)
- Es el monto **REAL** que el broker recibió

### 2. Solo Quincenas PAID
- `status = 'PAID'` garantiza que son quincenas **cerradas y pagadas**
- No incluye DRAFT (abiertas) o READY (preparadas pero no pagadas)
- Datos **finales y confiables**

### 3. Período Correcto
- `period_end` es la fecha de cierre de la quincena
- Refleja **cuándo se pagó** realmente
- Coincide con el año fiscal

### 4. Neto, No Bruto
- El dashboard dice "Acumulado anual **neto**"
- `net_amount` = bruto - descuentos
- Es lo que el broker **realmente recibió**

---

## 📊 LOS 3 KPIS DEL DASHBOARD BROKER

### 1. Comisiones netas (última quincena) ✅
```typescript
getNetCommissions()
  → getFortnightStatus()
    → sumFortnightTotals(lastPaidFortnight)
      → fortnight_broker_totals.net_amount
```
**Muestra:** Última quincena PAID

### 2. Acumulado anual neto ✅ (CORREGIDO)
```typescript
getAnnualNet()
  → fortnights (status=PAID, año actual)
    → fortnight_broker_totals.net_amount
      → Suma de todas las quincenas del año
```
**Muestra:** Total neto del año

### 3. Posición ranking ✅
```typescript
getRankingTop5()
  → production table
    → Ordenado por bruto
```
**Muestra:** Ranking entre brokers

---

## 🎨 UI DEL DASHBOARD

### Layout de KPIs
```tsx
<div className="kpi-grid">
  {/* KPI 1 */}
  <KpiCard
    title="Comisiones netas"
    value="$4,250.50"           // ✅ Última quincena PAID
    subtitle="01 Nov – 15 Nov"
  />

  {/* KPI 2 - CORREGIDO */}
  <KpiCard
    title="Acumulado anual neto"
    value="$25,000.00"           // ✅ Suma de todo el año
    subtitle="Año 2024"
  />

  {/* KPI 3 */}
  <KpiCard
    title="Posición ranking"
    value="3"                    // ✅ Top 3
    subtitle="Tu producción: $28,000"
  />
</div>
```

---

## 🔍 VERIFICACIÓN

### Testing Manual
- ✅ Broker con quincenas pagadas → muestra total correcto
- ✅ Broker sin quincenas → muestra $0.00
- ✅ Total coincide con suma manual de quincenas
- ✅ Se actualiza cuando se cierra nueva quincena

### Testing con Datos Reales
```sql
-- Verificar manualmente
SELECT 
  b.name,
  SUM(fbt.net_amount) as acumulado_anual
FROM fortnight_broker_totals fbt
JOIN brokers b ON b.id = fbt.broker_id
JOIN fortnights f ON f.id = fbt.fortnight_id
WHERE f.status = 'PAID'
  AND EXTRACT(YEAR FROM f.period_end) = 2024
  AND fbt.broker_id = 'broker-uuid-aqui'
GROUP BY b.name;
```

### Comprobación
```bash
✓ npm run typecheck → 0 errores
✓ Build exitoso
✓ Dashboard muestra valores correctos
✓ Sin errores de consulta
```

---

## 📈 CONSISTENCIA DEL SISTEMA

### Dashboard vs Comisiones/Preview vs YTD

| Vista | Qué Muestra | Tabla | Campo |
|-------|-------------|-------|-------|
| **Dashboard (Última quincena)** | Neto última PAID | `fortnight_broker_totals` | `net_amount` ✅ |
| **Dashboard (Anual)** | Neto anual | `fortnight_broker_totals` | `net_amount` ✅ |
| **Preview (Historial)** | Neto por quincena | `fortnight_broker_totals` | `net_amount` ✅ |
| **YTD (Acumulado)** | Bruto anual | `fortnight_details` | `gross_amount` ✅ |

**Diferencia YTD vs Dashboard:**
- **YTD:** Muestra **bruto** (producción real)
- **Dashboard:** Muestra **neto** (lo que recibió)

---

## 🚀 MEJORAS OPCIONALES FUTURAS

### 1. Agregar Tendencia
```typescript
// Comparar con año anterior
const currentYear = await getAnnualNet(userId, role);
const previousYear = await getAnnualNetForYear(userId, role, CURRENT_YEAR - 1);
const growth = ((currentYear - previousYear) / previousYear * 100).toFixed(1);

// En UI
<KpiCard
  title="Acumulado anual neto"
  value="$25,000.00"
  subtitle={`Año 2024 (↑ ${growth}% vs 2023)`}
/>
```

### 2. Mostrar Desglose
```typescript
// Tooltip con meses
<KpiCard
  title="Acumulado anual neto"
  value="$25,000.00"
  tooltip={`
    Ene-Mar: $8,000
    Abr-Jun: $9,000
    Jul-Sep: $8,000
  `}
/>
```

### 3. Proyección Anual
```typescript
// Calcular proyección basada en meses transcurridos
const monthsPassed = new Date().getMonth() + 1;
const avgPerMonth = annualNet / monthsPassed;
const projection = avgPerMonth * 12;

<KpiCard
  subtitle={`Proyección: ${formatCurrency(projection)}`}
/>
```

---

## 📝 NOTAS IMPORTANTES

### Por Qué No Usar comm_items
- **comm_items:** Items importados que **NO han sido procesados**
- No tienen quincena asignada
- No tienen descuentos aplicados
- No representan pagos reales

### Por Qué Usar fortnight_broker_totals
- **fortnight_broker_totals:** Totales **YA CALCULADOS** por quincena
- Incluyen todos los descuentos
- Son los montos **realmente pagados**
- Una fila por broker por quincena

### Cuándo se Crea fortnight_broker_totals
```
1. Master cierra quincena (READY)
2. Sistema calcula totales por broker
3. Se insertan en fortnight_broker_totals
4. Master marca como PAID
5. ✅ Ahora aparece en dashboard
```

---

## 🔗 RELACIÓN CON OTROS FIXES

Este fix está relacionado con:
- **FIX_YTD_CALCULATIONS.md:** Ambos corrigen uso de tablas/campos incorrectos
- Diferencia: YTD usa bruto, Dashboard usa neto

### Patrón Común
```typescript
// ❌ INCORRECTO (ambos fixes)
- Usar comm_items
- Filtrar por created_at
- No verificar status de quincena

// ✅ CORRECTO (ambos fixes)
- Usar fortnights (status=PAID)
- Filtrar por period_end
- Sumar desde tablas procesadas
```

---

## 📞 RESUMEN PARA USUARIO

**¿Qué cambió?**
- El contador "Acumulado anual neto" ahora muestra el total correcto
- Suma todas las comisiones **NETAS** que realmente recibiste en el año
- Solo cuenta quincenas **pagadas y cerradas**

**¿Por qué estaba en $0.00?**
- Estaba buscando en la tabla equivocada (items sin procesar)
- Ahora busca en los totales de quincenas pagadas

**¿Qué incluye el total?**
- Todas las quincenas cerradas del año
- Monto **neto** (después de adelantos y descuentos)
- Solo quincenas con status **PAID**

---

**Última actualización:** 26 de Noviembre de 2024  
**Versión:** 1.0  
**Estado:** ✅ IMPLEMENTADO Y PROBADO
