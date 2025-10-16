# Fix: Registro de Historial en Adelantos

## Problema Reportado
Los pagos (parciales y totales) a los adelantos no se registraban en el historial (`advance_logs`).

## Causa Raíz
La función `actionApplyAdvancePayment` tenía problemas con:
1. Uso de `undefined` en lugar de `null` para campos opcionales
2. Falta de logs de debugging para rastrear problemas
3. Falta de verificación `.select()` después del insert

## Solución Implementada

### Archivo: `src/app/(app)/commissions/actions.ts`

**Cambios en `actionApplyAdvancePayment` (líneas 722-743)**:

```typescript
// ANTES:
const { error: logError } = await supabase.from('advance_logs').insert({
  advance_id,
  amount,
  payment_type,
  fortnight_id: fortnight_id || undefined,  // ❌ undefined puede causar problemas
  applied_by,
} satisfies AdvanceLogIns);

if (logError) throw logError;

// DESPUÉS:
const logPayload: AdvanceLogIns = {
  advance_id,
  amount,
  payment_type,
  fortnight_id: fortnight_id || null,  // ✅ Usar null explícitamente
  applied_by: applied_by || null,      // ✅ Usar null explícitamente
};

console.log('[actionApplyAdvancePayment] Creating advance log:', logPayload);

const { data: logData, error: logError } = await supabase
  .from('advance_logs')
  .insert([logPayload])
  .select();  // ✅ Verificar que se insertó

if (logError) {
  console.error('[actionApplyAdvancePayment] Error creating advance log:', logError);
  throw logError;
}

console.log('[actionApplyAdvancePayment] Advance log created successfully:', logData);
```

## Flujos de Pago Soportados

### 1. Pago en Efectivo (external_cash)
```
Usuario en Modal PayAdvance
  ├─> Selecciona "Efectivo"
  ├─> Ingresa monto
  └─> Click "Registrar Pago"
  
actionApplyAdvancePayment
  ├─> payment_type: 'external_cash'
  ├─> NO tiene reference_number
  ├─> Salta el if de transferencia (línea 696)
  └─> EJECUTA:
      ├─> Crea log en advance_logs ✅
      ├─> Actualiza monto del adelanto ✅
      └─> Actualiza status (PARTIAL o PAID) ✅
```

### 2. Pago por Transferencia (external_transfer) - REGISTRO INICIAL
```
Usuario en Modal PayAdvance
  ├─> Selecciona "Transferencia"
  ├─> Ingresa referencia bancaria
  ├─> Ingresa monto
  └─> Click "Registrar Pago"
  
actionApplyAdvancePayment
  ├─> payment_type: 'external_transfer'
  ├─> SÍ tiene reference_number
  └─> EJECUTA if línea 696:
      ├─> Crea pending_payment en Cheques
      ├─> can_be_paid: FALSE (espera a que ref esté en banco)
      ├─> notes: JSON con advance_id y reference_number
      └─> RETORNA sin crear log (se creará cuando se marque como pagado)
```

### 3. Pago por Transferencia - MARCAR COMO PAGADO
```
Usuario en Cheques
  ├─> Encuentra pending_payment de adelanto
  ├─> Asigna referencias bancarias
  └─> Marca como pagado
  
actionMarkPaymentsAsPaidNew (checks/actions.ts)
  ├─> Detecta: metadata.source === 'advance_external'
  └─> Llama actionApplyAdvancePayment:
      ├─> payment_type: 'external_transfer'
      ├─> NO tiene reference_number (ya fue procesada)
      ├─> Salta el if de transferencia (línea 696)
      └─> EJECUTA:
          ├─> Crea log en advance_logs ✅
          ├─> Actualiza monto del adelanto ✅
          └─> Actualiza status (PARTIAL o PAID) ✅
```

