# 🔍 AUDITORÍA COMISIONES - PARTE 3: ACCIONES FALTANTES

**Fecha:** 2025-10-04 03:22  
**Estado:** 🔴 IMPLEMENTACIÓN URGENTE REQUERIDA

---

## 🚨 ACCIONES CRÍTICAS FALTANTES

### 1. `actionRecalculateFortnight` ⚡ URGENTE

**Archivo:** `src/app/(app)/commissions/actions.ts`

**Implementación completa:**

```typescript
export async function actionRecalculateFortnight(fortnight_id: string) {
  try {
    const supabase = getSupabaseAdmin();
    const { userId } = await getAuthContext();
    
    // 1. Obtener todos los imports del draft
    const { data: imports, error: importsError } = await supabase
      .from('comm_imports')
      .select('id')
      .eq('period_label', fortnight_id);
    
    if (importsError) throw importsError;
    if (!imports || imports.length === 0) {
      return { ok: true as const, data: { message: 'No hay imports en este draft' } };
    }
    
    const importIds = imports.map(i => i.id);
    
    // 2. Obtener todos los comm_items del draft
    const { data: items, error: itemsError } = await supabase
      .from('comm_items')
      .select('broker_id, gross_amount')
      .in('import_id', importIds)
      .not('broker_id', 'is', null);
    
    if (itemsError) throw itemsError;
    
    // 3. Agrupar por broker
    const brokerTotals = (items || []).reduce((acc, item) => {
      const brokerId = item.broker_id!;
      if (!acc[brokerId]) {
        acc[brokerId] = { gross: 0, items_count: 0 };
      }
      acc[brokerId].gross += Number(item.gross_amount) || 0;
      acc[brokerId].items_count += 1;
      return acc;
    }, {} as Record<string, { gross: number; items_count: number }>);
    
    // 4. Obtener adelantos seleccionados (de comm_metadata)
    const { data: advanceSelections } = await supabase
      .from('comm_metadata')
      .select('value')
      .eq('fortnight_id', fortnight_id)
      .eq('key', 'selected_advance');
    
    // 5. Agrupar adelantos por broker
    const brokerAdvances: Record<string, { advance_id: string; amount: number }[]> = {};
    (advanceSelections || []).forEach(meta => {
      try {
        const { broker_id, advance_id, amount } = JSON.parse(meta.value || '{}');
        if (!brokerAdvances[broker_id]) {
          brokerAdvances[broker_id] = [];
        }
        brokerAdvances[broker_id].push({ advance_id, amount: Number(amount) });
      } catch (e) {
        console.error('Error parsing advance selection:', e);
      }
    });
    
    // 6. Calcular totales y crear/actualizar fortnight_broker_totals
    const upsertPromises = Object.entries(brokerTotals).map(async ([brokerId, totals]) => {
      const advances = brokerAdvances[brokerId] || [];
      const totalDiscounts = advances.reduce((sum, adv) => sum + adv.amount, 0);
      const netAmount = totals.gross - totalDiscounts;
      
      const { data: existing } = await supabase
        .from('fortnight_broker_totals')
        .select('id')
        .eq('fortnight_id', fortnight_id)
        .eq('broker_id', brokerId)
        .single();
      
      const payload = {
        fortnight_id,
        broker_id: brokerId,
        gross_amount: totals.gross,
        net_amount: netAmount,
        discounts_json: {
          adelantos: advances,
          total: totalDiscounts,
        },
      } satisfies TablesInsert<'fortnight_broker_totals'> | TablesUpdate<'fortnight_broker_totals'>;
      
      if (existing) {
        return supabase
          .from('fortnight_broker_totals')
          .update(payload)
          .eq('id', existing.id);
      } else {
        return supabase
          .from('fortnight_broker_totals')
          .insert([payload]);
      }
    });
    
    await Promise.all(upsertPromises);
    
    revalidatePath('/(app)/commissions');
    return { 
      ok: true as const, 
      data: { 
        brokers_count: Object.keys(brokerTotals).length,
        total_gross: Object.values(brokerTotals).reduce((s, t) => s + t.gross, 0),
      } 
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error al recalcular',
    };
  }
}
```

---

### 2. `actionPayFortnight` ⚡ URGENTE

**Archivo:** `src/app/(app)/commissions/actions.ts`

**Implementación completa:**

