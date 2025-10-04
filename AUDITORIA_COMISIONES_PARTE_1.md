# 🔍 AUDITORÍA COMISIONES - PARTE 1: PROBLEMAS CRÍTICOS

**Fecha:** 2025-10-04 03:18  
**Estado:** ⚠️ PROBLEMAS CRÍTICOS DETECTADOS

---

## ❌ PROBLEMA #1: `/produccion` 404

**Descripción:** Links en dashboard usan `/produccion` pero ruta es `/production`

**Impacto:** CRÍTICO - 9 enlaces rotos en ambos dashboards

**Solución:** ✅ **YA CORREGIDO**
- `MasterDashboard.tsx`: 3 enlaces actualizados
- `BrokerDashboard.tsx`: 6 enlaces actualizados

**Archivos modificados:**
- `src/components/dashboard/MasterDashboard.tsx`
- `src/components/dashboard/BrokerDashboard.tsx`

---

## ❌ PROBLEMA #2: Falta `actionRecalculateFortnight`

**Descripción:** No existe la acción para recalcular totales de quincena

**Impacto:** BLOQUEANTE - Sin esto no se pueden calcular:
- Bruto por broker
- Descuentos (adelantos)
- Neto por broker
- No se genera `fortnight_broker_totals`

**Ubicación esperada:** `src/app/(app)/commissions/actions.ts`

**Estado:** ❌ NO EXISTE

**Debe implementar:**
1. Leer todos los `comm_items` del draft (vía `period_label`)
2. Sumar `gross_amount` por broker
3. Leer adelantos seleccionados (de `comm_metadata` o tabla temporal)
4. Calcular descuentos
5. Calcular `net_amount = gross - discounts`
6. Insertar/actualizar `fortnight_broker_totals`

---

## ❌ PROBLEMA #3: Falta `actionPayFortnight`

**Descripción:** No existe la acción para cerrar/pagar quincena

**Impacto:** BLOQUEANTE - Sin esto no se puede:
- Cambiar status a PAID
- Generar CSV Banco
- Marcar adelantos como cobrados
- Enviar notificaciones/correos

**Ubicación esperada:** `src/app/(app)/commissions/actions.ts`

**Estado:** ❌ NO EXISTE

**Debe implementar:**
1. Recalcular automáticamente (seguridad)
2. Generar CSV Banco con layout configurado
3. Excluir filas con `net_amount = 0.00`
4. Cambiar `fortnights.status = 'PAID'`
5. Crear `advance_logs` para adelantos aplicados
6. Si `notify_brokers = true`: notificaciones + correos
7. Adjuntar PDF/XLSX por broker

---

## ❌ PROBLEMA #4: No migra `pending_items` asignados

**Descripción:** Cuando Master asigna broker a pending_item, queda en `pending_items` forever

**Impacto:** CRÍTICO - Items asignados no:
- Suman al bruto del broker
- Aparecen en recalcular
- Se pagan en quincena

**Flujo actual:**
```typescript
// actionResolvePendingGroups solo marca:
await supabase
  .from('pending_items')
  .update({
    assigned_broker_id: broker_id,
    status: 'claimed', // ← Queda aquí
  });
// ❌ NO inserta en comm_items
```

**Solución requerida:**
1. Al asignar broker, calcular `gross_amount = commission_raw × broker.percent_default`
2. Insertar en `comm_items` con el import_id original
3. Marcar `pending_items` como procesado o eliminarlo

**Opciones:**
- Trigger DB que al cambiar `assigned_broker_id` migra automáticamente
- Proceso en acción que hace ambas cosas

---

## ❌ PROBLEMA #5: No inyecta items "Próxima quincena"

**Descripción:** Items marcados `approved_next` no se agregan al crear nuevo draft

**Impacto:** CRÍTICO - Items quedan huérfanos

**Flujo actual:**
```typescript
// actionMarkPendingAsNextFortnight solo marca:
await supabase
  .from('pending_items')
  .update({
    status: 'approved_next',
    action_type: 'next_fortnight',
  });
// ❌ NO hay código que los busque al crear draft
```

**Solución requerida:**
En `actionCreateDraftFortnight`, después de crear el draft:
```typescript
// 1. Buscar pending_items aprobados para siguiente quincena
const { data: pendingNext } = await supabase
  .from('pending_items')
  .select('*')
  .eq('status', 'approved_next');

// 2. Para cada uno:
for (const item of pendingNext) {
  // Calcular gross_amount
  const { data: broker } = await supabase
    .from('brokers')
    .select('percent_default')
    .eq('id', item.assigned_broker_id)
    .single();
  
  const gross = item.commission_raw * (broker.percent_default / 100);
  
  // Insertar en comm_items
  await supabase
    .from('comm_items')
    .insert({
      import_id: item.import_id,
      insurer_id: item.insurer_id,
      policy_number: item.policy_number,
      broker_id: item.assigned_broker_id,
      gross_amount: gross,
      insured_name: item.insured_name,
    });
  
  // Marcar como procesado
  await supabase
    .from('pending_items')
    .update({ status: 'processed' })
    .eq('id', item.id);
}
```

---

## ❌ PROBLEMA #6: Falta CSV Banco para "Pagar ahora"

**Descripción:** No hay acción que genere CSV para ajustes pagados ahora

**Impacto:** BLOQUEANTE - No se pueden pagar ajustes inmediatos

**Flujo esperado según spec:**
1. Master selecciona pending_items
2. Click "Pagar ahora"
3. Modal muestra resumen
4. Botón "Descargar CSV Banco"
5. Botón "Confirmar pagado"
6. Al confirmar:
   - Marcar como pagados
   - Adjuntar a última quincena cerrada (solo visual)
   - Sumar al YTD bruto del broker

**Estado:** ❌ NO EXISTE

**Acción requerida:** `actionGeneratePayNowCSV` y `actionConfirmPayNowPaid`

---

## ⚠️ PROBLEMA #7: Regla 90 días → Oficina incompleta

**Descripción:** Solo muestra toast, no asigna realmente

**Código actual:**
```typescript
const handleAssignToOffice = async () => {
  // ⚠️ TODO: Implement actual assignment
  toast.success(`${oldItems.length} grupos asignados a Oficina`);
};
```

**Solución:**
1. Tener broker "OFICINA" en DB (con flag o nombre especial)
2. Llamar `actionResolvePendingGroups` con ese broker_id
3. Aplicar a todos los items >= 90 días

---

## 📊 RESUMEN DE PROBLEMAS

| # | Problema | Prioridad | Bloqueante | Estado |
|---|----------|-----------|------------|--------|
| 1 | Links `/produccion` 404 | 🔴 ALTA | SÍ | ✅ CORREGIDO |
| 2 | Falta `actionRecalculateFortnight` | 🔴 ALTA | SÍ | ❌ PENDIENTE |
| 3 | Falta `actionPayFortnight` | 🔴 ALTA | SÍ | ❌ PENDIENTE |
| 4 | No migra pending → comm_items | 🔴 ALTA | SÍ | ❌ PENDIENTE |
| 5 | No inyecta "Próxima quincena" | 🔴 ALTA | SÍ | ❌ PENDIENTE |
| 6 | Falta CSV "Pagar ahora" | 🔴 ALTA | SÍ | ❌ PENDIENTE |
| 7 | Regla 90 días incompleta | 🟡 MEDIA | NO | ❌ PENDIENTE |

**Total bloqueantes:** 5 de 7

---

**Siguiente:** Ver PARTE 2 para estructura de DB y flujos correctos
