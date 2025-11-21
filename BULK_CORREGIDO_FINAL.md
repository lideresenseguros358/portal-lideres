# ✅ BULK IMPORT CORREGIDO - RESUMEN FINAL

## 🔧 Correcciones Aplicadas al Script

**Archivo:** `scripts/bulk-import-final.mjs`

---

## 1. ✅ Normalización de Nombres de Clientes

### Cambios:
- **Guiones → Espacios** (línea 40)
- **Nombres normalizados al crear/actualizar** (líneas 247-280)
- **Actualización automática de clientes existentes** (líneas 273-279)

### Código corregido:
```javascript
function normalizar(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Quitar acentos
    .replace(/ñ/g, 'n')                // ñ → n
    .replace(/Ñ/g, 'N')                // Ñ → N
    .replace(/-/g, ' ');               // guiones → espacios ✅
}

// Al crear/actualizar cliente
const clientNameNormalized = normalizar(clientName).toUpperCase();

// Si cliente existe con nombre viejo, lo actualiza
if (clientName !== clientNameNormalized) {
  await supabase
    .from('clients')
    .update({ name: clientNameNormalized })
    .eq('id', clientId);
}
```

### Resultado:
- ✅ Clientes nuevos: nombres normalizados desde el inicio
- ✅ Clientes existentes: nombres actualizados automáticamente
- ✅ Base de datos limpia sin caracteres especiales

---

## 2. ✅ Cálculo de Porcentajes Correcto

### Lógica (líneas 287-298):
```javascript
let percentToUse = 100;

// 1. VIDA en ASSA → 100%
if (policyType === 'VIDA' && insurerName === 'ASSA') {
  percentToUse = 100;
  percentOverride = 100;
  
// 2. Si existe percent_override en póliza → usar ese
} else if (percentOverride != null) {
  percentToUse = percentOverride;
  
// 3. Aplicar percent_default del broker
} else {
  percentToUse = brokerPercents.get(brokerId) || 100;
}

// Calcular comisión
const grossAmount = commissionRaw * (percentToUse / 100);
```

### Casos:
| Situación | % Aplicado |
|-----------|------------|
| VIDA en ASSA | 100% |
| Póliza tiene `percent_override` | Ese valor |
| Resto | `percent_default` del broker |

---

## 3. ✅ Códigos ASSA al 100%

### Códigos Excluidos (línea 397):
```javascript
const codigosExcluir = ['PJ750', 'PJ750-1', 'PJ750-6', 'PJ750-9'];
```

### Lógica (líneas 437-497):
```javascript
for (const record of records) {
  const code = record.assa_code;
  const amount = record.commission_amount;
  
  // 1. Excluir códigos especificados
  if (codigosExcluir.includes(code)) {
    skipped++;
    continue;
  }
  
  // 2. Buscar broker con ese código ASSA
  const brokerId = brokerByAssaCode.get(code);
  
  if (brokerId) {
    // Asignado a broker → 100% del amount
    await supabase.from('comm_items').insert({
      broker_id: brokerId,
      gross_amount: amount  // 100%
    });
  } else {
    // Huérfano → LISSA (ganancia oficina) → 100%
    await supabase.from('comm_items').insert({
      broker_id: lissaBrokerId,
      gross_amount: amount  // 100%
    });
  }
}
```

### Resultado:
- ✅ PJ750, PJ750-1, PJ750-6, PJ750-9 → Excluidos
- ✅ Códigos con broker asignado → 100% al broker
- ✅ Códigos huérfanos → 100% a LISSA (ganancia oficina)

---

## 4. ✅ Quincena Creada Correctamente

### Flujo corregido (líneas 624-651):
```javascript
// 1. CREAR QUINCENA PRIMERO
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

// 2. Importar reportes con fortnight_id
await importarReportes(insurerMap, fortnight.id);

// 3. Importar comisiones
await importarComisionesConCalculos(insurerMap, brokerMap, brokerPercents);

// 4. Importar códigos ASSA
await importarCodigosASSA(insurerMap, brokerByAssaCode, lissaBrokerId);

// 5. Calcular totales y actualizar items
await calcularTotalesYActualizar(fortnight.id, totalReportes);
```

### Resultado:
- ✅ Quincena Q1 Nov 2025 creada con estado PAID
- ✅ Todos los `comm_imports` vinculados al `fortnight_id`
- ✅ Todos los `comm_items` vinculados al `fortnight_id`
- ✅ Todos los `pending_items` vinculados al `fortnight_id`

---

## 5. ✅ Match de Totales Reportes vs Comisiones

### Verificación (líneas 598-607):
```javascript
console.log(`💰 VERIFICACIÓN DE TOTALES:`);
console.log(`   Total reportes aseguradoras: $${totalReportes.toFixed(2)}`);
console.log(`   Total comm_items calculado:  $${totalCommItems.toFixed(2)}`);

const diff = Math.abs(totalReportes - totalCommItems);
if (diff < 0.01) {
  console.log(`   ✅ Match perfecto!`);
} else {
  console.log(`   ⚠️  Diferencia: $${diff.toFixed(2)}`);
}
```

### Resultado:
- ✅ Suma de reportes por aseguradora
- ✅ Suma de comm_items calculados
- ✅ Comparación automática
- ✅ Alerta si no coinciden

---

## 6. ✅ Items Sin Identificar (Pendientes)

