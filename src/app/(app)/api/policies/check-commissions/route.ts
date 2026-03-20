import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * POST /api/policies/check-commissions
 * Verifica si una póliza específica tiene comisiones pagadas a un corredor.
 * Retorna el total y desglose por quincena — mismo formato que /api/clients/check-commissions
 * pero filtrado a un solo policy_number.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    
    // Verificar autenticación
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que sea Master
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'master') {
      return NextResponse.json({ error: 'Solo Master puede realizar esta acción' }, { status: 403 });
    }

    const body = await request.json();
    const { policyNumber, oldBrokerId } = body;

    if (!policyNumber || !oldBrokerId) {
      return NextResponse.json({ error: 'policyNumber y oldBrokerId son requeridos' }, { status: 400 });
    }

    // 1. Obtener percent_default del broker antiguo
    const { data: oldBroker } = await supabase
      .from('brokers')
      .select('percent_default')
      .eq('id', oldBrokerId)
      .single();

    const percentOld = oldBroker?.percent_default || 0;
    console.log('[CHECK POLICY COMMISSIONS] Old broker percent_default:', percentOld);

    // 2. Buscar comm_items del broker antiguo para esta póliza
    const { data: commissions, error: commError } = await supabase
      .from('comm_items')
      .select(`
        id,
        policy_number,
        insured_name,
        insurer_id,
        gross_amount,
        broker_id,
        import_id,
        comm_imports!inner(
          id,
          period_label
        )
      `)
      .eq('policy_number', policyNumber.trim().toUpperCase())
      .eq('broker_id', oldBrokerId)
      .not('gross_amount', 'is', null);

    if (commError) {
      console.error('[CHECK POLICY COMMISSIONS] Error querying comm_items:', commError);
      return NextResponse.json({ error: 'Error al buscar comisiones: ' + commError.message }, { status: 500 });
    }

    console.log('[CHECK POLICY COMMISSIONS] Total comm_items encontrados:', commissions?.length || 0);

    if (!commissions || commissions.length === 0) {
      return NextResponse.json({
        success: true,
        hasPaidCommissions: false,
        totalAmount: 0,
        commissionsByFortnight: []
      });
    }

    // 3. Obtener los fortnight_ids únicos desde period_label
    const fortnightIds = [...new Set(
      commissions
        .map((c: any) => c.comm_imports?.period_label)
        .filter(Boolean)
    )];

    console.log('[CHECK POLICY COMMISSIONS] Fortnight IDs:', fortnightIds);

    // 4. Buscar fortnights con status PAID
    const { data: fortnights } = await supabase
      .from('fortnights')
      .select('id, period_start, period_end, status')
      .in('id', fortnightIds)
      .eq('status', 'PAID');

    if (!fortnights || fortnights.length === 0) {
      console.log('[CHECK POLICY COMMISSIONS] No hay quincenas PAID');
      return NextResponse.json({
        success: true,
        hasPaidCommissions: false,
        totalAmount: 0,
        commissionsByFortnight: []
      });
    }

    // Crear mapa de fortnights PAID
    const paidFortnightMap = new Map<string, { period_start: string; period_end: string }>();
    fortnights.forEach((f: any) => {
      paidFortnightMap.set(f.id, { period_start: f.period_start, period_end: f.period_end });
    });

    // 5. Filtrar comm_items que pertenecen a quincenas PAID
    const paidCommissions = commissions.filter((c: any) => {
      const fortnightId = c.comm_imports?.period_label;
      return fortnightId && paidFortnightMap.has(fortnightId);
    });

    if (paidCommissions.length === 0) {
      return NextResponse.json({
        success: true,
        hasPaidCommissions: false,
        totalAmount: 0,
        commissionsByFortnight: []
      });
    }

    // 6. Agrupar por quincena
    //    gross_amount YA ES la comisión del broker (= raw * percent)
    const byFortnight = paidCommissions.reduce((acc: any, item: any) => {
      const fortnightId = item.comm_imports?.period_label;
      if (!fortnightId) return acc;

      const fortnightData = paidFortnightMap.get(fortnightId);
      if (!fortnightData) return acc;

      if (!acc[fortnightId]) {
        acc[fortnightId] = {
          fortnight_id: fortnightId,
          period_label: fortnightId,
          period_start: fortnightData.period_start,
          period_end: fortnightData.period_end,
          total_commission: 0,
          items: []
        };
      }

      const brokerCommission = Math.abs(item.gross_amount || 0);

      acc[fortnightId].total_commission += brokerCommission;
      acc[fortnightId].items.push({
        id: item.id,
        policy_number: item.policy_number,
        insured_name: item.insured_name || null,
        insurer_id: item.insurer_id || null,
        gross_amount: brokerCommission,
        broker_commission: brokerCommission
      });

      return acc;
    }, {});

    const commissionsByFortnight = Object.values(byFortnight);
    const totalAmount = commissionsByFortnight.reduce((sum: number, f: any) => sum + f.total_commission, 0);

    console.log('[CHECK POLICY COMMISSIONS] Total amount:', totalAmount, 'Fortnights:', commissionsByFortnight.length);

    return NextResponse.json({
      success: true,
      hasPaidCommissions: true,
      totalAmount,
      commissionsByFortnight
    });
  } catch (error: any) {
    console.error('Error checking policy commissions:', error);
    return NextResponse.json({ error: 'Error al verificar comisiones: ' + (error.message || 'desconocido') }, { status: 500 });
  }
}
