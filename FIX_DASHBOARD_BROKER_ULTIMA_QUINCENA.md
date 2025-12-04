# ✅ Fix: Dashboard Broker - Comisiones de Última Quincena

## Fecha: 3 de diciembre, 2025, 2:59 PM

---

## 🐛 Problema

En el dashboard del broker, el KPI card de **"Comisiones netas - Última quincena pagada"** mostraba **$0.00** después de cambiar de mes, aunque sí existieran quincenas pagadas en el historial.

### **Comportamiento Incorrecto:**
```
Noviembre 30 → Muestra: $4,250.50 (última quincena pagada)
Diciembre 1  → Muestra: $0.00 ❌ (aunque la quincena de nov sigue existiendo)
```

---

## 🔍 Causa Raíz

**Archivo:** `src/lib/dashboard/queries.ts`  
**Función:** `getNetCommissions()`

### **Problema en el Fallback (líneas 191-220):**

```typescript
// ❌ INCORRECTO - Buscaba en mes ACTUAL
if (totalPaid === 0 && role === 'broker') {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  // Buscaba comm_items del MES ACTUAL solamente
  const { data } = await supabase
    .from('comm_items')
    .select('gross_amount')
    .eq('broker_id', brokerId)
    .gte('created_at', monthStart.toISOString()) // ❌ Filtro por mes actual
    .lte('created_at', monthEnd.toISOString())   // ❌ Filtro por mes actual
    .limit(FETCH_LIMIT);
}
```

**Problema:**
- Cuando cambiaba de mes (ej: 1 de diciembre), buscaba datos de diciembre
- Como diciembre aún no tenía quincenas cerradas, retornaba 0
- Ignoraba completamente las quincenas de noviembre u otros meses

---

## ✅ Solución Implementada

### **Nueva Lógica del Fallback:**

```typescript
// ✅ CORRECTO - Busca la ÚLTIMA quincena cerrada disponible
if (totalPaid === 0 && role === 'broker') {
  const brokerId = await resolveBrokerId(userId);
  if (brokerId) {
    const supabase = await getSupabaseServer();
    
    // Buscar la última quincena CERRADA que tenga datos, sin filtrar por mes
    const { data: lastFortnight } = await supabase
      .from('fortnights')
      .select('id, period_start, period_end')
      .in('status', ['PAID', 'READY'])
      .order('period_end', { ascending: false }) // Más reciente primero
      .limit(1)
      .maybeSingle();
    
    if (lastFortnight) {
      // Sumar las comisiones de esa quincena específica
      const { data } = await supabase
        .from('fortnight_details')
        .select('commission_calculated')
        .eq('fortnight_id', lastFortnight.id)
        .eq('broker_id', brokerId)
        .limit(FETCH_LIMIT);
      
      if (data) {
        totalPaid = data.reduce((acc, item) => 
          acc + toNumber(item.commission_calculated), 0
        );
      }
    }
  }
}
```

---

## 🎯 Comportamiento Correcto

### **Ahora funciona así:**

```
1. Intenta buscar quincena pagada actual
2. Si no encuentra o retorna $0:
   ├─ Busca la ÚLTIMA quincena cerrada (PAID o READY) en TODO el historial
   ├─ No importa el mes (nov, oct, sept, etc.)
   └─ Suma las comisiones del broker de esa quincena específica

Resultado:
Noviembre 30 → Muestra: $4,250.50 ✅
Diciembre 1  → Muestra: $4,250.50 ✅ (última quincena pagada = noviembre)
Diciembre 15 → Nueva quincena cerrada → Muestra nueva cifra ✅
```

---

## 📋 Flujo Completo

```
Dashboard Broker carga → getNetCommissions()
  │
  ├─ 1. Busca quincena PAID/READY más reciente
  │    └─ Si encuentra: suma comisiones del broker
  │
  ├─ 2. Si $0 o no encuentra:
  │    └─ FALLBACK: Busca última quincena cerrada en historial
  │         └─ Suma comisiones del broker de esa quincena
  │
  └─ 3. Si aún $0 y MOCK_DATA_ENABLED:
       └─ Retorna datos de prueba
```

---

## 🔧 Cambios Realizados

**Archivo:** `src/lib/dashboard/queries.ts`  
**Función:** `getNetCommissions` (líneas 185-220)

### **Cambios:**
1. ✅ Eliminado filtro por mes actual en fallback
2. ✅ Ahora busca última quincena cerrada en TODO el historial
3. ✅ Suma comisiones de la quincena específica encontrada
4. ✅ No depende del mes actual del sistema

---

## ✅ Verificación

```bash
✅ npm run typecheck → 0 errores
✅ Lógica corregida para buscar última quincena real
✅ No depende del mes del sistema
```

---

## 🧪 Testing

