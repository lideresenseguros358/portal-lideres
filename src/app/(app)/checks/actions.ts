'use server';

import { getSupabaseServer } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { DB, Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/client';

// Types
export type CheckStatus = 'green' | 'gray' | 'yellow' | 'red' | 'blue';

export interface CheckHistoryItem {
  id: string;
  reference: string;
  date: string;
  description: string;
  amount: number;
  status: CheckStatus;
  is_internal: boolean;
  applied_amount?: number;
  remaining_amount?: number;
  linked_payments?: Array<{
    id: string;
    type: string;
    amount: number;
    description: string;
  }>;
  created_at: string;
  updated_at?: string;
}

export interface PendingPayment {
  id: string;
  type: 'insurer' | 'refund' | 'client' | 'advance';
  description: string;
  amount: number;
  broker_id: string;
  broker_name?: string;
  policy_number?: string;
  client_name?: string;
  notes?: string;
  is_refund: boolean;
  created_at: string;
  reference?: string;
}

// Get check history with filters (only bank transfers, not pending payments)
export async function actionGetCheckHistory(
  year?: number,
  page: number = 1,
  pageSize: number = 20
) {
  try {
    const supabase = await getSupabaseServer();
    
    const currentYear = year || new Date().getFullYear();
    const startDate = `${currentYear}-01-01`;
    const endDate = `${currentYear}-12-31`;

    // Get ALL items for the year, we'll filter by type in bank_json
    let query = supabase
      .from('check_items')
      .select('*', { count: 'exact' })
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error, count } = await query.returns<any[]>();

    if (error) throw error;

    // Filter only bank imports (not pending payments)
    const bankImports = (data || []).filter((item: any) => {
      const bankJson = item.bank_json as any;
      return bankJson?.type === 'bank_import';
    });

    // Transform to CheckHistoryItem format
    const history = bankImports.map((item: any) => {
      const daysSinceCreated = Math.floor(
        (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      let status: CheckStatus = 'gray';
      
      // Determine status based on item.status and days
      if (item.status === 'applied') {
        status = 'green';
      } else if (item.status === 'deferred') {
        status = 'blue';
      } else if (daysSinceCreated > 30) {
        status = 'red';
      } else if (daysSinceCreated > 15) {
        status = 'yellow';
      } else {
        status = 'gray';
      }

      return {
        id: item.id,
        reference: item.reference || '',
        date: item.created_at,
        description: `${item.client_name || ''} - ${item.policy_number || ''}`,
        amount: Number(item.amount),
        status,
        is_internal: false,
        created_at: item.created_at
      };
    });

    return { ok: true, data: history };
  } catch (error: any) {
    console.error('Error fetching check history:', error);
    return { ok: false, error: error.message };
  }
}

// Get pending payments
export async function actionGetPendingPayments(filters?: {
  broker_id?: string;
  type?: string;
  search?: string;
}) {
  try {
    const supabase = await getSupabaseServer();
    
    let query = supabase
      .from('check_items')
      .select(`
        *,
        brokers (
          id,
          name
        )
      `)
      .order('created_at', { ascending: false });

    if (filters?.broker_id) {
      query = query.eq('broker_id', filters.broker_id);
    }
    if (filters?.search) {
      query = query.or(`
        client_name.ilike.%${filters.search}%,
        policy_number.ilike.%${filters.search}%
      `);
    }

    const { data, error } = await query.returns<any[]>();

    if (error) throw error;

    // Filter only pending payments (not bank imports)
    const pendingItems = (data || []).filter((item: any) => {
      const bankJson = item.bank_json as any;
      return bankJson?.type === 'pending_payment';
    });

    // Transform to PendingPayment format
    const payments = pendingItems.map((item: any) => ({
      id: item.id,
      type: (item.is_refund ? 'refund' : 'insurer') as 'insurer' | 'refund' | 'client' | 'advance',
      description: `${item.client_name || ''} - ${item.policy_number || ''}`,
      amount: Number(item.amount),
      broker_id: item.broker_id,
      broker_name: item.brokers?.name,
      policy_number: item.policy_number,
      client_name: item.client_name,
      notes: '',
      is_refund: item.is_refund,
      bank_json: item.bank_json,
      created_at: item.created_at,
      reference: item.reference
    }));

    return { ok: true, data: payments };
  } catch (error: any) {
    console.error('Error fetching pending payments:', error);
    return { ok: false, error: error.message };
  }
}

// Register a new pending payment (not a bank transfer)
export async function actionRegisterPendingPayment(data: {
  date: string;
  reference: string;
  amount: number;
  description: string;
  is_internal?: boolean;
  advance_id?: string; // If coming from advances
  insurer_id?: string;
  insurer_name?: string;
  policy_number?: string;
  client_name?: string;
  payment_type?: string;
}) {
  try {
    console.log('[SERVER] actionRegisterPendingPayment called with:', data);
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('[SERVER] User not authenticated');
      return { ok: false, error: 'Usuario no autenticado' };
    }
    
    console.log('[SERVER] User authenticated:', user.id);
    
    // Create the pending payment batch
    const { data: batch, error: batchError } = await supabase
      .from('check_batches')
      .insert([
        {
          title: `Pago Pendiente - ${data.description}`,
          created_by: user.id
        } satisfies TablesInsert<'check_batches'>
      ])
      .select()
      .single<Tables<'check_batches'>>();

    if (batchError || !batch) {
      console.error('[SERVER] Batch creation failed:', batchError);
      throw batchError || new Error('Failed to create batch');
    }
    console.log('[SERVER] Batch created:', batch.id);

    // Get a default broker_id or use the one provided
    const brokerResult = await supabase
      .from('brokers')
      .select('id')
      .limit(1)
      .single();

    const brokerData = brokerResult.data as { id: string } | null;

    if (!brokerData) {
      console.error('[SERVER] No brokers found');
      throw new Error('No brokers found in the system');
    }
    console.log('[SERVER] Using broker:', brokerData.id);

    // Store additional payment info in bank_json
    const paymentInfo = {
      payment_type: data.payment_type || 'policy',
      insurer_id: data.insurer_id,
      insurer_name: data.insurer_name,
      registered_date: new Date().toISOString(),
      registered_by: user.id
    };

    const insertData = {
      batch_id: batch.id,
      broker_id: brokerData.id,
      reference: data.reference,
      client_name: data.client_name || '',
      policy_number: data.policy_number || '',
      amount: data.amount,
      is_refund: data.payment_type === 'refund' || false,
      bank_json: {
        ...paymentInfo,
        type: 'pending_payment',
        registered_date: new Date().toISOString()
      },
      created_at: data.date
    };
    console.log('[SERVER] Inserting check_item:', insertData);

    const { data: checkItem, error: itemError } = await supabase
      .from('check_items')
      .insert([insertData satisfies TablesInsert<'check_items'>])
      .select()
      .single();

    if (itemError) {
      console.error('[SERVER] Check item insertion failed:', itemError);
      throw itemError;
    }

    console.log('[SERVER] Check item created successfully:', checkItem);
    return { ok: true, data: checkItem };
  } catch (error: any) {
    console.error('Error registering transfer:', error);
    return { ok: false, error: error.message };
  }
}

// Apply transfer to payments
export async function actionApplyTransferToPayments(
  referenceId: string,
  applications: Array<{
    payment_id: string;
    amount: number;
    notes?: string;
  }>
) {
  try {
    const supabase = await getSupabaseAdmin();
    
    // Get the reference details
    const { data: reference, error: refError } = await supabase
      .from('check_items')
      .select('*')
      .eq('id', referenceId)
      .single<Tables<'check_items'>>();

    if (refError) throw refError;
    if (!reference) {
      return { ok: false, error: 'Referencia no encontrada' };
    }

    // Calculate total to apply
    const totalToApply = applications.reduce((sum, app) => sum + app.amount, 0);
    const currentAmount = Number(reference.amount);

    if (totalToApply > currentAmount) {
      return { ok: false, error: 'El monto a aplicar excede el monto disponible' };
    }

    // Update each payment
    for (const app of applications) {
      const { error: paymentError } = await supabase
        .from('check_items')
        .update({
          status: 'applied'
        } satisfies TablesUpdate<'check_items'>)
        .eq('id', app.payment_id);

      if (paymentError) throw paymentError;
    }

    // Update the reference status
    const { error: updateError } = await supabase
      .from('check_items')
      .update({
        status: totalToApply >= currentAmount ? 'applied' : 'partial'
      } satisfies TablesUpdate<'check_items'>)
      .eq('id', referenceId);

    if (updateError) throw updateError;

    return { ok: true, data: { applied: applications, remaining: currentAmount - totalToApply } };
  } catch (error: any) {
    console.error('Error applying transfer to payments:', error);
    return { ok: false, error: error.message };
  }
}

// Import bank history
export async function actionImportBankHistory(
  records: Array<{
    date: string;
    reference: string;
    description: string;
    amount: number;
    is_internal?: boolean;
  }>
) {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { ok: false, error: 'Usuario no autenticado' };
    }
    
    // Check for duplicate references within the import
    const references = records.map(r => r.reference);
    const duplicates = references.filter((ref, index) => references.indexOf(ref) !== index);
    
    if (duplicates.length > 0) {
      return { 
        ok: false, 
        error: `Referencias duplicadas en el archivo: ${duplicates.join(', ')}` 
      };
    }

    // Check for existing references in database
    const { data: existing } = await supabase
      .from('check_items')
      .select('reference')
      .in('reference', references);

    const existingRefs = existing?.map(e => e.reference) || [];
    const newRecords = records.filter(r => !existingRefs.includes(r.reference));

    if (newRecords.length === 0) {
      return { 
        ok: true, 
        data: { 
          imported: 0, 
          skipped: records.length,
          message: 'Todas las referencias ya existen en el histórico' 
        } 
      };
    }

    // Create batch
    const { data: batch, error: batchError } = await supabase
      .from('check_batches')
      .insert([
        {
          title: `Importación ${new Date().toLocaleDateString('es-PA')}`,
          created_by: user.id
        } satisfies TablesInsert<'check_batches'>
      ])
      .select()
      .single<Tables<'check_batches'>>();

    if (batchError || !batch) throw batchError || new Error('Failed to create batch');

    // Get a default broker_id
    const brokerResult = await supabase
      .from('brokers')
      .select('id')
      .limit(1)
      .single();

    const brokerData = brokerResult.data as { id: string } | null;

    if (!brokerData) {
      throw new Error('No brokers found in the system');
    }

    // Insert new records as bank transfers
    const itemsToInsert = newRecords.map(record => ({
      batch_id: batch.id,
      broker_id: brokerData.id,
      reference: record.reference,
      client_name: '',
      policy_number: '',
      amount: record.amount,
      is_refund: false,
      bank_json: { 
        description: record.description, 
        is_internal: record.is_internal,
        type: 'bank_import',
        import_date: new Date().toISOString()
      },
      created_at: record.date
    } satisfies TablesInsert<'check_items'>));

    const { data: items, error: itemsError } = await supabase
      .from('check_items')
      .insert(itemsToInsert)
      .select();

    if (itemsError) throw itemsError;

    return {
      ok: true, 
      data: { 
        imported: items?.length || 0,
        skipped: records.length - newRecords.length,
        message: `${items?.length || 0} registros importados, ${records.length - newRecords.length} duplicados omitidos`
      } 
    };
  } catch (error: any) {
    console.error('Error importing bank history:', error);
    return { ok: false, error: error.message };
  }
}

