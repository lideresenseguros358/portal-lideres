import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * POST /api/clients/reassign-broker
 * Reasigna un cliente a un nuevo corredor con opción de ajustes retroactivos
 * Si makeAdjustments = true:
 *   - Crea adelanto (deuda) al broker antiguo
 *   - Crea adjustment_reports para broker nuevo
 *   - Actualiza broker_id en client y policies
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
    const { 
      clientId, 
      oldBrokerId, 
      newBrokerId, 
      makeAdjustments,
      commissionsData,
      clientData 
    } = body;

    if (!clientId || !oldBrokerId || !newBrokerId) {
      return NextResponse.json({ 
        error: 'clientId, oldBrokerId y newBrokerId son requeridos' 
      }, { status: 400 });
    }

    // 1. Actualizar broker_id en el cliente
    const { error: clientUpdateError } = await supabase
      .from('clients')
      .update({ 
        broker_id: newBrokerId,
        ...clientData,
        updated_at: new Date().toISOString()
      })
      .eq('id', clientId);

    if (clientUpdateError) {
      console.error('Error updating client:', clientUpdateError);
      throw new Error('Error al actualizar cliente');
    }

    // 2. Actualizar broker_id en todas las pólizas del cliente
    const { error: policiesUpdateError } = await supabase
      .from('policies')
      .update({ 
        broker_id: newBrokerId 
      })
      .eq('client_id', clientId);

    if (policiesUpdateError) {
      console.error('Error updating policies:', policiesUpdateError);
      throw new Error('Error al actualizar pólizas');
    }

    // Si no se requieren ajustes, terminar aquí
    if (!makeAdjustments || !commissionsData || commissionsData.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Cliente reasignado sin ajustes retroactivos',
        adjustmentsCreated: false
      });
    }

    // 3. Calcular total de comisiones
    const totalCommissions = commissionsData.reduce(
      (sum: number, fortnight: any) => sum + fortnight.total_commission, 
      0
    );

    // 4. Crear adelanto (deuda) para el broker antiguo
    // El monto es negativo porque es una deuda
    const { data: advance, error: advanceError } = await supabase
      .from('advances')
      .insert({
        broker_id: oldBrokerId,
        amount: -Math.abs(totalCommissions), // Negativo = deuda
        reason: `Ajuste por reasignación de cliente. Cliente reasignado a otro corredor. Total comisiones recuperadas: $${totalCommissions.toFixed(2)}`,
        status: 'PENDING',
        created_by: user.id,
        is_recurring: false
      })
      .select()
      .single();

    if (advanceError) {
      console.error('Error creating advance:', advanceError);
      throw new Error('Error al crear adelanto para broker anterior');
    }

    // 5. Crear adjustment_reports para el broker nuevo (uno por quincena)
    const adjustmentReports = [];
    const adjustmentItems = [];

    for (const fortnight of commissionsData) {
      // Crear adjustment_report para esta quincena
      const { data: report, error: reportError } = await supabase
        .from('adjustment_reports')
        .insert({
          broker_id: newBrokerId,
          fortnight_id: fortnight.fortnight_id,
          total_amount: fortnight.total_commission,
          status: 'PENDING',
          admin_notes: `Ajuste por reasignación de cliente. Cliente previamente asignado a otro corredor. Período: ${fortnight.period_label}`,
          broker_notes: null
        })
        .select()
        .single();

      if (reportError) {
        console.error('Error creating adjustment report:', reportError);
        throw new Error(`Error al crear reporte de ajuste para quincena ${fortnight.period_label}`);
      }

      adjustmentReports.push(report);

      // 6. Los adjustment_report_items se crearán cuando Master apruebe los reportes
      // Por ahora, los reportes quedan en estado PENDING con la información en admin_notes
      adjustmentItems.push({
        report_id: report.id,
        fortnight_label: fortnight.period_label,
        items_count: fortnight.items.length,
        total_amount: fortnight.total_commission
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Cliente reasignado con ajustes retroactivos creados',
      adjustmentsCreated: true,
      details: {
        advanceId: advance.id,
        advanceAmount: advance.amount,
        adjustmentReportsCount: adjustmentReports.length,
        adjustmentItemsCount: adjustmentItems.length,
        totalCommissions: totalCommissions
      }
    });

  } catch (error: any) {
    console.error('Error in reassign-broker:', error);
    return NextResponse.json({ 
      error: error.message || 'Error al reasignar corredor' 
    }, { status: 500 });
  }
}
