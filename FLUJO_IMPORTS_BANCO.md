# FLUJO COMPLETO: IMPORTACIÓN DE REPORTES CON SISTEMA BANCO

## ✅ IMPLEMENTACIÓN COMPLETADA

### Cambios Principales

1. **database.types.ts actualizado** con tabla `bank_transfer_imports`
2. **ImportForm flexible** - permite importar sin transferencia o con monto 0.00
3. **División de transferencias** - sin necesidad de especificar montos por reporte
4. **Soporte para reportes con descuentos** - manejo de casos especiales

---

## 📋 CASOS DE USO

### Caso 1: Import Normal con Transferencia Única
**Escenario:** Una transferencia de $1,000 para un reporte

**Flujo:**
1. Usuario selecciona aseguradora
2. Selecciona la transferencia del dropdown (autocompletará monto)
3. Sube el archivo
4. Sistema vincula: 1 transferencia → 1 reporte

**Resultado:**
- `bank_transfer_imports`: 1 registro (transfer_id, import_id, amount: $1,000)
- Transferencia marcada como usada

---

### Caso 2: División de Transferencia (Múltiples Reportes)
**Escenario:** Una transferencia de $1,000 dividida entre 2 reportes ($400 y $600)

**Flujo:**
1. **Primer Reporte:**
   - Selecciona aseguradora A
   - Selecciona la transferencia (autocompletará $1,000)
   - Puede cambiar monto a $400 o dejarlo en $1,000
   - Sube archivo

2. **Segundo Reporte:**
   - Selecciona aseguradora B
   - Selecciona la MISMA transferencia
   - Puede cambiar monto a $600 o dejarlo en $1,000
   - Sube archivo

**Resultado:**
- `bank_transfer_imports`: 2 registros
  - (transfer_id, import_id_1, amount: $400)
  - (transfer_id, import_id_2, amount: $600)
- Sistema NO valida que sumen exactamente $1,000 (flexible)

**Nota:** El sistema permite flexibilidad. No es necesario que los montos sumen exactamente el total de la transferencia.

---

### Caso 3: Reporte Sin Transferencia (Descuento de Aseguradora)
**Escenario:** Reporte con descuentos que resulta en monto negativo, sin transferencia recibida

**Flujo:**
1. Usuario selecciona aseguradora
2. **NO selecciona transferencia** (deja dropdown vacío)
3. Ingresa monto: **0.00** (o cualquier monto)
4. Sube archivo con clientes en positivo y negativo

**Resultado:**
- `comm_imports`: registro creado con total_amount: 0.00
- NO se crea registro en `bank_transfer_imports` (sin transferencia)
- Clientes procesados normalmente
- Al cerrar quincena, se puede crear transferencia "fantasma" (ver Caso 5)

**Uso:** Cuando la aseguradora descontó lo suficiente como para dejar el reporte en negativo, pero aún hay clientes en positivo que debemos pagar.

---

### Caso 4: Importar Múltiples Reportes Independientes
**Escenario:** 3 aseguradoras, 3 transferencias diferentes

**Flujo:**
1. Reporte 1: Aseguradora A + Transferencia A + Archivo A
2. Reporte 2: Aseguradora B + Transferencia B + Archivo B
3. Reporte 3: Aseguradora C + Transferencia C + Archivo C

**Resultado:**
- 3 registros en `comm_imports`
- 3 registros en `bank_transfer_imports` (uno por cada)
- Cada transferencia vinculada a su reporte

---

### Caso 5: Crear Transferencia "Fantasma" al Cerrar Quincena
**Escenario:** Reporte importado con monto 0.00 (Caso 3) que necesita registro en banco

**Al confirmar quincena PAGADO:**

Sistema crea automáticamente una transferencia bancaria con:
- **Tipo:** `transfer_type = 'REPORTE'`
- **Estado:** `status = 'PAGADO'`
- **Referencia:** `"DESCUENTO ASEGURADORA - [Nombre Aseguradora]"`
- **Descripción:** `description_raw = "[Nombre Aseguradora] - Reporte Q[XX]"`
- **Monto:** Negativo del total pagado a corredores
  - Ejemplo: Si se pagó $200 a corredores, monto = `-$200`