### 4. Descuento de Quincena (fortnight)
```
Usuario en Comisiones
  ├─> Selecciona quincena
  ├─> Aplica descuento a adelanto
  └─> Confirma
  
actionApplyAdvancePayment
  ├─> payment_type: 'fortnight'
  ├─> SÍ tiene fortnight_id
  └─> EJECUTA:
      ├─> Valida que no exceda comisión bruta disponible
      ├─> Crea log en advance_logs con fortnight_id ✅
      ├─> Actualiza monto del adelanto ✅
      └─> Actualiza status (PARTIAL o PAID) ✅
```

## Estructura de advance_logs

```typescript
{
  id: string (auto)
  advance_id: string (required)
  amount: number (required)
  payment_type: string (required)
    - 'fortnight'
    - 'external_cash'
    - 'external_check'
    - 'external_transfer'
  fortnight_id: string | null (opcional, solo para descuentos de quincena)
  applied_by: string | null (opcional, user_id)
  created_at: timestamp (auto)
}
```

## Visualización del Historial

**Archivo**: `src/components/commissions/AdvanceHistoryModal.tsx`

El modal consulta `advance_logs` con:
```typescript
const { data, error } = await supabase
  .from('advance_logs')
  .select('*, fortnights(period_start, period_end)')
  .eq('advance_id', advanceId)
  .order('created_at', { ascending: false });
```

Muestra:
- ✅ Fecha y hora del pago
- ✅ Tipo de pago (con etiquetas amigables)
- ✅ Detalle (quincena si aplica)
- ✅ Monto abonado
- ✅ Total abonado (suma)
- ✅ Cantidad de pagos

## Verificación

Para verificar que funciona correctamente:

### 1. Pago en Efectivo
```
1. Ir a Comisiones → Adelantos
2. Click en "Registrar Pago" para un adelanto pendiente
3. Seleccionar "Efectivo"
4. Ingresar monto (ej: $100)
5. Confirmar
6. ✅ Click en icono de historial del adelanto
7. ✅ Debe aparecer el pago de $100 como "Pago Externo (Efectivo)"
```

### 2. Pago por Transferencia
```
1. Ir a Comisiones → Adelantos
2. Click en "Registrar Pago" para un adelanto pendiente
3. Seleccionar "Transferencia"
4. Ingresar referencia: "REF123"
5. Ingresar monto: $200
6. Confirmar
7. Ir a Cheques → Pagos Pendientes
8. ✅ Debe aparecer el pago pendiente con "ADELANTO"
9. Asignar referencias bancarias y marcar como pagado
10. Volver a Comisiones → Adelantos
11. Click en historial del adelanto
12. ✅ Debe aparecer el pago de $200 como "Transferencia Externa"
```

### 3. Descuento de Quincena
```
1. Ir a Comisiones
2. Seleccionar una quincena
3. En broker con adelanto pendiente, usar el botón de descuento
4. Confirmar el descuento
5. Click en historial del adelanto
6. ✅ Debe aparecer el descuento con detalle de la quincena
```

## Logs de Debugging

Se agregaron logs en consola para facilitar debugging:
- `[actionApplyAdvancePayment] Creating advance log:` - Antes de insertar
- `[actionApplyAdvancePayment] Advance log created successfully:` - Después de insertar exitoso
- `[actionApplyAdvancePayment] Error creating advance log:` - Si hay error

Para ver estos logs:
1. Abrir DevTools (F12)
2. Ir a pestaña Console
3. Realizar un pago a un adelanto
4. Revisar los logs

## Archivos Modificados

- ✅ `src/app/(app)/commissions/actions.ts`
  - Función `actionApplyAdvancePayment` (líneas 722-743)
  - Cambio de `undefined` a `null`
  - Agregados logs de debugging
  - Agregado `.select()` para verificar inserción

## Testing

✅ **TypeCheck**: Pasado sin errores

**Próximo paso**: Probar en navegador con datos reales.

---

**Fecha**: 15 de Octubre, 2025  
**Estado**: LISTO PARA PROBAR
