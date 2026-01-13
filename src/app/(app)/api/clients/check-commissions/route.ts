import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * POST /api/clients/check-commissions
 * Verifica si un cliente tiene comisiones pagadas a un corredor específico
 * Retorna el total y desglose por quincena
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
    const { clientId, oldBrokerId } = body;

    if (!clientId || !oldBrokerId) {
      return NextResponse.json({ error: 'clientId y oldBrokerId son requeridos' }, { status: 400 });
    }

    // Obtener todas las pólizas del cliente
    const { data: policies } = await supabase
      .from('policies')
      .select('policy_number')
      .eq('client_id', clientId);

    if (!policies || policies.length === 0) {
      return NextResponse.json({
        success: true,
        hasPaidCommissions: false,
        totalAmount: 0,
        commissionsByFortnight: []
      });
    }

    const policyNumbers = policies.map(p => p.policy_number);

    // Buscar comisiones pagadas (en quincenas cerradas con status PAID)
    const { data: commissions } = await supabase
      .from('comm_items')
      .select(`
        id,
        policy_number,
        gross_amount,
        broker_commission,
        import_id,
        comm_imports!inner(
          id,
          period_label,
          fortnights!inner(
            id,
            period_start,
            period_end,
            status
          )
        )
      `)
      .in('policy_number', policyNumbers)
      .eq('broker_id', oldBrokerId)
      .not('gross_amount', 'is', null);

    if (!commissions || commissions.length === 0) {
      return NextResponse.json({
        success: true,
        hasPaidCommissions: false,
        totalAmount: 0,
        commissionsByFortnight: []
      });
    }

    // Filtrar solo las comisiones de quincenas PAID
    const paidCommissions = commissions.filter((c: any) => 
      c.comm_imports?.fortnights?.status === 'PAID'
    );

    if (paidCommissions.length === 0) {
      return NextResponse.json({
        success: true,
        hasPaidCommissions: false,
        totalAmount: 0,
        commissionsByFortnight: []
      });
    }

    // Agrupar por quincena
    const byFortnight = paidCommissions.reduce((acc: any, item: any) => {
      const fortnightId = item.comm_imports?.fortnights?.id;
      if (!fortnightId) return acc;

      if (!acc[fortnightId]) {
        acc[fortnightId] = {
          fortnight_id: fortnightId,
          period_label: item.comm_imports?.period_label || '',
          period_start: item.comm_imports?.fortnights?.period_start || '',
          period_end: item.comm_imports?.fortnights?.period_end || '',
          total_commission: 0,
          items: []
        };
      }

      const commission = Math.abs(item.broker_commission || 0);
      acc[fortnightId].total_commission += commission;
      acc[fortnightId].items.push({
        id: item.id,
        policy_number: item.policy_number,
        gross_amount: item.gross_amount,
        broker_commission: commission
      });

      return acc;
    }, {});

    const commissionsByFortnight = Object.values(byFortnight);
    const totalAmount = commissionsByFortnight.reduce((sum: number, f: any) => sum + f.total_commission, 0);

    return NextResponse.json({
      success: true,
      hasPaidCommissions: true,
      totalAmount,
      commissionsByFortnight
    });
  } catch (error) {
    console.error('Error checking commissions:', error);
    return NextResponse.json({ error: 'Error al verificar comisiones' }, { status: 500 });
  }
}
