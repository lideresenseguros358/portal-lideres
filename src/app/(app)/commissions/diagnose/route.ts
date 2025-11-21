import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const advanceId = searchParams.get('advanceId') || 'ca65033a-09ae-49f2-8d79-f25cd1696a32';
    
    const supabase = await getSupabaseAdmin();
    
    // 1. Verificar si el adelanto existe
    const { data: advance, error: advError } = await supabase
      .from('advances')
      .select('*')
      .eq('id', advanceId)
      .single();
    
    // 2. Obtener logs de ese adelanto
    const { data: logs, error: logsError } = await supabase
      .from('advance_logs')
      .select('*')
      .eq('advance_id', advanceId)
      .order('created_at', { ascending: false });
    
    // 3. Calcular totales
    const totalPaid = (logs || []).reduce((sum, log) => sum + Number(log.amount), 0);
    const lastPaymentDate = logs && logs.length > 0 && logs[0] ? logs[0].created_at : null;
    
    return NextResponse.json({
      ok: true,
      advanceExists: !!advance,
      advance: advance || null,
      advanceError: advError?.message || null,
      logsCount: logs?.length || 0,
      logs: logs || [],
      logsError: logsError?.message || null,
      calculated: {
        total_paid: totalPaid,
        last_payment_date: lastPaymentDate,
        should_show_in_descuentos: totalPaid > 0 && !!lastPaymentDate
      }
    });
    
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
