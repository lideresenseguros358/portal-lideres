# 🔥 PROBLEMAS DETECTADOS Y SOLUCIONES

## 📋 Resumen de Problemas

1. ❌ **Historial de comisiones no muestra detalle de brokers**
2. ❌ **Bulk import solo crea clientes, no crea pólizas**

---

## 🔴 PROBLEMA 1: Historial No Muestra Brokers

### **Causa:**
El componente está correcto, pero probablemente:
- El array `brokers` llega vacío desde el backend
- Problema de caché del navegador

### **Verificación:**
Abrir DevTools (F12) → Console y buscar:
```javascript
// Debería ver logs como:
console.log('Brokers received:', brokers);
```

### **Solución Rápida:**
```bash
# 1. Limpiar caché
Ctrl + Shift + R

# 2. Si no funciona, rebuild:
rm -rf .next
npm run build
npm run dev
```

### **Verificar en Base de Datos:**
```sql
-- Verificar que existen totales de brokers:
SELECT 
  f.label,
  f.status,
  COUNT(fbt.id) as num_brokers,
  SUM(fbt.net_amount) as total_neto
FROM fortnights f
LEFT JOIN fortnight_broker_totals fbt ON fbt.fortnight_id = f.id
WHERE f.status IN ('PAID', 'READY')
GROUP BY f.id, f.label, f.status
ORDER BY f.period_end DESC
LIMIT 5;
```

Si no hay registros en `fortnight_broker_totals`, ese es el problema.

---

## 🔴 PROBLEMA 2: Bulk Import No Crea Pólizas

### **Causa Principal:**
El script **SÍ crea pólizas**, pero solo para registros que tienen un `broker_email` válido.

**Ubicación en el código:** `bulk-import-completo.mjs` líneas 229-254

```javascript
const brokerId = brokerEmail ? brokerMap.get(brokerEmail) : null;

if (!brokerId) {
  // ❌ Sin broker → solo crea pending_items
  // NO crea cliente ni póliza
  await supabase.from('pending_items').insert({...});
  continue; // ← SALTA todo lo demás
}

// ✅ Con broker → crea cliente y póliza
// Líneas 256-353: Crea cliente y póliza
```

### **El Problema:**
Si el `broker_email` en el CSV:
- ❌ **No existe** → Solo crea pending_item
- ❌ **No coincide** con ningún email en BD → Solo crea pending_item
- ❌ **Está vacío** → Solo crea pending_item
- ✅ **Coincide exactamente** → Crea cliente y póliza

### **Solución:**

#### **Opción 1: Corregir los Emails del CSV**
```csv
policy_number,client_name,broker_email,...
POL-001,Juan Pérez,juan@ejemplo.com,...
POL-002,Ana López,ana@ejemplo.com,...
```

Verificar que los emails coincidan EXACTAMENTE con los de la tabla `profiles`:
```sql
SELECT 
  b.id,
  b.name as broker_name,
  p.email
FROM brokers b
JOIN profiles p ON p.id = b.profile_id
WHERE b.active = true
ORDER BY b.name;
```

#### **Opción 2: Modificar el Script para Crear Pólizas Sin Broker**

**Archivo:** `scripts/bulk-import-completo.mjs`

**Cambio en línea 229-254:**

```javascript
// ANTES (NO crea póliza sin broker):
if (!brokerId) {
  await supabase.from('pending_items').insert({...});
  continue; // ← PROBLEMA: Se salta todo
}

// DESPUÉS (Crea póliza aún sin broker):
if (!brokerId) {
  // Crear pending_item
  await supabase.from('pending_items').insert({...});
  // NO hacer continue, seguir creando cliente y póliza
}

// Crear cliente SIN broker (o con broker default)
const { data: existingClient } = await supabase
  .from('clients')
  .select('id')
  .eq('name', clientNameNormalized)
  .maybeSingle(); // ← Cambiar: no filtrar por broker_id

let clientId = existingClient?.id;

if (!clientId) {
  const { data: newClient } = await supabase
    .from('clients')
    .insert({
      name: clientNameNormalized,
      broker_id: brokerId || null // ← Permitir null
    })
    .select('id')
    .single();
  
  clientId = newClient?.id;
}

// Crear póliza SIN broker (o con broker default)
const { data: existingPolicy } = await supabase
  .from('policies')
  .select('id, percent_override')
  .eq('policy_number', policyNumber)
  .maybeSingle();

let policyId = existingPolicy?.id;

if (!policyId) {
  const { data: newPolicy } = await supabase
    .from('policies')
    .insert({
      policy_number: policyNumber,
      broker_id: brokerId || null, // ← Permitir null
      client_id: clientId,
      insurer_id: insurerId,
      ramo: policyType || null,
      start_date: startDate,
      renewal_date: renewalDate,
      status: 'active'
    })
    .select('id')
    .single();
  
  policyId = newPolicy?.id;
}
```

#### **Opción 3: Asignar Broker por Defecto**

Si prefieres que todas las pólizas sin broker se asignen a un broker específico (ej: LISSA):

```javascript
const brokerId = brokerEmail 
  ? brokerMap.get(brokerEmail) 
  : lissaBrokerId; // ← Usar LISSA como default

// Ahora SIEMPRE habrá brokerId, todas las pólizas se crearán
```

