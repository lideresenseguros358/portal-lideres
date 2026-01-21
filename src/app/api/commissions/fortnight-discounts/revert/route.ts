import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

/**
 * POST: Revertir un descuento aplicado
 * - Elimina el registro de fortnight_discounts
 * - Mantiene el adelanto intacto (saldo se restaura automáticamente)
 * - El adelanto queda disponible para ser aplicado nuevamente
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fortnight_id, broker_id, advance_id } = body;

    if (!fortnight_id || !broker_id || !advance_id) {
      return NextResponse.json(
        { ok: false, error: 'Datos incompletos' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 1. Verificar que el descuento existe
    const { data: discount, error: fetchError } = await supabase
      .from('fortnight_discounts')
      .select('*')
      .eq('fortnight_id', fortnight_id)
      .eq('broker_id', broker_id)
      .eq('advance_id', advance_id)
      .eq('applied', false) // Solo descuentos en borrador
      .maybeSingle();

    if (fetchError) {
      console.error('[revert-discount] Error fetching discount:', fetchError);
      return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
    }

    if (!discount) {
      return NextResponse.json(
        { ok: false, error: 'Descuento no encontrado o ya fue aplicado' },
        { status: 404 }
      );
    }

    console.log(`[revert-discount] Revirtiendo descuento de $${discount.amount} para adelanto ${advance_id}`);

    // 2. Eliminar el descuento de fortnight_discounts
    const { error: deleteError } = await supabase
      .from('fortnight_discounts')
      .delete()
      .eq('fortnight_id', fortnight_id)
      .eq('broker_id', broker_id)
      .eq('advance_id', advance_id)
      .eq('applied', false);

    if (deleteError) {
      console.error('[revert-discount] Error deleting discount:', deleteError);
      return NextResponse.json({ ok: false, error: deleteError.message }, { status: 500 });
    }

    console.log('[revert-discount] ✓ Descuento eliminado correctamente');

    // 3. Revalidar páginas relacionadas
    revalidatePath('/commissions');

    return NextResponse.json({ 
      ok: true, 
      message: 'Descuento revertido correctamente',
      amount: discount.amount
    });
  } catch (error) {
    console.error('[revert-discount] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
