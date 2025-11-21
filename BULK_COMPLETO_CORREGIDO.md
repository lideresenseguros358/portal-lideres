# ✅ BULK IMPORT COMPLETO - TODAS LAS CORRECCIONES APLICADAS

**Archivo corregido:** `scripts/bulk-import-completo.mjs`

---

## 🔧 Correcciones Aplicadas

### 1. ✅ Normalización de Nombres (Guiones → Espacios)

**Línea 40:**
```javascript
.replace(/-/g, ' ');  // Guiones → espacios
```

**Resultado:**
- `"González-López"` → `"GONZALEZ LOPEZ"` ✅
- `"Juan-Carlos"` → `"JUAN CARLOS"` ✅
- Todos los nombres sin ñ, sin acentos, guiones convertidos a espacios

---

### 2. ✅ Percent_Default de Brokers

**Línea 64:**
```javascript
const { data: brokers } = await supabase.from('brokers')
  .select('id, email, name, assa_code, percent_default');
```

**Línea 82:**
```javascript
brokerPercents.set(b.id, b.percent_default || 1.0);
```

**Línea 89:**
```javascript
return { insurerMap, brokerMap, brokerByAssaCode, brokerPercents, lissaBrokerId };
```

---

### 3. ✅ Crear/Actualizar Clientes con Nombres Normalizados

**Líneas 256-287:**
```javascript
// CREAR/ACTUALIZAR CLIENTE (NORMALIZADO)
const clientNameNormalized = normalizar(clientNameRaw).toUpperCase();

const { data: existingClient } = await supabase
  .from('clients')
  .select('id')
  .eq('name', clientNameNormalized)
  .eq('broker_id', brokerId)
  .single();

if (!clientId) {
  // Crear nuevo cliente con nombre normalizado
  await supabase.from('clients').insert({
    name: clientNameNormalized,
    broker_id: brokerId
  });
} else {
  // Actualizar nombre si tiene caracteres especiales
  if (clientNameRaw !== clientNameNormalized) {
    await supabase.from('clients')
      .update({ name: clientNameNormalized })
      .eq('id', clientId);
  }
}
```

**Resultado:**
- ✅ Clientes nuevos: nombres normalizados desde el inicio
- ✅ Clientes existentes: nombres actualizados automáticamente
- ✅ Base de datos se limpia automáticamente

---

### 4. ✅ Crear/Actualizar Pólizas

**Líneas 295-353:**
```javascript
// CREAR/ACTUALIZAR PÓLIZA
const { data: existingPolicy } = await supabase
  .from('policies')
  .select('id, percent_override')
  .eq('policy_number', policyNumber)
  .single();

if (!policyId) {
  // Crear nueva póliza
  const policyPayload = {
    policy_number: policyNumber,
    broker_id: brokerId,
    client_id: clientId,
    insurer_id: insurerId,
    ramo: policyType || null,
    start_date: startDate,
    renewal_date: renewalDate,
    status: 'active'
  };
  
  // Solo agregar percent_override si es VIDA ASSA
  if (policyType === 'VIDA' && insurerName === 'ASSA') {
    policyPayload.percent_override = 1.0;
  }
  
  await supabase.from('policies').insert(policyPayload);
} else {
  // Actualizar póliza existente si es VIDA ASSA
  if (policyType === 'VIDA' && insurerName === 'ASSA' && percentOverride !== 1.0) {
    await supabase.from('policies')
      .update({ percent_override: 1.0 })
      .eq('id', policyId);
  }
}
```

---

### 5. ✅ VIDA ASSA al 100%

**Líneas 305-316:**
```javascript
// DETERMINAR PORCENTAJE
let percentToUse = 1.0;

// Si es VIDA + ASSA → 100%
if (policyType === 'VIDA' && insurerName === 'ASSA') {
  percentToUse = 1.0;
  percentOverride = 1.0;
} else if (percentOverride != null) {
  percentToUse = percentOverride;
} else {
  percentToUse = brokerPercents.get(brokerId) || 1.0;
}
```

**Lógica:**
1. ✅ VIDA en ASSA → 100%
2. ✅ Si existe `percent_override` en póliza → usar ese
3. ✅ Si no → usar `percent_default` del broker

---

### 6. ✅ Códigos ASSA: Excluir Específicos

**Línea 414:**
```javascript
const codigosExcluir = ['PJ750', 'PJ750-1', 'PJ750-6', 'PJ750-9'];
```

**Líneas 476-479:**
```javascript
if (codigosExcluir.includes(code)) {
  console.log(`🚫 Excluido: ${code}`);
  skipped++;
  continue;
}
```

---

### 7. ✅ Códigos Huérfanos a LISSA (Ganancia Oficina)

**Líneas 506-526:**
```javascript
} else {
  // Sin broker asignado → LISSA (ganancia oficina)
  const { error } = await supabase
    .from('comm_items')
    .insert({
      import_id: importRecord.id,
      broker_id: lissaBrokerId,  // LISSA
      policy_number: code,
      insured_name: `Código ASSA Huérfano: ${code}`,
      insurer_id: assaId,
      gross_amount: amount  // 100%
    });
  
  if (!error) {
    huerfanos++;
    console.log(`🏢 Código huérfano a LISSA: ${code} ($${amount.toFixed(2)})`);
  }
}
```

**Cambio:** Códigos huérfanos van a `comm_items` (LISSA), NO a `pending_items`

---

