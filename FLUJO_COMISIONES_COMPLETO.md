# 📊 FLUJO COMPLETO DEL SISTEMA DE COMISIONES

## 🎯 Resumen Ejecutivo

El sistema **NO actualiza policies desde comisiones**. El flujo es:

```
1. Póliza creada → broker_id asignado
2. Import reporte → CONSULTA broker_id de policies  
3. Calcula comisión → Usa percent_override o percent_default
4. Genera quincena → Suma por broker y aplica descuentos
```

---

## 📝 PASO A PASO DETALLADO

### **PASO 1: Creación de Póliza (Módulo `/db`)**

**Origen:** Usuario Master o Broker crea cliente + póliza

**Tablas afectadas:**
- `clients` → Se crea con `broker_id`
- `policies` → Se crea con `broker_id` + `percent_override` (opcional)

**Datos clave guardados:**
```typescript
policies: {
  policy_number: "POL-2024-001",      // Identificador único
  broker_id: "uuid-del-broker",        // Broker asignado ✅
  client_id: "uuid-del-cliente",
  insurer_id: "uuid-aseguradora",
  percent_override: 0.8,               // Override opcional (80%)
  // Si percent_override es null, se usa broker.percent_default
}
```

**Porcentajes:**
- **`percent_override`** (en policies): % específico para esta póliza
- **`percent_default`** (en brokers): % por defecto del broker
- **Prioridad**: `percent_override` > `percent_default`

**Regla especial:** 
- ASSA + VIDA → Siempre 1.0% (100%) automático

---

### **PASO 2: Import de Reporte de Aseguradora**

**Archivo:** `src/app/(app)/commissions/actions.ts` → `actionUploadImport()`

#### 2.1 Parseo del Archivo (líneas 69-95)

```typescript
// Se obtienen las reglas de mapeo de la aseguradora
const { data: mappingRules } = await supabase
  .from('insurer_mapping_rules')
  .select('target_field, aliases, ...')
  .eq('insurer_id', insurer_id);

// Se parsea el archivo (CSV/XLSX)
const rows = await parseCsvXlsx(file, mappingRules, invertNegatives, useMultiColumns);
```

**Resultado del parseo:**
```typescript
[
  {
    policy_number: "POL-2024-001",
    client_name: "JUAN PEREZ",
    commission_amount: 1500.00,  // ← MONTO RAW del reporte
    raw_row: { ... }
  },
  ...
]
```

**Configuración por aseguradora:**
- **Mapping rules**: Qué columnas usar (policy, insured, commission)
- **invert_negatives**: Si invertir negativos (ej: MAPFRE)
- **use_multi_commission_columns**: Si sumar múltiples columnas (ej: ASSA)

#### 2.2 Identificación de Brokers (líneas 115-129)

```typescript
// Se CONSULTA policies para identificar el broker
const { data: existingPolicies } = await supabase
  .from('policies')
  .select('policy_number, broker_id, client_id')
  .in('policy_number', policyNumbers);

// Se crea un mapa: policy_number → broker_id
const policyMap = new Map();
existingPolicies.forEach(p => {
  policyMap.set(p.policy_number, {
    broker_id: p.broker_id,  // ← SE OBTIENE, NO SE ESCRIBE
    client_id: p.client_id
  });
});
```

**🔑 PUNTO CLAVE:** Se **CONSULTA** `policies.broker_id`, **NO se actualiza**.

#### 2.3 Separación de Items (líneas 135-162)

```typescript
for (const row of rows) {
  const policyData = policyMap.get(row.policy_number);
  
  if (policyData && policyData.broker_id) {
    // ✅ Broker identificado → comm_items
    itemsToInsert.push({
      import_id: importRecord.id,
      insurer_id: insurer_id,
      policy_number: row.policy_number,
      gross_amount: row.commission_amount,  // ← RAW del reporte
      broker_id: policyData.broker_id,      // ← OBTENIDO de policies
    });
  } else {
    // ❌ Broker NO identificado → pending_items
    pendingItemsToInsert.push({
      policy_number: row.policy_number,
      commission_raw: row.commission_amount,  // ← RAW sin calcular
      assigned_broker_id: null,
      status: 'open',
    });
  }
}
```

**Resultado:**
- **`comm_items`**: Items con broker identificado
- **`pending_items`**: Items sin broker (Master los asignará después)

---

### **PASO 3: Cálculo de Comisión del Broker**

