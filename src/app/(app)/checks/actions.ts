'use server';

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/client';
import { revalidatePath } from 'next/cache';
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
    // IMPORTANTE: Excluir pagos de descuento a corredor (is_auto_advance=true)
    const { data: pendingWithRefs } = await supabase
      .from('pending_payments')
      .select(`
        id,
        notes,
        payment_references (id, reference_number, exists_in_bank)
      `)
      .eq('can_be_paid', false);
    
    const toUpdate: string[] = [];
    (pendingWithRefs || []).forEach((p: any) => {
      // Verificar si es descuento a corredor
      let isDescuentoCorredor = false;
      try {
        if (p.notes) {
          let metadata: any = null;
          if (typeof p.notes === 'object' && p.notes !== null) {
            metadata = p.notes;
          } else if (typeof p.notes === 'string') {
            metadata = JSON.parse(p.notes);
          }
          if (metadata) {
            const hasAutoFlag = metadata.is_auto_advance === true;
            const hasAdvanceIdDirect = !!metadata.advance_id;
            const hasAdvanceIdInNotes = metadata.notes && typeof metadata.notes === 'string' && 
                                       metadata.notes.includes('Adelanto ID:');
            isDescuentoCorredor = hasAutoFlag || hasAdvanceIdDirect || hasAdvanceIdInNotes;
          }
        }
      } catch (e) {
        // Si no se puede parsear, no es descuento a corredor
      }
      
      // Solo actualizar si NO es descuento a corredor y todas las refs existen
      if (!isDescuentoCorredor) {
        const allExist = p.payment_references?.every((ref: any) => ref.exists_in_bank);
        if (allExist && p.payment_references?.length > 0) {
          toUpdate.push(p.id);
        }
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
    
    // PASO 2: Obtener TODOS los payment_details con JOIN a pending_payments para traer notas
    const { data: allDetails, error: detailsError } = await supabaseAdmin
      .from('payment_details')
      .select(`
        *,
        pending_payments!payment_details_payment_id_fkey (
          notes
        )
      `);
    
    if (detailsError) throw detailsError;
    
    // PASO 3: Agrupar payment_details por bank_transfer_id y parsear metadata
    const detailsByTransfer = new Map<string, any[]>();
    (allDetails || []).forEach((detail: any) => {
      if (detail.bank_transfer_id) {
        // Parsear metadata de notes si existe
        let metadata: any = {};
        let displayNotes = null;
        
        if (detail.pending_payments?.notes) {
          try {
            const parsed = JSON.parse(detail.pending_payments.notes);
            if (parsed && typeof parsed === 'object') {
              metadata = parsed;
              displayNotes = parsed.notes || null;
            }
          } catch {
            displayNotes = detail.pending_payments.notes;
          }
        }
        
        // Agregar metadata al detail
        const enrichedDetail = {
          ...detail,
          notes: displayNotes,
          metadata: metadata,
          banco_nombre: metadata.banco_nombre || null,
          tipo_cuenta: metadata.tipo_cuenta || null,
          cuenta_banco: metadata.cuenta_banco || null,
          devolucion_tipo: metadata.devolucion_tipo || null,
        };
        
        if (!detailsByTransfer.has(detail.bank_transfer_id)) {
          detailsByTransfer.set(detail.bank_transfer_id, []);
        }
        detailsByTransfer.get(detail.bank_transfer_id)!.push(enrichedDetail);
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
  is_broker_deduction?: boolean;
  deduction_broker_id?: string;
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
    
    // Para descuento a corredor, NO validar referencias ni crear transferencias sintéticas ahora
    // Solo se creará en bank_transfers cuando se marque como pagado
    const skipBankValidation = payment.is_broker_deduction && payment.deduction_broker_id;
    
    if (skipBankValidation) {
      console.log('⏭️  Descuento a corredor: Saltando validación de banco (se creará al marcar como pagado)');
    }
    
    // Validate references exist in bank (excepto para descuento a corredor)
    let can_be_paid = true;
    let bankRefMap = new Map<string, {
      id: string;
      amount: number;
      used_amount: number;
      remaining_amount: number;
      status: string | null;
    }>();
    
    if (!skipBankValidation) {
      const refNumbers = payment.references.map(r => r.reference_number);
      const { data: bankRefs, error: bankRefsError } = await supabase
        .from('bank_transfers')
        .select('id, reference_number, amount, used_amount, remaining_amount, status')
        .in('reference_number', refNumbers);

      if (bankRefsError) throw bankRefsError;

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

      can_be_paid = payment.references.every((ref) => bankRefMap.has(ref.reference_number));
    } else {
      // Descuento a corredor: NO puede pagarse hasta que adelanto esté PAID
      can_be_paid = false;
    }

    // Validar saldo solo si NO es descuento a corredor
    if (!skipBankValidation) {
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
    }
    
    // Preparar metadata para notes
    const metadata: any = {
      notes: payment.notes || null,
    };
    
    // Si es descuento a corredor, crear adelanto automáticamente
    let createdAdvanceId: string | undefined;
    let brokerNameForMessage = '';
    if (payment.is_broker_deduction && payment.deduction_broker_id) {
      try {
        // Obtener nombre del broker para el motivo
        const { data: brokerData } = await supabase
          .from('brokers')
          .select('name')
          .eq('id', payment.deduction_broker_id)
          .single();
        
        const brokerName = brokerData?.name || 'Corredor';
        brokerNameForMessage = brokerName;
        const advanceReason = `Descuento por pago: ${payment.client_name}`;
        
        console.log(`💰 Creando adelanto automático para ${brokerName} - Cliente: ${payment.client_name} - Monto: $${payment.amount_to_pay}`);
        
        // Crear adelanto
        const { data: newAdvance, error: advanceError } = await supabase
          .from('advances')
          .insert([{
            broker_id: payment.deduction_broker_id,
            amount: payment.amount_to_pay,
            reason: advanceReason,
            status: 'PENDING',
            created_by: user.id
          }] satisfies TablesInsert<'advances'>[])
          .select()
          .single();
        
        if (advanceError) throw advanceError;
        
        createdAdvanceId = newAdvance.id;
        console.log(`✅ Adelanto creado: ID ${createdAdvanceId} - Status: PENDING`);
        
        // Agregar ID del adelanto al metadata para identificar descuentos a corredor
        metadata.advance_id = createdAdvanceId;
        metadata.is_auto_advance = true; // Flag para identificar descuentos a corredor
        metadata.broker_id = payment.deduction_broker_id;
        metadata.source = 'broker_deduction'; // Identificador adicional
        
      } catch (error: any) {
        console.error('❌ Error al crear adelanto automático:', error);
        return { ok: false, error: `Error al crear adelanto: ${error.message}` };
      }
    }
    
    if (payment.advance_id) {
      metadata.source = 'advance_external';
      metadata.advance_id = payment.advance_id;
    }
    
    if (payment.devolucion_tipo) {
      metadata.devolucion_tipo = payment.devolucion_tipo;
      if (payment.devolucion_tipo === 'cliente') {
        metadata.cuenta_banco = payment.cuenta_banco || '';
        metadata.banco_nombre = (payment as any).banco_nombre || '';
        metadata.tipo_cuenta = (payment as any).tipo_cuenta || '';
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
          purpose: payment.purpose, // Mantener el purpose original del wizard (poliza/devolucion/otro)
          amount_to_pay: payment.amount_to_pay,
          total_received,
          can_be_paid: false, // SIEMPRE false para descuentos hasta que adelanto esté PAID
          status: 'pending' as const,
          notes: createdAdvanceId ? JSON.stringify({
            ...metadata,
            advance_id: createdAdvanceId,
            notes: `Adelanto ID: ${createdAdvanceId}`
          }) : JSON.stringify(metadata),
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
        exists_in_bank: skipBankValidation ? false : bankRefMap.has(ref.reference_number) // false para descuento a corredor
      }));
      allReferencesToInsert.push(...referencesToInsert);
    }

    const { error: refsError } = await supabase
      .from('payment_references')
      .insert(allReferencesToInsert satisfies TablesInsert<'payment_references'>[]);

    if (refsError) throw refsError;

    // NO actualizar bank_transfers aquí - solo al marcar como pagado
    // Esto es un pago PENDIENTE, no confirmado aún

    // Mensaje personalizado para descuento a corredor
    let successMessage = 'Pago pendiente creado exitosamente';
    if (payment.is_broker_deduction && createdAdvanceId && brokerNameForMessage) {
      console.log('✅ Pago pendiente de descuento a corredor creado con purpose="otro"');

      successMessage = `✅ Adelanto creado para ${brokerNameForMessage}\n\n` +
        `• Monto: $${payment.amount_to_pay.toFixed(2)}\n` +
        `• Cliente: ${payment.client_name}\n\n` +
        `El pago se habilitará cuando el adelanto esté confirmado como pagado`;
    } else if (pendingPayments.length > 1) {
      successMessage = `${pendingPayments.length} pagos pendientes creados exitosamente`;
    }

    return { 
      ok: true, 
      data: pendingPayments,
      message: successMessage
    };
  } catch (error: any) {
    console.error('Error creating pending payment:', error);
    return { ok: false, error: error.message };
  }
}

// Clean orphaned payments (paid status but not deleted)
export async function actionCleanOrphanedPayments() {
  try {
    const supabase = await getSupabaseAdmin();
    
    // Buscar pagos con status 'paid' que deberían haber sido eliminados
    const { data: orphanedPayments, error: fetchError } = await supabase
      .from('pending_payments')
      .select('id')
      .eq('status', 'paid');
    
    if (fetchError) throw fetchError;
    
    if (orphanedPayments && orphanedPayments.length > 0) {
      console.log(`🧹 Limpiando ${orphanedPayments.length} pagos huérfanos...`);
      
      const orphanedIds = orphanedPayments.map(p => p.id);
      
      // Eliminar referencias primero
      await supabase
        .from('payment_references')
        .delete()
        .in('payment_id', orphanedIds);
      
      // Eliminar los pagos huérfanos
      const { error: deleteError } = await supabase
        .from('pending_payments')
        .delete()
        .in('id', orphanedIds);
      
      if (deleteError) throw deleteError;
      
      console.log(`✅ Limpieza completada: ${orphanedPayments.length} pagos eliminados`);
      return { ok: true, cleaned: orphanedPayments.length };
    }
    
    return { ok: true, cleaned: 0 };
  } catch (error: any) {
    console.error('Error cleaning orphaned payments:', error);
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
    
    // PRIMERO: Limpiar pagos huérfanos (con status 'paid' que deberían haber sido eliminados)
    await actionCleanOrphanedPayments();
    
    // SEGUNDO: Sincronizar referencias con banco
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
        // IMPORTANTE: Excluir pagos de descuento a corredor (is_auto_advance=true en notes)
        // porque estos se habilitan cuando el adelanto se paga, no por referencias bancarias
        const { data: pendingWithRefs } = await supabaseAdmin
          .from('pending_payments')
          .select(`
            id,
            notes,
            payment_references (id, exists_in_bank)
          `)
          .eq('can_be_paid', false);
        
        const paymentsToUpdate: string[] = [];
        (pendingWithRefs || []).forEach((p: any) => {
          // Verificar si es descuento a corredor
          let isDescuentoCorredor = false;
          try {
            if (p.notes) {
              let metadata: any = null;
              if (typeof p.notes === 'object' && p.notes !== null) {
                metadata = p.notes;
              } else if (typeof p.notes === 'string') {
                metadata = JSON.parse(p.notes);
              }
              if (metadata) {
                const hasAutoFlag = metadata.is_auto_advance === true;
                const hasAdvanceIdDirect = !!metadata.advance_id;
                const hasAdvanceIdInNotes = metadata.notes && typeof metadata.notes === 'string' && 
                                           metadata.notes.includes('Adelanto ID:');
                isDescuentoCorredor = hasAutoFlag || hasAdvanceIdDirect || hasAdvanceIdInNotes;
              }
            }
          } catch (e) {
            // Si no se puede parsear, no es descuento a corredor
          }
          
          // Solo actualizar si NO es descuento a corredor y todas las refs existen
          if (!isDescuentoCorredor) {
            const allExist = p.payment_references?.every((ref: any) => ref.exists_in_bank);
            if (allExist && p.payment_references?.length > 0) {
              paymentsToUpdate.push(p.id);
            }
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
    
    // TERCERO: Obtener los pagos actualizados
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
      .eq('status', 'pending')  // SIEMPRE filtrar por pending para evitar pagos huérfanos
      .order('created_at', { ascending: false });
    
    // Aplicar filtro adicional si se especifica
    if (filters?.status && filters.status !== 'pending') {
      // Si se solicita otro status, cambiar el filtro
      query = supabase
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
        .eq('status', filters.status)
        .order('created_at', { ascending: false });
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

    // Validar referencias solo para pagos normales (no descuentos a corredor)
    const invalidReferences = payments
      .filter((payment: any) => {
        // Excluir descuentos a corredor de la validación
        if (payment.notes) {
          try {
            let metadata: any = null;
            if (typeof payment.notes === 'object' && payment.notes !== null) {
              metadata = payment.notes;
            } else if (typeof payment.notes === 'string') {
              metadata = JSON.parse(payment.notes);
            }
            
            if (metadata) {
              const hasAutoFlag = metadata.is_auto_advance === true;
              const hasAdvanceIdDirect = !!metadata.advance_id;
              const hasAdvanceIdInNotes = metadata.notes && typeof metadata.notes === 'string' && 
                                         metadata.notes.includes('Adelanto ID:');
              if (hasAutoFlag || hasAdvanceIdDirect || hasAdvanceIdInNotes) {
                return false; // Excluir de validación
              }
            }
          } catch (e) {
            // Si no se puede parsear, incluir en validación
          }
        }
        return true; // Incluir en validación
      })
      .flatMap((payment: any) =>
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
      // Verificar si es descuento a corredor: tiene is_auto_advance, advance_id o "Adelanto ID:" en notes
      let isDescuentoCorredor = false;
      if (payment.notes) {
        try {
          let metadata: any = null;
          if (typeof payment.notes === 'object' && payment.notes !== null) {
            metadata = payment.notes;
          } else if (typeof payment.notes === 'string') {
            metadata = JSON.parse(payment.notes);
          }
          
          if (metadata) {
            const hasAutoFlag = metadata.is_auto_advance === true;
            const hasAdvanceIdDirect = !!metadata.advance_id;
            const hasAdvanceIdInNotes = metadata.notes && typeof metadata.notes === 'string' && 
                                       metadata.notes.includes('Adelanto ID:');
            isDescuentoCorredor = hasAutoFlag || hasAdvanceIdDirect || hasAdvanceIdInNotes;
          }
        } catch (e) {
          // Si no se puede parsear, no es descuento a corredor
        }
      }

      // Skip can_be_paid check for DESCUENTO A CORREDOR
      if (!isDescuentoCorredor && !payment.can_be_paid) {
        return {
          ok: false as const,
          error: `El pago "${payment.client_name}" tiene referencias inválidas. Actualice el historial de banco primero.`
        };
      }

      const paidAt = new Date().toISOString();

      // Solo procesar referencias normales si NO es descuento a corredor
      if (!isDescuentoCorredor) {
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

        // remaining_amount y status son columnas generadas, solo actualizar used_amount
        const { error: transferUpdateError } = await supabase
          .from('bank_transfers')
          .update({
            used_amount: newUsedAmount,
          } satisfies TablesUpdate<'bank_transfers'>)
          .eq('id', transfer.id);

        if (transferUpdateError) throw transferUpdateError;

        transferMap.set(referenceNumber, {
          ...transfer,
          used_amount: newUsedAmount,
          remaining_amount: newRemainingAmount,
          status: newStatus,
        });

        existingDetailKeys.add(detailKey);
        }
      } // Fin de if (!isDescuentoCorredor)

      // Special handling for DESCUENTO A CORREDOR
      if (isDescuentoCorredor) {
        // Extraer advance_id usando la misma lógica de sincronización
        let advanceId: string | null = null;
        try {
          if (payment.notes) {
            let metadata: any = null;
            if (typeof payment.notes === 'object' && payment.notes !== null) {
              metadata = payment.notes;
            } else if (typeof payment.notes === 'string') {
              metadata = JSON.parse(payment.notes);
            }
            
            if (metadata) {
              // Buscar advance_id en 2 lugares:
              // 1. Campo directo metadata.advance_id
              // 2. Texto dentro de metadata.notes
              if (metadata.advance_id) {
                advanceId = metadata.advance_id;
              } else if (metadata.notes && typeof metadata.notes === 'string') {
                const match = metadata.notes.match(/Adelanto ID:\s*([a-f0-9-]+)/i);
                if (match && match[1]) {
                  advanceId = match[1];
                }
              }
            }
          }
        } catch (e) {
          console.error('Error parsing notes for advance_id:', e);
        }
        
        // Obtener información del adelanto y broker
        let brokerName = 'CORREDOR';
        let advanceAmount = Number(payment.amount_to_pay) || 0;
        
        if (advanceId) {
          const { data: advanceData } = await supabase
            .from('advances')
            .select(`
              id,
              amount,
              broker_id,
              brokers (name, nombre_completo)
            `)
            .eq('id', advanceId)
            .single();
          
          if (advanceData) {
            const broker = (advanceData as any).brokers;
            brokerName = broker?.name || broker?.nombre_completo || 'CORREDOR';
            
            // Calcular monto total descontado (suma de todos los pagos del adelanto)
            const { data: advanceLogs } = await supabase
              .from('advance_logs')
              .select('amount')
              .eq('advance_id', advanceId);
            
            if (advanceLogs && advanceLogs.length > 0) {
              advanceAmount = advanceLogs.reduce((sum, log) => sum + (Number(log.amount) || 0), 0);
            }
          }
        }
        
        // AHORA SÍ crear la transferencia sintética en banco (al marcar como pagado)
        const dateParts = paidAt.split('T');
        const dateStr = (dateParts[0] || new Date().toISOString().split('T')[0]) as string;
        
        // Descripción detallada: Cliente, Corredor, Monto
        const detailedDescription = `Descuento aplicado a ${brokerName} por pago de cliente ${payment.client_name} - Monto: $${advanceAmount.toFixed(2)}`;
        
        // Generar reference_number único usando ID del pago
        const uniqueReference = `DESC-${payment.id.substring(0, 8).toUpperCase()}`;
        
        const transferPayload: TablesInsert<'bank_transfers'> = {
          reference_number: uniqueReference, // Único por pago
          date: dateStr as string,
          amount: advanceAmount, // Monto total del adelanto descontado
          used_amount: advanceAmount, // Igual al amount = status 'exhausted' automático
          description: detailedDescription, // Descripción detallada con contexto completo
          transaction_code: advanceId ? `ADV-${advanceId.substring(0, 8)}` : 'DESCUENTO',
        };
        
        const { data: newTransfer, error: transferError} = await supabase
          .from('bank_transfers')
          .insert([transferPayload])
          .select()
          .single();

        if (transferError) throw transferError;

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

        if (detailError) throw detailError;
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
    
    // Optimizado: Solo seleccionar campos necesarios y usar índice
    const { data, error } = await supabase
      .from('bank_transfers')
      .select('reference_number, amount, used_amount, remaining_amount, status, date')
      .in('reference_number', references)
      .limit(references.length); // Limitar resultados al número de referencias buscadas
    
    if (error) throw error;
    
    // Crear Map para búsqueda O(1) en lugar de Set
    const transfersMap = new Map(
      (data || []).map((r: any) => [r.reference_number, r])
    );
    
    // Mapear resultados de forma más eficiente
    const result = references.map((ref) => {
      const transfer = transfersMap.get(ref);
      
      if (!transfer) {
        return {
          reference: ref,
          exists: false,
          details: null
        };
      }
      
      // Calcular remaining amount
      let remaining = 0;
      if (transfer.remaining_amount !== null && transfer.remaining_amount !== undefined) {
        remaining = Number(transfer.remaining_amount);
      } else {
        remaining = Math.max(Number(transfer.amount || 0) - Number(transfer.used_amount || 0), 0);
      }
      
      return {
        reference: ref,
        exists: true,
        details: {
          ...transfer,
          remaining_amount: remaining,
          status: transfer.status || 'available'
        }
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

// Update pending payment (básico - sin referencias)
export async function actionUpdatePendingPayment(paymentId: string, updates: {
  client_name: string;
  purpose: string;
  policy_number?: string;
  insurer_name?: string;
  amount_to_pay: number;
  notes?: string;
  devolucion_tipo?: 'cliente' | 'corredor';
  cuenta_banco?: string;
  banco_nombre?: string;
  tipo_cuenta?: string;
  broker_id?: string;
  broker_cuenta?: string;
}) {
  try {
    const supabaseServer = await getSupabaseServer();
    const { data: userData } = await supabaseServer.auth.getUser();

    if (!userData || !userData.user) {
      return { ok: false, error: 'Usuario no autenticado' };
    }

    const supabase = await getSupabaseAdmin();

    // Prepare metadata for notes
    const metadata: any = {
      notes: updates.notes || null,
    };

    if (updates.devolucion_tipo) {
      metadata.devolucion_tipo = updates.devolucion_tipo;
      if (updates.devolucion_tipo === 'cliente') {
        metadata.cuenta_banco = updates.cuenta_banco || '';
        metadata.banco_nombre = updates.banco_nombre || '';
        metadata.tipo_cuenta = updates.tipo_cuenta || '';
      } else if (updates.devolucion_tipo === 'corredor') {
        metadata.broker_id = updates.broker_id || null;
        metadata.broker_cuenta = updates.broker_cuenta || null;
      }
    }

    // Update pending payment
    const { error: updateError } = await supabase
      .from('pending_payments')
      .update({
        client_name: updates.client_name,
        purpose: updates.purpose,
        policy_number: updates.purpose === 'poliza' ? updates.policy_number : null,
        insurer_name: updates.purpose === 'poliza' ? updates.insurer_name : null,
        amount_to_pay: updates.amount_to_pay,
        notes: JSON.stringify(metadata),
      } satisfies TablesUpdate<'pending_payments'>)
      .eq('id', paymentId);

    if (updateError) throw updateError;

    return { ok: true, message: 'Pago actualizado correctamente' };
  } catch (error: any) {
    console.error('Error updating pending payment:', error);
    return { ok: false, error: error.message };
  }
}

// Update pending payment (completo - con referencias y divisiones)
export async function actionUpdatePendingPaymentFull(paymentId: string, updates: {
  client_name: string;
  purpose: string;
  policy_number?: string;
  insurer_name?: string;
  amount_to_pay: number;
  notes?: string;
  devolucion_tipo?: 'cliente' | 'corredor';
  cuenta_banco?: string;
  banco_nombre?: string;
  tipo_cuenta?: string;
  broker_id?: string;
  broker_cuenta?: string;
  references: Array<{
    reference_number: string;
    date: string;
    amount: number;
    amount_to_use: number;
  }>;
  divisions?: Array<any>;
}) {
  try {
    const supabaseServer = await getSupabaseServer();
    const { data: userData } = await supabaseServer.auth.getUser();

    if (!userData || !userData.user) {
      return { ok: false, error: 'Usuario no autenticado' };
    }

    const supabase = await getSupabaseAdmin();

    console.log(`📝 Actualizando pago pendiente ${paymentId}...`);

    // Prepare metadata for notes
    const metadata: any = {
      notes: updates.notes || null,
    };

    if (updates.devolucion_tipo) {
      metadata.devolucion_tipo = updates.devolucion_tipo;
      if (updates.devolucion_tipo === 'cliente') {
        metadata.cuenta_banco = updates.cuenta_banco || '';
        metadata.banco_nombre = updates.banco_nombre || '';
        metadata.tipo_cuenta = updates.tipo_cuenta || '';
      } else if (updates.devolucion_tipo === 'corredor') {
        metadata.broker_id = updates.broker_id || null;
        metadata.broker_cuenta = updates.broker_cuenta || null;
      }
    }

    // Update pending payment
    const { error: updateError } = await supabase
      .from('pending_payments')
      .update({
        client_name: updates.client_name,
        purpose: updates.purpose,
        policy_number: updates.purpose === 'poliza' && !updates.divisions ? updates.policy_number : null,
        insurer_name: updates.purpose === 'poliza' && !updates.divisions ? updates.insurer_name : null,
        amount_to_pay: updates.amount_to_pay,
        notes: JSON.stringify(metadata),
      } satisfies TablesUpdate<'pending_payments'>)
      .eq('id', paymentId);

    if (updateError) {
      console.error('❌ Error actualizando pago:', updateError);
      throw updateError;
    }

    console.log('✅ Pago pendiente actualizado');

    // Delete existing references
    console.log('🗑️ Eliminando referencias antiguas...');
    const { error: deleteRefsError } = await supabase
      .from('payment_references')
      .delete()
      .eq('payment_id', paymentId);

    if (deleteRefsError) {
      console.error('❌ Error eliminando referencias:', deleteRefsError);
      throw deleteRefsError;
    }

    console.log('✅ Referencias antiguas eliminadas');

    // Insert new references
    console.log(`📝 Insertando ${updates.references.length} nuevas referencias...`);
    const newReferences = updates.references.map(ref => ({
      payment_id: paymentId,
      reference_number: ref.reference_number,
      date: ref.date,
      amount: ref.amount,
      amount_to_use: ref.amount_to_use,
      exists_in_bank: true // Se asume que existe
    }));

    const { error: refsError } = await supabase
      .from('payment_references')
      .insert(newReferences satisfies TablesInsert<'payment_references'>[]);

    if (refsError) {
      console.error('❌ Error insertando referencias:', refsError);
      throw refsError;
    }

    console.log('✅ Nuevas referencias insertadas');

    // TODO: Handle divisions if needed in the future

    revalidatePath('/(app)/checks');
    
    return { ok: true, message: 'Pago actualizado correctamente con todas sus referencias' };
  } catch (error: any) {
    console.error('Error updating pending payment:', error);
    return { ok: false, error: error.message };
  }
}

// Sincronizar pagos pendientes con adelantos pagados (para casos existentes)
export async function actionSyncPendingPaymentsWithAdvances() {
  try {
    const supabaseServer = await getSupabaseServer();
    const { data: userData } = await supabaseServer.auth.getUser();

    if (!userData || !userData.user) {
      return { ok: false, error: 'Usuario no autenticado' };
    }

    const supabase = await getSupabaseAdmin();

    // Buscar todos los adelantos completamente pagados
    const { data: paidAdvances, error: advancesError } = await supabase
      .from('advances')
      .select('id, broker_id, amount, reason, status')
      .eq('status', 'PAID');

    if (advancesError) throw advancesError;

    if (!paidAdvances || paidAdvances.length === 0) {
      return { ok: true, message: 'No hay adelantos pagados para sincronizar', updated: 0 };
    }

    // Buscar todos los pagos pendientes no habilitados que sean descuentos a corredor
    // Los descuentos a corredor tienen is_auto_advance=true en notes (metadata)
    const { data: allPendingPayments, error: paymentsError } = await supabase
      .from('pending_payments')
      .select('id, notes, client_name, amount_to_pay, can_be_paid, purpose, status')
      .eq('status', 'pending')
      .eq('can_be_paid', false); // Solo los que NO están habilitados

    if (paymentsError) throw paymentsError;

    if (!allPendingPayments || allPendingPayments.length === 0) {
      return { ok: true, message: 'No hay pagos pendientes para sincronizar', updated: 0 };
    }

    // Filtrar descuentos a corredor: tienen is_auto_advance=true O tienen advance_id en notes
    const pendingPayments = allPendingPayments.filter(payment => {
      try {
        if (payment.notes) {
          let metadata: any = null;
          if (typeof payment.notes === 'object' && payment.notes !== null) {
            metadata = payment.notes;
          } else if (typeof payment.notes === 'string') {
            metadata = JSON.parse(payment.notes);
          }
          
          if (metadata) {
            // Es descuento a corredor si tiene:
            // 1. is_auto_advance=true (pagos nuevos)
            // 2. advance_id directo (algunos pagos)
            // 3. "Adelanto ID:" en el campo notes (pagos antiguos)
            const hasAutoFlag = metadata.is_auto_advance === true;
            const hasAdvanceIdDirect = !!metadata.advance_id;
            const hasAdvanceIdInNotes = metadata.notes && typeof metadata.notes === 'string' && 
                                       metadata.notes.includes('Adelanto ID:');
            return hasAutoFlag || hasAdvanceIdDirect || hasAdvanceIdInNotes;
          }
        }
      } catch (e) {
        // Si no se puede parsear, no es descuento a corredor
      }
      return false;
    });

    if (pendingPayments.length === 0) {
      return { ok: true, message: 'No hay descuentos a corredor para sincronizar', updated: 0 };
    }

    // Crear un Set con los IDs de adelantos pagados para búsqueda rápida
    const paidAdvanceIds = new Set(paidAdvances.map(a => a.id));

    let updatedCount = 0;

    // Revisar cada pago pendiente
    for (const payment of pendingPayments) {
      try {
        // Parsear notes para extraer advance_id
        let paymentAdvanceId: string | null = null;

        if (payment.notes) {
          try {
            let metadata: any = null;
            if (typeof payment.notes === 'object' && payment.notes !== null) {
              metadata = payment.notes;
            } else if (typeof payment.notes === 'string') {
              metadata = JSON.parse(payment.notes);
            }
            
            if (metadata) {
              // Buscar advance_id en 3 lugares:
              // 1. Campo directo metadata.advance_id
              // 2. Texto dentro de metadata.notes
              if (metadata.advance_id) {
                paymentAdvanceId = metadata.advance_id;
              } else if (metadata.notes && typeof metadata.notes === 'string') {
                const match = metadata.notes.match(/Adelanto ID:\s*([a-f0-9-]+)/i);
                if (match && match[1]) {
                  paymentAdvanceId = match[1];
                }
              }
            }
          } catch (e) {
            // Error parsing notes
          }
        }

        // Si el adelanto asociado está en el set de pagados, habilitar el pago
        if (paymentAdvanceId && paidAdvanceIds.has(paymentAdvanceId)) {
          const { error: updateError } = await supabase
            .from('pending_payments')
            .update({
              can_be_paid: true,
            } satisfies TablesUpdate<'pending_payments'>)
            .eq('id', payment.id);

          if (!updateError) {
            updatedCount++;
          }
        }
      } catch (e) {
        console.error(`Error procesando pago ${payment.id}:`, e);
      }
    }

    revalidatePath('/(app)/checks');

    return { 
      ok: true, 
      message: `Sincronización completada: ${updatedCount} pago(s) habilitado(s)`,
      updated: updatedCount 
    };
  } catch (error: any) {
    console.error('Error en sincronización:', error);
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
