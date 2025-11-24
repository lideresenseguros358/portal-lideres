import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fortnightId = searchParams.get('fortnight_id');

    if (!fortnightId) {
      return NextResponse.json({ ok: false, error: 'fortnight_id requerido' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Obtener imports de esta quincena
    const { data: imports, error: importsError } = await supabase
      .from('comm_imports')
      .select('id, total_amount, is_life_insurance')
      .eq('period_label', fortnightId);

    if (importsError) {
      console.error('[imports-by-fortnight] Error:', importsError);
      return NextResponse.json({ ok: false, error: importsError.message }, { status: 500 });
    }

    // Para cada import, calcular ganancia de oficina
    const importsWithProfit = await Promise.all(
      (imports || []).map(async (imp) => {
        // Obtener comisiones desde fortnight_details (datos procesados)
        const { data: details } = await supabase
          .from('fortnight_details')
          .select('commission_calculated')
          .eq('source_import_id', imp.id);

        const totalComisionesBrokers = (details || []).reduce((sum, detail) => {
          return sum + Math.abs(Number(detail.commission_calculated) || 0);
        }, 0);

        const totalReporte = Math.abs(Number(imp.total_amount) || 0);
        const officeProfit = totalReporte - totalComisionesBrokers;

        return {
          id: imp.id,
          total_amount: totalReporte,
          broker_commissions: totalComisionesBrokers,
          office_profit: officeProfit,
          is_life_insurance: imp.is_life_insurance || false,
        };
      })
    );

    return NextResponse.json({
      ok: true,
      imports: importsWithProfit,
    });

  } catch (error) {
    console.error('[imports-by-fortnight] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
