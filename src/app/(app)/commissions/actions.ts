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
type PendingItemRow = Tables<'pending_items'>;
type PendingItemUpd = TablesUpdate<'pending_items'>;
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
      is_life_insurance: String(formData.get('is_life_insurance') || 'false'),
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
    
    // Get insurer mapping rules (including multi-column support for ASSA)
    const { data: mappingRules } = await supabase
      .from('insurer_mapping_rules')
      .select('target_field, aliases, commission_column_2_aliases, commission_column_3_aliases')
      .eq('insurer_id', parsed.insurer_id) as any;
    
    console.log('[SERVER] Mapping rules:', mappingRules);
    
    // Get insurer configuration for invert_negatives and multi-column support (ASSA)
    const { data: insurerData } = await supabase
      .from('insurers')
      .select('invert_negatives, use_multi_commission_columns')
      .eq('id', parsed.insurer_id)
      .single();
    
    const invertNegatives = (insurerData as any)?.invert_negatives || false;
    const useMultiColumns = (insurerData as any)?.use_multi_commission_columns || false;
    console.log('[SERVER] Invert negatives from insurer config:', invertNegatives);
    console.log('[SERVER] Use multi commission columns (ASSA):', useMultiColumns);
    
    const rows = await parseCsvXlsx(file, mappingRules || [], invertNegatives, useMultiColumns);
    console.log('[SERVER] Parsed rows:', rows.length);
    console.log('[SERVER] First 3 rows:', rows.slice(0, 3).map(r => ({
      policy: r.policy_number,
      client: r.client_name,
      amount: r.commission_amount
    })));

    // 1. Create the comm_imports record with user-entered total_amount and life insurance flag
    const { data: importRecord, error: importError } = await supabase
      .from('comm_imports')
      .insert([{
        insurer_id: parsed.insurer_id,
        period_label: parsed.fortnight_id,
        uploaded_by: userId,
        total_amount: parseFloat(parsed.total_amount),
        is_life_insurance: parsed.is_life_insurance === 'true',
      }])
      .select()
      .single<CommImportRow>();

    if (importError) throw importError;
    if (!importRecord) throw new Error('Failed to create import record');
    
    console.log('[SERVER] Saved total_amount:', importRecord.total_amount, 'for import:', importRecord.id);

    // 2. Buscar pólizas existentes para identificar broker
    const policyNumbers = rows.map(r => r.policy_number).filter(Boolean) as string[];
    const { data: existingPolicies } = await supabase
      .from('policies')
      .select('policy_number, broker_id, client_id, clients(national_id)')
      .in('policy_number', policyNumbers.length > 0 ? policyNumbers : ['__NONE__']);

    const policyMap = new Map<string, { broker_id: string | null; client_id: string; national_id: string | null }>();
    (existingPolicies || []).forEach((p: any) => {
      policyMap.set(p.policy_number, {
        broker_id: p.broker_id,
        client_id: p.client_id,
        national_id: p.clients?.national_id || null,
      });
    });

    // 3. Separar: comm_items (identificados con broker) y pending_items (sin identificar)
    const itemsToInsert: CommItemIns[] = [];
    const pendingItemsToInsert: any[] = [];

    for (const row of rows) {
      const policyData = row.policy_number ? policyMap.get(row.policy_number) : null;
      
      // Si existe póliza con broker identificado, va a comm_items
      if (policyData && policyData.broker_id) {
        itemsToInsert.push({
          import_id: importRecord.id,
          insurer_id: parsed.insurer_id,
          policy_number: row.policy_number || 'UNKNOWN',
          gross_amount: row.commission_amount || 0,
          insured_name: row.client_name || 'UNKNOWN',
          raw_row: row.raw_row,
          broker_id: policyData.broker_id,
        });
      } else {
        // Sin broker identificado: va a pending_items con commission_raw (NO calculado con %)
        pendingItemsToInsert.push({
          insured_name: row.client_name || null,
          policy_number: row.policy_number || 'UNKNOWN',
          insurer_id: parsed.insurer_id,
          commission_raw: row.commission_amount || 0, // RAW, no calculado
          fortnight_id: parsed.fortnight_id,
          import_id: importRecord.id,
          status: 'open',
          assigned_broker_id: null,
        });
      }
    }

    console.log('[SERVER] Items to insert (identified):', itemsToInsert.length);
    console.log('[SERVER] Pending items (unidentified):', pendingItemsToInsert.length);

    // 4. Insert comm_items (con cédula)
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

    // 5. Insert pending_items (no identificados)
    if (pendingItemsToInsert.length > 0) {
      const { error: pendingError } = await supabase
        .from('pending_items')
        .insert(pendingItemsToInsert);
      
      if (pendingError) {
        console.error('[SERVER] Error inserting pending items:', pendingError);
        // No fallar el import completo, solo logear
        console.log('[SERVER] Continuing despite pending items errors');
      } else {
        console.log('[SERVER] Pending items inserted successfully');
      }
    }

    const result = { 
      insertedCount: itemsToInsert.length,
      pendingCount: pendingItemsToInsert.length,
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

export async function actionMarkPendingAsPayNow(payload: { policy_number: string; item_ids?: string[] }) {
  try {
    const { userId } = await getAuthContext();
    const supabase = getSupabaseAdmin();

    let targetIds = payload.item_ids ?? [];

    if (targetIds.length === 0) {
      const { data: itemsByPolicy, error: fetchError } = await supabase
        .from('pending_items')
        .select('id')
        .eq('policy_number', payload.policy_number)
        .eq('status', 'open')
        .returns<Pick<PendingItemRow, 'id'>[]>();

      if (fetchError) throw fetchError;
      targetIds = (itemsByPolicy || []).map(item => item.id);
    }

    if (targetIds.length === 0) {
      return { ok: false as const, error: 'No hay pendientes abiertos para marcar como pagados.' };
    }

    const { data, error } = await supabase
      .from('pending_items')
      .update({
        status: 'approved_pay_now',
        action_type: 'pay_now',
        assigned_by: userId,
        assigned_at: new Date().toISOString(),
      } satisfies PendingItemUpd)
      .in('id', targetIds)
      .select('id');

    if (error) throw error;

    revalidatePath('/(app)/commissions');
    return { ok: true as const, data: { updated: data?.length || 0 } };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

export async function actionMarkPendingAsNextFortnight(payload: { policy_number: string; item_ids?: string[] }) {
  try {
    const { userId } = await getAuthContext();
    const supabase = getSupabaseAdmin();

    let targetIds = payload.item_ids ?? [];

    if (targetIds.length === 0) {
      const { data: itemsByPolicy, error: fetchError } = await supabase
        .from('pending_items')
        .select('id')
        .eq('policy_number', payload.policy_number)
        .eq('status', 'open')
        .returns<Pick<PendingItemRow, 'id'>[]>();

      if (fetchError) throw fetchError;
      targetIds = (itemsByPolicy || []).map(item => item.id);
    }

    if (targetIds.length === 0) {
      return { ok: false as const, error: 'No hay pendientes abiertos para enviar a la próxima quincena.' };
    }

    const { data, error } = await supabase
      .from('pending_items')
      .update({
        status: 'approved_next',
        action_type: 'next_fortnight',
        assigned_by: userId,
        assigned_at: new Date().toISOString(),
      } satisfies PendingItemUpd)
      .in('id', targetIds)
      .select('id');

    if (error) throw error;

    revalidatePath('/(app)/commissions');
    return { ok: true as const, data: { updated: data?.length || 0 } };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
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

    if (error || !data) throw new Error(error?.message || 'No se pudo crear fortnight');

    // Inyectar pending_items "approved_next" en el nuevo draft
    const { data: pendingNext } = await supabase
      .from('pending_items')
      .select('*')
      .eq('status', 'approved_next')
      .not('assigned_broker_id', 'is', null)
      .returns<PendingItemRow[]>();
    
    const firstItem = pendingNext?.[0];
    if (pendingNext && pendingNext.length > 0 && firstItem?.insurer_id) {
      console.log(`[actionCreateDraftFortnight] Inyectando ${pendingNext.length} items de próxima quincena`);
      
      // Crear import virtual para estos items
      const { data: virtualImport } = await supabase
        .from('comm_imports')
        .insert([{
          insurer_id: firstItem.insurer_id,
          period_label: data.id,
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
        
        console.log(`[actionCreateDraftFortnight] ✓ ${pendingNext.length} items inyectados exitosamente`);
      }
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

// Get advances filtered by broker and year
export async function actionGetAdvances(brokerId?: string, year?: number) {
  const supabase = await getSupabaseAdmin();
  try {
    let query = supabase
      .from('advances')
      .select('*, brokers(id, name)')
      .order('created_at', { ascending: false });

    // Filter by broker_id if provided
    if (brokerId) {
      query = query.eq('broker_id', brokerId);
    }

    // Filter by year if provided
    if (year) {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      query = query.gte('created_at', startDate).lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[actionGetAdvances] Error:', error);
      throw error;
    }
    
    console.log('[actionGetAdvances] Loaded advances:', data?.length || 0);
    return { ok: true as const, data: data || [] };
  } catch (error) {
    console.error('[actionGetAdvances] Exception:', error);
    return { ok: false as const, error: String(error) };
  }
}

export async function actionApplyAdvancePayment(payload: { 
  advance_id: string; 
  amount: number; 
  payment_type: string; 
  fortnight_id?: string; 
  broker_id?: string;
  reference_number?: string;
  payment_date?: string;
}) {
  try {
    const { advance_id, amount, payment_type, fortnight_id, broker_id, reference_number, payment_date } = payload;
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

    // Si es transferencia externa, crear pending_payment y esperar a que la referencia esté disponible
    if (payment_type === 'external_transfer' && reference_number) {
      // Crear pending_payment para el adelanto
      const { error: pendingError } = await supabase.from('pending_payments').insert({
        client_name: `ADELANTO - ${(advance as any).broker_id}`,
        policy_number: `ADV-${advance_id.substring(0, 8)}`,
        insurer_name: 'ADELANTO',
        purpose: `Pago adelanto por transferencia - Ref: ${reference_number}`,
        amount_to_pay: amount,
        total_received: amount,
        can_be_paid: false, // Se activará cuando la referencia esté en banco
        notes: JSON.stringify({
          source: 'advance_external',
          advance_id,
          reference_number,
          payment_date: payment_date || new Date().toISOString().split('T')[0],
        }),
        created_by: applied_by,
      } satisfies TablesInsert<'pending_payments'>);

      if (pendingError) throw pendingError;

      revalidatePath('/(app)/commissions');
      revalidatePath('/(app)/checks');
      return { ok: true as const, message: 'Transferencia registrada. Se aplicará cuando la referencia esté disponible en banco.' };
    }

    // Para efectivo u otros pagos, aplicar directamente
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
    broker_id: payload.broker_id,
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

// Assign pending items to a broker
export async function actionResolvePendingGroups(payload: unknown) {
  try {
    const parsed = ResolvePendingSchema.parse(payload);
    const supabase = getSupabaseAdmin();

    let targetIds = parsed.item_ids ?? [];

    if (targetIds.length === 0) {
      const { data: itemsByPolicy, error: fetchError } = await supabase
        .from('pending_items')
        .select('id')
        .eq('policy_number', parsed.policy_number)
        .eq('status', 'open')
        .returns<Pick<PendingItemRow, 'id'>[]>();

      if (fetchError) throw fetchError;
      targetIds = (itemsByPolicy || []).map(item => item.id);
    }

    if (targetIds.length === 0) {
      return { ok: false as const, error: 'No hay pendientes abiertos para asignar.' };
    }
    const { data, error } = await supabase
      .from('pending_items')
      .update({
        assigned_broker_id: parsed.broker_id,
      })
      .in('id', targetIds)
      .eq('status', 'open')
      .select('id');

    if (error) throw error;

    if (data && data.length > 0) {
      // Migrar automáticamente a comm_items
      const migrateResult = await actionMigratePendingToCommItems(
        data.map(item => item.id)
      );
      
      if (!migrateResult.ok) {
        console.error('Error al migrar:', migrateResult.error);
      }
    }

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

// ============================================
// ADVANCE RECURRENCES
// ============================================

export async function actionGetAdvanceRecurrences(brokerId?: string) {
  try {
    const supabase = getSupabaseAdmin();
    
    let query = (supabase as any)
      .from('advance_recurrences')
      .select('*, brokers(id, name)')
      .order('created_at', { ascending: false });
    
    if (brokerId) {
      query = query.eq('broker_id', brokerId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return { ok: true as const, data: data || [] };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

export async function actionCreateAdvanceRecurrence(payload: {
  broker_id: string;
  amount: number;
  reason: string;
}) {
  try {
    const { userId } = await getAuthContext();
    const supabase = getSupabaseAdmin();
    
    const { data, error } = await (supabase as any)
      .from('advance_recurrences')
      .insert({
        broker_id: payload.broker_id,
        amount: payload.amount,
        reason: payload.reason,
        is_active: true,
        start_date: new Date().toISOString().split('T')[0],
        created_by: userId,
      })
      .select()
      .single();
    
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

export async function actionUpdateAdvanceRecurrence(
  id: string,
  payload: { amount?: number; reason?: string; is_active?: boolean }
) {
  try {
    const supabase = getSupabaseAdmin();
    
    const { error } = await (supabase as any)
      .from('advance_recurrences')
      .update(payload)
      .eq('id', id);
    
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

export async function actionDeleteAdvanceRecurrence(id: string) {
  try {
    const supabase = getSupabaseAdmin();
    
    const { error } = await (supabase as any)
      .from('advance_recurrences')
      .delete()
      .eq('id', id);
    
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

// ============================================
// RETAINED COMMISSIONS
// ============================================

export async function actionRetainBrokerPayment(payload: {
  fortnight_id: string;
  broker_id: string;
}) {
  try {
    const supabase = getSupabaseAdmin();
    
    // Marcar como retenido en fortnight_broker_totals
    const { error } = await supabase
      .from('fortnight_broker_totals')
      .update({ is_retained: true } satisfies TablesUpdate<'fortnight_broker_totals'>)
      .eq('fortnight_id', payload.fortnight_id)
      .eq('broker_id', payload.broker_id);
    
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

export async function actionUnretainBrokerPayment(payload: {
  fortnight_id: string;
  broker_id: string;
}) {
  try {
    const supabase = getSupabaseAdmin();
    
    // Quitar retención
    const { error } = await supabase
      .from('fortnight_broker_totals')
      .update({ is_retained: false } satisfies TablesUpdate<'fortnight_broker_totals'>)
      .eq('fortnight_id', payload.fortnight_id)
      .eq('broker_id', payload.broker_id);
    
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

export async function actionGetRetainedCommissions() {
  try {
    const supabase = getSupabaseAdmin();
    
    // Obtener todas las comisiones retenidas (cerradas)
    const { data, error } = await (supabase as any)
      .from('retained_commissions')
      .select('*, brokers(id, name), fortnights(period_start, period_end)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return { ok: true as const, data: data || [] };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

export async function actionPayRetainedCommission(payload: {
  retained_id: string;
  pay_option: 'immediate' | 'next_fortnight';
}) {
  try {
    const { userId } = await getAuthContext();
    const supabase = getSupabaseAdmin();
    
    if (payload.pay_option === 'immediate') {
      // Marcar como pagado inmediatamente
      const { error } = await (supabase as any)
        .from('retained_commissions')
        .update({
          status: 'paid_immediate',
          paid_at: new Date().toISOString(),
        })
        .eq('id', payload.retained_id);
      
      if (error) throw error;
    } else {
      // Marcar como aplicado a siguiente quincena
      const { error } = await (supabase as any)
        .from('retained_commissions')
        .update({
          status: 'paid_in_fortnight',
        })
        .eq('id', payload.retained_id);
      
      if (error) throw error;
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

export async function actionApplyRetainedToAdvance(payload: {
  retained_id: string;
  advance_id: string;
  amount: number;
}) {
  try {
    const supabase = getSupabaseAdmin();
    
    // Obtener info de la retención
    const { data: retained, error: retainedError } = await (supabase as any)
      .from('retained_commissions')
      .select('*, fortnights(period_start, period_end)')
      .eq('id', payload.retained_id)
      .single();
    
    if (retainedError) throw retainedError;
    
    // Aplicar el pago al adelanto
    const result = await actionApplyAdvancePayment({
      advance_id: payload.advance_id,
      amount: payload.amount,
      payment_type: 'retained_commission',
      reference_number: `Retenido Q${retained.fortnights.period_start}`,
    });
    
    if (!result.ok) throw new Error(result.error);
    
    // Marcar la retención como aplicada
    const { error } = await (supabase as any)
      .from('retained_commissions')
      .update({
        status: 'applied_to_advance',
        applied_advance_id: payload.advance_id,
      })
      .eq('id', payload.retained_id);
    
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
    };
  }
}

// Delete import
export async function actionDeleteImport(importId: string) {
  try {
    console.log('[actionDeleteImport] Iniciando eliminación de import:', importId);
    const supabase = getSupabaseAdmin();

    // Get import data to verify it's from a DRAFT fortnight
    const { data: importData, error: getError } = await supabase
      .from('comm_imports')
      .select('id, period_label')
      .eq('id', importId)
      .single();

    console.log('[actionDeleteImport] Import encontrado:', importData);
    
    if (getError || !importData) {
      console.error('[actionDeleteImport] Error buscando import:', getError);
      return { ok: false as const, error: 'Importación no encontrada.' };
    }

    // Verify fortnight is DRAFT
    const { data: fortnight, error: fortnightError } = await supabase
      .from('fortnights')
      .select('status')
      .eq('id', importData.period_label)
      .single();

    console.log('[actionDeleteImport] Fortnight status:', fortnight?.status);

    if (fortnightError || fortnight?.status !== 'DRAFT') {
      return { ok: false as const, error: 'Solo se pueden eliminar importaciones de quincenas en borrador.' };
    }

    // Delete all comm_items associated with this import
    console.log('[actionDeleteImport] Eliminando comm_items...');
    const { error: itemsError, count: itemsCount } = await supabase
      .from('comm_items')
      .delete({ count: 'exact' })
      .eq('import_id', importId);

    if (itemsError) {
      console.error('[actionDeleteImport] Error eliminando items:', itemsError);
      throw new Error(`Error eliminando items: ${itemsError.message}`);
    }
    console.log('[actionDeleteImport] Items eliminados:', itemsCount);

    // Delete the import record
    console.log('[actionDeleteImport] Eliminando import...');
    const { error: importError } = await supabase
      .from('comm_imports')
      .delete()
      .eq('id', importId);

    if (importError) {
      console.error('[actionDeleteImport] Error eliminando import:', importError);
      throw new Error(`Error eliminando importación: ${importError.message}`);
    }

    console.log('[actionDeleteImport] ✓ Import eliminado exitosamente');
    revalidatePath('/(app)/commissions');
    return { ok: true as const };
  } catch (error) {
    console.error('[actionDeleteImport] Exception:', error);
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// Get closed fortnights
export async function actionGetClosedFortnights(year: number, month: number, fortnight?: number, brokerId?: string | null) {
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

      const filteredBrokers = brokerId
        ? brokerTotals.filter((bt: any) => bt.broker_id === brokerId)
        : brokerTotals;

      if (brokerId && filteredBrokers.length === 0) {
        return null;
      }

      return {
        id: f.id,
        label: `Q${fortnightStart.getDate() <= 15 ? 1 : 2} - ${fortnightStart.toLocaleString('es-PA', { month: 'short', timeZone: 'UTC' })}. ${fortnightStart.getUTCFullYear()}`,
        total_imported,
        total_paid_gross,
        total_office_profit,
        totalsByInsurer: Object.entries(totalsByInsurer).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
        brokers: filteredBrokers.map((bt: any) => ({
          broker_id: bt.broker_id,
          broker_name: bt.brokers?.name || 'N/A',
          net_amount: bt.net_amount,
          gross_amount: bt.gross_amount,
          discounts_json: bt.discounts_json,
        })).sort((a: any, b: any) => b.net_amount - a.net_amount),
      };
    });

    return { ok: true as const, data: formattedData.filter(Boolean) };
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

// Get pending items (sin broker asignado)
export async function actionGetPendingItems() {
  try {
    console.log('[actionGetPendingItems] Fetching pending_items...');
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('pending_items')
      .select(`
        id,
        insured_name,
        policy_number,
        commission_raw,
        created_at,
        status,
        insurers ( name )
      `)
      .eq('status', 'open')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[actionGetPendingItems] Error:', error);
      throw error;
    }

    const formattedData = (data || []).map(item => ({
      id: item.id,
      policy_number: item.policy_number,
      insured_name: item.insured_name,
      gross_amount: Number((item as any).commission_raw) || 0,
      created_at: item.created_at,
      status: item.status,
      insurers: item.insurers,
    }));

    console.log('[actionGetPendingItems] Found', formattedData.length, 'pending items');
    return { ok: true as const, data: formattedData };
  } catch (error) {
    console.error('[actionGetPendingItems] Exception:', error);
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
    console.log('[actionDeleteDraft] Iniciando eliminación de borrador:', fortnightId);
    const supabase = getSupabaseAdmin();

    // Verify it's a draft
    const { data: fortnight, error: fortnightError } = await supabase
      .from('fortnights')
      .select('status')
      .eq('id', fortnightId)
      .single<Pick<FortnightRow, 'status'>>();

    console.log('[actionDeleteDraft] Fortnight encontrada:', fortnight);
    if (fortnightError) {
      console.error('[actionDeleteDraft] Error buscando fortnight:', fortnightError);
      throw fortnightError;
    }

    if (fortnight?.status !== 'DRAFT') {
      return { ok: false as const, error: 'Solo se pueden eliminar quincenas en borrador.' };
    }

    // Delete fortnight_broker_totals FIRST (no dependencies)
    console.log('[actionDeleteDraft] Eliminando totals...');
    await supabase
      .from('fortnight_broker_totals')
      .delete()
      .eq('fortnight_id', fortnightId);

    // Delete temp imports if any (no dependencies)
    console.log('[actionDeleteDraft] Eliminando temp imports...');
    await supabase
      .from('temp_client_imports')
      .delete()
      .eq('fortnight_id', fortnightId);

    // Get all imports BEFORE deleting items
    console.log('[actionDeleteDraft] Buscando imports...');
    const { data: imports } = await supabase
      .from('comm_imports')
      .select('id')
      .eq('period_label', fortnightId);

    console.log('[actionDeleteDraft] Imports encontrados:', imports?.length || 0);

    // Delete comm_items by import_id
    if (imports && imports.length > 0) {
      for (const imp of imports) {
        console.log('[actionDeleteDraft] Eliminando items de import:', imp.id);
        await supabase
          .from('comm_items')
          .delete()
          .eq('import_id', imp.id);
      }
      
      // Now delete imports
      console.log('[actionDeleteDraft] Eliminando imports...');
      await supabase
        .from('comm_imports')
        .delete()
        .eq('period_label', fortnightId);
    }

    // Delete any orphan comm_items
    console.log('[actionDeleteDraft] Eliminando items huérfanos...');
    await supabase
      .from('comm_items')
      .delete()
      .eq('fortnight_id', fortnightId);

    // Delete advance_logs that reference this fortnight (CRITICAL: must be before fortnight deletion)
    console.log('[actionDeleteDraft] Eliminando advance_logs...');
    await supabase
      .from('advance_logs')
      .delete()
      .eq('fortnight_id', fortnightId);

    // Finally, delete the fortnight itself
    console.log('[actionDeleteDraft] Eliminando fortnight...');
    const { error: deleteError } = await supabase
      .from('fortnights')
      .delete()
      .eq('id', fortnightId);

    if (deleteError) {
      console.error('[actionDeleteDraft] Error eliminando fortnight:', deleteError);
      throw deleteError;
    }

    console.log('[actionDeleteDraft] ✓ Borrador eliminado exitosamente');
    revalidatePath('/(app)/commissions');
    return { ok: true as const };
  } catch (error) {
    console.error('[actionDeleteDraft] Exception:', error);
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

    const fortnightLabel = `${fortnight.period_start} al ${fortnight.period_end}`;
    const csvContent = await buildBankCsv(filteredTotals, fortnightLabel);

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

/**
 * Recalculate fortnight broker totals
 */
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
      
      const payload: any = {
        fortnight_id,
        broker_id: brokerId,
        gross_amount: totals.gross,
        net_amount: netAmount,
        discounts_json: {
          adelantos: advances,
          total: totalDiscounts,
        },
      };
      
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

/**
 * Pay/Close fortnight
 */
const toIsoDate = (value?: string | null) => {
  if (!value) return new Date().toISOString().split('T')[0];
  if (value.includes('T')) return value.split('T')[0];
  return value;
};

const formatFortnightLabel = (start?: string | null, end?: string | null) => {
  try {
    if (!start || !end) return '';
    const startDate = new Date(start);
    const endDate = new Date(end);
    const month = endDate.toLocaleDateString('es-PA', { month: 'long' });
    const year = endDate.getFullYear();
    return `del ${startDate.getUTCDate()} al ${endDate.getUTCDate()} de ${month} ${year}`;
  } catch (_err) {
    return '';
  }
};

export async function actionPayFortnight(fortnight_id: string) {
  try {
    const supabase = getSupabaseAdmin();
    const { userId } = await getAuthContext();
    
    // 1. Verificar que existe el draft
    const { data: fortnight, error: fnError } = await supabase
      .from('fortnights')
      .select('id, status, notify_brokers, period_start, period_end')
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
    
    // 4. Crear registros de retained_commissions para pagos retenidos
    for (const bt of brokerTotals) {
      if (bt.is_retained) {
        // Obtener detalle de comisiones por aseguradora para este broker
        const { data: commItems, error: itemsError } = await supabase
          .from('comm_items')
          .select('*, comm_imports(insurer_id, insurers(name))')
          .eq('fortnight_id', fortnight_id)
          .eq('broker_id', bt.broker_id);
        
        if (itemsError) throw itemsError;
        
        // Agrupar por aseguradora
        const insurersDetail: any = {};
        if (commItems) {
          for (const item of commItems) {
            const itemAny = item as any;
            const insurerName = itemAny.comm_imports?.insurers?.name || 'Sin aseguradora';
            if (!insurersDetail[insurerName]) {
              insurersDetail[insurerName] = {
                insurer: insurerName,
                clients: [],
                total: 0,
              };
            }
            insurersDetail[insurerName].clients.push({
              client_name: itemAny.insured_name || 'Sin nombre',
              policy_number: item.policy_number,
              amount: itemAny.gross_amount || 0,
            });
            insurersDetail[insurerName].total += itemAny.gross_amount || 0;
          }
        }
        
        // Calcular discount_amount del broker
        const btAny = bt as any;
        const discountAmount = btAny.discount_amount || (bt.gross_amount - bt.net_amount);
        
        // Crear retained_commission
        const { error: retainedError } = await (supabase as any)
          .from('retained_commissions')
          .insert({
            broker_id: bt.broker_id,
            fortnight_id: fortnight_id,
            gross_amount: bt.gross_amount,
            discount_amount: discountAmount,
            net_amount: bt.net_amount,
            status: 'pending',
            insurers_detail: insurersDetail,
            created_by: userId,
          });
        
        if (retainedError) throw retainedError;
      }
    }
    
    // 5. Generar CSV Banco (solo brokers con neto > 0 Y NO retenidos)
    const filteredTotals = brokerTotals
      .filter(bt => bt.net_amount > 0 && !bt.is_retained)
      .map(bt => ({
        ...bt,
        broker: bt.brokers as any
      }));
    
    const csvContent = await buildBankCsv(filteredTotals, fortnight_id);
    
    // 6. Cambiar status a PAID
    const { error: updateError } = await supabase
      .from('fortnights')
      .update({ status: 'PAID' } satisfies FortnightUpd)
      .eq('id', fortnight_id);
    
    if (updateError) throw updateError;
    
    // 6. Marcar adelantos como aplicados (crear logs)
    for (const bt of brokerTotals) {
      const discounts = bt.discounts_json as any;
      if (!discounts?.adelantos || !Array.isArray(discounts.adelantos) || discounts.adelantos.length === 0) {
        continue;
      }

      let totalDiscount = 0;

      for (const adv of discounts.adelantos) {
        await supabase.from('advance_logs').insert([{
          advance_id: adv.advance_id,
          amount: adv.amount,
          payment_type: 'fortnight',
          fortnight_id,
          applied_by: userId,
        } satisfies AdvanceLogIns]);

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

        totalDiscount += Number(adv.amount) || 0;
      }

      if (totalDiscount <= 0) {
        continue;
      }

      const periodLabel = formatFortnightLabel(fortnight.period_start ?? null, fortnight.period_end ?? null);
      const referenceNumber = `DESCUENTO-COMISIONES-${fortnight_id}-${bt.broker_id}`.toUpperCase();
      const periodDate = toIsoDate(fortnight.period_end ?? null);
      const nowIso = new Date().toISOString();

      const { error: bankTransferError } = await supabase
        .from('bank_transfers')
        .insert([
          {
            date: periodDate as string,
            reference_number: referenceNumber,
            transaction_code: 'DESCUENTO_COMISIONES',
            description: `Broker: ${bt.brokers?.name ?? 'N/D'} — Quincena: ${periodLabel || fortnight_id}`,
            amount: totalDiscount,
            imported_at: nowIso,
            used_amount: totalDiscount,
          } satisfies TablesInsert<'bank_transfers'>,
        ]);

      if (bankTransferError) {
        throw bankTransferError;
      }

      const pendingPayload = {
        client_name: bt.brokers?.name ?? 'Broker',
        insurer_name: null,
        policy_number: null,
        purpose: 'devolucion',
        amount_to_pay: totalDiscount,
        total_received: totalDiscount,
        can_be_paid: true,
        status: 'pending',
        notes: JSON.stringify({
          source: 'fortnight_discount',
          fortnight_id,
          broker_id: bt.broker_id,
        }),
        created_at: nowIso,
        created_by: userId,
      } satisfies TablesInsert<'pending_payments'>;

      const { error: pendingError } = await supabase
        .from('pending_payments')
        .insert([pendingPayload]);

      if (pendingError) {
        throw pendingError;
      }
    }
    
    revalidatePath('/(app)/commissions');
    return { 
      ok: true as const, 
      data: { 
        csv: csvContent,
        brokers_paid: filteredTotals.length,
        total_paid: filteredTotals.reduce((s, r) => s + r.net_amount, 0),
      } 
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error al pagar quincena',
    };
  }
}

/**
 * Migrate assigned pending items to comm_items
 */
export async function actionMigratePendingToCommItems(pending_item_ids: string[]) {
  try {
    const supabase = getSupabaseAdmin();
    
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
    
    for (const item of pendingItems) {
      const { data: broker } = await supabase
        .from('brokers')
        .select('percent_default')
        .eq('id', item.assigned_broker_id!)
        .single();
      
      if (!broker) continue;
      
      const percent = (broker as any).percent_default || 100;
      const grossAmount = item.commission_raw * (percent / 100);
      
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

/**
 * Generate CSV for Pay Now adjustments
 */
export async function actionGeneratePayNowCSV(item_ids: string[]) {
  try {
    const supabase = getSupabaseAdmin();
    
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
    
    // Crear fortnight_broker_totals falsos para el CSV
    const totalsByBroker = items.reduce((acc, item) => {
      const brokerId = item.assigned_broker_id!;
      const percent = item.brokers?.percent_default || 100;
      const grossAmount = item.commission_raw * (percent / 100);
      
      if (!acc[brokerId]) {
        acc[brokerId] = {
          broker_id: brokerId,
          fortnight_id: 'pay_now',
          gross_amount: 0,
          net_amount: 0,
          discounts_json: {},
          created_at: new Date().toISOString(),
          id: brokerId,
          bank_snapshot: null,
          broker: item.brokers
        };
      }
      acc[brokerId].net_amount += grossAmount;
      acc[brokerId].gross_amount += grossAmount;
      return acc;
    }, {} as Record<string, any>);
    
    const csvContent = await buildBankCsv(Object.values(totalsByBroker), 'Ajustes-PagoInmediato');
    
    return { 
      ok: true as const, 
      data: { 
        csv: csvContent,
        items_count: items.length,
        total_amount: Object.values(totalsByBroker).reduce((s, r) => s + r.net_amount, 0),
      } 
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error al generar CSV',
    };
  }
}

/**
 * Confirm Pay Now items as paid
 */
export async function actionConfirmPayNowPaid(item_ids: string[]) {
  try {
    const supabase = getSupabaseAdmin();
    const { userId } = await getAuthContext();
    
    const { data: items } = await supabase
      .from('pending_items')
      .select('*, brokers(percent_default)')
      .in('id', item_ids)
      .eq('status', 'approved_pay_now')
      .returns<(PendingItemRow & { brokers: any })[]>();
    
    if (!items || items.length === 0) {
      return { ok: false as const, error: 'No hay items para confirmar' };
    }
    
    for (const item of items) {
      const percent = item.brokers?.percent_default || 100;
      const grossAmount = item.commission_raw * (percent / 100);
      
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
      
      await supabase
        .from('pending_items')
        .update({ status: 'paid_now' } satisfies PendingItemUpd)
        .eq('id', item.id);
    }
    
    revalidatePath('/(app)/commissions');
    return { ok: true as const, data: { paid_count: items.length } };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Error al confirmar pago',
    };
  }
}
