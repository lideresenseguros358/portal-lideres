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


// ============================================
// FUNCIONES OBSOLETAS ELIMINADAS:
// - actionDeferReference (mock data)
// - actionGetReferenceDetails (mock data)
// - actionSearchPayments (mock data)
// - actionMarkPaymentsAsPaid (usaba check_items - reemplazada por actionMarkPaymentsAsPaidNew)
// ============================================

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
    
    // Update payment_references to mark as existing in bank
    const newRefs = newTransfers.map(t => t.reference_number);
    await supabase
      .from('payment_references')
      .update({ exists_in_bank: true })
      .in('reference_number', newRefs)
      .eq('exists_in_bank', false);
    
    // Update pending_payments.can_be_paid where all references now exist
    const { data: pendingWithRefs } = await supabase
      .from('pending_payments')
      .select(`
        id,
        payment_references (id, reference_number, exists_in_bank)
      `)
      .eq('can_be_paid', false);
    
    const toUpdate: string[] = [];
    (pendingWithRefs || []).forEach((p: any) => {
      const allExist = p.payment_references?.every((ref: any) => ref.exists_in_bank);
      if (allExist && p.payment_references?.length > 0) {
        toUpdate.push(p.id);
      }
    });
    
    if (toUpdate.length > 0) {
      await supabase
        .from('pending_payments')
        .update({ can_be_paid: true })
        .in('id', toUpdate);
    }
    
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
    const supabaseAdmin = await getSupabaseAdmin();
    
    // PASO 1: Obtener todas las transferencias bancarias
    let query = supabaseAdmin
      .from('bank_transfers')
      .select('*')
      .order('date', { ascending: false });
    
    if (filters?.startDate) {
      query = query.gte('date', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('date', filters.endDate);
    }
    
    const { data: transfers, error: transfersError } = await query;
    
    if (transfersError) throw transfersError;
    
    let results = transfers || [];
    
    // PASO 2: Obtener TODOS los payment_details
    const { data: allDetails, error: detailsError } = await supabaseAdmin
      .from('payment_details')
      .select('*');
    
    if (detailsError) throw detailsError;
    
    // PASO 3: Agrupar payment_details por bank_transfer_id
    const detailsByTransfer = new Map<string, any[]>();
    (allDetails || []).forEach((detail: any) => {
      if (detail.bank_transfer_id) {
        if (!detailsByTransfer.has(detail.bank_transfer_id)) {
          detailsByTransfer.set(detail.bank_transfer_id, []);
        }
        detailsByTransfer.get(detail.bank_transfer_id)!.push(detail);
      }
    });
    
    // PASO 4: Unir manualmente
    results = results.map((transfer: any) => ({
      ...transfer,
      payment_details: detailsByTransfer.get(transfer.id) || []
    }));
    
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
    const supabaseAdmin = await getSupabaseAdmin();
    
    // PRIMERO: Sincronizar referencias con banco
    // Obtener todas las referencias que están marcadas como no existentes
    const { data: pendingRefs } = await supabaseAdmin
      .from('payment_references')
      .select('id, reference_number')
      .eq('exists_in_bank', false);
    
    if (pendingRefs && pendingRefs.length > 0) {
      const refNumbers = pendingRefs.map(r => r.reference_number);
      
      // Verificar cuáles existen en bank_transfers
      const { data: existingInBank } = await supabaseAdmin
        .from('bank_transfers')
        .select('reference_number')
        .in('reference_number', refNumbers);
      
      const existingRefs = new Set((existingInBank || []).map(b => b.reference_number));
      
      // Actualizar las que ahora existen
      const toUpdate = pendingRefs
        .filter(r => existingRefs.has(r.reference_number))
        .map(r => r.id);
      
      if (toUpdate.length > 0) {
        await supabaseAdmin
          .from('payment_references')
          .update({ exists_in_bank: true })
          .in('id', toUpdate);
        
        // Actualizar pending_payments.can_be_paid
        const { data: pendingWithRefs } = await supabaseAdmin
          .from('pending_payments')
          .select(`
            id,
            payment_references (id, exists_in_bank)
          `)
          .eq('can_be_paid', false);
        
        const paymentsToUpdate: string[] = [];
        (pendingWithRefs || []).forEach((p: any) => {
          const allExist = p.payment_references?.every((ref: any) => ref.exists_in_bank);
          if (allExist && p.payment_references?.length > 0) {
            paymentsToUpdate.push(p.id);
          }
        });
        
        if (paymentsToUpdate.length > 0) {
          await supabaseAdmin
            .from('pending_payments')
            .update({ can_be_paid: true })
            .in('id', paymentsToUpdate);
        }
      }
    }
    
    // SEGUNDO: Obtener los pagos actualizados
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

        // Update bank_transfer amounts and status
        const newUsedAmount = Number(transfer.used_amount || 0) + Number(ref.amount_to_use || 0);
        const newRemainingAmount = Number(transfer.amount) - newUsedAmount;
        
        let newStatus = 'available';
        if (newRemainingAmount <= 0) {
          newStatus = 'exhausted';
        } else if (newUsedAmount > 0) {
          newStatus = 'partial';
        }

        const { error: transferUpdateError} = await supabase
          .from('bank_transfers')
          .update({
            used_amount: newUsedAmount,
            status: newStatus
          })
          .eq('id', transfer.id);

        if (transferUpdateError) throw transferUpdateError;
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
    
    return {
      ok: true,
      message: `${paymentIds.length} pago(s) marcado(s) como pagado(s)`
    };
  } catch (error: any) {
    console.error('Error marking payments as paid:', error);
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
    
    const found = new Set(data?.map((r: any) => r.reference_number) || []);
    const result = references.map((ref) => ({
      reference: ref,
      exists: found.has(ref),
      details: data?.find((r: any) => r.reference_number === ref) || null,
    }));
    
    return { ok: true, data: result };
  } catch (error: any) {
    console.error('Error validating references:', error);
    return { ok: false, error: error.message };
  }
}

// Delete pending payment
export async function actionDeletePendingPayment(paymentId: string) {
  try {
    const supabaseServer = await getSupabaseServer();
    const { data: userData } = await supabaseServer.auth.getUser();

    if (!userData || !userData.user) {
      return { ok: false, error: 'Usuario no autenticado' };
    }

    const supabase = await getSupabaseAdmin();
    
    // Delete payment references first (cascade)
    const { error: refsError } = await supabase
      .from('payment_references')
      .delete()
      .eq('payment_id', paymentId);
    
    if (refsError) throw refsError;
    
    // Delete pending payment
    const { error: paymentError } = await supabase
      .from('pending_payments')
      .delete()
      .eq('id', paymentId);
    
    if (paymentError) throw paymentError;
    
    return { ok: true, message: 'Pago pendiente eliminado correctamente' };
  } catch (error: any) {
    console.error('Error deleting pending payment:', error);
    return { ok: false, error: error.message };
  }
}
