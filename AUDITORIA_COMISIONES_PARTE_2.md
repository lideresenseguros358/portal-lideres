# 🔍 AUDITORÍA COMISIONES - PARTE 2: BASE DE DATOS

**Fecha:** 2025-10-04 03:20  
**Estado:** ✅ ESTRUCTURA CORRECTA CON OBSERVACIONES

---

## ✅ TABLAS VERIFICADAS

### 1. `fortnights` ✅ CORRECTA
```typescript
{
  id: string (PK)
  period_start: string
  period_end: string
  status: 'DRAFT' | 'READY' | 'PAID'
  notify_brokers: boolean
  created_by: string (FK profiles)
  created_at: string
}
```

**Validación:** ✅ Correcta. Un solo draft permitido.

---

### 2. `comm_imports` ✅ CORRECTA
```typescript
{
  id: string (PK)
  insurer_id: string (FK insurers)
  period_label: string ← Fortnight ID
  total_amount: number ← Monto reportado
  is_life_insurance: boolean
  uploaded_by: string (FK profiles)
  created_at: string
}
```

**Validación:** ✅ Almacena monto total del reporte

---

### 3. `comm_items` ✅ CORRECTA
```typescript
{
  id: string (PK)
  import_id: string (FK comm_imports)
  insurer_id: string (FK insurers)
  policy_number: string
  broker_id: string | NULL (FK brokers)
  gross_amount: number ← YA calculado con %
  insured_name: string | null
  raw_row: Json
  created_at: string
}
```

**Validación:** ✅ Items identificados con broker

**⚠️ OBSERVACIÓN:** No tiene `fortnight_id` directo. Se obtiene vía:
```
comm_items → import_id → comm_imports → period_label (fortnight_id)
```

---

### 4. `pending_items` ✅ CORRECTA
```typescript
{
  id: string (PK)
  policy_number: string
  insurer_id: string | null
  insured_name: string | null
  commission_raw: number ← SIN calcular con %
  fortnight_id: string | null
  import_id: string | null
  assigned_broker_id: string | null
  assigned_by: string | null
  assigned_at: string | null
  status: string (open, claimed, approved_pay_now, approved_next)
  action_type: string | null (pay_now, next_fortnight)
  assignment_notes: string | null
  created_at: string
  updated_at: string
}
```

**Validación:** ✅ Items NO identificados

**Estados:**
- `open` - Sin asignar
- `claimed` - Broker asignado (esperando migración)
- `approved_pay_now` - Pagar ahora (genera CSV separado)
- `approved_next` - Próxima quincena (espera nuevo draft)

---

### 5. `fortnight_broker_totals` ✅ CORRECTA
```typescript
{
  id: string (PK)
  fortnight_id: string (FK fortnights)
  broker_id: string (FK brokers)
  gross_amount: number
  net_amount: number
  discounts_json: Json ({ adelantos: [], otros: [] })
  bank_snapshot: Json | null
  created_at: string
}
```

**Validación:** ✅ Generado por Recalcular

---

### 6. `advances` ✅ CORRECTA
```typescript
{
  id: string (PK)
  broker_id: string (FK brokers)
  amount: number ← Saldo pendiente
  reason: string | null
  status: string (PENDING, PARTIAL, PAID)
  created_by: string | null
  created_at: string
}
```

**Validación:** ✅ Adelantos por broker

---

### 7. `advance_logs` ✅ CORRECTA
```typescript
{
  id: string (PK)
  advance_id: string (FK advances)
  amount: number ← Monto del pago
  payment_type: string (fortnight, cash, transfer)
  fortnight_id: string | null
  applied_by: string | null
  created_at: string
}
```

**Validación:** ✅ Historial de pagos

---

### 8. `comm_item_claims` ✅ CORRECTA (Solicitudes "Mío")
```typescript
{
  id: string (PK)
  comm_item_id: string (FK comm_items, unique)
  broker_id: string ← Quien reclama
  status: string (pending, approved, rejected)
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
}
```

**Uso:** Items YA asignados que broker reclama

---

### 9. `comm_metadata` ✅ EXISTENTE
```typescript
{
  id: string (PK)
  import_id: string | null
  fortnight_id: string | null
  key: string
  value: string | null
  created_at: string
}
```

**Uso:** Metadata adicional (nombre archivo, hash, etc.)

