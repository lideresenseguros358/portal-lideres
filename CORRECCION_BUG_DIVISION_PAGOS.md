# 🐛 CORRECCIÓN: Bug en División de Pagos

## Problema Identificado

Al dividir un pago entre múltiples beneficiarios (divisiones), el sistema estaba usando **el mismo monto** para todas las divisiones en lugar de distribuirlo proporcionalmente.

### Síntomas:
- ✅ **UI mostraba correcto**: La interfaz calculaba y mostraba los montos correctos
- ✅ **PDF mostraba correcto**: Los PDFs generados tenían los montos correctos
- ❌ **Historial Banco incorrecto**: Al registrar como "pagado", todas las divisiones usaban el mismo `amount_to_use`

### Ejemplo del Error:
```
Transferencia total: $100.00
División 1 (60%): Debería usar $60.00
División 2 (40%): Debería usar $40.00

❌ ERROR: Ambas divisiones registraban $100.00 en payment_details
```

## Causa Raíz

**Archivo:** `src/app/(app)/checks/actions.ts`
**Función:** `actionCreatePendingPayment`
**Líneas:** 793-876

Cuando se creaban divisiones, **todas compartían las mismas referencias** con el mismo `amount_to_use`:

```typescript
// ❌ CÓDIGO ANTERIOR (INCORRECTO)
const referencesToInsert = payment.references.map((ref) => ({
  payment_id: pendingPayment.id,
  reference_number: ref.reference_number,
  date: ref.date,
  amount: ref.amount,
  amount_to_use: ref.amount_to_use, // ← MISMO MONTO PARA TODAS LAS DIVISIONES
  exists_in_bank: bankRefMap.has(ref.reference_number)
}));
```

## Solución Implementada

### 1. Distribución Proporcional de Referencias

Ahora el sistema:
1. Calcula el **total de todas las divisiones**
2. Para cada división, calcula su **proporción** del total
3. Distribuye el `amount_to_use` de cada referencia **proporcionalmente**

```typescript
// ✅ CÓDIGO NUEVO (CORRECTO)
if (hasDivisions && !isBrokerDeduction && payment.divisions) {
  const totalDivisions = payment.divisions.reduce((sum, div) => sum + Number(div.amount), 0);
  
  for (let i = 0; i < pendingPayments.length; i++) {
    const division = payment.divisions[i];
    const divisionAmount = Number(division.amount);
    const divisionProportion = divisionAmount / totalDivisions; // Proporción
    
    for (const ref of payment.references) {
      const refAmountToUse = Number(ref.amount_to_use);
      const proportionalAmount = refAmountToUse * divisionProportion; // ← DISTRIBUCIÓN PROPORCIONAL
      
      allReferencesToInsert.push({
        payment_id: pendingPayment.id,
        reference_number: ref.reference_number,
        amount_to_use: proportionalAmount, // ← MONTO CORRECTO
        // ...
      });
    }
  }
}
```

### 2. Logs Detallados

Ahora el sistema registra en consola:
```
📊 Distribuyendo referencias proporcionalmente entre divisiones...
📝 División 1/2:
  client: "Cliente A"
  amount: 60
  proportion: "60.00%"
  └─ Ref 123456: $100.00 × 60.00% = $60.00
📝 División 2/2:
  client: "Cliente B"
  amount: 40
  proportion: "40.00%"
  └─ Ref 123456: $100.00 × 40.00% = $40.00
✅ Referencias distribuidas proporcionalmente
```

## Corrección de Datos Históricos

### Caso Específico Reportado

**Transferencia:** `ac020810-299b-4186-815c-2345eecae6df`
**Pago a corregir:** `b55eae1d-c56c-421c-b432-7358635278e4`
**Monto correcto:** `$57.10`

### Script SQL para Corrección

📄 **Archivo:** `fix_payment_division_bug.sql`

El script incluye:
1. ✅ Verificación del estado actual
2. ✅ Consulta de otros pagos afectados
3. ✅ Corrección del `amount_used` en `payment_details`
4. ✅ Recálculo del `used_amount` en `bank_transfers`
5. ✅ Verificación del resultado
6. ✅ Transaction con COMMIT/ROLLBACK

### Pasos para Ejecutar:

```sql
-- 1. Primero verificar estado actual (PASO 1-3 del SQL)
-- 2. Ejecutar corrección dentro de BEGIN/COMMIT
-- 3. Verificar resultado
-- 4. Si está correcto: COMMIT
-- 5. Si está mal: ROLLBACK
```

## Archivos Modificados

### 1. `src/app/(app)/checks/actions.ts`
- Agregada lógica de distribución proporcional de referencias
- Validaciones de existencia de divisiones
- Logs detallados para debugging

### 2. `fix_payment_division_bug.sql` (NUEVO)
- Script SQL para corregir datos históricos
- Incluye verificaciones y rollback safety

## Verificación

```bash
✅ npm run typecheck → 0 errores
✅ Lógica de distribución proporcional implementada
✅ Validaciones de TypeScript correctas
✅ Logs informativos agregados
✅ SQL de corrección creado
```

## Impacto

### Para Pagos Futuros:
✅ **RESUELTO**: Ahora las divisiones se registran correctamente desde el inicio

### Para Pagos Históricos:
⚠️ **ACCIÓN REQUERIDA**: Ejecutar SQL para corregir registros existentes

## Casos de Uso Afectados

### ✅ Funcionaba Correctamente:
- Pagos simples sin división
- Descuentos a corredor
- Vista en UI
- Generación de PDFs

### ❌ Estaba Fallando (AHORA CORREGIDO):
- División de pagos entre múltiples beneficiarios
- Registro en `payment_details` al marcar como pagado
- Cálculo de `used_amount` en transferencias con divisiones

## Testing Recomendado

1. **Crear pago con divisiones:**
   - Monto total: $100
   - División 1: $60 (60%)
   - División 2: $40 (40%)

2. **Verificar en consola:**
   - Debe mostrar logs de distribución proporcional
   - División 1 debe usar $60
   - División 2 debe usar $40

3. **Marcar como pagado**

4. **Verificar en base de datos:**
   ```sql
   SELECT 
     pd.client_name,
     pd.amount_used,
     bt.reference_number
   FROM payment_details pd
   JOIN bank_transfers bt ON pd.bank_transfer_id = bt.id
   WHERE bt.reference_number = 'TU_REFERENCIA'
   ORDER BY pd.paid_at;
   ```

## Notas Técnicas

### División Proporcional:
- Se calcula basado en el **monto** de cada división
- No en número de divisiones (no es 50/50, es proporcional al monto)
- Soporta cualquier número de divisiones

### Descuentos a Corredor:
- NO se distribuyen proporcionalmente
- Usan lógica especial con adelantos
- No afectados por este bug

### Referencias Múltiples:
- Si un pago usa 2 referencias de $50 cada una
- Y tiene 2 divisiones de $60 y $40
- División 1 usará: Ref1 $30 + Ref2 $30 = $60
- División 2 usará: Ref1 $20 + Ref2 $20 = $40

---

**Fecha de corrección:** Diciembre 3, 2025
**Autor:** Sistema de mantenimiento
**Prioridad:** 🔴 ALTA (afecta integridad de datos financieros)