// Defer a reference - simplified for now
export async function actionDeferReference(referenceId: string, days: number = 30) {
  try {
    const supabase = await getSupabaseServer();
    
    const deferredUntil = new Date();
    deferredUntil.setDate(deferredUntil.getDate() + days);

    // Return mock data for now - needs proper database setup
    return { ok: true, data: { deferred_until: deferredUntil } };
  } catch (error: any) {
    console.error('Error deferring reference:', error);
    return { ok: false, error: error.message };
  }
}

// Get reference details with linked payments - simplified for now
export async function actionGetReferenceDetails(referenceId: string) {
  try {
    const supabase = await getSupabaseServer();
    // Return mock data for now - needs proper database setup
    return { ok: true, data: null };
  } catch (error: any) {
    console.error('Error fetching reference details:', error);
    return { ok: false, error: error.message };
  }
}

// Search for payments - simplified for now
export async function actionSearchPayments(query: string) {
  try {
    const supabase = await getSupabaseServer();
    // Return empty data for now - needs proper database setup
    return { ok: true, data: [] };
  } catch (error: any) {
    console.error('Error searching payments:', error);
    return { ok: false, error: error.message };
  }
}

// Mark payments as paid
export async function actionMarkPaymentsAsPaid(paymentIds: string[], references: string[]) {
  try {
    const supabase = await getSupabaseServer();
    
    // First, get the pending payment details
    const { data: payments, error: fetchError } = await supabase
      .from('check_items')
      .select('*')
      .in('id', paymentIds)
      .returns<Tables<'check_items'>[]>();
    
    if (fetchError) throw fetchError;
    
    // Update check_items status to 'completed' and add payment details
    for (const payment of payments || []) {
      // Skip if no reference
      if (!payment.reference) continue;
      
      // Find the corresponding bank history item by reference
      const { data: historyItem, error: historyError } = await supabase
        .from('check_items')
        .select('*')
        .eq('reference', payment.reference)
        .neq('id', payment.id) // Make sure we don't get the same payment
        .single<Tables<'check_items'>>();
      
      if (historyError || !historyItem) continue;
      
      // Update the bank history item with payment details in bank_json
      const existingData = (historyItem.bank_json as any) || {};
      const paymentDetails = {
        ...existingData,
        payments_applied: [
          ...(existingData.payments_applied || []),
          {
            date: new Date().toISOString(),
            description: payment.client_name || '',
            policy_number: payment.policy_number,
            amount: Number(payment.amount),
            is_refund: payment.is_refund,
            applied_to: 'payment',
            payment_id: payment.id
          }
        ]
      };
      
      const { error: updateError } = await supabase
        .from('check_items')
        .update({ 
          status: 'completed',
          bank_json: paymentDetails
        } satisfies TablesUpdate<'check_items'>)
        .eq('id', historyItem.id);
      
      if (updateError) throw updateError;
    }
    
    // Update the pending payments to completed
    const { error } = await supabase
      .from('check_items')
      .update({ status: 'completed' })
      .in('id', paymentIds);
    
    if (error) throw error;
    
    return { ok: true, message: `${paymentIds.length} pagos marcados como realizados` };
  } catch (error: any) {
    console.error('Error marking payments as paid:', error);
    return { ok: false, error: error.message };
  }
}