```typescript
export async function actionPayFortnight(fortnight_id: string) {
  try {
    const supabase = getSupabaseAdmin();
    const { userId } = await getAuthContext();
    
    // 1. Verificar que existe el draft
    const { data: fortnight, error: fnError } = await supabase
      .from('fortnights')
      .select('id, status, notify_brokers')
      .eq('id', fortnight_id)
      .single<FortnightRow>();
    
    if (fnError) throw fnError;
    if (!fortnight) throw new Error('Quincena no encontrada');
    if (fortnight.status === 'PAID') {
      return { ok: false as const, error: 'Esta quincena ya fue pagada' };
    }
    
    // 2. Recalcular automáticamente (seguridad)
    const recalcResult = await actionRecalculateFortnight(fortnight_id);
    if (!recalcResult.ok) {
      return { ok: false as const, error: 'Error al recalcular: ' + recalcResult.error };
    }
    
    // 3. Obtener totales por broker
    const { data: brokerTotals, error: totalsError } = await supabase
      .from('fortnight_broker_totals')
      .select(`
        *,
        brokers (
          id,
          name,
          bank_account_no,
          beneficiary_id,
          beneficiary_name
        )
      `)
      .eq('fortnight_id', fortnight_id);
    
    if (totalsError) throw totalsError;
    if (!brokerTotals || brokerTotals.length === 0) {
      return { ok: false as const, error: 'No hay totales calculados' };
    }
    
    // 4. Generar CSV Banco (solo brokers con neto > 0)
    const csvRows = brokerTotals
      .filter(bt => bt.net_amount > 0)
      .map(bt => ({
        beneficiary_name: (bt.brokers as any)?.beneficiary_name || (bt.brokers as any)?.name || '',
        beneficiary_id: (bt.brokers as any)?.beneficiary_id || '',
        account_number: (bt.brokers as any)?.bank_account_no || '',
        amount: bt.net_amount,
      }));
    
    // buildBankCsv debe leer layout de app_settings
    const csvContent = await buildBankCsv(csvRows);
    
    // 5. Cambiar status a PAID
    const { error: updateError } = await supabase
      .from('fortnights')
      .update({ status: 'PAID' } satisfies FortnightUpd)
      .eq('id', fortnight_id);
    
    if (updateError) throw updateError;
    
    // 6. Marcar adelantos como aplicados (crear logs)
    for (const bt of brokerTotals) {
      const discounts = bt.discounts_json as any;
      if (discounts?.adelantos && Array.isArray(discounts.adelantos)) {
        for (const adv of discounts.adelantos) {
          // Crear log
          await supabase.from('advance_logs').insert([{
            advance_id: adv.advance_id,
            amount: adv.amount,
            payment_type: 'fortnight',
            fortnight_id: fortnight_id,
            applied_by: userId,
          } satisfies AdvanceLogIns]);
          
          // Reducir saldo del adelanto
          const { data: advance } = await supabase
            .from('advances')
            .select('amount, status')
            .eq('id', adv.advance_id)
            .single();
          
          if (advance) {
            const newAmount = (advance as any).amount - adv.amount;
            const newStatus = newAmount <= 0 ? 'PAID' : 'PARTIAL';
            
            await supabase
              .from('advances')
              .update({
                amount: Math.max(0, newAmount),
                status: newStatus,
              } satisfies TablesUpdate<'advances'>)
              .eq('id', adv.advance_id);
          }
        }
      }
    }
    
    // 7. Si notify_brokers = true, enviar notificaciones/correos
    if (fortnight.notify_brokers) {
      // TODO: Implementar notificaciones y correos
      // Para cada broker en brokerTotals:
      // - Crear notificación en tabla notifications
      // - Generar PDF/XLSX con su detalle
      // - Enviar correo con adjunto
    }
    
    revalidatePath('/(app)/commissions');
    return { 
      ok: true as const, 
      data: { 
        csv: csvContent,
        brokers_paid: csvRows.length,
        total_paid: csvRows.reduce((s, r) => s + r.amount, 0),
      } 
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error al pagar quincena',
    };
  }
}
```

---

### 3. `actionMigratePendingToCommItems` ⚡ URGENTE

**Archivo:** `src/app/(app)/commissions/actions.ts`

**Nueva acción para migrar pending_items asignados:**

