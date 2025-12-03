# 📋 Estructura Correcta de Divisiones en BD

## Ejemplo Concreto

### Transferencia Bancaria
```
REF-001: $138.00
```

### Divisiones
```
División 1: $110.59 (ELIZA MEDRANO)
División 2: $27.30 (OSCAR BOSQUEZ)
```

---

## Tabla: `bank_transfers`

```sql
reference_number | amount  | used_amount | remaining_amount
REF-001         | 138.00  | 0.00        | 138.00
```

---

## Tabla: `pending_payments`

```sql
id                                      | client_name     | amount_to_pay | notes (batch_id)
38d62066-608b-4313-b7eb-a51cb0e8e02c   | OSCAR BOSQUEZ   | 27.30         | {"batch_id": "batch-xxx"}
otro-id                                 | ELIZA MEDRANO   | 110.59        | {"batch_id": "batch-xxx"}
```

---

## Tabla: `payment_references`

### ✅ CORRECTO:

```sql
payment_id                              | reference_number | amount  | amount_to_use
38d62066-608b-4313-b7eb-a51cb0e8e02c   | REF-001          | 138.00  | 27.30
otro-id                                 | REF-001          | 138.00  | 110.59
```

**Reglas:**
- ✅ `amount` = Monto de la transferencia (IGUAL para todas las divisiones)
- ✅ `amount_to_use` = Monto de la división (DIFERENTE para cada división)

### ❌ INCORRECTO:

```sql
payment_id                              | reference_number | amount  | amount_to_use
38d62066-608b-4313-b7eb-a51cb0e8e02c   | REF-001          | 27.30   | 27.30   ❌ amount está mal
otro-id                                 | REF-001          | 110.59  | 110.59  ❌ amount está mal
```

---

## En la UI (PendingPaymentsTab.tsx)

### Cintillo de Referencia (línea 2010):
```tsx
<span className="text-sm font-semibold">
  ${Number(ref.amount).toFixed(2)}  {/* Debe mostrar 138.00 */}
</span>
```

**Muestra:** `ref.amount` → Monto de la transferencia ($138.00)

---

## Cómo Verificar

Ejecuta: `verificar_registro_38d62066.sql`

### Valores Esperados:
```
monto_transferencia_debe_ser_138: 138.00 ✅
monto_division_debe_ser_27_30:     27.30 ✅
```

### Si está mal:
```
monto_transferencia_debe_ser_138:  27.30 ❌
monto_division_debe_ser_27_30:     27.30 ✅
```

**Problema:** El campo `amount` tiene el valor de `amount_to_use`

---

## Cómo Corregir

### Opción 1: Registro Específico
```sql
UPDATE payment_references
SET amount = 138.00,
    amount_to_use = 27.30
WHERE payment_id = '38d62066-608b-4313-b7eb-a51cb0e8e02c';
```

### Opción 2: Todas las Divisiones
Ejecuta: `fix_completo_divisiones.sql`

Esto corrige:
1. `amount` → Toma el valor de `bank_transfers.amount`
2. `amount_to_use` → Toma el valor de `pending_payments.amount_to_pay`

---

## Resumen

| Campo | Valor | Descripción |
|-------|-------|-------------|
| `amount` | $138.00 | Monto TOTAL de la transferencia |
| `amount_to_use` | $27.30 | Monto de ESTA división |

**Ambos campos son necesarios y tienen propósitos diferentes.**

---

**Fecha:** Diciembre 3, 2025, 2:15 PM