---

## 🎯 Recomendaciones

### **Para el Problema de Historial:**

1. **Verificar datos:**
   ```sql
   SELECT * FROM fortnight_broker_totals 
   WHERE fortnight_id = 'tu-fortnight-id'
   LIMIT 10;
   ```

2. **Limpiar caché:**
   ```bash
   Ctrl + Shift + R
   ```

3. **Si persiste, rebuild:**
   ```bash
   rm -rf .next
   npm run build
   npm run dev
   ```

### **Para el Problema de Bulk Import:**

**Elección según tu caso de uso:**

| Escenario | Solución Recomendada |
|-----------|---------------------|
| Tienes emails correctos | Opción 1: Corregir CSV |
| Faltan algunos emails | Opción 2: Crear sin broker |
| Todas sin broker van a LISSA | Opción 3: Broker default |

---

## 📝 Código Corregido (Opción 2)

**Archivo:** `scripts/bulk-import-completo.mjs`

Reemplazar líneas 229-393 con:

```javascript
const brokerId = brokerEmail ? brokerMap.get(brokerEmail) : null;

// Crear pending_item si no hay broker
if (!brokerId) {
  const { error } = await supabase
    .from('pending_items')
    .insert({
      import_id: importRecord.id,
      policy_number: policyNumber,
      insured_name: clientNameNormalized,
      insurer_id: insurerId,
      commission_raw: commissionRaw,
      status: 'open'
    });
  
  if (error) {
    console.error(`❌ pending: ${policyNumber}`, error.message);
    errors++;
  } else {
    pending++;
    if (pending % 20 === 0) {
      console.log(`⏳ Pendientes: ${pending}...`);
    }
  }
  // NO hacer continue - seguir creando cliente y póliza
}

// CREAR/ACTUALIZAR CLIENTE (incluso sin broker)
const clientQuery = supabase
  .from('clients')
  .select('id')
  .eq('name', clientNameNormalized);

// Solo filtrar por broker si existe
if (brokerId) {
  clientQuery.eq('broker_id', brokerId);
}

const { data: existingClient } = await clientQuery.maybeSingle();

let clientId = existingClient?.id;

if (!clientId) {
  const { data: newClient, error: clientError } = await supabase
    .from('clients')
    .insert({
      name: clientNameNormalized,
      broker_id: brokerId || null
    })
    .select('id')
    .single();
  
  if (!clientError && newClient) {
    clientId = newClient.id;
  }
}

if (!clientId) {
  console.error(`❌ No se pudo crear cliente para ${policyNumber}`);
  errors++;
  continue;
}

// CREAR/ACTUALIZAR PÓLIZA (incluso sin broker)
const { data: existingPolicy } = await supabase
  .from('policies')
  .select('id, percent_override')
  .eq('policy_number', policyNumber)
  .single();

let policyId = existingPolicy?.id;
let percentOverride = existingPolicy?.percent_override;

// DETERMINAR PORCENTAJE
let percentToUse = 1.0;

if (policyType === 'VIDA' && insurerName === 'ASSA') {
  percentToUse = 1.0;
  percentOverride = 1.0;
} else if (percentOverride != null) {
  percentToUse = percentOverride;
} else if (brokerId) {
  percentToUse = brokerPercents.get(brokerId) || 1.0;
}

if (!policyId) {
  const policyPayload = {
    policy_number: policyNumber,
    broker_id: brokerId || null,
    client_id: clientId,
    insurer_id: insurerId,
    ramo: policyType || null,
    start_date: startDate,
    renewal_date: renewalDate,
    status: 'active'
  };
  
  if (policyType === 'VIDA' && insurerName === 'ASSA') {
    policyPayload.percent_override = 1.0;
  }
  
  const { data: newPolicy, error: policyError } = await supabase
    .from('policies')
    .insert(policyPayload)
    .select('id')
    .single();
  
  if (!policyError && newPolicy) {
    policyId = newPolicy.id;
  }
}

if (!policyId) {
  console.error(`❌ No se pudo crear póliza ${policyNumber}`);
  errors++;
  continue;
}

// CALCULAR COMISIÓN (solo si HAY broker)
if (brokerId) {
  const grossAmount = commissionRaw * percentToUse;
  
  const { error } = await supabase
    .from('comm_items')
    .insert({
      import_id: importRecord.id,
      broker_id: brokerId,
      policy_number: policyNumber,
      insured_name: clientNameNormalized,
      insurer_id: insurerId,
      gross_amount: grossAmount
    });
  
  if (error) {
    console.error(`❌ comm_items: ${policyNumber}`, error.message);
    errors++;
  } else {
    withBroker++;
    if (withBroker % 100 === 0) {
      console.log(`✅ Con broker: ${withBroker}...`);
    }
  }
}
```

---

## ✅ Resumen

| Problema | Causa | Solución |
|----------|-------|----------|
| **Historial sin brokers** | Caché o datos faltantes | Ctrl+Shift+R o verificar `fortnight_broker_totals` |
| **Bulk sin pólizas** | Script salta registros sin broker | Modificar script para crear pólizas sin broker |

---

¿Qué opción prefieres para el bulk import?