```typescript
export async function actionMigratePendingToCommItems(pending_item_ids: string[]) {
  try {
    const supabase = getSupabaseAdmin();
    
    // 1. Obtener pending_items asignados
    const { data: pendingItems, error: fetchError } = await supabase
      .from('pending_items')
      .select('*')
      .in('id', pending_item_ids)
      .not('assigned_broker_id', 'is', null)
      .returns<PendingItemRow[]>();
    
    if (fetchError) throw fetchError;
    if (!pendingItems || pendingItems.length === 0) {
      return { ok: false as const, error: 'No hay items para migrar' };
    }
    
    // 2. Para cada pending_item, calcular gross y migrar
    for (const item of pendingItems) {
      // Obtener % del broker
      const { data: broker } = await supabase
        .from('brokers')
        .select('percent_default')
        .eq('id', item.assigned_broker_id!)
        .single();
      
      if (!broker) continue;
      
      const percent = (broker as any).percent_default || 100;
      const grossAmount = item.commission_raw * (percent / 100);
      
      // Insertar en comm_items
      const { error: insertError } = await supabase
        .from('comm_items')
        .insert([{
          import_id: item.import_id!,
          insurer_id: item.insurer_id!,
          policy_number: item.policy_number,
          broker_id: item.assigned_broker_id,
          gross_amount: grossAmount,
          insured_name: item.insured_name,
          raw_row: null,
        } satisfies CommItemIns]);
      
      if (insertError) {
        console.error('Error inserting comm_item:', insertError);
        continue;
      }
      
      // Marcar pending_item como procesado
      await supabase
        .from('pending_items')
        .update({ status: 'migrated' } satisfies PendingItemUpd)
        .eq('id', item.id);
    }
    
    revalidatePath('/(app)/commissions');
    return { ok: true as const, data: { migrated: pendingItems.length } };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error al migrar items',
    };
  }
}
```

**Integración con `actionResolvePendingGroups`:**

```typescript
// Actualizar actionResolvePendingGroups:
export async function actionResolvePendingGroups(payload: unknown) {
  try {
    const parsed = ResolvePendingSchema.parse(payload);
    const supabase = getSupabaseAdmin();
    
    // ... código existente ...
    
    // Después de asignar broker:
    if (data && data.length > 0) {
      // Migrar automáticamente
      const migrateResult = await actionMigratePendingToCommItems(
        data.map(item => item.id)
      );
      
      if (!migrateResult.ok) {
        console.error('Error al migrar:', migrateResult.error);
      }
    }
    
    // ... resto del código ...
  }
}
```

---

### 4. Actualizar `actionCreateDraftFortnight` para inyectar "Próxima quincena"

**Modificación en:** `src/app/(app)/commissions/actions.ts`

```typescript
export async function actionCreateDraftFortnight(payload: unknown) {
  try {
    const parsed = CreateDraftSchema.parse(payload);
    const { userId } = await getAuthContext();
    const supabase = getSupabaseAdmin();
    
    // Validar único draft
    const { data: existing } = await supabase
      .from('fortnights')
      .select('id')
      .eq('status', 'DRAFT')
      .single<Pick<FortnightRow, 'id'>>();
    
    if (existing) {
      return { ok: false as const, error: 'Ya existe una quincena en borrador' };
    }
    
    // Crear draft
    const { data: newFortnight, error } = await supabase
      .from('fortnights')
      .insert([{
        period_start: parsed.period_start,
        period_end: parsed.period_end,
        status: 'DRAFT',
        notify_brokers: false,
        created_by: userId,
      } satisfies FortnightIns])
      .select()
      .single<FortnightRow>();
    
    if (error) throw new Error(error.message);
    
    // ✅ NUEVO: Inyectar pending_items "approved_next"
    const { data: pendingNext } = await supabase
      .from('pending_items')
      .select('*')
      .eq('status', 'approved_next')
      .not('assigned_broker_id', 'is', null)
      .returns<PendingItemRow[]>();
    
    if (pendingNext && pendingNext.length > 0) {
      console.log(`Inyectando ${pendingNext.length} items de próxima quincena`);
      
      // Crear un import virtual para estos items
      const { data: virtualImport } = await supabase
        .from('comm_imports')
        .insert([{
          insurer_id: pendingNext[0].insurer_id!,
          period_label: newFortnight.id,
          uploaded_by: userId,
          total_amount: pendingNext.reduce((s, p) => s + p.commission_raw, 0),
          is_life_insurance: false,
        } satisfies CommImportIns])
        .select()
        .single<CommImportRow>();
      
      if (virtualImport) {
        // Migrar cada item
        for (const item of pendingNext) {
          const { data: broker } = await supabase
            .from('brokers')
            .select('percent_default')
            .eq('id', item.assigned_broker_id!)
            .single();
          
          const percent = (broker as any)?.percent_default || 100;
          const grossAmount = item.commission_raw * (percent / 100);
          
          await supabase
            .from('comm_items')
            .insert([{
              import_id: virtualImport.id,
              insurer_id: item.insurer_id!,
              policy_number: item.policy_number,
              broker_id: item.assigned_broker_id,
              gross_amount: grossAmount,
              insured_name: item.insured_name,
              raw_row: null,
            } satisfies CommItemIns]);
          
          // Marcar como procesado
          await supabase
            .from('pending_items')
            .update({ status: 'injected_to_fortnight' } satisfies PendingItemUpd)
            .eq('id', item.id);
        }
      }
    }
    
    revalidatePath('/(app)/commissions');
    return { ok: true as const, data: newFortnight };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}
```

