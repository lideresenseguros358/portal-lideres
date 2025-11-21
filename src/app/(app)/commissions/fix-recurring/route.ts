import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { advanceId } = body;
    
    if (!advanceId) {
      return NextResponse.json({ ok: false, error: 'advanceId required' }, { status: 400 });
    }
    
    const supabase = await getSupabaseAdmin();
    
    // Obtener el adelanto
    const { data: advance, error: advError } = await supabase
      .from('advances')
      .select('*, advance_recurrences(*)')
      .eq('id', advanceId)
      .single();
    
    if (advError || !advance) {
      return NextResponse.json({ ok: false, error: 'Adelanto no encontrado' }, { status: 404 });
    }
    
    // Verificar si es recurrente
    if (!advance.is_recurring || !advance.recurrence_id) {
      return NextResponse.json({ ok: false, error: 'No es un adelanto recurrente' }, { status: 400 });
    }
    
    // Obtener monto original de la recurrencia
    const recurrence = (advance as any).advance_recurrences;
    if (!recurrence) {
      return NextResponse.json({ ok: false, error: 'No se encontró configuración de recurrencia' }, { status: 404 });
    }
    
    // Resetear adelanto
    const { error: updateError } = await supabase
      .from('advances')
      .update({
        amount: recurrence.amount,
        status: 'PENDING'
      })
      .eq('id', advanceId);
    
    if (updateError) throw updateError;
    
    return NextResponse.json({
      ok: true,
      message: 'Adelanto recurrente reseteado',
      advance: {
        id: advance.id,
        reason: advance.reason,
        original_amount: advance.amount,
        new_amount: recurrence.amount,
        status: 'PENDING'
      }
    });
    
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