// Get insurers list
export async function actionGetInsurers() {
  try {
    const supabase = await getSupabaseServer();
    
    const { data, error } = await supabase
      .from('insurers')
      .select('id, name')
      .eq('active', true)
      .order('name');
    
    if (error) throw error;
    
    return { ok: true, data: data || [] };
  } catch (error: any) {
    console.error('Error fetching insurers:', error);
    return { ok: false, error: error.message };
  }
}

// Delete history item
export async function actionDeleteHistoryItem(itemId: string) {
  try {
    const supabase = await getSupabaseServer();
    
    const { error} = await supabase
      .from('check_items')
      .delete()
      .eq('id', itemId);
    
    if (error) throw error;
    
    return { ok: true, message: 'Registro eliminado exitosamente' };
  } catch (error: any) {
    console.error('Error deleting history item:', error);
    return { ok: false, error: error.message };
  }
}

// ========================================
// NEW CHECKS FLOW - Bank Transfers & Pending Payments
// ========================================

// Import bank history from XLSX
export async function actionImportBankHistoryXLSX(transfers: Array<{
  date: Date;
  reference_number: string;
  transaction_code: string;
  description: string;
  amount: number;
}>) {
  try {
    const supabase = await getSupabaseAdmin();
    
    // Check for existing references
    const refs = transfers.map(t => t.reference_number);
    const { data: existing } = await supabase
      .from('bank_transfers')
      .select('reference_number')
      .in('reference_number', refs);
    
    const existingRefs = new Set((existing || []).map((e: any) => e.reference_number));
    const newTransfers = transfers.filter(t => !existingRefs.has(t.reference_number));
    
    if (newTransfers.length === 0) {
      return {
        ok: true,
        data: {
          imported: 0,
          skipped: transfers.length,
          message: 'Todas las referencias ya existen'
        }
      };
    }
    
    // Insert new transfers
    const recordsToInsert: Array<{
      date: string;
      reference_number: string;
      transaction_code: string;
      description: string;
      amount: number;
    }> = [];
    
    for (const t of newTransfers) {
      if (!t.date) continue;
      recordsToInsert.push({
        date: t.date.toISOString().split('T')[0] as string,
        reference_number: t.reference_number,
        transaction_code: t.transaction_code || '',
        description: t.description || '',
        amount: t.amount
      });
    }
    
    const { data, error } = await supabase
      .from('bank_transfers')
      .insert(recordsToInsert)
      .select();
    
    if (error) throw error;
    
    return {
      ok: true,
      data: {
        imported: newTransfers.length,
        skipped: transfers.length - newTransfers.length,
        message: `${newTransfers.length} nuevos, ${transfers.length - newTransfers.length} duplicados omitidos`
      }
    };
  } catch (error: any) {
    console.error('Error importing bank history:', error);
    return { ok: false, error: error.message };
  }
}