---

### 5. `actionGeneratePayNowCSV` y `actionConfirmPayNowPaid` ⚡ URGENTE

**Archivo:** `src/app/(app)/commissions/actions.ts`

```typescript
export async function actionGeneratePayNowCSV(item_ids: string[]) {
  try {
    const supabase = getSupabaseAdmin();
    
    // 1. Obtener pending_items marcados como pay_now
    const { data: items, error: fetchError } = await supabase
      .from('pending_items')
      .select(`
        *,
        brokers (
          id,
          name,
          bank_account_no,
          beneficiary_id,
          beneficiary_name,
          percent_default
        )
      `)
      .in('id', item_ids)
      .eq('status', 'approved_pay_now')
      .returns<(PendingItemRow & { brokers: any })[]>();
    
    if (fetchError) throw fetchError;
    if (!items || items.length === 0) {
      return { ok: false as const, error: 'No hay items para pagar' };
    }
    
    // 2. Calcular gross_amount para cada item
    const csvRows = items.map(item => {
      const percent = item.brokers?.percent_default || 100;
      const grossAmount = item.commission_raw * (percent / 100);
      
      return {
        beneficiary_name: item.brokers?.beneficiary_name || item.brokers?.name || '',
        beneficiary_id: item.brokers?.beneficiary_id || '',
        account_number: item.brokers?.bank_account_no || '',
        amount: grossAmount,
      };
    });
    
    // 3. Agrupar por broker (sumar si hay múltiples items del mismo)
    const grouped = csvRows.reduce((acc, row) => {
      const key = row.account_number;
      if (!acc[key]) {
        acc[key] = { ...row };
      } else {
        acc[key].amount += row.amount;
      }
      return acc;
    }, {} as Record<string, typeof csvRows[0]>);
    
    const csvContent = await buildBankCsv(Object.values(grouped));
    
    return { 
      ok: true as const, 
      data: { 
        csv: csvContent,
        items_count: items.length,
        total_amount: Object.values(grouped).reduce((s, r) => s + r.amount, 0),
      } 
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error al generar CSV',
    };
  }
}

export async function actionConfirmPayNowPaid(item_ids: string[]) {
  try {
    const supabase = getSupabaseAdmin();
    const { userId } = await getAuthContext();
    
    // 1. Obtener items y calcular gross
    const { data: items } = await supabase
      .from('pending_items')
      .select('*, brokers(percent_default)')
      .in('id', item_ids)
      .eq('status', 'approved_pay_now')
      .returns<(PendingItemRow & { brokers: any })[]>();
    
    if (!items || items.length === 0) {
      return { ok: false as const, error: 'No hay items para confirmar' };
    }
    
    // 2. Para cada item, registrar como pagado
    for (const item of items) {
      const percent = item.brokers?.percent_default || 100;
      const grossAmount = item.commission_raw * (percent / 100);
      
      // Crear registro en tabla de ajustes pagados (usar comm_metadata o crear tabla)
      await supabase
        .from('comm_metadata')
        .insert([{
          key: 'paid_adjustment',
          value: JSON.stringify({
            pending_item_id: item.id,
            broker_id: item.assigned_broker_id,
            policy_number: item.policy_number,
            commission_raw: item.commission_raw,
            gross_amount: grossAmount,
            paid_at: new Date().toISOString(),
            paid_by: userId,
          }),
        }]);
      
      // Marcar como pagado
      await supabase
        .from('pending_items')
        .update({ status: 'paid_now' } satisfies PendingItemUpd)
        .eq('id', item.id);
    }
    
    // 3. Sumar al YTD bruto del broker (esto se hace en query de YTD)
    
    revalidatePath('/(app)/commissions');
    return { ok: true as const, data: { paid_count: items.length } };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error al confirmar pago',
    };
  }
}
```

---

## 📝 RESUMEN DE IMPLEMENTACIONES

| Acción | Prioridad | Líneas | Complejidad |
|--------|-----------|--------|-------------|
| `actionRecalculateFortnight` | 🔴 CRÍTICA | ~100 | Media |
| `actionPayFortnight` | 🔴 CRÍTICA | ~150 | Alta |
| `actionMigratePendingToCommItems` | 🔴 CRÍTICA | ~80 | Media |
| Actualizar `actionCreateDraftFortnight` | 🔴 CRÍTICA | ~60 | Media |
| `actionGeneratePayNowCSV` | 🔴 CRÍTICA | ~70 | Media |
| `actionConfirmPayNowPaid` | 🔴 CRÍTICA | ~60 | Media |

**Total líneas:** ~520 líneas

**Tiempo estimado:** 4-6 horas de desarrollo + testing

---

**Siguiente:** Ver PARTE 4 para componentes UI y integraciones
