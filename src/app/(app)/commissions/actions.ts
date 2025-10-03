'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServer,
  Tables,
  TablesInsert,
  TablesUpdate,
} from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  UploadImportSchema,
  CreateDraftSchema,
  ResolvePendingSchema,
  AdvanceSchema,
  ToggleNotifySchema,
} from '@/lib/commissions/schemas';
import { parseCsvXlsx } from '@/lib/commissions/importers';
import { calculateDiscounts } from '@/lib/commissions/rules';
import { buildBankCsv } from '@/lib/commissions/bankCsv';
import { getAuthContext } from '@/lib/db/context';

type FortnightRow = Tables<'fortnights'>;
type FortnightIns = TablesInsert<'fortnights'>;
type FortnightUpd = TablesUpdate<'fortnights'>;
type FortnightBrokerTotalRow = Tables<'fortnight_broker_totals'>;
type FortnightBrokerTotalIns = TablesInsert<'fortnight_broker_totals'>;
type CommImportRow = Tables<'comm_imports'>;
type CommImportIns = TablesInsert<'comm_imports'>;
type CommItemRow = Tables<'comm_items'>;
type CommItemIns = TablesInsert<'comm_items'>;
type CommItemUpd = TablesUpdate<'comm_items'>;
type AdvanceRow = Tables<'advances'>;
type AdvanceIns = TablesInsert<'advances'>;
type AdvanceLogRow = Tables<'advance_logs'>;
type AdvanceLogIns = TablesInsert<'advance_logs'>;

/**
 * Upload and import commission file (CSV/XLSX/PDF)
 */
export async function actionUploadImport(formData: FormData) {
  try {
    console.log('[SERVER] actionUploadImport called');
    const file = formData.get('file') as File;
    const rawData = {
      insurer_id: String(formData.get('insurer_id') || ''),
      total_amount: String(formData.get('total_amount') || '0'),
      fortnight_id: String(formData.get('fortnight_id') || ''),
      invert_negatives: String(formData.get('invert_negatives') || 'false'),
    };

    console.log('[SERVER] FormData:', { ...rawData, fileName: file?.name });

    // Validate input
    const parsed = UploadImportSchema.parse(rawData);
    console.log('[SERVER] Validation passed:', parsed);

    if (!file) {
      return { ok: false as const, error: 'Archivo requerido' };
    }

    const { userId } = await getAuthContext();
    const supabase = getSupabaseAdmin();
    
    console.log('[SERVER] Parsing file...');
    
    // Get insurer mapping rules
    const { data: mappingRules } = await supabase
      .from('insurer_mapping_rules')
      .select('target_field, aliases')
      .eq('insurer_id', parsed.insurer_id);
    
    console.log('[SERVER] Mapping rules:', mappingRules);
    
    // Get insurer configuration for invert_negatives
    const { data: insurerData } = await supabase
      .from('insurers')
      .select('invert_negatives')
      .eq('id', parsed.insurer_id)
      .single();
    
    const invertNegatives = insurerData?.invert_negatives || false;
    console.log('[SERVER] Invert negatives from insurer config:', invertNegatives);
    
    const rows = await parseCsvXlsx(file, mappingRules || [], invertNegatives);
    console.log('[SERVER] Parsed rows:', rows.length);
    console.log('[SERVER] First 3 rows:', rows.slice(0, 3).map(r => ({
      policy: r.policy_number,
      client: r.client_name,
      amount: r.commission_amount
    })));

    // 1. Create the comm_imports record with user-entered total_amount
    const { data: importRecord, error: importError } = await supabase
      .from('comm_imports')
      .insert({
        insurer_id: parsed.insurer_id,
        period_label: parsed.fortnight_id,
        uploaded_by: userId,
        total_amount: parseFloat(parsed.total_amount),
      } satisfies CommImportIns)
      .select()
      .single<CommImportRow>();

    if (importError) throw importError;
    if (!importRecord) throw new Error('Failed to create import record');
    
    console.log('[SERVER] Saved total_amount:', importRecord.total_amount, 'for import:', importRecord.id);

    // 2. Prepare comm_items - sin broker_id = pendiente de identificar
    const itemsToInsert: CommItemIns[] = rows.map(row => ({
      import_id: importRecord.id,
      insurer_id: parsed.insurer_id,
      policy_number: row.policy_number || 'PENDIENTE',
      gross_amount: row.commission_amount || 0,
      insured_name: row.client_name || 'PENDIENTE DE IDENTIFICAR',
      raw_row: row.raw_row,
      // broker_id omitido = NULL en DB = pendiente de identificar
    }));

    console.log('[SERVER] Items to insert:', itemsToInsert.length);

    // 3. Insert comm_items
    if (itemsToInsert.length > 0) {
      const { error: itemsError } = await supabase
        .from('comm_items')
        .insert(itemsToInsert);
      
      if (itemsError) {
        console.error('[SERVER] Error inserting items:', itemsError);
        throw itemsError;
      }
      console.log('[SERVER] Items inserted successfully');
    }

    const result = { 
      insertedCount: itemsToInsert.length,
      importId: importRecord.id,
      totalAmount: parsed.total_amount,
    };

    console.log('[SERVER] Import successful:', result);
    revalidatePath('/(app)/commissions');
    return { ok: true as const, data: result };
  } catch (error) {
    console.error('[SERVER] Import error:', error);
    
    // Mejor manejo de errores
    let errorMessage = 'Error desconocido';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
      // Supabase errors
      errorMessage = JSON.stringify(error);
    }
    
    console.error('[SERVER] Error message:', errorMessage);
    
    return {
      ok: false as const,
      error: errorMessage,
    };
  }
}

