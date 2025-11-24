import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fortnight_id, broker_id } = body;

    if (!fortnight_id || !broker_id) {
      return NextResponse.json(
        { ok: false, error: 'fortnight_id y broker_id son requeridos' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Quitar retención
    const { error } = await supabase
      .from('fortnight_broker_totals')
      .update({ is_retained: false })
      .eq('fortnight_id', fortnight_id)
      .eq('broker_id', broker_id);

    if (error) {
      console.error('[unretain] Error:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    revalidatePath('/(app)/commissions');

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[unretain] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