- **Fecha:** Fecha de cierre de quincena

**Propósito:** Registro contable del pago realizado sin transferencia recibida.

---

## 🔄 FLUJO TÉCNICO

### Base de Datos

#### Tablas Involucradas

1. **`comm_imports`**
   - Almacena cada reporte importado
   - Campos: `id`, `insurer_id`, `total_amount`, `period_label`, etc.

2. **`bank_transfers_comm`** (existente)
   - Transferencias bancarias del corte
   - Campos: `id`, `reference_number`, `amount`, `status`, `transfer_type`

3. **`bank_groups`** (existente)
   - Agrupaciones de transferencias
   - Para matching con múltiples reportes

4. **`bank_transfer_imports`** ⭐ (NUEVA)
   ```sql
   CREATE TABLE bank_transfer_imports (
     id UUID PRIMARY KEY,
     transfer_id UUID REFERENCES bank_transfers_comm(id),
     import_id UUID REFERENCES comm_imports(id),
     amount_assigned NUMERIC(12,2),
     created_at TIMESTAMPTZ,
     CONSTRAINT unique_transfer_import UNIQUE(transfer_id, import_id)
   );
   ```
   - **Permite:** 1 transferencia → N imports (división)
   - **Permite:** 1 import → 0 o 1 transferencia (sin transferencia OK)

5. **`bank_group_imports`** (existente)
   - Vincula grupos bancarios con imports
   - Para casos de múltiples transferencias agrupadas

---

### Validaciones

#### Frontend (`ImportForm.tsx`)

```typescript
// Validación flexible
if (!totalAmount && !selectedOption) {
  // Error: debe tener monto O transferencia
  return;
}

// Permitido:
// - Monto 0.00 + sin transferencia ✅
// - Monto 0.00 + con transferencia ✅
// - Monto > 0 + sin transferencia ✅
// - Monto > 0 + con transferencia ✅
```

#### Backend (`actions.ts`)

```typescript
// Sin validaciones estrictas de monto
// Sistema flexible permite cualquier combinación
```

---

## 📊 VISUALIZACIÓN

### Lista de Imports en Nueva Quincena

Muestra para cada reporte importado:
- ✅ Aseguradora
- ✅ Monto total del reporte
- ✅ Transferencia vinculada (si existe)
- ✅ Cantidad de ítems procesados
- ✅ Corredores identificados
- ✅ Total comisiones calculadas

### Tabla de Corredores

Por cada reporte, muestra:
- ✅ Nombre del corredor
- ✅ Cantidad de pólizas
- ✅ Comisión bruta calculada (monto * percent_default)
- ✅ Porcentaje aplicado

**Importante:** NO se mezcla con quincenas ya cerradas.

---

## 🔧 CONTADORES Y TOTALES

### Contador de Reportes Importados
```typescript
imports.length // Total de reportes en la quincena actual
```

### Contador de Transferencias Usadas
```typescript
// Deduplicar por transfer_id
const uniqueTransfers = new Set(
  imports
    .filter(i => i.bank_transfer_id)
    .map(i => i.bank_transfer_id)
);
uniqueTransfers.size
```

### Total Recibido del Banco
```typescript
// Sumar montos únicos de transferencias (deduplicar)
const transferMap = new Map();
imports.forEach(i => {
  if (i.bank_transfer_id && i.amount_assigned) {
    if (!transferMap.has(i.bank_transfer_id)) {
      transferMap.set(i.bank_transfer_id, i.amount_assigned);
    }
  }
});
const totalRecibido = Array.from(transferMap.values())
  .reduce((sum, amt) => sum + amt, 0);
```

### Total a Pagar Corredores
```typescript
// Sumar comisiones brutas de todos los imports
const totalAPagar = imports.reduce((sum, imp) => {
  return sum + imp.broker_commissions_total;
}, 0);
```

### Diferencia (Oficina)
```typescript
const diferencia = totalRecibido - totalAPagar;
```

---

## 🎯 MEJORAS IMPLEMENTADAS