### Lógica (líneas 220-242):
```javascript
// Si no hay broker
if (!brokerId) {
  const clientNameNormalized = normalizar(clientName).toUpperCase();
  
  await supabase
    .from('pending_items')
    .insert({
      import_id: importRecord.id,
      policy_number: policyNumber,
      insured_name: clientNameNormalized,  // Normalizado
      insurer_id: insurerId,
      commission_raw: commissionRaw,
      status: 'open'
    });
  
  pending++;
  continue;
}
```

### Resultado:
- ✅ Pólizas sin broker → `pending_items`
- ✅ Nombres normalizados también
- ✅ Estado: 'open'
- ✅ Vinculados al fortnight

---

## 7. ✅ Totales por Broker Calculados

### Lógica (líneas 563-586):
```javascript
const brokerTotals = {};
let totalCommItems = 0;

// Sumar por broker
items.forEach(item => {
  const brokerId = item.broker_id;
  const amount = Number(item.gross_amount) || 0;
  
  if (!brokerTotals[brokerId]) {
    brokerTotals[brokerId] = { gross: 0, count: 0 };
  }
  
  brokerTotals[brokerId].gross += amount;
  brokerTotals[brokerId].count += 1;
  totalCommItems += amount;
});

// Insertar en fortnight_broker_totals
const totalsToInsert = Object.entries(brokerTotals).map(([brokerId, totals]) => ({
  fortnight_id: fortnightId,
  broker_id: brokerId,
  gross_amount: totals.gross,
  net_amount: totals.gross,
  discounts_json: { adelantos: [], total: 0 }
}));

await supabase.from('fortnight_broker_totals').insert(totalsToInsert);
```

### Resultado:
- ✅ Totales por broker calculados correctamente
- ✅ Incluye comisiones de lista de clientes
- ✅ Incluye códigos ASSA (asignados + huérfanos)
- ✅ `fortnight_broker_totals` poblado correctamente

---

## 📁 Archivos CSV Necesarios

1. **`public/total_reportes_por_aseguradora.csv`**
   - Columnas: `insurer_name, total_amount`
   - Ejemplo: `ASSA,7747.32`

2. **`public/plantilla_comisiones_quincena.csv`**
   - Columnas: `policy_number, client_name, insurer_name, broker_email, policy_type, commission_amount, start_date, renewal_date`
   - Lista de clientes con sus pólizas

3. **`public/plantilla_codigos_assa.csv`**
   - Columnas: `assa_code, commission_amount`
   - Códigos ASSA con sus montos

---

## 🚀 Ejecución

```bash
node scripts/bulk-import-final.mjs
```

---

## 📊 Resultado Esperado

```
🚀 BULK IMPORT FINAL - CON CÁLCULOS CORRECTOS

🗑️  LIMPIANDO DATOS EXISTENTES...
✅ Datos limpiados

✅ 15 aseguradoras, 45 brokers
✅ LISSA broker ID: abc-123...

📅 CREANDO QUINCENA...
✅ Quincena creada: xyz-789...
   Período: 2025-11-01 a 2025-11-15
   Estado: PAID

📊 IMPORTANDO REPORTES DE ASEGURADORAS...
✅ ASSA                 $7747.32
✅ FEDPA                $2500.00
...
✅ Reportes importados: 15/15
💰 Total sum reportes: $15000.00

💰 IMPORTANDO COMISIONES CON CÁLCULOS CORRECTOS...
📄 Total registros: 692
✅ Procesados: 100 (70% aplicado)...
✅ Procesados: 200 (100% aplicado)...
...
✅ Con broker y cálculos: 650
⏳ Pendientes: 42
❌ Errores: 0

🔢 IMPORTANDO CÓDIGOS ASSA...
📄 Total códigos en CSV: 50
🚫 Códigos a excluir: PJ750, PJ750-1, PJ750-6, PJ750-9
✅ Códigos asignados: 30...
🏢 Código huérfano a LISSA: PJ123 ($100.00)
...
✅ Códigos asignados a brokers: 30
🏢 Códigos huérfanos a LISSA (ganancia oficina): 16
🚫 Excluidos: 4
❌ Errores: 0

📊 CALCULANDO TOTALES Y ACTUALIZANDO ITEMS...
✅ comm_items actualizados con fortnight_id
✅ pending_items actualizados con fortnight_id
✅ Calculados totales para 45 brokers
✅ Totales por broker insertados: 45

💰 VERIFICACIÓN DE TOTALES:
   Total reportes aseguradoras: $15000.00
   Total comm_items calculado:  $15000.00
   ✅ Match perfecto!

============================================================
✅ IMPORTACIÓN COMPLETADA

📊 RESULTADO FINAL:

   comm_items (con broker):    650
   pending_items (sin broker): 42
   comm_imports (reportes):    15
   fortnight_broker_totals:    45
   policies creadas/actualizadas: 692
   clients creados/actualizados:  650

🎉 Quincena Q1 Nov 2025 creada: xyz-789...
   Estado: PAID
   Período: 2025-11-01 a 2025-11-15
```

---

## ✅ Checklist Final

- [x] Normalización de nombres (guiones → espacios)
- [x] Clientes existentes actualizados automáticamente
- [x] VIDA ASSA al 100%
- [x] Resto con percent_default del broker
- [x] Códigos ASSA excluidos (PJ750, PJ750-1, PJ750-6, PJ750-9)
- [x] Códigos ASSA asignados al 100%
- [x] Códigos huérfanos a LISSA al 100%
- [x] Items sin broker a pending_items
- [x] Quincena creada con estado PAID
- [x] Todos los items vinculados al fortnight_id
- [x] Totales por broker calculados
- [x] Match de totales verificado
- [x] Build sin errores (typecheck ✅)

---

## 🎯 Todo Listo

El script está completamente corregido y listo para ejecutar.
