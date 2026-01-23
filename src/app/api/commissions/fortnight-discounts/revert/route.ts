import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

/**
 * POST: Revertir/Eliminar un descuento aplicado
 * - Busca el advance_log específico por advance_id y fecha de pago
 * - Valida que el descuento no esté amarrado a un pago pendiente ya pagado
 * - Elimina el advance_log (el saldo del adelanto se restaura automáticamente)
 * - El adelanto queda disponible para ser aplicado nuevamente
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { advance_id, payment_date } = body;

    if (!advance_id || !payment_date) {
      return NextResponse.json(
        { ok: false, error: 'Datos incompletos' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    console.log(`[revert-discount] Buscando descuento: advance_id=${advance_id}, payment_date=${payment_date}`);

    // 1. Buscar el advance_log específico por advance_id y fecha
    // La fecha en created_at está en formato "YYYY-MM-DD HH:MM:SS"
    // payment_date viene como "YYYY-MM-DD"
    const { data: advanceLogs, error: fetchError } = await supabase
      .from('advance_logs')
      .select('*')
      .eq('advance_id', advance_id)
      .gte('created_at', `${payment_date} 00:00:00`)
      .lte('created_at', `${payment_date} 23:59:59`);

    if (fetchError) {
      console.error('[revert-discount] Error fetching advance_log:', fetchError);
      return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
    }

    if (!advanceLogs || advanceLogs.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Descuento no encontrado en esta fecha' },
        { status: 404 }
      );
    }

    const advanceLog = advanceLogs[0]!;
    console.log(`[revert-discount] Advance log encontrado: id=${advanceLog.id}, amount=$${advanceLog.amount}, payment_type=${advanceLog.payment_type}`);

    // 2. Validar si el adelanto está asociado a un pago pendiente YA PAGADO
    // La relación se establece en el campo 'notes' (JSON) con la clave 'advance_id'
    const { data: paidPayments, error: paymentsError } = await supabase
      .from('pending_payments')
      .select('id, status, client_name, notes')
      .eq('status', 'PAID');

    if (paymentsError) {
      console.error('[revert-discount] Error checking paid payments:', paymentsError);
    }

    // Buscar si algún pago PAID tiene este advance_id en su metadata
    if (paidPayments && paidPayments.length > 0) {
      for (const payment of paidPayments) {
        let metadata: any = null;
        
        // Parsear notes como JSON
        if (payment.notes) {
          try {
            metadata = typeof payment.notes === 'string' ? JSON.parse(payment.notes) : payment.notes;
          } catch (e) {
            // Si no es JSON válido, continuar
            continue;
          }
        }

        // Verificar si este pago tiene el advance_id que estamos intentando eliminar
        if (metadata && metadata.advance_id === advance_id) {
          console.log(`[revert-discount] ❌ BLOQUEADO: Descuento amarrado a pago PAID: ${payment.id} - Cliente: ${payment.client_name}`);
          return NextResponse.json({
            ok: false,
            error: 'No se puede eliminar porque este descuento ya se utilizó para un pago. Por favor contactar al administrador para más información.',
            blocked: true,
            payment_info: {
              payment_id: payment.id,
              client: payment.client_name
            }
          }, { status: 403 });
        }
      }
    }

    console.log(`[revert-discount] ✓ Validación pasada: descuento no está amarrado a pagos PAID`);

    // 3. Buscar el pago pendiente asociado ANTES de eliminar el log
    const { data: pendingPayment, error: paymentFetchError } = await supabase
      .from('pending_payments')
      .select('id, status, notes')
      .eq('status', 'paid')
      .ilike('notes', `%${advance_id}%`)
      .single();

    if (paymentFetchError && paymentFetchError.code !== 'PGRST116') {
      console.error('[revert-discount] Error buscando pago pendiente:', paymentFetchError);
    }

    let paymentId: string | null = null;
    if (pendingPayment) {
      try {
        const metadata = typeof pendingPayment.notes === 'string' ? JSON.parse(pendingPayment.notes) : pendingPayment.notes;
        if (metadata && metadata.advance_id === advance_id) {
          paymentId = pendingPayment.id;
          console.log(`[revert-discount] Pago pendiente encontrado: ${paymentId}`);
        }
      } catch (e) {
        // Si no se puede parsear, continuar
      }
    }

    // 4. Eliminar el advance_log (esto restaura el saldo del adelanto automáticamente)
    const { error: deleteError } = await supabase
      .from('advance_logs')
      .delete()
      .eq('id', advanceLog.id);

    if (deleteError) {
      console.error('[revert-discount] Error deleting advance_log:', deleteError);
      return NextResponse.json({ ok: false, error: deleteError.message }, { status: 500 });
    }

    console.log('[revert-discount] ✓ Advance_log eliminado, saldo restaurado');

    // 5. CRÍTICO: Cambiar adelanto a status='PENDING' para que vuelva a "Deudas Activas"
    const { error: advanceUpdateError } = await supabase
      .from('advances')
      .update({ status: 'PENDING' })
      .eq('id', advance_id);

    if (advanceUpdateError) {
      console.error('[revert-discount] Error restaurando adelanto a PENDING:', advanceUpdateError);
      return NextResponse.json({ ok: false, error: advanceUpdateError.message }, { status: 500 });
    }

    console.log('[revert-discount] ✓ Adelanto restaurado a status=PENDING (Deudas Activas)');

    // 6. CRÍTICO: Si hay pago pendiente asociado, des-conciliarlo (volver a pending)
    if (paymentId) {
      const { error: paymentUpdateError } = await supabase
        .from('pending_payments')
        .update({ 
          status: 'pending',
          can_be_paid: false, // Mantener false hasta que se vuelva a conciliar
          paid_at: null
        })
        .eq('id', paymentId);

      if (paymentUpdateError) {
        console.error('[revert-discount] Error des-conciliando pago pendiente:', paymentUpdateError);
        return NextResponse.json({ ok: false, error: paymentUpdateError.message }, { status: 500 });
      }

      console.log('[revert-discount] ✓ Pago pendiente des-conciliado (vuelto a pending)');
    }

    // 7. Revalidar páginas relacionadas
    revalidatePath('/commissions');
    revalidatePath('/checks');

    return NextResponse.json({ 
      ok: true, 
      message: 'Descuento eliminado correctamente. Adelanto restaurado a Deudas Activas.',
      amount: advanceLog.amount,
      advance_restored: true,
      payment_unconciled: paymentId ? true : false
    });
  } catch (error) {
    console.error('[revert-discount] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