/**
 * Create a new draft fortnight
 */
export async function actionCreateDraftFortnight(payload: unknown) {
  try {
    const parsed = CreateDraftSchema.parse(payload);
    const { userId } = await getAuthContext();
    const supabase = getSupabaseAdmin();

    const { data: existing } = await supabase
      .from('fortnights')
      .select('id')
      .eq('status', 'DRAFT')
      .single<Pick<FortnightRow, 'id'>>();

    if (existing) {
      return { ok: false as const, error: 'Ya existe una quincena en borrador' };
    }

    const { data, error } = await supabase
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

    revalidatePath('/(app)/commissions');
    return { ok: true as const, data };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Get Year-to-Date gross commissions, aggregated by broker and insurer
 */
export async function actionGetYTDCommissions(year: number, brokerId?: string | null, includePreviousYear?: boolean) {
  const supabase = await getSupabaseAdmin();

  const currentYearStartDate = `${year}-01-01T00:00:00.000Z`;
  const currentYearEndDate = `${year}-12-31T23:59:59.999Z`;

  const previousYear = year - 1;
  const previousYearStartDate = `${previousYear}-01-01T00:00:00.000Z`;
  const previousYearEndDate = `${previousYear}-12-31T23:59:59.999Z`;

  try {
    let query = supabase
      .from('comm_items')
      .select(`
        gross_amount,
        created_at,
        brokers (id, name),
        insurers (id, name)
      `)
      .gte('created_at', includePreviousYear ? previousYearStartDate : currentYearStartDate)
      .lte('created_at', currentYearEndDate);

    if (brokerId) {
      query = query.eq('broker_id', brokerId);
    }

    const { data, error } = await query.returns<
      (Pick<CommItemRow, 'gross_amount' | 'created_at'> & {
        brokers: Pick<Tables<'brokers'>, 'id' | 'name'> | null;
        insurers: Pick<Tables<'insurers'>, 'id' | 'name'> | null;
      })[]
    >();

    if (error) throw new Error(error.message);

    const aggregated = (data || [])
      .filter(item => item.brokers && item.insurers)
      .reduce((acc, item) => {
        const itemYear = new Date(item.created_at!).getFullYear();
        const broker = item.brokers!;
        const insurer = item.insurers!;
        const key = `${broker.id}-${insurer.id}-${itemYear}`;

        if (!acc[key]) {
          acc[key] = {
            broker_id: broker.id,
            broker_name: broker.name || 'N/A',
            insurer_name: insurer.name,
            year: itemYear,
            total_gross: 0,
          };
        }
        acc[key].total_gross += Number(item.gross_amount) || 0; // Convert unknown to number
        return acc;
      }, {} as Record<string, { broker_id: string; broker_name: string; insurer_name: string; year: number; total_gross: number }>);

    return { ok: true as const, data: Object.values(aggregated) };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

export async function actionGetAllAdvances() {
  const supabase = await getSupabaseAdmin();
  try {
    const { data, error } = await supabase
      .from('advances')
      .select('*')
      .gt('amount', 0)
      .order('created_at', { ascending: false })
      .returns<AdvanceRow[]>();

    if (error) throw error;
    return { ok: true as const, data: data || [] };
  } catch (error) {
    return { ok: false as const, error: String(error) };
  }
}

// Get advances filtered by broker
export async function actionGetAdvances(brokerId?: string, year?: number) {
  const supabase = await getSupabaseAdmin();
  try {
    let query = supabase
      .from('advances')
      .select('*, brokers(id, name)')
      .gt('amount', 0)
      .order('created_at', { ascending: false });

    // CRITICAL: Filter by broker_id if provided
    if (brokerId) {
      query = query.eq('broker_id', brokerId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { ok: true as const, data: data || [] };
  } catch (error) {
    return { ok: false as const, error: String(error) };
  }
}

export async function actionApplyAdvancePayment(payload: { advance_id: string; amount: number; payment_type: string; fortnight_id?: string; broker_id?: string }) {
  try {
    const { advance_id, amount, payment_type, fortnight_id, broker_id } = payload;
    const { userId: applied_by } = await getAuthContext();
    const supabase = getSupabaseAdmin();

    // Validar que el monto no sea negativo
    if (amount <= 0) {
      return { ok: false as const, error: 'El monto debe ser mayor a cero' };
    }

    const { data: advance, error: advanceError } = await supabase
      .from('advances')
      .select('id, amount, status, broker_id')
      .eq('id', advance_id)
      .single();

    if (advanceError) throw advanceError;
    if (!advance) throw new Error('Adelanto no encontrado');

    // Validar que el monto no exceda el saldo del adelanto
    if (amount > (advance as any).amount) {
      return { ok: false as const, error: `El monto no puede exceder el saldo del adelanto ($${(advance as any).amount.toFixed(2)})` };
    }

    // Si es descuento de quincena, validar que no exceda comisión bruta
    if (payment_type === 'fortnight' && fortnight_id && broker_id) {
      const { data: brokerTotal } = await supabase
        .from('fortnight_broker_totals')
        .select('gross_amount, discount_amount')
        .eq('fortnight_id', fortnight_id)
        .eq('broker_id', broker_id)
        .single();

      if (brokerTotal) {
        const currentGross = (brokerTotal as any).gross_amount || 0;
        const currentDiscounts = (brokerTotal as any).discount_amount || 0;
        const availableForDiscount = currentGross - currentDiscounts;
        
        if (amount > availableForDiscount) {
          return { ok: false as const, error: `El monto excede la comisión bruta disponible ($${availableForDiscount.toFixed(2)})` };
        }
      }
    }

    const { error: logError } = await supabase.from('advance_logs').insert({
      advance_id,
      amount,
      payment_type,
      fortnight_id: fortnight_id || undefined,
      applied_by,
    } satisfies AdvanceLogIns);

    if (logError) throw logError;

    const newAmount = (Number((advance as any).amount) || 0) - amount;
    const newStatus = newAmount <= 0 ? 'PAID' : 'PARTIAL';

    const { error: updateError } = await supabase.from('advances').update({
      amount: newAmount,
      status: newStatus,
    } satisfies TablesUpdate<'advances'>).eq('id', advance_id);

    if (updateError) throw updateError;

    revalidatePath('/(app)/commissions');
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// Alias for compatibility
export async function actionApplyAdvanceDiscount(payload: any) {
  return actionApplyAdvancePayment({
    advance_id: payload.advance_id,
    amount: payload.amount,
    payment_type: payload.payment_type || 'fortnight',
    fortnight_id: payload.fortnight_id,
  });
}

export async function actionCreateClaim(payload: { comm_item_id: string; broker_id: string }) {
  try {
    const supabase = getSupabaseAdmin();
    const { comm_item_id, broker_id } = payload;

    const { data, error } = await supabase
      .from('comm_item_claims')
      .insert([{
        comm_item_id,
        broker_id,
        status: 'pending',
      }])
      .select();

    if (error) {
      throw new Error(error.message);
    }
    revalidatePath('/(app)/commissions');
    return { ok: true as const, data };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

export async function actionResolveClaim(payload: unknown) {
  try {
    const parsed = payload as {
      claim_id: string;
      status: string;
      broker_id: string;
      comm_item_id: string;
    };
    const { userId } = await getAuthContext();
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('comm_item_claims')
      .update({ status: parsed.status, resolved_by: userId, resolved_at: new Date().toISOString() })
      .eq('id', parsed.claim_id);

    if (error) throw error;

    if (parsed.status === 'approved') {
      const { error: updateItemError } = await supabase
        .from('comm_items')
        .update({ broker_id: parsed.broker_id })
        .eq('id', parsed.comm_item_id);
      if (updateItemError) throw updateItemError;
    }

    revalidatePath('/(app)/commissions');
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// Compatibility function for resolving pending groups
export async function actionResolvePendingGroups(payload: unknown) {
  try {
    const parsed = payload as { 
      broker_id: string; 
      policy_number: string; 
      item_ids?: string[] 
    };
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('comm_items')
      .update({ broker_id: parsed.broker_id } satisfies CommItemUpd)
      .eq('policy_number', parsed.policy_number)
      .is('broker_id', null);

    if (parsed.item_ids && parsed.item_ids.length > 0) {
      query = query.in('id', parsed.item_ids);
    }

    const { data, error } = await query.select();

    if (error) throw new Error(error.message);

    revalidatePath('/(app)/commissions');
    return { ok: true as const, data: { updated: data?.length || 0 } };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

export async function actionCreateAdvance(payload: { broker_id: string; amount: number; reason: string }) {
  try {
    const { userId } = await getAuthContext();
    const supabase = getSupabaseAdmin();
    const { broker_id, amount, reason } = payload;

    const { data, error } = await supabase
      .from('advances')
      .insert([{
        broker_id,
        amount,
        reason,
        status: 'PENDING',
        created_by: userId,
      } satisfies AdvanceIns])
      .select();

    if (error) throw error;
    revalidatePath('/(app)/commissions');
    return { ok: true as const, data };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// Alias for compatibility
export async function actionAddAdvance(brokerId: string, payload: { amount: number; reason: string }) {
  return actionCreateAdvance({
    broker_id: brokerId,
    amount: payload.amount,
    reason: payload.reason,
  });
}

export async function actionRejectAdvance(advanceId: string) {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('advances')
      .update({ status: 'REJECTED' })
      .eq('id', advanceId);

    if (error) throw error;
    revalidatePath('/(app)/commissions');
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

export async function actionReassignAdvance(advanceId: string, broker_id: string) {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('advances')
      .update({ broker_id })
      .eq('id', advanceId);

    if (error) throw error;
    revalidatePath('/(app)/commissions');
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// Get advance history
export async function actionGetAdvanceHistory(advanceId: string) {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('advance_logs')
      .select('*, fortnights(period_start, period_end)')
      .eq('advance_id', advanceId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { ok: true as const, data };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// Recalculate fortnight totals
export async function actionRecalculateFortnight(fortnightId: string) {
  try {
    const supabase = getSupabaseAdmin();
    
    // Get fortnight details
    const { data: fortnight, error: fError } = await supabase
      .from('fortnights')
      .select('*')
      .eq('id', fortnightId)
      .single<FortnightRow>();

    if (fError || !fortnight) throw new Error('Quincena no encontrada');

    // Get all comm_items in the period with broker and insurer info
    const { data: items, error: itemsError } = await supabase
      .from('comm_items')
      .select('broker_id, gross_amount, insurer_id, insured_name, policy_number')
      .not('broker_id', 'is', null)
      .gte('created_at', fortnight.period_start!)
      .lte('created_at', fortnight.period_end!);

    if (itemsError) throw new Error(itemsError.message);

    // Get broker commission percentages (YA EXISTE en DB)
    // NOTA: Regenerar tipos con: npx supabase gen types typescript --project-id xxx > src/lib/supabase/database.types.ts
    const { data: brokers } = await supabase
      .from('brokers')
      .select('id') as any;

    const brokerPercentages = new Map<string, number>();
    for (const broker of brokers || []) {
      // TODO: Usar commission_percentage cuando se regeneren los tipos
      brokerPercentages.set(broker.id, broker.commission_percentage || 100);
    }

    // Get broker-insurer overrides (si existen)
    const overrideMap = new Map<string, number>();
    // TODO: Habilitar cuando se regeneren los tipos
    // const { data: overrides } = await supabase
    //   .from('broker_insurer_overrides')
    //   .select('broker_id, insurer_id, commission_percentage') as any;
    // for (const override of overrides || []) {
    //   const key = `${override.broker_id}-${override.insurer_id}`;
    //   overrideMap.set(key, override.commission_percentage);
    // }

    // Group by broker and calculate commission with percentage
    // Agrupación por nombre de cliente (no solo póliza)
    const brokerTotals = new Map<string, number>();
    const brokerClientGroups = new Map<string, Map<string, number>>();
    
    for (const item of items || []) {
      const brokerId = item.broker_id!;
      const insurerId = item.insurer_id;
      const clientName = item.insured_name || 'DESCONOCIDO';
      const reportCommission = Number(item.gross_amount) || 0;
      
      // Get percentage (check override first, then default)
      const overrideKey = `${brokerId}-${insurerId}`;
      const percentage = overrideMap.get(overrideKey) || brokerPercentages.get(brokerId) || 100;
      
      // Calculate broker's gross commission
      const brokerGrossCommission = (reportCommission * percentage) / 100;
      
      // Group by client name
      if (!brokerClientGroups.has(brokerId)) {
        brokerClientGroups.set(brokerId, new Map());
      }
      const clientMap = brokerClientGroups.get(brokerId)!;
      const currentClientTotal = clientMap.get(clientName) || 0;
      clientMap.set(clientName, currentClientTotal + brokerGrossCommission);
      
      // Total by broker
      const current = brokerTotals.get(brokerId) || 0;
      brokerTotals.set(brokerId, current + brokerGrossCommission);
    }

    // Get advances for each broker
    const { data: advances } = await supabase
      .from('advances')
      .select('broker_id, amount, reason')
      .eq('status', 'PENDING');

    // Group advances by broker
    const brokerAdvances = new Map<string, Array<{ amount: unknown; reason: string }>>();
    for (const advance of advances || []) {
      const current = brokerAdvances.get(advance.broker_id!) || [];
      current.push({ amount: advance.amount, reason: advance.reason || '' });
      brokerAdvances.set(advance.broker_id!, current);
    }

    // Calculate and upsert totals for each broker
    const upserts: FortnightBrokerTotalIns[] = [];
    
    for (const [brokerId, grossAmount] of brokerTotals) {
      const advances = brokerAdvances.get(brokerId) || [];
      const totalAdvances = advances.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
      const discounts = { advances: totalAdvances };
      const netAmount = grossAmount - totalAdvances;

      upserts.push({
        fortnight_id: fortnightId,
        broker_id: brokerId,
        gross_amount: grossAmount,
        discounts_json: discounts,
        net_amount: netAmount,
        bank_snapshot: {
          account_no: 'PENDING',
          name: 'PENDING',
          amount: netAmount,
        },
      });
    }

    // Upsert all totals
    if (upserts.length > 0) {
      const { error: upsertError } = await supabase
        .from('fortnight_broker_totals')
        .upsert(upserts, { onConflict: 'fortnight_id,broker_id' });

      if (upsertError) throw new Error(upsertError.message);
    }

    revalidatePath('/(app)/commissions');
    return { ok: true as const, data: { recalculated: upserts.length } };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// Toggle notification setting for a fortnight
export async function actionToggleNotify(fortnightId: string, on: boolean) {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('fortnights')
      .update({ notify_brokers: on } satisfies FortnightUpd)
      .eq('id', fortnightId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidatePath('/(app)/commissions');
    return { ok: true as const, data };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// Pay fortnight
export async function actionPayFortnight(fortnightId: string) {
  try {
    const supabase = getSupabaseAdmin();

    // First recalculate to ensure latest totals
    await actionRecalculateFortnight(fortnightId);

    // Get fortnight with totals
    const { data: fortnight, error: fError } = await supabase
      .from('fortnights')
      .select(`
        *,
        fortnight_broker_totals (
          *,
          brokers (*)
        )
      `)
      .eq('id', fortnightId)
      .single();

    if (fError || !fortnight) throw new Error('Quincena no encontrada');

    // Generate bank CSV
    const csvContent = await buildBankCsv(
      (fortnight as any).fortnight_broker_totals || []
    );

    // Update fortnight status to closed
    const { error: updateError } = await supabase
      .from('fortnights')
      .update({ status: 'PAID' } satisfies FortnightUpd)
      .eq('id', fortnightId);

    if (updateError) throw new Error(updateError.message);

    revalidatePath('/(app)/commissions');
    return {
      ok: true as const,
      data: {
        csvContent,
        notified: (fortnight as any).notify_brokers
      }
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// Delete import
export async function actionDeleteImport(importId: string) {
  try {
    const supabase = getSupabaseAdmin();

    // First, verify the import is part of a DRAFT fortnight
    const { data: importData } = await supabase
      .from('comm_imports')
      .select('*, fortnights!inner(status)')
      .eq('id', importId)
      .single();

    if (!importData || (importData.fortnights as any)?.status !== 'DRAFT') {
      return { ok: false as const, error: 'Solo se pueden eliminar importaciones de quincenas en borrador.' };
    }

    // Explicitly delete all comm_items first
    const { error: itemsError } = await supabase
      .from('comm_items')
      .delete()
      .eq('import_id', importId);

    if (itemsError) throw new Error(`Error eliminando items: ${itemsError.message}`);

    // Then delete the comm_imports record
    const { error: importError } = await supabase
      .from('comm_imports')
      .delete()
      .eq('id', importId);

    if (importError) throw new Error(`Error eliminando importación: ${importError.message}`);

    revalidatePath('/(app)/commissions');
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// Get closed fortnights
export async function actionGetClosedFortnights(year: number, month: number, fortnight?: number) {
  try {
    const supabase = getSupabaseAdmin();
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

    let query = supabase
      .from('fortnights')
      .select(`
        *,
        fortnight_broker_totals (
          *,
          brokers ( name )
        ),
        comm_imports ( * )
      `)
      .eq('status', 'PAID')
      .gte('period_start', startDate)
      .lte('period_end', endDate);

    if (fortnight === 1) {
      query = query.lte('period_start', new Date(year, month - 1, 15).toISOString());
    } else if (fortnight === 2) {
      query = query.gte('period_start', new Date(year, month - 1, 16).toISOString());
    }

    const { data: fortnights, error: fError } = await query.order('period_start', { ascending: false });

    if (fError) throw fError;

    // Get all comm_items for the entire month in one go
    const { data: allCommItems, error: itemsError } = await supabase
      .from('comm_items')
      .select('gross_amount, insurer_id, insurers(name), created_at')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (itemsError) throw itemsError;

    const formattedData = (fortnights || []).map((f: any) => {
      const brokerTotals = f.fortnight_broker_totals || [];
      const fortnightStart = new Date(f.period_start);
      const fortnightEnd = new Date(f.period_end);

      // Filter items for the specific fortnight in memory
      const commItems = (allCommItems || []).filter(item => {
        const itemDate = new Date(item.created_at);
        return itemDate >= fortnightStart && itemDate <= fortnightEnd;
      });

      const total_imported = commItems.reduce((sum, item) => sum + (Number(item.gross_amount) || 0), 0);
      const total_paid_gross = brokerTotals.reduce((sum: number, bt: any) => sum + (Number(bt.gross_amount) || 0), 0);
      const total_office_profit = total_imported - total_paid_gross;

      const totalsByInsurer = commItems.reduce((acc, item) => {
        if (!item.insurers) return acc;
        const insurerName = item.insurers.name || 'Desconocido';
        acc[insurerName] = (acc[insurerName] || 0) + (Number(item.gross_amount) || 0);
        return acc;
      }, {} as Record<string, number>);

      return {
        id: f.id,
        label: `Q${fortnightStart.getDate() <= 15 ? 1 : 2} - ${fortnightStart.toLocaleString('es-PA', { month: 'short', timeZone: 'UTC' })}. ${fortnightStart.getUTCFullYear()}`,
        total_imported,
        total_paid_gross,
        total_office_profit,
        totalsByInsurer: Object.entries(totalsByInsurer).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
        brokers: brokerTotals.map((bt: any) => ({
          broker_id: bt.broker_id,
          broker_name: bt.brokers?.name || 'N/A',
          net_amount: bt.net_amount,
          gross_amount: bt.gross_amount,
          discounts_json: bt.discounts_json,
        })).sort((a: any, b: any) => b.net_amount - a.net_amount),
      };
    });

    return { ok: true as const, data: formattedData };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// Get last closed fortnight
export async function actionGetLastClosedFortnight() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('fortnights')
      .select('period_end')
      .eq('status', 'PAID')
      .order('period_end', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { ok: true as const, data: null };
      }
      throw error;
    }

    return { ok: true as const, data: data?.period_end || null };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// Get pending items
export async function actionGetPendingItems() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('comm_items')
      .select('*, insurers(name)')
      .is('broker_id', null)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return { ok: true as const, data };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// Get draft details
export async function actionGetDraftDetails(fortnightId: string) {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('comm_items')
      .select(`
        id,
        gross_amount,
        insured_name,
        brokers (id, name),
        insurers (id, name)
      `)
      .not('broker_id', 'is', null);

    if (error) throw error;

    // Convert gross_amount from unknown to number
    const formattedData = (data || []).map((item: any) => ({
      ...item,
      gross_amount: Number(item.gross_amount) || 0
    }));

    return { ok: true as const, data: formattedData };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// Claim pending items
export async function actionClaimPendingItem(itemIds: string[]) {
  try {
    const { userId, brokerId } = await getAuthContext();
    if (!brokerId) throw new Error('User is not a broker.');

    const supabase = getSupabaseAdmin();

    // Create a claim record for each item
    const claimsToInsert = itemIds.map(itemId => ({
      comm_item_id: itemId,
      broker_id: brokerId,
      status: 'pending',
    }));

    const { error } = await supabase.from('comm_item_claims').insert(claimsToInsert);

    if (error) throw error;

    revalidatePath('/(app)/commissions');
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// Delete draft fortnight
export async function actionDeleteDraft(fortnightId: string) {
  try {
    const supabase = getSupabaseAdmin();

    // Verify it's a draft
    const { data: fortnight } = await supabase
      .from('fortnights')
      .select('status')
      .eq('id', fortnightId)
      .single<Pick<FortnightRow, 'status'>>();

    if (fortnight?.status !== 'DRAFT') {
      return { ok: false as const, error: 'Solo se pueden eliminar quincenas en borrador.' };
    }

    // Get all imports for this fortnight
    const { data: imports } = await supabase
      .from('comm_imports')
      .select('id')
      .eq('period_label', fortnightId);

    // Delete all comm_items for each import
    if (imports && imports.length > 0) {
      for (const imp of imports) {
        await supabase
          .from('comm_items')
          .delete()
          .eq('import_id', imp.id);
      }

      // Delete all imports
      await supabase
        .from('comm_imports')
        .delete()
        .eq('period_label', fortnightId);
    }

    // Delete fortnight_broker_totals
    await supabase
      .from('fortnight_broker_totals')
      .delete()
      .eq('fortnight_id', fortnightId);

    // Delete the fortnight
    const { error } = await supabase
      .from('fortnights')
      .delete()
      .eq('id', fortnightId);

    if (error) throw error;

    revalidatePath('/(app)/commissions');
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// Export bank CSV without closing fortnight
export async function actionExportBankCsv(fortnightId: string) {
  try {
    const supabase = getSupabaseAdmin();

    // Recalculate first
    await actionRecalculateFortnight(fortnightId);

    // Get fortnight with totals
    const { data: fortnight, error: fError } = await supabase
      .from('fortnights')
      .select(`
        *,
        fortnight_broker_totals (
          *,
          brokers (*)
        )
      `)
      .eq('id', fortnightId)
      .single();

    if (fError || !fortnight) throw new Error('Quincena no encontrada');

    // Generate CSV excluding brokers with net <= 0
    const totals = (fortnight as any).fortnight_broker_totals || [];
    const filteredTotals = totals.filter((t: any) => {
      const net = t.gross_amount - (t.discount_amount || 0);
      return net > 0;
    });

    const csvContent = await buildBankCsv(filteredTotals);

    return {
      ok: true as const,
      data: { csvContent }
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}
