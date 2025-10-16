'use server';

import { getSupabaseServer } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { DB, Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/client';
import { actionApplyAdvancePayment } from '@/app/(app)/commissions/actions';

const AMOUNT_TOLERANCE = 0.01;

function determineTransferStatus(amount: number, used: number, remaining: number) {
  if (remaining <= AMOUNT_TOLERANCE) {
    return 'exhausted';
  }
  if (used > AMOUNT_TOLERANCE) {
    return 'partial';
  }
  return 'available';
}

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
        // remaining_amount y status son columnas generadas, se calculan automáticamente
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
    
    console.log('actionGetBankTransfers - consultando BD...');
    
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
    
    // Log para ver qué trae de BD
    if (transfers && transfers.length > 0) {
      console.log('Muestra de datos de BD:', transfers.slice(0, 3).map(t => ({
        ref: t.reference_number,
        used: t.used_amount,
        remaining: t.remaining_amount,
        status: t.status
      })));
    }
    
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
    // Campos de devolución
    return_type?: 'client' | 'broker' | '';
    client_name?: string;
    broker_id?: string;
    bank_name?: string;
    account_type?: string;
    account_number?: string;
    // Campo de otros
    description?: string;
  }>;
  advance_id?: string;
  devolucion_tipo?: 'cliente' | 'corredor';
  cuenta_banco?: string;
  broker_id?: string;
  broker_cuenta?: string;
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
      return requested > bankRef.remaining_amount + AMOUNT_TOLERANCE;
    });

    if (overdrawn) {
      const available = bankRefMap.get(overdrawn.reference_number)?.remaining_amount ?? 0;
      return {
        ok: false as const,
        error: `La referencia ${overdrawn.reference_number} no tiene saldo suficiente (disponible ${available.toFixed(2)}).`
      };
    }
    
    // Preparar metadata para notes
    const metadata: any = {
      notes: payment.notes || null,
    };
    
    if (payment.advance_id) {
      metadata.source = 'advance_external';
      metadata.advance_id = payment.advance_id;
    }
    
    if (payment.devolucion_tipo) {
      metadata.devolucion_tipo = payment.devolucion_tipo;
      if (payment.devolucion_tipo === 'cliente' && payment.cuenta_banco) {
        metadata.cuenta_banco = payment.cuenta_banco;
      } else if (payment.devolucion_tipo === 'corredor') {
        metadata.broker_id = payment.broker_id || null;
        metadata.broker_cuenta = payment.broker_cuenta || null;
      }
    }
    
    // Si hay divisiones, crear múltiples pagos pendientes
    const paymentsToCreate = payment.divisions && payment.divisions.length > 0
      ? payment.divisions.map(div => {
          // Crear metadata específico para cada división
          const divMetadata: any = {
            notes: div.description || payment.notes || null,
          };
          
          if (payment.advance_id) {
            divMetadata.source = 'advance_external';
            divMetadata.advance_id = payment.advance_id;
          }
          
          // Datos de devolución específicos de esta división
          if (div.purpose === 'devolucion') {
            if (div.return_type === 'client') {
              divMetadata.devolucion_tipo = 'cliente';
              divMetadata.client_name = div.client_name;
              divMetadata.cuenta_banco = div.bank_name || '';
              divMetadata.account_type = div.account_type || '';
              divMetadata.account_number = div.account_number || '';
            } else if (div.return_type === 'broker') {
              divMetadata.devolucion_tipo = 'corredor';
              divMetadata.broker_id = div.broker_id || null;
            }
          }
          
          return {
            client_name: payment.client_name,
            policy_number: div.policy_number || payment.policy_number,
            insurer_name: div.insurer_name || payment.insurer_name,
            purpose: div.purpose,
            amount_to_pay: div.amount,
            total_received: div.amount, // Cada división recibe su monto
            can_be_paid,
            status: 'pending' as const,
            notes: JSON.stringify(divMetadata),
            created_by: user.id
          };
        })
      : [{
          client_name: payment.client_name,
          policy_number: payment.policy_number,
          insurer_name: payment.insurer_name,
          purpose: payment.purpose,
          amount_to_pay: payment.amount_to_pay,
          total_received,
          can_be_paid,
          status: 'pending' as const,
          notes: JSON.stringify(metadata),
          created_by: user.id
        }];
    
    // Insert pending payments (uno o múltiples)
    const { data: pendingPayments, error: paymentError } = await supabase
      .from('pending_payments')
      .insert(paymentsToCreate satisfies TablesInsert<'pending_payments'>[])
      .select();
    
    if (paymentError) throw paymentError;
    if (!pendingPayments || pendingPayments.length === 0) {
      throw new Error('No se pudo crear el pago pendiente');
    }
    
    // Insert payment references para cada pago creado
    const allReferencesToInsert: TablesInsert<'payment_references'>[] = [];
    
    for (const pendingPayment of pendingPayments) {
      const referencesToInsert = payment.references.map((ref) => ({
        payment_id: pendingPayment.id,
        reference_number: ref.reference_number,
        date: ref.date,
        amount: ref.amount, // Monto total de la transferencia bancaria
        amount_to_use: pendingPayment.amount_to_pay, // Monto del pago (división o completo)
        exists_in_bank: bankRefMap.has(ref.reference_number)
      }));
      allReferencesToInsert.push(...referencesToInsert);
    }

    const { error: refsError } = await supabase
      .from('payment_references')
      .insert(allReferencesToInsert satisfies TablesInsert<'payment_references'>[]);

    if (refsError) throw refsError;

    // NO actualizar bank_transfers aquí - solo al marcar como pagado
    // Esto es un pago PENDIENTE, no confirmado aún

    return { 
      ok: true, 
      data: pendingPayments,
      message: pendingPayments.length > 1 
        ? `${pendingPayments.length} pagos pendientes creados exitosamente`
        : 'Pago pendiente creado exitosamente'
    };
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

    if (!payments || payments.length === 0) {
      return {
        ok: false as const,
        error: 'No se encontraron pagos para procesar.'
      };
    }

    const alreadyPaid = payments.filter((payment: any) => payment.status === 'paid');
    if (alreadyPaid.length > 0) {
      const labels = alreadyPaid.map((p: any) => `"${p.client_name}"`).join(', ');
      return {
        ok: false as const,
        error: `Los pagos ${labels} ya fueron marcados como pagados previamente.`
      };
    }

    const paymentIdsToProcess = payments.map((payment: any) => payment.id);

    const { data: existingDetails, error: existingDetailsError } = await supabase
      .from('payment_details')
      .select('payment_id, bank_transfer_id')
      .in('payment_id', paymentIdsToProcess);

    if (existingDetailsError) throw existingDetailsError;

    const existingDetailKeys = new Set<string>();
    (existingDetails || []).forEach((detail: any) => {
      if (detail.payment_id && detail.bank_transfer_id) {
        existingDetailKeys.add(`${detail.payment_id}:${detail.bank_transfer_id}`);
      }
    });

    const referenceNumbers = Array.from(
      new Set<string>(
        payments.flatMap((payment: any) =>
          (payment.payment_references || [])
            .map((ref: any) => String(ref.reference_number))
            .filter(Boolean)
        )
      )
    );

    const transferMap = new Map<string, any>();

    if (referenceNumbers.length > 0) {
      const { data: transfersData, error: transfersError } = await supabase
        .from('bank_transfers')
        .select('*')
        .in('reference_number', referenceNumbers);

      if (transfersError) throw transfersError;

      (transfersData || []).forEach((transfer: any) => {
        const key = String(transfer.reference_number);
        transferMap.set(key, transfer);
      });
    }

    const invalidReferences = payments.flatMap((payment: any) =>
      (payment.payment_references || [])
        .filter((ref: any) => !transferMap.has(String(ref.reference_number)))
        .map((ref: any) => ref.reference_number)
    );

    if (invalidReferences.length > 0) {
      const labels = invalidReferences.map((ref: string) => `"${ref}"`).join(', ');
      return {
        ok: false as const,
        error: `Las referencias ${labels} no existen en el historial de banco.`
      };
    }

    // For each payment, update bank transfers and create payment details
    for (const payment of payments || []) {
      const refs = payment.payment_references || [];
      const isDescuentoCorredor = payment.purpose === 'DESCUENTO A CORREDOR';

      // Skip can_be_paid check for DESCUENTO A CORREDOR
      if (!isDescuentoCorredor && !payment.can_be_paid) {
        return {
          ok: false as const,
          error: `El pago "${payment.client_name}" tiene referencias inválidas. Actualice el historial de banco primero.`
        };
      }

      const paidAt = new Date().toISOString();

      for (const ref of refs) {
        const referenceNumber = String(ref.reference_number);
        const transfer = transferMap.get(referenceNumber);

        if (!transfer) {
          return {
            ok: false as const,
            error: `La referencia "${referenceNumber}" no existe en el historial de banco.`
          };
        }

        const detailKey = `${payment.id}:${transfer.id}`;
        if (existingDetailKeys.has(detailKey)) {
          return {
            ok: false as const,
            error: `El pago "${payment.client_name}" ya fue conciliado con la referencia ${referenceNumber}.`
          };
        }

        const amountToUse = Number(ref.amount_to_use) || 0;
        console.log(`📊 Pago ${payment.client_name} - Ref ${referenceNumber}:`, {
          amount: ref.amount,
          amount_to_use: ref.amount_to_use,
          parsed_amount_to_use: amountToUse
        });
        if (amountToUse <= 0) {
          continue;
        }

        const transferAmount = Number(transfer.amount) || 0;
        const transferUsed = Number(transfer.used_amount || 0);
        const transferRemaining = transfer.remaining_amount !== null && transfer.remaining_amount !== undefined
          ? Number(transfer.remaining_amount)
          : Math.max(transferAmount - transferUsed, 0);

        if (amountToUse > transferRemaining + AMOUNT_TOLERANCE) {
          return {
            ok: false as const,
            error: `La referencia ${referenceNumber} no tiene saldo suficiente (disponible ${transferRemaining.toFixed(2)}).`
          };
        }

        const previous = transferMap.get(referenceNumber) || transfer;
        const previousUsed = Number(previous.used_amount || 0);
        const newUsedAmount = previousUsed + amountToUse;
        const newRemainingAmount = Math.max(transferAmount - newUsedAmount, 0);
        const newStatus = determineTransferStatus(transferAmount, newUsedAmount, newRemainingAmount);

        const { error: detailError } = await supabase
          .from('payment_details')
          .insert([{
            bank_transfer_id: transfer.id,
            payment_id: payment.id,
            policy_number: payment.policy_number,
            insurer_name: payment.insurer_name,
            client_name: payment.client_name,
            purpose: payment.purpose,
            amount_used: amountToUse,
            paid_at: paidAt,
          }] satisfies TablesInsert<'payment_details'>[]);

        if (detailError) throw detailError;

        console.log(`Actualizando transfer ${referenceNumber}:`, {
          id: transfer.id,
          used_amount: newUsedAmount,
          remaining_will_be_calculated: newRemainingAmount,
          status_will_be_calculated: newStatus
        });

        // remaining_amount y status son columnas generadas, solo actualizar used_amount
        const { error: transferUpdateError } = await supabase
          .from('bank_transfers')
          .update({
            used_amount: newUsedAmount,
          } satisfies TablesUpdate<'bank_transfers'>)
          .eq('id', transfer.id);

        if (transferUpdateError) {
          console.error('Error actualizando transfer:', transferUpdateError);
          throw transferUpdateError;
        }
        
        console.log(`Transfer ${referenceNumber} actualizado exitosamente`);

        transferMap.set(referenceNumber, {
          ...transfer,
          used_amount: newUsedAmount,
          remaining_amount: newRemainingAmount,
          status: newStatus,
        });

        existingDetailKeys.add(detailKey);
      }

      // Special handling for DESCUENTO A CORREDOR
      if (isDescuentoCorredor) {
        // Get broker name for description
        const { data: brokerData } = await supabase
          .from('brokers')
          .select('name, nombre_completo')
          .eq('id', payment.notes?.match(/Adelanto ID: (.+)/)?.[0] || '')
          .single();

        const brokerName = brokerData?.name || brokerData?.nombre_completo || 'CORREDOR';
        
        // Create bank_transfers entry
        const dateParts = paidAt.split('T');
        const dateStr = (dateParts[0] || new Date().toISOString().split('T')[0]) as string;
        const transferPayload: TablesInsert<'bank_transfers'> = {
          reference_number: `DESC-${payment.id.slice(0, 8)}`,
          date: dateStr as string,
          amount: Number(payment.amount_to_pay) || 0,
          used_amount: Number(payment.amount_to_pay) || 0,
          description: `DESCUENTO A CORREDOR - ${brokerName}`,
          transaction_code: payment.notes || 'DESCUENTO',
        };
        
        const { data: newTransfer, error: transferError} = await supabase
          .from('bank_transfers')
          .insert([transferPayload])
          .select()
          .single();

        if (transferError) {
          console.error('Error creating bank transfer for descuento:', transferError);
          throw transferError;
        }

        // Create payment_details linking to this transfer
        const { error: detailError } = await supabase
          .from('payment_details')
          .insert([{
            bank_transfer_id: newTransfer.id,
            payment_id: payment.id,
            policy_number: payment.policy_number,
            insurer_name: payment.insurer_name,
            client_name: payment.client_name,
            purpose: payment.purpose,
            amount_used: Number(payment.amount_to_pay) || 0,
            paid_at: paidAt,
          }] satisfies TablesInsert<'payment_details'>[]);

        if (detailError) {
          console.error('Error creating payment detail for descuento:', detailError);
          throw detailError;
        }
      }

      const { error: paymentUpdateError } = await supabase
        .from('pending_payments')
        .update({
          status: 'paid',
          paid_at: paidAt,
          can_be_paid: false,
        } satisfies TablesUpdate<'pending_payments'>)
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

      const { error: detailCleanupError } = await supabase
        .from('payment_details')
        .update({ payment_id: null } satisfies TablesUpdate<'payment_details'>)
        .eq('payment_id', payment.id);

      if (detailCleanupError) throw detailCleanupError;

      const { error: referencesDeleteError } = await supabase
        .from('payment_references')
        .delete()
        .eq('payment_id', payment.id);

      if (referencesDeleteError) throw referencesDeleteError;

      const { error: paymentDeleteError } = await supabase
        .from('pending_payments')
        .delete()
        .eq('id', payment.id);

      if (paymentDeleteError) throw paymentDeleteError;
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
      .select('reference_number, amount, used_amount, remaining_amount, status, date')
      .in('reference_number', references);
    
    if (error) throw error;
    
    const found = new Set(data?.map((r: any) => r.reference_number) || []);
    const result = references.map((ref) => {
      const transfer = data?.find((r: any) => r.reference_number === ref);
      let remaining = 0;
      
      if (transfer) {
        // Calculate remaining amount
        if (transfer.remaining_amount !== null && transfer.remaining_amount !== undefined) {
          remaining = Number(transfer.remaining_amount);
        } else {
          remaining = Math.max(Number(transfer.amount || 0) - Number(transfer.used_amount || 0), 0);
        }
      }
      
      return {
        reference: ref,
        exists: found.has(ref),
        details: transfer ? {
          ...transfer,
          remaining_amount: remaining,
          status: transfer.status || 'available'
        } : null,
      };
    });
    
    return { ok: true, data: result };
  } catch (error: any) {
    console.error('Error validating references:', error);
    return { ok: false, error: error.message };
  }
}


