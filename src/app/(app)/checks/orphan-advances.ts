'use server';

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { Tables, TablesUpdate } from '@/lib/supabase/client';

/**
 * Tipo para adelantos huérfanos
 */
export interface OrphanAdvance {
  id: string;
  broker_id: string;
  broker_name: string;
  amount: number;
  reason: string | null;
  status: string;
  created_at: string;
  total_paid: number; // Total descontado en advance_logs
  has_paid_logs: boolean; // Si tiene logs con status PAID
}

/**
 * Busca adelantos huérfanos: adelantos que están en status CANCELLED
 * pero que tienen logs indicando que fueron PAID exitosamente.
 * Esto sucede cuando alguien elimina por error un pending_payment asociado.
 */
export async function actionFindOrphanAdvances(brokerId?: string) {
  try {
    const supabase = await getSupabaseAdmin();
    
    // Buscar adelantos CANCELLED
    let query = supabase
      .from('advances')
      .select(`
        id,
        broker_id,
        amount,
        reason,
        status,
        created_at,
        brokers!inner (
          id,
          name
        )
      `)
      .eq('status', 'CANCELLED');
    
    if (brokerId) {
      query = query.eq('broker_id', brokerId);
    }
    
    const { data: cancelledAdvances, error: advancesError } = await query;
    
    if (advancesError) {
      console.error('Error fetching cancelled advances:', advancesError);
      return { ok: false, error: advancesError.message, data: [] };
    }
    
    if (!cancelledAdvances || cancelledAdvances.length === 0) {
      return { ok: true, data: [] };
    }
    
    // Para cada adelanto CANCELLED, verificar si tiene logs que indiquen que fue PAID
    const orphanAdvances: OrphanAdvance[] = [];
    
    for (const advance of cancelledAdvances) {
      const { data: logs, error: logsError } = await supabase
        .from('advance_logs')
        .select('amount, payment_type')
        .eq('advance_id', advance.id);
      
      if (logsError) {
        console.error(`Error fetching logs for advance ${advance.id}:`, logsError);
        continue;
      }
      
      if (logs && logs.length > 0) {
        // Calcular total pagado (descontado)
        const totalPaid = logs.reduce((sum, log) => sum + (log.amount || 0), 0);
        
        // Si tiene logs, significa que se usó/descontó, por lo tanto es huérfano
        orphanAdvances.push({
          id: advance.id,
          broker_id: advance.broker_id,
          broker_name: (advance.brokers as any)?.name || 'Desconocido',
          amount: advance.amount,
          reason: advance.reason,
          status: advance.status,
          created_at: advance.created_at,
          total_paid: totalPaid,
          has_paid_logs: totalPaid > 0,
        });
      }
    }
    
    return { ok: true, data: orphanAdvances };
  } catch (error: any) {
    console.error('Error finding orphan advances:', error);
    return { ok: false, error: error.message, data: [] };
  }
}

/**
 * Recupera un adelanto huérfano asociándolo a un nuevo pending_payment
 * Cambia el status de CANCELLED a PAID y actualiza el metadata del adelanto
 */
