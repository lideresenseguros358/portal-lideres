import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fortnight_id, broker_id, discounts } = body;

    if (!fortnight_id || !broker_id || !Array.isArray(discounts)) {
      return NextResponse.json(
        { ok: false, error: 'Datos incompletos' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 1. Obtener total actual
    const { data: brokerTotal } = await supabase
      .from('fortnight_broker_totals')
      .select('gross_amount, discounts_json')
      .eq('fortnight_id', fortnight_id)
      .eq('broker_id', broker_id)
      .single();

    if (!brokerTotal) {
      return NextResponse.json(
        { ok: false, error: 'No se encontró el registro del broker' },
        { status: 404 }
      );
    }

    // 2. Calcular nuevo total de descuentos
    const totalDiscount = discounts.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
    const newNetAmount = (brokerTotal as any).gross_amount - totalDiscount;

    if (newNetAmount < 0) {
      return NextResponse.json(
        { ok: false, error: 'El total de descuentos excede el monto bruto' },
        { status: 400 }
      );
    }

    // 3. Actualizar fortnight_broker_totals
    const { error: updateError } = await supabase
      .from('fortnight_broker_totals')
      .update({
        net_amount: newNetAmount,
        discounts_json: {
          adelantos: discounts,
          total: totalDiscount
        }
      })
      .eq('fortnight_id', fortnight_id)
      .eq('broker_id', broker_id);

    if (updateError) {
      console.error('[apply-discounts] Error:', updateError);
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
    }

    revalidatePath('/(app)/commissions');

    return NextResponse.json({ 
      ok: true,
      net_amount: newNetAmount,
      discount_amount: totalDiscount
    });

  } catch (error) {
    console.error('[apply-discounts] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