### 8. ✅ Quincena Creada Primero

**Líneas 650-670 en main():**
```javascript
// CREAR QUINCENA PRIMERO
const { data: fortnight } = await supabase
  .from('fortnights')
  .insert({
    period_start: '2025-11-01',
    period_end: '2025-11-15',
    status: 'PAID',
    notify_brokers: false
  })
  .select()
  .single();

console.log(`✅ Quincena creada: ${fortnight.id}`);
console.log(`   Período: ${fortnight.period_start} a ${fortnight.period_end}`);
console.log(`   Estado: ${fortnight.status}\n`);
```

---

### 9. ✅ Reportes con Fortnight_ID

**Línea 92 y 133:**
```javascript
async function importarReportes(insurerMap, fortnightId) {
  // ...
  await supabase.from('comm_imports').insert({
    insurer_id: insurerId,
    period_label: fortnightId,  // Vinculado a quincena
    total_amount: amount
  });
}
```

**Líneas 147-155:**
```javascript
// Calcular total de reportes
let totalReportes = 0;
for (const record of records) {
  const amount = parseFloat(record[1] || 0);
  if (amount) totalReportes += amount;
}
console.log(`💰 Total sum reportes: $${totalReportes.toFixed(2)}\n`);

return totalReportes;
```

---

### 10. ✅ Items Actualizados con Fortnight_ID

**Líneas 542-564:**
```javascript
// 1. Actualizar comm_items con fortnight_id
await supabase.from('comm_items')
  .update({ fortnight_id: fortnightId })
  .is('fortnight_id', null);

console.log('✅ comm_items actualizados con fortnight_id');

// 3. Actualizar pending_items con fortnight_id
await supabase.from('pending_items')
  .update({ fortnight_id: fortnightId })
  .is('fortnight_id', null);

console.log('✅ pending_items actualizados con fortnight_id');
```

---

### 11. ✅ Match de Totales Verificado

**Líneas 615-625:**
```javascript
// VERIFICACIÓN DE MATCH
console.log(`\n💰 VERIFICACIÓN DE TOTALES:`);
console.log(`   Total reportes aseguradoras: $${(totalReportes || 0).toFixed(2)}`);
console.log(`   Total comm_items calculado:  $${totalCommItems.toFixed(2)}`);

const diff = Math.abs((totalReportes || 0) - totalCommItems);
if (diff < 0.01) {
  console.log(`   ✅ Match perfecto!\n`);
} else {
  console.log(`   ⚠️  Diferencia: $${diff.toFixed(2)}\n`);
}
```

---

## 📊 Flujo Correcto del Script

```
1. Limpiar datos existentes
   ↓
2. Obtener catálogos (insurers, brokers, percents, LISSA)
   ↓
3. CREAR QUINCENA (Q1 Nov 2025, PAID)
   ↓
4. Importar reportes (con fortnight_id)
   └─> Calcular totalReportes
   ↓
5. Importar comisiones de pólizas
   ├─> Normalizar nombres de clientes
   ├─> Crear/actualizar clientes
   ├─> Crear/actualizar pólizas
   ├─> Aplicar percent_default de broker
   ├─> VIDA ASSA → 100%
   ├─> Items con broker → comm_items
   └─> Items sin broker → pending_items
   ↓
6. Importar códigos ASSA
   ├─> Excluir: PJ750, PJ750-1, PJ750-6, PJ750-9
   ├─> Códigos asignados → comm_items (100%)
   └─> Códigos huérfanos → comm_items LISSA (100%)
   ↓
7. Actualizar items y calcular totales
   ├─> Actualizar comm_items con fortnight_id
   ├─> Actualizar pending_items con fortnight_id
   ├─> Agrupar por broker
   ├─> Insertar fortnight_broker_totals
   └─> Verificar match de totales
   ↓
8. Mostrar resultado final
```

---

## 🚀 Ejecución

```bash
node scripts/bulk-import-completo.mjs
```

---

## 📁 Archivos CSV Necesarios

1. **`public/total_reportes_por_aseguradora.csv`**
   - Columnas: `insurer_name, total_amount`

2. **`public/plantilla_comisiones_quincena.csv`**
   - Columnas: `policy_number, client_name, insurer_name, broker_email, policy_type, commission_amount, start_date, renewal_date`

3. **`public/plantilla_codigos_assa.csv`**
   - Columnas: `assa_code, commission_amount`

---

## ✅ Checklist de Correcciones

- [x] Normalización con guiones → espacios
- [x] Obtener `percent_default` de brokers
- [x] Crear/actualizar clientes normalizados
- [x] Actualizar nombres de clientes existentes
- [x] Crear/actualizar pólizas
- [x] VIDA ASSA al 100%
- [x] Resto con `percent_default` del broker
- [x] Códigos ASSA excluidos (PJ750, PJ750-1, PJ750-6, PJ750-9)
- [x] Códigos ASSA asignados al 100%
- [x] Códigos huérfanos a LISSA al 100%
- [x] Items sin broker a pending_items
- [x] Quincena creada primero con estado PAID
- [x] Reportes con fortnight_id correcto
- [x] comm_items actualizados con fortnight_id
- [x] pending_items actualizados con fortnight_id
- [x] Totales por broker calculados
- [x] Match de totales verificado
- [x] Build sin errores ✅

---

## 🎯 Todo Listo para Ejecutar

El script `bulk-import-completo.mjs` está completamente corregido y listo para ejecutar.