export async function actionRecoverOrphanAdvance(
  advanceId: string,
  pendingPaymentId: string,
  clientName: string
) {
  try {
    const supabaseServer = await getSupabaseServer();
    const { data: userData } = await supabaseServer.auth.getUser();
    
    if (!userData || !userData.user) {
      return { ok: false, error: 'Usuario no autenticado' };
    }
    
    const supabase = await getSupabaseAdmin();
    
    // Verificar que el adelanto existe y está CANCELLED
    const { data: advance, error: advanceError } = await supabase
      .from('advances')
      .select('*, advance_logs(*)')
      .eq('id', advanceId)
      .single();
    
    if (advanceError || !advance) {
      return { ok: false, error: 'Adelanto no encontrado' };
    }
    
    if (advance.status !== 'CANCELLED') {
      return { ok: false, error: 'Solo se pueden recuperar adelantos cancelados' };
    }
    
    // Verificar que tiene logs (fue usado)
    if (!advance.advance_logs || advance.advance_logs.length === 0) {
      return { ok: false, error: 'Este adelanto no tiene historial de uso' };
    }
    
    // Cambiar status a PAID (porque ya fue descontado)
    const { error: updateError } = await supabase
      .from('advances')
      .update({ 
        status: 'PAID',
        reason: `${advance.reason || 'Adelanto'} - Recuperado y asociado a: ${clientName}`
      } satisfies TablesUpdate<'advances'>)
      .eq('id', advanceId);
    
    if (updateError) {
      console.error('Error updating advance status:', updateError);
      return { ok: false, error: 'Error al actualizar el adelanto' };
    }
    
    // Actualizar el metadata del pending_payment para asociarlo con este adelanto
    const { data: payment, error: fetchPaymentError } = await supabase
      .from('pending_payments')
      .select('notes')
      .eq('id', pendingPaymentId)
      .single();
    
    if (!fetchPaymentError && payment) {
      let metadata: any = {};
      try {
        metadata = typeof payment.notes === 'string' ? JSON.parse(payment.notes) : payment.notes || {};
      } catch {
        metadata = {};
      }
      
      // Agregar ID del adelanto recuperado al metadata
      metadata.advance_id = advanceId;
      metadata.is_auto_advance = true;
      metadata.source = 'orphan_recovery';
      metadata.recovered_at = new Date().toISOString();
      
      await supabase
        .from('pending_payments')
        .update({ notes: JSON.stringify(metadata) })
        .eq('id', pendingPaymentId);
    }
    
    console.log(`✅ Adelanto ${advanceId} recuperado exitosamente y asociado a pago ${pendingPaymentId}`);
    
    return { 
      ok: true, 
      message: `Adelanto recuperado exitosamente. El monto de $${advance.amount.toFixed(2)} que ya fue descontado ahora está asociado a este pago.`,
      advance_id: advanceId
    };
  } catch (error: any) {
    console.error('Error recovering orphan advance:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * Verifica si un adelanto está PAID (fue descontado) antes de permitir eliminar un pending_payment
 */
export async function actionCheckAdvanceBeforeDelete(advanceId: string) {
  try {
    const supabase = await getSupabaseAdmin();
    
    const { data: advance, error: advanceError } = await supabase
      .from('advances')
      .select('*, advance_logs(*)')
      .eq('id', advanceId)
      .single();
    
    if (advanceError || !advance) {
      return { ok: false, error: 'Adelanto no encontrado', canDelete: false };
    }
    
    // Si el adelanto tiene status PAID, NO se puede eliminar el pago
    if (advance.status === 'PAID') {
      return { 
        ok: true, 
        canDelete: false,
        reason: 'paid',
        message: `Este pago está asociado a un adelanto que ya fue PAGADO/DESCONTADO. 
                  No se puede eliminar porque el dinero ya fue descontado al corredor.
                  Monto del adelanto: $${advance.amount.toFixed(2)}`,
        advance
      };
    }
    
    // Si tiene logs (historial de pagos), también es riesgoso
    if (advance.advance_logs && advance.advance_logs.length > 0) {
      const totalPaid = advance.advance_logs.reduce((sum: number, log: any) => sum + (log.amount || 0), 0);
      return {
        ok: true,
        canDelete: false,
        reason: 'has_history',
        message: `Este pago tiene un adelanto con historial de descuentos.
                  Total descontado: $${totalPaid.toFixed(2)} de $${advance.amount.toFixed(2)}
                  No es seguro eliminarlo sin revisar.`,
        advance
      };
    }
    
    // Si está PENDING sin historial, se puede eliminar
    return { ok: true, canDelete: true, advance };
  } catch (error: any) {
    console.error('Error checking advance before delete:', error);
    return { ok: false, error: error.message, canDelete: false };
  }
}