// Get bank transfers with payment details
export async function actionGetBankTransfers(filters?: {
  startDate?: string;
  endDate?: string;
  status?: string;
}) {
  try {
    const supabase = await getSupabaseServer();
    
    let query = supabase
      .from('bank_transfers')
      .select(`
        *,
        payment_details (
          id,
          payment_id,
          policy_number,
          insurer_name,
          client_name,
          purpose,
          amount_used,
          paid_at
        )
      `)
      .order('date', { ascending: false });
    
    if (filters?.startDate) {
      query = query.gte('date', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('date', filters.endDate);
    }
    if (filters?.status && filters.status !== 'all') {
      // Status is a generated column, can't filter directly
      // Will filter in JS
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    let results = data || [];
    
    // Filter by status if needed
    if (filters?.status && filters.status !== 'all') {
      results = results.filter((t: any) => t.status === filters.status);
    }
    
    return { ok: true, data: results };
  } catch (error: any) {
    console.error('Error fetching bank transfers:', error);
    return { ok: false, error: error.message };
  }
}

// Create pending payment with references
export async function actionCreatePendingPayment(payment: {
  client_name: string;
  policy_number?: string;
  insurer_name?: string;
  purpose: string;
  amount_to_pay: number;
  notes?: string;
  references: Array<{
    reference_number: string;
    date: string;
    amount: number;
    amount_to_use: number;
  }>;
  divisions?: Array<{
    purpose: string;
    policy_number?: string;
    insurer_name?: string;
    amount: number;
  }>;
}) {
  try {
    const supabase = await getSupabaseAdmin();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { ok: false, error: 'Usuario no autenticado' };
    }
    
    // Calculate total received
    const total_received = payment.references.reduce((sum, ref) => sum + ref.amount, 0);
    
    // Validate references exist in bank
    const refNumbers = payment.references.map(r => r.reference_number);
    const { data: bankRefs } = await supabase
      .from('bank_transfers')
      .select('reference_number')
      .in('reference_number', refNumbers);
    
    const existingRefs = new Set((bankRefs || []).map((r: any) => r.reference_number));
    const can_be_paid = payment.references.every(r => existingRefs.has(r.reference_number));
    
    // Insert pending payment
    const { data: pendingPayment, error: paymentError } = await supabase
      .from('pending_payments')
      .insert([{
        client_name: payment.client_name,
        policy_number: payment.policy_number,
        insurer_name: payment.insurer_name,
        purpose: payment.purpose,
        amount_to_pay: payment.amount_to_pay,
        total_received,
        can_be_paid,
        notes: payment.notes,
        created_by: user.id
      }])
      .select()
      .single();
    
    if (paymentError) throw paymentError;
    
    // Insert payment references
    const { error: refsError } = await supabase
      .from('payment_references')
      .insert(payment.references.map(ref => ({
        payment_id: pendingPayment.id,
        reference_number: ref.reference_number,
        date: ref.date,
        amount: ref.amount,
        amount_to_use: ref.amount_to_use,
        exists_in_bank: existingRefs.has(ref.reference_number)
      })));
    
    if (refsError) throw refsError;
    
    return { ok: true, data: pendingPayment };
  } catch (error: any) {
    console.error('Error creating pending payment:', error);
    return { ok: false, error: error.message };
  }
}

// Get pending payments with references
export async function actionGetPendingPaymentsNew(filters?: {
  status?: string;
  search?: string;
}) {
  try {
    const supabase = await getSupabaseServer();
    
    let query = supabase
      .from('pending_payments')
      .select(`
        *,
        payment_references (
          id,
          reference_number,
          date,
          amount,
          amount_to_use,
          exists_in_bank
        )
      `)
      .order('created_at', { ascending: false });
    
    if (filters?.status === 'pending') {
      query = query.eq('status', 'pending');
    } else if (filters?.status === 'paid') {
      query = query.eq('status', 'paid');
    }
    
    if (filters?.search) {
      query = query.or(`client_name.ilike.%${filters.search}%,policy_number.ilike.%${filters.search}%`);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return { ok: true, data: data || [] };
  } catch (error: any) {
    console.error('Error fetching pending payments:', error);
    return { ok: false, error: error.message };
  }
}

// Mark payments as paid - new flow
export async function actionMarkPaymentsAsPaidNew(paymentIds: string[]) {
  try {
    console.log('Marcando como pagados:', paymentIds);
    const supabase = await getSupabaseAdmin();
    
    // Get payment details
    const { data: payments, error: fetchError } = await supabase
      .from('pending_payments')
      .select(`
        *,
        payment_references (*)
      `)
      .in('id', paymentIds);
    
    if (fetchError) throw fetchError;
    console.log('Pagos obtenidos:', payments?.length);
    
    // For each payment, update bank transfers and create payment details
    for (const payment of payments || []) {
      const refs = payment.payment_references || [];
      
      // Validate all references exist
      if (!payment.can_be_paid) {
        return {
          ok: false,
          error: `El pago "${payment.client_name}" tiene referencias inválidas. Actualice el historial de banco primero.`
        };
      }
      
      // Update each bank transfer
      for (const ref of refs) {
        // Get current bank transfer
        const { data: transfer } = await supabase
          .from('bank_transfers')
          .select('*')
          .eq('reference_number', ref.reference_number)
          .single();
        
        if (!transfer) continue;
        
        // Update used_amount
        const newUsedAmount = Number(transfer.used_amount) + Number(ref.amount_to_use);
        console.log(`Actualizando transfer ${transfer.reference_number}: ${transfer.used_amount} → ${newUsedAmount}`);
        
        const { error: updateError } = await supabase
          .from('bank_transfers')
          .update({
            used_amount: newUsedAmount
          })
          .eq('id', transfer.id);
        
        if (updateError) throw updateError;
        console.log('Transfer actualizado ✓');
        
        // Create payment detail
        const { error: detailError } = await supabase
          .from('payment_details')
          .insert([{
            bank_transfer_id: transfer.id,
            payment_id: payment.id,
            policy_number: payment.policy_number,
            insurer_name: payment.insurer_name,
            client_name: payment.client_name,
            purpose: payment.purpose,
            amount_used: ref.amount_to_use
          }]);
        
        if (detailError) throw detailError;
      }
      
      // Mark payment as paid
      const { error: paymentUpdateError } = await supabase
        .from('pending_payments')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString()
        })
        .eq('id', payment.id);
      
      if (paymentUpdateError) throw paymentUpdateError;
    }
    
    console.log('✅ Todos los pagos procesados correctamente');
    return {
      ok: true,
      message: `${paymentIds.length} pago(s) marcado(s) como pagado(s)`
    };
  } catch (error: any) {
    console.error('❌ Error marking payments as paid:', error);
    return { ok: false, error: error.message };
  }
}

// Validate references against bank
export async function actionValidateReferences(references: string[]) {
  try {
    const supabase = await getSupabaseServer();
    
    const { data, error } = await supabase
      .from('bank_transfers')
      .select('reference_number, amount, remaining_amount')
      .in('reference_number', references);
    
    if (error) throw error;
    
    const results = references.map(ref => {
      const transfer = (data || []).find((t: any) => t.reference_number === ref);
      return {
        reference_number: ref,
        exists: !!transfer,
        available_amount: transfer?.remaining_amount || 0,
        total_amount: transfer?.amount || 0
      };
    });
    
    return { ok: true, data: results };
  } catch (error: any) {
    console.error('Error validating references:', error);
    return { ok: false, error: error.message };
  }
}