**Propuesto:** También para guardar adelantos seleccionados:
```json
{
  "key": "selected_advance",
  "fortnight_id": "abc",
  "value": "{\"broker_id\":\"xyz\",\"advance_id\":\"123\",\"amount\":500}"
}
```

---

### 10. `temp_client_imports` ✅ EXISTENTE
Para clientes preliminares sin RUC/cédula

---

## ⚠️ OBSERVACIONES DE ESTRUCTURA

### O-1: `comm_items` sin `fortnight_id`
**Problema:** Para recalcular, necesitamos saber qué items pertenecen a qué draft

**Solución actual:** Navegar vía `import_id → period_label`

**Recomendación:** Agregar columna `fortnight_id` a `comm_items` para queries más rápidas:
```sql
ALTER TABLE comm_items ADD COLUMN fortnight_id TEXT REFERENCES fortnights(id);
CREATE INDEX idx_comm_items_fortnight ON comm_items(fortnight_id);
```

---

### O-2: No hay tabla para adelantos seleccionados por quincena
**Problema:** Al seleccionar adelantos a aplicar, ¿dónde se guarda antes de recalcular?

**Opciones:**
1. Usar `comm_metadata` (actual)
2. Crear `fortnight_advance_selections`:
```typescript
{
  fortnight_id: string
  broker_id: string
  advance_id: string
  amount_to_apply: number
  created_at: string
}
```

**Recomendación:** Usar `comm_metadata` por ahora (más flexible)

---

### O-3: `pending_items.commission_raw` puede no ser realmente "raw"
**Problema:** Si el parser ya aplica %, entonces no es raw

**Verificación necesaria:** Revisar `parseCsvXlsx` para confirmar que NO aplica % para items sin broker

---

## ✅ RELACIONES VERIFICADAS

```
fortnights (1) ←→ (N) comm_imports [period_label]
comm_imports (1) ←→ (N) comm_items [import_id]
comm_items (N) → (1) brokers [broker_id]
comm_items (N) → (1) insurers [insurer_id]

fortnights (1) ←→ (N) pending_items [fortnight_id]
pending_items (N) → (1) brokers [assigned_broker_id]

fortnights (1) ←→ (N) fortnight_broker_totals [fortnight_id]
brokers (1) ←→ (N) fortnight_broker_totals [broker_id]

brokers (1) ←→ (N) advances [broker_id]
advances (1) ←→ (N) advance_logs [advance_id]
advance_logs (N) → (1) fortnights [fortnight_id]

comm_items (1) ←→ (1) comm_item_claims [comm_item_id]
```

**Validación:** ✅ Todas las relaciones existen

---

## 🔍 QUERIES CRÍTICAS A IMPLEMENTAR

### Q-1: Obtener comm_items de un draft
```typescript
// Opción 1: Via imports
const { data: imports } = await supabase
  .from('comm_imports')
  .select('id')
  .eq('period_label', fortnight_id);

const importIds = imports.map(i => i.id);

const { data: items } = await supabase
  .from('comm_items')
  .select('*')
  .in('import_id', importIds);
```

```sql
-- Opción 2: Con JOIN (más eficiente)
SELECT ci.* 
FROM comm_items ci
JOIN comm_imports im ON ci.import_id = im.id
WHERE im.period_label = 'fortnight_id_here';
```

**Recomendación:** Agregar `fortnight_id` a `comm_items` evita JOIN

---

### Q-2: Calcular totales por broker en draft
```sql
SELECT 
  ci.broker_id,
  SUM(ci.gross_amount) as total_gross,
  COUNT(*) as item_count
FROM comm_items ci
JOIN comm_imports im ON ci.import_id = im.id
WHERE im.period_label = 'fortnight_id'
  AND ci.broker_id IS NOT NULL
GROUP BY ci.broker_id;
```

---

### Q-3: Pending items >= 90 días
```sql
SELECT 
  policy_number,
  MIN(created_at) as oldest_date,
  COUNT(*) as item_count,
  SUM(commission_raw) as total_raw
FROM pending_items
WHERE status = 'open'
  AND created_at <= NOW() - INTERVAL '90 days'
GROUP BY policy_number;
```

---

**Siguiente:** Ver PARTE 3 para flujos de trabajo y acciones faltantes
