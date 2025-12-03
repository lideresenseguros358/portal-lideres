# 🔍 DEBUG: Remanente en Divisiones

## Problema Reportado
Diciembre 3, 2025, 12:31 PM

**Síntoma:**
- Pago agrupado por división
- Solo una división se logró registrar
- El remanente en el card superior se muestra incorrecto

---

## Logs de Depuración Agregados

He agregado logs detallados en la consola del navegador para identificar exactamente qué valores se están usando.

### Cómo Verificar

1. **Abrir DevTools del Navegador:**
   - F12 o Click derecho > Inspeccionar
   - Ir a la pestaña "Console"

2. **Recargar la página de Pagos Pendientes**

3. **Buscar en la consola:**

#### Log 1: Referencias Enriquecidas
```
📊 [Remanente] Ref XXX-XXXXX:
  amount_total: 1000          ← Monto total de la transferencia
  used_amount: 500            ← Ya usado en el banco
  remaining_amount: 500       ← Disponible real en BD
  bank_remaining_amount: 500  ← Lo que usamos en cálculos
  ref_amount_in_payment: 1000 ← Monto original en payment_reference
```

**Qué verificar:**
- ✅ `remaining_amount` debe reflejar lo ya usado
- ✅ Si una división se registró, `used_amount` debe incluirla
- ❌ Si `remaining_amount` está desactualizado, el cálculo será incorrecto

#### Log 2: Grupos Batch (Divisiones)
```
📦 [Batch] batch-abc123:
  referencias: ["REF-001", "REF-002"]
  totalBankAmount: 2000        ← Suma de montos totales
  totalBankRemaining: 1000     ← Suma de disponibles
  totalBatchAmount: 800        ← Suma de divisiones pendientes
  remanente_calculado: 200     ← totalBankRemaining - totalBatchAmount
```

**Qué verificar:**
- ✅ `totalBankRemaining` debe ser la suma de los `remaining_amount` reales
- ✅ `totalBatchAmount` debe incluir solo las divisiones pendientes (no las ya pagadas)
- ✅ `remanente_calculado` = disponible - pendiente

#### Log 3: Grupos Simples
```
📌 [Simple] REF-003:
  bank_amount: 1000           ← Monto total
  initial_remaining: 500      ← Disponible inicial (de BD)
  total_pending: 300          ← Pendiente en este grupo
  final_remaining: 200        ← 500 - 300
```

**Qué verificar:**
- ✅ `initial_remaining` debe venir de `bank_remaining_amount`
- ✅ `total_pending` debe sumar solo pagos no marcados
- ✅ `final_remaining` = initial - pending

---

## Escenarios Posibles

### Escenario 1: División Registrada pero BD No Actualizada

**Problema:**
```
División 1: $500 (ya pagada)
División 2: $500 (pendiente)

bank_transfers:
  amount: $1000
  used_amount: $0          ← ❌ No se actualizó!
  remaining_amount: $1000  ← ❌ Debería ser $500
```

**Logs mostrarían:**
```
📊 [Remanente] Ref:
  remaining_amount: 1000  ← ❌ Incorrecto, debería ser 500
  
📦 [Batch]:
  totalBankRemaining: 1000  ← ❌ Incorrecto
  totalBatchAmount: 500     ← ✅ Correcto (solo División 2)
  remanente_calculado: 500  ← ❌ Incorrecto (debería ser 0)
```

**Solución:**
Verificar que `actionMarkPaymentsAsPaidNew` esté actualizando correctamente `bank_transfers.used_amount`.

### Escenario 2: División Pendiente Duplicada

**Problema:**
```
División 1: $500 (ya pagada, pero aún aparece en pending_payments)
División 2: $500 (pendiente)

UI muestra:
  Total pendiente: $1000  ← ❌ Cuenta División 1 duplicada
```

**Logs mostrarían:**
```
📦 [Batch]:
  totalBatchAmount: 1000  ← ❌ Incorrecto (incluye la ya pagada)
  remanente_calculado: -500  ← ❌ Negativo porque cuenta de más
```

**Solución:**
Verificar que la División 1 se haya eliminado correctamente de `pending_payments`.

### Escenario 3: Ref Amount Incorrecto

**Problema:**
```
payment_references tiene ref.amount = monto total original
Pero ya se usó parte del dinero
```

**Logs mostrarían:**
```
📊 [Remanente] Ref:
  amount_total: 1000        ← ✅ Correcto (monto original)
  remaining_amount: 500     ← ✅ Correcto (disponible real)
  ref_amount_in_payment: 1000  ← ⚠️ Esto es solo referencia
  bank_remaining_amount: 500   ← ✅ Esto es lo que usamos
```

**Verificación:**
Confirmar que `bank_remaining_amount` se está usando (no `ref_amount_in_payment`).

---

## Pasos de Depuración

### Paso 1: Identificar el Pago Problemático

En la UI:
1. Localiza el card con remanente incorrecto
2. Anota el número de referencia que muestra
3. Anota el batch_id si es visible en la URL o logs

### Paso 2: Buscar en Console