**Ubicación:** `src/app/(app)/commissions/actions.ts` (líneas 386-387 y otras)

```typescript
// Se obtiene el porcentaje del broker
const { data: broker } = await supabase
  .from('brokers')
  .select('percent_default')
  .eq('id', broker_id)
  .single();

// O si la póliza tiene override
const { data: policy } = await supabase
  .from('policies')
  .select('percent_override')
  .eq('policy_number', policy_number)
  .single();

// Prioridad: percent_override > percent_default
const percent = policy.percent_override ?? broker.percent_default ?? 100;

// CÁLCULO FINAL
const brokerCommission = commission_raw × (percent / 100);
```

**Ejemplo:**
- Reporte dice: `$1,500` (gross_amount RAW)
- Broker tiene: `percent_default = 80%`
- Cálculo: `$1,500 × 0.80 = $1,200` (comisión del broker)

**Casos especiales:**
- ASSA + VIDA: Siempre 100% (`percent = 1.0`)
- Algunos brokers: 70%, 80%, 94%, etc.

---

### **PASO 4: Generación de Quincena**

**Ubicación:** `src/app/(app)/commissions/actions.ts` → `actionGenerateFortnight()`

#### 4.1 Agrupación por Broker

```typescript
// Se agrupan todos los comm_items por broker_id
SELECT 
  broker_id,
  SUM(gross_amount) as total_gross
FROM comm_items
WHERE import_id IN (imports de esta quincena)
GROUP BY broker_id;
```

#### 4.2 Aplicación de Descuentos

```typescript
// Adelantos pendientes del broker
SELECT * FROM advances 
WHERE broker_id = broker_id 
  AND status != 'PAID';

// Cálculo final
const neto = total_gross - adelantos - descuentos;
```

#### 4.3 Creación de Totales

```typescript
// Se crea el registro final por broker
INSERT INTO fortnight_broker_totals (
  fortnight_id,
  broker_id,
  gross_amount,        // Suma de comm_items
  discount_amount,     // Adelantos + descuentos
  net_amount          // gross - discount
);
```

---

### **PASO 5: Generación de Archivo ACH**

**Ubicación:** `src/lib/commissions/bankACH.ts`

```typescript
// Se genera el archivo de pago para Banco General
for (const total of fortnight_broker_totals) {
  // Línea en formato ACH
  `${broker.bank_route}|${broker.account}|${total.net_amount}|...`;
}
```

**Resultado:** Archivo TXT con formato ACH para subir al banco.

---

## 🚫 LO QUE **NO** OCURRE

### ❌ NO se actualiza `policies` desde comisiones

```sql
-- Esto NO existe en el flujo
UPDATE policies 
SET broker_id = xxx  -- ❌ NUNCA ocurre
WHERE ...;
```

**Razón:** Las pólizas ya tienen su `broker_id` desde que se crean.

### ❌ NO se actualiza `clients` desde comisiones

```sql
-- Esto NO existe en el flujo
UPDATE clients 
SET broker_id = xxx  -- ❌ NUNCA ocurre
WHERE ...;
```

**Razón:** Los clientes ya tienen su `broker_id` desde que se crean.

### ❌ NO se usa `updated_at` en `policies`

**Razón:** La tabla `policies` NO tiene columna `updated_at`, solo `created_at`.

---

## 🔧 CONFIGURACIÓN POR ASEGURADORA

### Tabla: `insurers`

```typescript
insurers: {
  name: "ASSA",
  invert_negatives: false,              // Si invertir negativos
  use_multi_commission_columns: true,   // Si sumar múltiples columnas
  default_percent: 0.8,                 // % por defecto (80%)
}
```

### Tabla: `insurer_mapping_rules`

Define qué columnas del Excel/CSV corresponden a qué campos:

```typescript
insurer_mapping_rules: [
  {
    insurer_id: "uuid-assa",
    target_field: "policy",
    aliases: ["POLIZA", "NO. POLIZA", "POLICY"]
  },
  {
    target_field: "commission",
    aliases: ["HONORARIO", "COMMISSION", "MONTO"]
  },
  {
    target_field: "commission_column_2",  // Para ASSA: Vida 1er año
    aliases: ["VIDA PRIMER AÑO"]
  }
]
```

**Por eso cada aseguradora puede tener Excel diferente y el sistema se adapta.**

---

## 📊 TABLAS PRINCIPALES

### 1. `comm_imports`
- Registro del archivo importado
- Guarda: `insurer_id`, `total_amount`, `period_label`

