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

    // Obtener datos de producción del año
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
      .eq('year', year);

    if (prodError) {
      console.error('Error fetching production data:', prodError);
      return NextResponse.json({ error: 'Error al obtener datos' }, { status: 500 });
    }

    // Calcular PMA Neto (YTD) por broker
    const brokerTotals = new Map<string, { broker_id: string; broker_name: string; pma_neto_ytd: number }>();

    productionData?.forEach((record: any) => {
      const brokerId = record.broker_id;
      const brokerName = record.brokers?.name || 'Sin nombre';
      const bruto = parseFloat(record.bruto) || 0;
      const canceladas = parseFloat(record.canceladas) || 0;
      const neto = bruto - canceladas;

      if (!brokerTotals.has(brokerId)) {
        brokerTotals.set(brokerId, {
          broker_id: brokerId,
          broker_name: brokerName,
          pma_neto_ytd: 0
        });
      }

      const broker = brokerTotals.get(brokerId)!;
      broker.pma_neto_ytd += neto;
    });

    // Convertir a array y ordenar
    const brokersArray = Array.from(brokerTotals.values());
    
    // Ordenar: descendente por PMA Neto, en empate alfabético
    brokersArray.sort((a, b) => {
      if (b.pma_neto_ytd !== a.pma_neto_ytd) {
        return b.pma_neto_ytd - a.pma_neto_ytd;
      }
      return a.broker_name.localeCompare(b.broker_name);
    });

    // Tomar top 5
    const top5 = brokersArray.slice(0, 5).map((broker, index) => ({
      ...broker,
      rank: index + 1
    }));

    return NextResponse.json({ 
      success: true, 
      data: top5,
      year 
    });
  } catch (error) {
    console.error('Error al obtener top 5:', error);
    return NextResponse.json({ error: 'Error al obtener ranking' }, { status: 500 });
  }
}
