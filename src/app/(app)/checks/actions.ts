'use server';

import { getSupabaseServer } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { DB, Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/client';
import { actionApplyAdvancePayment } from '@/app/(app)/commissions/actions';

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
  metadata?: {
    advance_id?: string | null;
    source?: string | null;
  } | null;
}

// Fetch advance details for prefilling payments
export async function actionGetAdvanceDetails(advanceId: string) {
  try {
    const supabase = await getSupabaseServer();
    const { data, error } = await supabase
      .from('advances')
      .select(`
        id,
        amount,
        status,
        broker_id,
        brokers ( name )
      `)
      .eq('id', advanceId)
      .single();

    if (error) throw error;
    if (!data) {
      return { ok: false, error: 'Adelanto no encontrado' };
    }

    const advance = {
      id: data.id as string,
      amount: Number((data as any).amount) || 0,
      status: (data as any).status as string | null,
      broker_id: (data as any).broker_id as string,
      broker_name: ((data as any).brokers?.name as string) || 'Corredor',
    };

    return { ok: true, data: advance };
  } catch (error: any) {
    console.error('Error fetching advance details:', error);
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
    const supabaseServer = await getSupabaseServer();
    const { data: userData } = await supabaseServer.auth.getUser();

    if (!userData || !userData.user) {
      return { ok: false, error: 'Usuario no autenticado' };
    }

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
    const nowIso = new Date().toISOString();
    const recordsToInsert = newTransfers
      .filter((t) => !!t.date)
      .map((t) => ({
        date: t.date.toISOString().split('T')[0] as string,
        reference_number: t.reference_number,
        transaction_code: t.transaction_code || '',
        description: t.description || '',
        amount: t.amount,
        imported_at: nowIso,
        used_amount: 0,
      } satisfies TablesInsert<'bank_transfers'>));

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
        message: `${newTransfers.length} transferencias importadas, ${transfers.length - newTransfers.length} duplicados omitidos`,
        records: data ?? [],
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
  advance_id?: string;
}) {
  try {
    const supabaseServer = await getSupabaseServer();
    const { data: userSession } = await supabaseServer.auth.getUser();

    if (!userSession || !userSession.user) {
      return { ok: false, error: 'Usuario no autenticado' };
    }

    const user = userSession.user;
    const supabase = await getSupabaseAdmin();
    
    // Calculate total received
    const total_received = payment.references.reduce((sum, ref) => sum + ref.amount, 0);
    
    // Validate references exist in bank
    const refNumbers = payment.references.map(r => r.reference_number);
    const { data: bankRefs, error: bankRefsError } = await supabase
      .from('bank_transfers')
      .select('id, reference_number, amount, used_amount, remaining_amount, status')
      .in('reference_number', refNumbers);

    if (bankRefsError) throw bankRefsError;

    const bankRefMap = new Map<string, {
      id: string;
      amount: number;
      used_amount: number;
      remaining_amount: number;
      status: string | null;
    }>();

    (bankRefs || []).forEach((ref: any) => {
      const amount = Number(ref.amount) || 0;
      const used = Number(ref.used_amount) || 0;
      const remaining = ref.remaining_amount !== null && ref.remaining_amount !== undefined
        ? Number(ref.remaining_amount)
        : amount - used;

      bankRefMap.set(ref.reference_number, {
        id: ref.id,
        amount,
        used_amount: used,
        remaining_amount: remaining,
        status: ref.status ?? null,
      });
    });

    const can_be_paid = payment.references.every((ref) => bankRefMap.has(ref.reference_number));

    const overdrawn = payment.references.find((ref) => {
      const bankRef = bankRefMap.get(ref.reference_number);
      if (!bankRef) return false;
      const requested = Number(ref.amount_to_use);
      return requested > bankRef.remaining_amount + 1e-2; // allow tiny float tolerance
    });

    if (overdrawn) {
      const available = bankRefMap.get(overdrawn.reference_number)?.remaining_amount ?? 0;
      return {
        ok: false as const,
        error: `La referencia ${overdrawn.reference_number} no tiene saldo suficiente (disponible ${available.toFixed(2)}).`
      };
    }
    
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
        notes: payment.advance_id
          ? JSON.stringify({
              source: 'advance_external',
              advance_id: payment.advance_id,
              notes: payment.notes || null,
            })
          : payment.notes,
        created_by: user.id
      }])
      .select()
      .single();
    
    if (paymentError) throw paymentError;
    
    // Insert payment references
    const referencesToInsert = payment.references.map((ref) => ({
      payment_id: pendingPayment.id,
      reference_number: ref.reference_number,
      date: ref.date,
      amount: ref.amount,
      amount_to_use: ref.amount_to_use,
      exists_in_bank: bankRefMap.has(ref.reference_number)
    })) satisfies TablesInsert<'payment_references'>[];

    const { error: refsError } = await supabase
      .from('payment_references')
      .insert(referencesToInsert);

    if (refsError) throw refsError;

    for (const ref of payment.references) {
      const transfer = bankRefMap.get(ref.reference_number);
      if (!transfer) continue;

      const requested = Number(ref.amount_to_use) || 0;
      const newUsed = transfer.used_amount + requested;
      const newRemaining = Math.max(transfer.amount - newUsed, 0);

      const { error: updateTransferError } = await supabase
        .from('bank_transfers')
        .update({
          used_amount: newUsed,
          remaining_amount: newRemaining,
        } satisfies TablesUpdate<'bank_transfers'>)
        .eq('id', transfer.id);

      if (updateTransferError) throw updateTransferError;

      bankRefMap.set(ref.reference_number, {
        ...transfer,
        used_amount: newUsed,
        remaining_amount: newRemaining,
        status: transfer.status,
      });
    }

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
    const supabaseServer = await getSupabaseServer();
    const { data: userData } = await supabaseServer.auth.getUser();

    if (!userData || !userData.user) {
      return { ok: false, error: 'Usuario no autenticado' };
    }

    const supabase = await getSupabaseAdmin();
    
    // Get payment details
    const { data: rawPayments, error: fetchError } = await supabase
      .from('pending_payments')
      .select(`
        *,
        payment_references (*)
      `)
      .in('id', paymentIds);
    
    if (fetchError) throw fetchError;
    console.log('Pagos obtenidos:', rawPayments?.length);

    const payments = (rawPayments || []).map((payment: any) => {
      let metadata: { advance_id?: string | null; source?: string | null; notes?: string | null } | null = null;
      let notesValue: string | null = payment.notes ?? null;

      if (typeof notesValue === 'string') {
        try {
          const parsed = JSON.parse(notesValue) as {
            advance_id?: string | null;
            source?: string | null;
            notes?: string | null;
          };
          if (parsed && (parsed.advance_id || parsed.source)) {
            metadata = {
              advance_id: parsed.advance_id ?? null,
              source: parsed.source ?? null,
              notes: parsed.notes ?? null,
            };
            notesValue = parsed.notes ?? null;
          }
        } catch (_) {
          // keep raw notes
        }
      }

      return {
        ...payment,
        notes: notesValue,
        metadata,
      };
    });
    
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
        const { data: transfer, error: transferError } = await supabase
          .from('bank_transfers')
          .select('*')
          .eq('reference_number', ref.reference_number)
          .single();

        if (transferError) throw transferError;
        if (!transfer) continue;

        const remainingAmount = transfer.remaining_amount !== null && transfer.remaining_amount !== undefined
          ? Number(transfer.remaining_amount)
          : Math.max(Number(transfer.amount) - Number(transfer.used_amount || 0), 0);

        console.log('Transfer verificado ✓');

        const { error: detailError } = await supabase
          .from('payment_details')
          .insert([{
            bank_transfer_id: transfer.id,
            payment_id: payment.id,
            policy_number: payment.policy_number,
            insurer_name: payment.insurer_name,
            client_name: payment.client_name,
            purpose: payment.purpose,
            amount_used: Number(ref.amount_to_use) || 0,
            paid_at: new Date().toISOString(),
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

      if (payment.metadata?.source === 'advance_external' && payment.metadata?.advance_id) {
        const amount = Number(payment.amount_to_pay) || 0;
        if (amount > 0) {
          const advanceResult = await actionApplyAdvancePayment({
            advance_id: payment.metadata.advance_id,
            amount,
            payment_type: 'external_transfer',
          });

          if (!advanceResult.ok) {
            throw new Error(advanceResult.error || 'No se pudo marcar el adelanto como pagado');
          }
        }
      }
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