// Migrate bank transfers to ensure all have used_amount, remaining_amount, and status
export async function actionMigrateBankTransfers() {
  try {
    const supabase = await getSupabaseAdmin();
    
    // Get all transfers
    const { data: transfers, error: fetchError } = await supabase
      .from('bank_transfers')
      .select('*');
    
    if (fetchError) throw fetchError;
    if (!transfers || transfers.length === 0) {
      return { ok: true, message: 'No hay transferencias para migrar' };
    }
    
    // Calculate used_amount from payment_details
    const { data: allDetails } = await supabase
      .from('payment_details')
      .select('bank_transfer_id, amount_used');
    
    console.log('payment_details encontrados:', allDetails?.length || 0);
    console.log('Muestra payment_details:', allDetails?.slice(0, 5));
    
    const usedByTransfer = new Map<string, number>();
    (allDetails || []).forEach((detail: any) => {
      if (detail.bank_transfer_id) {
        const current = usedByTransfer.get(detail.bank_transfer_id) || 0;
        usedByTransfer.set(detail.bank_transfer_id, current + (Number(detail.amount_used) || 0));
      }
    });
    
    console.log('Transferencias con pagos aplicados:', usedByTransfer.size);
    console.log('Mapa de usado por transfer:', Array.from(usedByTransfer.entries()).slice(0, 5));
    
    // Update each transfer
    let updated = 0;
    console.log(`Procesando ${transfers.length} transferencias...`);
    console.log(`Encontrados ${allDetails?.length || 0} payment_details`);
    
    for (const transfer of transfers) {
      const amount = Number(transfer.amount) || 0;
      const currentUsed = Number(transfer.used_amount) || 0;
      const actualUsed = usedByTransfer.get(transfer.id) || 0;
      
      // Debug primer transfer
      if (updated === 0 && actualUsed > 0) {
        console.log('DEBUG primer transfer con pagos:', {
          id: transfer.id,
          ref: transfer.reference_number,
          currentUsed,
          actualUsed,
          hasInMap: usedByTransfer.has(transfer.id)
        });
      }
      
      // Use actual used from payment_details if different
      const finalUsed = actualUsed > 0 ? actualUsed : currentUsed;
      const remaining = Math.max(amount - finalUsed, 0);
      const status = determineTransferStatus(amount, finalUsed, remaining);
      
      // Only update if values are different
      if (
        transfer.used_amount !== finalUsed ||
        transfer.remaining_amount !== remaining ||
        transfer.status !== status
      ) {
        console.log(`Actualizando ${transfer.reference_number}:`, {
          antes: { used: transfer.used_amount, remaining: transfer.remaining_amount, status: transfer.status },
          despues: { used: finalUsed, remaining, status }
        });
        
        try {
          // remaining_amount y status son columnas generadas, NO actualizar manualmente
          // Solo actualizar used_amount y la BD calcula el resto
          const { data: updatedData, error: updateError } = await supabase
            .from('bank_transfers')
            .update({
              used_amount: finalUsed,
            } satisfies TablesUpdate<'bank_transfers'>)
            .eq('id', transfer.id)
            .select('id, reference_number, used_amount, remaining_amount, status')
            .single();
          
          if (updateError) {
            console.error(`❌ Error actualizando ${transfer.reference_number}:`, updateError);
            continue; // Continuar con el siguiente
          }
          
          if (updatedData) {
            console.log(`✅ ${updatedData.reference_number} actualizado:`, {
              used: updatedData.used_amount,
              remaining: updatedData.remaining_amount,
              status: updatedData.status
            });
            updated++;
          }
        } catch (err) {
          console.error(`❌ Excepción actualizando ${transfer.reference_number}:`, err);
        }
      }
    }
    
    console.log(`Migración completada: ${updated} transferencias actualizadas`);
    
    return { 
      ok: true, 
      message: `${updated} transferencias actualizadas de ${transfers.length} totales` 
    };
  } catch (error: any) {
    console.error('Error migrating bank transfers:', error);
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
