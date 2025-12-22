import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

// GET: Obtener descuentos temporales de una quincena
export async function GET(request: NextRequest) {
  try {
    const fortnight_id = request.nextUrl.searchParams.get('fortnight_id');
    const broker_id = request.nextUrl.searchParams.get('broker_id');

    if (!fortnight_id) {
      return NextResponse.json(
        { ok: false, error: 'fortnight_id es requerido' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('fortnight_discounts')
      .select('*')
      .eq('fortnight_id', fortnight_id)
      .eq('applied', false); // Solo descuentos NO aplicados (aún en borrador)

    if (broker_id) {
      query = query.eq('broker_id', broker_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[fortnight-discounts] GET Error:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: data || [] });
  } catch (error) {
    console.error('[fortnight-discounts] GET Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}

// POST: Crear/Actualizar descuentos temporales
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

    // 1. Validar que los adelantos existen y tienen saldo suficiente
    for (const discount of discounts) {
      const { data: advance } = await supabase
        .from('advances')
        .select('amount, status')
        .eq('id', discount.advance_id)
        .single();

      if (!advance) {
        return NextResponse.json(
          { ok: false, error: `Adelanto ${discount.advance_id} no encontrado` },
          { status: 404 }
        );
      }

      // Calcular saldo del adelanto
      const { data: logs } = await supabase
        .from('advance_logs')
        .select('amount')
        .eq('advance_id', discount.advance_id);

      const totalPaid = (logs || []).reduce((sum, log) => sum + log.amount, 0);
      const remainingBalance = advance.amount - totalPaid;

      if (discount.amount > remainingBalance) {
        return NextResponse.json(
          { ok: false, error: `El monto excede el saldo del adelanto (${remainingBalance.toFixed(2)})` },
          { status: 400 }
        );
      }
    }

    // 2. Eliminar descuentos anteriores de este broker en esta quincena
    await supabase
      .from('fortnight_discounts')
      .delete()
      .eq('fortnight_id', fortnight_id)
      .eq('broker_id', broker_id)
      .eq('applied', false);

    // 3. Insertar nuevos descuentos
    if (discounts.length > 0) {
      const records = discounts.map(d => ({
        fortnight_id,
        broker_id,
        advance_id: d.advance_id,
        amount: d.amount,
        applied: false
      }));

      const { error: insertError } = await supabase
        .from('fortnight_discounts')
        .insert(records);

      if (insertError) {
        console.error('[fortnight-discounts] Insert Error:', insertError);
        return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
      }
    }

    revalidatePath('/(app)/commissions');

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[fortnight-discounts] POST Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar un descuento temporal específico
export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'id es requerido' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('fortnight_discounts')
      .delete()
      .eq('id', id)
      .eq('applied', false); // Solo se pueden eliminar descuentos NO aplicados

    if (error) {
      console.error('[fortnight-discounts] DELETE Error:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    revalidatePath('/(app)/commissions');

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[fortnight-discounts] DELETE Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
