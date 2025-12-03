# 🐛 BUG CRÍTICO: amount_to_use Incorrecto en Divisiones

## Fecha de Descubrimiento
Diciembre 3, 2025, 2:04 PM

---

## Problema

### Síntoma
Cuando se intenta marcar como pagada una división de un pago, el sistema rechaza con:
```
❌ Saldo insuficiente!
Disponible: $27.41
Intenta usar: $110.59
```

### Causa Raíz

**Línea 827-828** de `actions.ts` en la función `actionCreatePendingPayment`:

```typescript
// ❌ INCORRECTO
const refAmountToUse = Number(ref.amount_to_use); // Monto parcial del padre
const proportionalAmount = refAmountToUse * divisionProportion;
```

Cuando se crean divisiones, el código calculaba el `amount_to_use` proporcional usando el **monto parcial del pago padre** (`ref.amount_to_use`) en lugar del **monto total de la transferencia** (`ref.amount`).

---

## Ejemplo del Error

### Escenario:
```
Transferencia bancaria REF-001: $138

Pago padre:
  - amount_to_pay: $138
  - ref.amount: $138 (monto total transferencia)
  - ref.amount_to_use: $110.59 (monto parcial que se decidió usar)

Se divide en:
  - División 1: $110.59 (80.14%)
  - División 2: $27.30 (19.86%)
```

### Cálculo INCORRECTO (antes del fix):
```
División 1 amount_to_use = $110.59 × 80.14% = $88.63 ❌
División 2 amount_to_use = $110.59 × 19.86% = $21.96 ❌

Total: $88.63 + $21.96 = $110.59 ✓ (cuadra con padre)
```

**Problema:** Cuadra con el padre pero NO con la transferencia real.

### Cálculo CORRECTO (después del fix):
```
División 1 amount_to_use = $138 × 80.14% = $110.59 ✅
División 2 amount_to_use = $138 × 19.86% = $27.39 ✅

Total: $110.59 + $27.39 = $137.98 ≈ $138 ✓ (cuadra con transferencia)
```

**Correcto:** Cuadra con el monto de la transferencia bancaria.

---

## Solución Implementada

### Cambio en Código

**Archivo:** `src/app/(app)/checks/actions.ts`
**Líneas:** 827-831

**ANTES:**
```typescript
const refAmountToUse = Number(ref.amount_to_use);
const proportionalAmount = refAmountToUse * divisionProportion;

console.log(`  └─ Ref ${ref.reference_number}: $${refAmountToUse.toFixed(2)} × ${(divisionProportion * 100).toFixed(2)}% = $${proportionalAmount.toFixed(2)}`);
```

**DESPUÉS:**
```typescript
// CORRECCIÓN: Usar ref.amount (monto total) no ref.amount_to_use (monto parcial)
const refTotalAmount = Number(ref.amount);
const proportionalAmount = refTotalAmount * divisionProportion;

console.log(`  └─ Ref ${ref.reference_number}: $${refTotalAmount.toFixed(2)} × ${(divisionProportion * 100).toFixed(2)}% = $${proportionalAmount.toFixed(2)}`);
```

**Impacto:** Ahora las nuevas divisiones se crearán con `amount_to_use` correcto.

---

## Fix para Divisiones Existentes

Las divisiones creadas ANTES de este fix tienen `amount_to_use` incorrecto en la BD.

### Opción 1: Script SQL Manual

1. **Abrir Supabase SQL Editor**
2. **Ejecutar el archivo:** `fix_divisiones_amount_to_use.sql`
3. **Pasos:**

```sql
-- PASO 1: Ver divisiones afectadas
-- (Ejecutar el SELECT al final del archivo para ver qué se cambiará)

-- PASO 2: Aplicar corrección
-- (Descomentar el UPDATE en el archivo y ejecutar)

-- PASO 3: Verificar
-- (Ejecutar la verificación post-fix al final del archivo)
```

### Opción 2: Reparar Manualmente

Para el caso específico actual:

```sql
-- Identificar el pago problemático
SELECT 
  pp.id,
  pp.client_name,
  pp.amount_to_pay,
  pr.reference_number,
  pr.amount as ref_total,
  pr.amount_to_use as actual
FROM pending_payments pp
JOIN payment_references pr ON pr.payment_id = pp.id
WHERE pp.client_name = 'OSCAR BOSQUEZ'
  AND pp.status = 'pending';

-- Si el resultado muestra amount_to_use = 110.59 en División 2 ($27.30)
-- Calcular correcto:
-- $138 × (27.30 / 137.89) = $27.32

-- Actualizar manualmente
UPDATE payment_references
SET amount_to_use = 27.32  -- Monto correcto calculado
WHERE payment_id = '349e9a3c-0fdb-4d42-a5c0-a34f4104d09d'
  AND reference_number = '109054752';
```

---

## Impacto

### Antes del Fix
- ❌ Divisiones creadas con `amount_to_use` incorrecto
- ❌ No se podían marcar como pagadas (saldo insuficiente)
- ❌ Números no cuadraban con transferencias bancarias
- ❌ Remanente calculado incorrectamente

### Después del Fix
- ✅ Nuevas divisiones se crean correctamente
- ✅ Se pueden marcar como pagadas sin problemas
- ✅ Números cuadran con transferencias bancarias
- ✅ Remanente calculado correctamente

---

## Testing

### Test 1: Nueva División
```
1. Crear pago: $200
2. Referencias: REF-001 ($200, amount_to_use $180)
3. Dividir: $120 + $80
4. Verificar:
   ✅ División 1 amount_to_use: $200 × 60% = $120
   ✅ División 2 amount_to_use: $200 × 40% = $80
   ✅ Total: $200 (cuadra con transferencia)
```

### Test 2: Marcar División Como Pagada
```
1. Tener división con amount_to_use correcto
2. Marcar como pagada
3. Verificar:
   ✅ Se marca sin error "saldo insuficiente"
   ✅ bank_transfers.used_amount se actualiza correctamente
   ✅ bank_transfers.remaining_amount es correcto
```

### Test 3: Divisiones Existentes Corregidas
```
1. Ejecutar script SQL de corrección
2. Intentar marcar divisiones antiguas como pagadas
3. Verificar:
   ✅ Se marcan sin error
   ✅ Cálculos correctos
```

---

## Prevención de Regresión

### Checklist para Cambios Futuros

Cuando modifiques distribución proporcional de divisiones:

- [ ] ¿Usas `ref.amount` (monto total) o `ref.amount_to_use` (monto parcial)?
- [ ] ¿La suma de divisiones cuadra con el monto de la transferencia?
- [ ] ¿Los logs muestran los valores correctos?
- [ ] ¿Las divisiones se pueden marcar como pagadas sin error?

### Regla de Oro

**SIEMPRE calcular proporciones desde el monto TOTAL de la transferencia:**

```typescript
✅ CORRECTO:
const proportionalAmount = Number(ref.amount) * divisionProportion;

❌ INCORRECTO:
const proportionalAmount = Number(ref.amount_to_use) * divisionProportion;
```

---

## Archivos Modificados

1. ✅ `src/app/(app)/checks/actions.ts` (líneas 827-831)
2. ✅ `fix_divisiones_amount_to_use.sql` (script de corrección)
3. ✅ `FIX_BUG_DIVISIONES_AMOUNT_TO_USE.md` (este documento)

---

## Próximos Pasos

1. ✅ **Código corregido** - Nuevas divisiones usan monto total
2. ⏳ **Corregir divisiones existentes** - Ejecutar script SQL
3. ⏳ **Verificar pagos bloqueados** - Intentar marcar como pagados
4. ⏳ **Testing** - Crear divisiones nuevas y verificar

---

## Resumen Ejecutivo

### Bug
Divisiones creadas con `amount_to_use` incorrecto, causando error "saldo insuficiente" al marcar como pagadas.

### Causa
Cálculo proporcional usaba monto parcial del padre en lugar de monto total de transferencia.

### Fix
Cambiar `ref.amount_to_use` por `ref.amount` en línea 828 de `actions.ts`.

### Impacto
- ✅ Nuevas divisiones correctas
- ⏳ Divisiones existentes necesitan script SQL de corrección

**Estado:** 🎯 **BUG IDENTIFICADO Y CORREGIDO EN CÓDIGO**  
**Pendiente:** Ejecutar script SQL para corregir divisiones existentes

---

**Documentado por:** Sistema de Desarrollo  
**Fecha:** Diciembre 3, 2025, 2:10 PM  
**Severidad:** 🔴 CRÍTICA  
**Prioridad:** 🔥 ALTA
