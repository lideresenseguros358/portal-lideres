# ✅ FIX FINAL: Divisiones - amount_to_use

## Flujo Correcto (Como Funciona el Wizard)

### En el Wizard:
1. Usuario crea pago con divisiones
2. Ingresa monto de cada póliza/división:
   - División 1: $110.59
   - División 2: $27.30
3. Selecciona referencia (transferencia): REF-001 ($138)
4. La referencia es de donde se dividen estos pagos

### En la BD:
- División 1: `amount_to_pay = $110.59`, `amount_to_use = $110.59` ✅
- División 2: `amount_to_pay = $27.30`, `amount_to_use = $27.30` ✅

**Regla:** `amount_to_use = monto de la división` (NO proporcional)

---

## Código Corregido

### ANTES (INCORRECTO):
```typescript
// Calculaba proporcionalmente ❌
const divisionProportion = divisionAmount / totalDivisions;
const proportionalAmount = refTotalAmount * divisionProportion;
amount_to_use: proportionalAmount
```

### AHORA (CORRECTO):
```typescript
// Usa el monto de la división directamente ✅
const divisionAmount = Number(division.amount);
amount_to_use: divisionAmount
```

**Resultado:**
- División $110.59 → `amount_to_use = $110.59` ✅
- División $27.30 → `amount_to_use = $27.30` ✅

---

## Scripts SQL para Corregir BD

### 1. Registro Específico
**Archivo:** `fix_registro_38d62066.sql`

```sql
UPDATE payment_references
SET amount_to_use = 27.30
WHERE payment_id = '38d62066-608b-4313-b7eb-a51cb0e8e02c';
```

### 2. Todas las Divisiones
**Archivo:** `fix_todas_divisiones_pendientes.sql`

```sql
-- Corrige TODAS las divisiones pendientes
UPDATE payment_references pr
SET amount_to_use = pp.amount_to_pay
FROM pending_payments pp
WHERE pr.payment_id = pp.id
  AND pp.status = 'pending'
  AND pp.notes IS NOT NULL
  AND pp.notes::jsonb ? 'batch_id'
  AND ABS(pr.amount_to_use - pp.amount_to_pay) > 0.01;
```

---

## Ejecución

### Opción 1: Solo el Registro Específico
Abre Supabase SQL Editor y ejecuta:
```sql
UPDATE payment_references
SET amount_to_use = 27.30
WHERE payment_id = '38d62066-608b-4313-b7eb-a51cb0e8e02c';
```

### Opción 2: Todas las Divisiones
Ejecuta el script completo de `fix_todas_divisiones_pendientes.sql`

---

## Verificación

Después de ejecutar el fix:

```sql
SELECT 
  pp.client_name,
  pp.amount_to_pay as division_amount,
  pr.amount_to_use,
  CASE 
    WHEN ABS(pr.amount_to_use - pp.amount_to_pay) < 0.01 THEN '✅ OK'
    ELSE '❌ ERROR'
  END as status
FROM payment_references pr
JOIN pending_payments pp ON pp.id = pr.payment_id
WHERE pp.notes::jsonb ? 'batch_id'
  AND pp.status = 'pending';
```

---

## Estado

✅ Código corregido en `actions.ts`  
✅ Scripts SQL creados  
⏳ Pendiente: Ejecutar script en Supabase

**Próximo paso:** Ejecuta el UPDATE en Supabase para corregir el registro `38d62066-608b-4313-b7eb-a51cb0e8e02c`

---

**Fecha:** Diciembre 3, 2025, 2:10 PM  
**Archivo modificado:** `src/app/(app)/checks/actions.ts` (líneas 798-835)