### 1. Flexibilidad en Montos
- ✅ No requiere especificar monto exacto por reporte al dividir
- ✅ Permite monto 0.00 para casos especiales
- ✅ No valida que la suma coincida exactamente

### 2. Importación Sin Transferencia
- ✅ Dropdown opcional
- ✅ Mensaje claro: "Sin vincular (manual)"
- ✅ Soporte para casos de descuentos

### 3. División Flexible
- ✅ Misma transferencia usable en múltiples reportes
- ✅ `bank_transfer_imports` permite N imports por transferencia
- ✅ No hay constraint de unicidad en `transfer_id`

### 4. UX Mejorada
- ✅ Autocompletado de monto al seleccionar transferencia
- ✅ Placeholder informativo
- ✅ Help text explicativo
- ✅ Botón habilitado sin requerir monto

---

## 📝 NOTAS TÉCNICAS

### Cast Temporal en Supabase
```typescript
// Mientras no se regeneren tipos después de migración
const { error } = await (supabase as any)
  .from('bank_transfer_imports')
  .insert({ ... });
```

**Acción requerida:** Después de ejecutar migración SQL en Supabase, regenerar `database.types.ts`.

### Migración SQL Ejecutada
```sql
-- Archivo: supabase/migrations/20241218_bank_transfer_imports.sql
-- ✅ Tabla creada
-- ✅ Índices agregados
-- ✅ RLS configurado (solo MASTER)
-- ✅ Función helper para calcular total usado
```

---

## ✅ VERIFICACIÓN

### Checklist de Testing

- [ ] Importar reporte con transferencia única
- [ ] Dividir una transferencia en 2 reportes
- [ ] Importar reporte sin transferencia (monto 0.00)
- [ ] Usar misma transferencia en 3 reportes diferentes
- [ ] Verificar contadores en UI
- [ ] Verificar tabla de corredores con cálculos correctos
- [ ] Confirmar que NO se mezcla con quincenas cerradas
- [ ] Probar autocomplete de monto al seleccionar transferencia

### Comandos de Verificación

```sql
-- Ver imports con sus transferencias
SELECT 
  ci.id as import_id,
  i.name as aseguradora,
  ci.total_amount,
  bti.transfer_id,
  bti.amount_assigned,
  bt.reference_number
FROM comm_imports ci
JOIN insurers i ON ci.insurer_id = i.id
LEFT JOIN bank_transfer_imports bti ON ci.id = bti.import_id
LEFT JOIN bank_transfers_comm bt ON bti.transfer_id = bt.id
WHERE ci.period_label = 'DRAFT'
ORDER BY ci.created_at DESC;

-- Ver cuántos imports usa cada transferencia
SELECT 
  bt.reference_number,
  bt.amount as transfer_total,
  COUNT(bti.id) as num_imports,
  SUM(bti.amount_assigned) as sum_assigned
FROM bank_transfers_comm bt
LEFT JOIN bank_transfer_imports bti ON bt.id = bti.transfer_id
GROUP BY bt.id
HAVING COUNT(bti.id) > 1; -- Solo las divididas
```

---

## 🚀 ESTADO ACTUAL

### ✅ Completado
1. Migración SQL ejecutada por usuario
2. `database.types.ts` actualizado manualmente
3. `ImportForm.tsx` ajustado para flexibilidad
4. `actions.ts` con lógica de vinculación
5. Typecheck OK (0 errores)

### ⏳ Pendiente (Usuario)
1. Testing completo del flujo
2. Regenerar tipos desde Supabase después de migración
3. Verificar que UI muestre correctamente la lista de imports
4. Confirmar cálculos de comisiones

---

## 📞 SOPORTE

Si encuentras algún problema:

1. **Error de tipos:** Regenerar `database.types.ts` desde Supabase
2. **Transferencia no se vincula:** Verificar que migración SQL se ejecutó
3. **Monto no autocompleta:** Verificar que transferencia tenga `amount` válido
4. **Contador incorrecto:** Verificar lógica de deduplicación

---

**Última actualización:** 2024-12-18
**Estado:** ✅ READY FOR TESTING
