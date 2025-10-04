import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    
    // Verificar autenticación
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    let month = parseInt(searchParams.get('month') || '0');

    // Regla de "mes cerrado":
    // - Por defecto, mes inmediatamente anterior al actual
    // - El 1° de cada mes, si hay datos del mes corriente, puede mostrar ese mes
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentDay = now.getDate();

    const monthNames = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    if (!month || month === 0) {
      if (currentDay === 1 && year === currentYear) {
        // Primer día del mes, verificar si hay datos del mes actual
        const { data: currentMonthData } = await (supabase as any)
          .from('production')
          .select('id')
          .eq('year', currentYear)
          .eq('month', currentMonth) // month es INTEGER en BD
          .limit(1);

        month = (currentMonthData && Array.isArray(currentMonthData) && currentMonthData.length > 0) 
          ? currentMonth 
          : (currentMonth === 1 ? 12 : currentMonth - 1);
      } else {
        // Mes anterior
        month = currentMonth === 1 ? 12 : currentMonth - 1;
      }
    }

    // Obtener datos de producción del mes específico
    const { data: productionData, error: prodError } = await (supabase as any)
      .from('production')
      .select(`
        broker_id,
        bruto,
        canceladas,
        brokers!production_broker_id_fkey (
          id,
          name
        )
      `)
      .eq('year', year)
      .eq('month', month); // month es INTEGER 1-12

    if (prodError) {
      console.error('Error fetching month production:', prodError);
      return NextResponse.json({ error: 'Error al obtener datos' }, { status: 500 });
    }

    if (!productionData || productionData.length === 0) {
      return NextResponse.json({ 
        success: true, 
        data: null,
        message: 'No hay datos para este mes' 
      });
    }

    // Calcular PMA Neto del mes por broker
    const brokers = productionData.map((record: any) => ({
      broker_id: record.broker_id,
      broker_name: record.brokers?.name || 'Sin nombre',
      pma_neto_month: (parseFloat(record.bruto) || 0) - (parseFloat(record.canceladas) || 0)
    }));

    // Ordenar: descendente por PMA Neto, en empate alfabético
    brokers.sort((a: any, b: any) => {
      if (b.pma_neto_month !== a.pma_neto_month) {
        return b.pma_neto_month - a.pma_neto_month;
      }
      return a.broker_name.localeCompare(b.broker_name);
    });

    // Ganador
    const winner = brokers[0];

    return NextResponse.json({ 
      success: true, 
      data: {
        ...winner,
        month,
        month_name: monthNames[month],
        year
      }
    });
  } catch (error) {
    console.error('Error al obtener corredor del mes:', error);
    return NextResponse.json({ error: 'Error al obtener corredor del mes' }, { status: 500 });
  }
}