### 2. `comm_items`
- Items identificados (con broker)
- Guarda: `broker_id`, `policy_number`, `gross_amount`

### 3. `pending_items`
- Items sin identificar (sin broker)
- Guarda: `policy_number`, `commission_raw`, `status: 'open'`

### 4. `fortnights`
- Quincena cerrada
- Guarda: `period`, `status: 'DRAFT' | 'PAID'`

### 5. `fortnight_broker_totals`
- Total por broker en la quincena
- Guarda: `gross_amount`, `discount_amount`, `net_amount`

### 6. `advances`
- Adelantos pendientes de los brokers
- Guarda: `broker_id`, `amount`, `status: 'PENDING' | 'PAID'`

---

## 🔄 FLUJO DE PENDING_ITEMS

Cuando una póliza no se encuentra:

```
1. Import → pending_items (status: 'open')
2. Master revisa en /commissions → Tab "Ajustes"
3. Master asigna broker → status: 'approved_next' o 'approved_pay_now'
4. Sistema calcula comisión con percent del broker
5. Se crea comm_item con broker asignado
6. Se incluye en siguiente quincena o pago inmediato
```

**Regla 90 días:** Items sin asignar por 90 días → Oficina automáticamente

---

## ✅ VALIDACIONES

### Al crear póliza:
- ✅ `broker_id` es obligatorio
- ✅ `percent_override` es opcional (usa default si es null)

### Al importar reporte:
- ✅ `policy_number` debe ser único en el archivo
- ✅ `commission_amount` debe ser número
- ✅ Aseguradora debe existir

### Al generar quincena:
- ✅ Todos los imports deben estar cerrados
- ✅ Broker debe tener datos bancarios ACH
- ✅ Net amount > 0 (después de descuentos)

---

## 🐛 ERROR QUE SE CORRIGIÓ

### Problema:
```
Error: column "updated_at" of relation "policies" does not exist
```

### Causa:
- Trigger `update_clients_policies_from_commissions()` intentaba:
  ```sql
  UPDATE policies SET updated_at = NOW() WHERE ...;
  ```
- Pero `policies` NO tiene columna `updated_at`

### Solución:
- **ELIMINAR el trigger completo**
- El trigger estaba al revés del flujo real
- No se debe actualizar `policies` desde `comm_items`

### Script:
- Ejecutar: `DESACTIVAR_TRIGGER_COMISIONES.sql`

---

## 📋 CHECKLIST PARA AGREGAR NUEVA ASEGURADORA

1. ✅ Agregar en tabla `insurers`
2. ✅ Configurar `invert_negatives` (true/false)
3. ✅ Configurar `use_multi_commission_columns` (solo ASSA = true)
4. ✅ Crear reglas en `insurer_mapping_rules`:
   - Alias para "policy_number"
   - Alias para "commission"
   - Alias para columnas adicionales si aplica
5. ✅ Probar import con archivo real
6. ✅ Verificar que identifica brokers correctamente
7. ✅ Verificar cálculos de comisión

---

## 🎓 CONCEPTOS CLAVE

### RAW vs CALCULATED

- **RAW (commission_raw)**: Monto del reporte sin procesar
- **CALCULATED (gross_amount)**: Monto × percent del broker

### GROSS vs NET

- **GROSS**: Total comisiones del broker en la quincena
- **NET**: Gross - adelantos - descuentos

### OVERRIDE vs DEFAULT

- **percent_override**: % específico de una póliza
- **percent_default**: % general del broker

**Prioridad:** override > default

---

## 🚀 PRÓXIMOS PASOS

Para agregar una nueva aseguradora:

1. Obtener archivo Excel/CSV de muestra
2. Identificar columnas: póliza, asegurado, comisión
3. Crear reglas de mapeo en BD
4. Configurar flags (invert_negatives, use_multi_columns)
5. Probar import
6. Ajustar si es necesario

**Todo lo demás es automático.**

---

## 📞 SOPORTE

Si algo no funciona:

1. ✅ Verificar que póliza tiene `broker_id` en BD
2. ✅ Verificar mapping rules de la aseguradora
3. ✅ Ver logs de parseo en consola
4. ✅ Revisar `comm_items` vs `pending_items`
5. ✅ Confirmar que trigger está desactivado

---

**Última actualización:** Nov 18, 2025  
**Estado:** ✅ Trigger corregido - Sistema funcionando correctamente