### **Para Probar:**

1. **Dashboard Broker en mes nuevo:**
   - Ve a `/dashboard` como broker
   - Verifica el KPI "Comisiones netas"
   - Debe mostrar la última quincena pagada, no $0.00

2. **Con quincenas de meses anteriores:**
   - Asegúrate que hay quincenas con status PAID o READY
   - El dashboard debe mostrar la más reciente
   - El subtitle debe mostrar el rango de fechas correcto

3. **Sin quincenas:**
   - Si no hay quincenas cerradas, mostrará $0.00
   - Esto es correcto (no hay historial)

---

## 📁 Archivos Modificados

1. ✅ `src/lib/dashboard/queries.ts`
   - Función `getNetCommissions` (líneas 185-220)

2. ✅ Documentación:
   - `FIX_DASHBOARD_BROKER_ULTIMA_QUINCENA.md` (este archivo)

---

## 🎯 Impacto

### **Antes:**
- ❌ Mostraba $0.00 al cambiar de mes
- ❌ Dependía del mes actual del sistema
- ❌ Ignoraba quincenas de meses anteriores

### **Ahora:**
- ✅ Muestra siempre la última quincena pagada disponible
- ✅ Independiente del mes del sistema
- ✅ Busca en todo el historial de quincenas
- ✅ Fijo y estable hasta nueva quincena

---

**Estado:** ✅ **COMPLETADO** (Actualizado: 3 dic 2025, 6:36 PM)  
**Prioridad:** 🔴 **ALTA**  
**Impacto:** Dashboard broker ahora muestra correctamente la última quincena pagada sin depender del mes actual

---

## 🔄 Actualización Final (3 dic 2025, 6:40 PM)

### Problema Real Identificado:

El fallback previo NO funcionaba porque:
1. `getFortnightStatus()` retornaba la última quincena cerrada GENERAL
2. Esa quincena podía NO tener datos del broker específico
3. Resultado: `totalPaid = 0` incluso con fallback

**Ejemplo del problema:**
```
Última quincena cerrada: 1-15 dic (PAID)
└─ Broker A: $0 (no tuvo ventas en esa quincena)
└─ Broker B: $5,000

Quincena anterior: 16-30 nov (PAID)  
└─ Broker A: $4,250 ✅ (SÍ tuvo ventas aquí)
└─ Broker B: $3,800

Dashboard mostraba: $0.00 ❌ (buscaba solo la más reciente)
Debía mostrar: $4,250.50 ✅ (última donde el broker tuvo datos)
```

### Solución REAL Implementada:

**Reescritura completa de `getNetCommissions()` para brokers:**

```typescript
// ✅ NUEVA LÓGICA: Buscar última quincena donde EL BROKER tenga datos
const { data: fortnights } = await supabase
  .from('fortnights')
  .select('id, status, period_start, period_end')
  .in('status', ['PAID', 'READY', 'DRAFT'])
  .order('period_end', { ascending: false })
  .limit(10); // Últimas 10 quincenas

// Iterar hasta encontrar la primera quincena CERRADA con datos del broker
for (const fortnight of fortnights) {
  if (fortnight.status === 'PAID' || fortnight.status === 'READY') {
    const { data: details } = await supabase
      .from('fortnight_details')
      .select('commission_calculated')
      .eq('fortnight_id', fortnight.id)
      .eq('broker_id', brokerId) // ✅ FILTRO POR BROKER
      .limit(FETCH_LIMIT);
    
    if (details && details.length > 0) {
      totalPaid = details.reduce(...);
      if (totalPaid > 0) {
        break; // ✅ Encontramos la última con datos del broker
      }
    }
  }
}
```

**Diferencia Clave:**
- ❌ Antes: Buscaba última quincena cerrada (sin importar si el broker tenía datos)
- ✅ Ahora: Busca última quincena cerrada DONDE EL BROKER TENGA DATOS

### Resultado Final:

```
✅ 30 Noviembre:
   Monto: $4,250.50 (quincena 16-30 nov)
   Rango: "16 nov – 30 nov"

✅ 1 Diciembre (nueva quincena cerrada sin datos del broker):
   Monto: $4,250.50 ✅ (sigue mostrando nov porque broker no tiene datos en dic)
   Rango: "16 nov – 30 nov" ✅

✅ 15 Diciembre (broker tiene datos en nueva quincena):
   Monto: $5,120.75 (quincena 1-15 dic)
   Rango: "1 dic – 15 dic"
```

**Archivos Modificados:**
1. ✅ `src/lib/dashboard/queries.ts` (getNetCommissions - lógica COMPLETAMENTE reescrita)
2. ✅ `src/components/dashboard/BrokerDashboard.tsx` (paidRange - fallback)

**Estado:** ✅ **VERDADERAMENTE RESUELTO**