```javascript
// Buscar logs de esa referencia específica
// Ejemplo: buscar "REF-001"
```

Copiar los logs que aparecen y enviarme:
- Log 📊 [Remanente] de esa referencia
- Log 📦 [Batch] de ese grupo (si aplica)

### Paso 3: Verificar en BD

Abrir Supabase > Table Editor:

```sql
-- Verificar estado de la transferencia
SELECT 
  reference_number,
  amount,
  used_amount,
  remaining_amount,
  status
FROM bank_transfers
WHERE reference_number = 'REF-XXX';

-- Verificar pagos pendientes usando esa referencia
SELECT 
  pp.id,
  pp.client_name,
  pp.amount_to_pay,
  pp.status,
  pr.reference_number,
  pr.amount_to_use
FROM pending_payments pp
JOIN payment_references pr ON pr.payment_id = pp.id
WHERE pr.reference_number = 'REF-XXX'
AND pp.status = 'pending';

-- Verificar pagos ya registrados con esa referencia
SELECT 
  pd.id,
  pd.client_name,
  pd.amount_used,
  pd.paid_at,
  bt.reference_number
FROM payment_details pd
JOIN bank_transfers bt ON bt.id = pd.bank_transfer_id
WHERE bt.reference_number = 'REF-XXX'
ORDER BY pd.paid_at DESC;
```

### Paso 4: Comparar Valores

| Campo | Esperado | Logs Console | BD Actual | Match? |
|-------|----------|--------------|-----------|---------|
| Monto Total | $1000 | ? | ? | ? |
| Usado | $500 | ? | ? | ? |
| Disponible | $500 | ? | ? | ? |
| Pendiente | $500 | ? | ? | ? |
| Remanente | $0 | ? | ? | ? |

---

## Soluciones Potenciales

### Solución A: Refrescar Datos de Banco

Si `remaining_amount` está desactualizado:

```sql
-- Recalcular remaining_amount manualmente
UPDATE bank_transfers
SET remaining_amount = amount - used_amount
WHERE reference_number = 'REF-XXX';
```

### Solución B: Limpiar División Fantasma

Si una división aparece como pendiente pero ya fue pagada:

```sql
-- Verificar el status
SELECT id, client_name, status, paid_at
FROM pending_payments
WHERE id = 'PAYMENT-ID';

-- Si status = 'paid' pero no fue eliminada
DELETE FROM payment_references WHERE payment_id = 'PAYMENT-ID';
DELETE FROM pending_payments WHERE id = 'PAYMENT-ID';
```

### Solución C: Recalcular used_amount

Si `used_amount` no refleja divisiones pagadas:

```sql
-- Recalcular used_amount desde payment_details
WITH usage AS (
  SELECT 
    bt.id as transfer_id,
    COALESCE(SUM(pd.amount_used), 0) as total_used
  FROM bank_transfers bt
  LEFT JOIN payment_details pd ON pd.bank_transfer_id = bt.id
  WHERE bt.reference_number = 'REF-XXX'
  GROUP BY bt.id
)
UPDATE bank_transfers bt
SET 
  used_amount = usage.total_used,
  remaining_amount = bt.amount - usage.total_used
FROM usage
WHERE bt.id = usage.transfer_id;
```

---

## Checklist de Verificación

Cuando una división se marca como pagada:

- [ ] `payment_details` se inserta con `amount_used` correcto
- [ ] `bank_transfers.used_amount` se actualiza (suma)
- [ ] `bank_transfers.remaining_amount` se actualiza (resta)
- [ ] `pending_payments.status` se marca como 'paid'
- [ ] `pending_payments` se elimina de la tabla
- [ ] `payment_references` se eliminan
- [ ] Al recargar UI, solo aparece la división pendiente
- [ ] `bank_remaining_amount` refleja el cambio
- [ ] Remanente en UI = disponible - pendiente

---

## Información Necesaria para Diagnóstico

Por favor, provee:

1. **Screenshot del card con remanente incorrecto**
2. **Número de referencia mostrado**
3. **Logs de consola** (📊, 📦, 📌)
4. **Query results** de las consultas SQL arriba
5. **Valores esperados vs actuales:**
   - ¿Cuánto debería estar disponible?
   - ¿Cuánto muestra pendiente?
   - ¿Cuánto muestra remanente?
   - ¿Cuánto DEBERÍA mostrar remanente?

---

## Próximos Pasos

1. ✅ Abrir DevTools Console
2. ✅ Recargar página de Pagos Pendientes
3. ✅ Copiar logs del pago problemático
4. ✅ Ejecutar queries SQL para verificar BD
5. ✅ Comparar valores
6. ✅ Identificar discrepancia
7. ✅ Aplicar solución correspondiente

---

**Estado:** 🔍 **DEPURACIÓN ACTIVA**  
**Logs Agregados:** ✅ Console logs detallados  
**Siguiente:** Analizar output de logs

---

**Documentado por:** Sistema de Desarrollo  
**Fecha:** Diciembre 3, 2025, 12:35 PM  
**Versión:** Debug v1.0
