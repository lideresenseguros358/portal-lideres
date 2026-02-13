import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * POST /api/clients/reassign-broker
 * Reasigna un cliente a un nuevo corredor con opción de ajustes retroactivos
 * Si makeAdjustments = true:
 *   - Crea adelanto (deuda) al broker antiguo por comisiones ya pagadas
 *   - Crea adjustment_report PRE-APROBADO con comm_items transformados para nuevo broker
 *   - Cálculo reverso: comm_antiguo / % antiguo = bruto → bruto * % nuevo = comm_nuevo
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const supabaseAdmin = getSupabaseAdmin();
    
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

    // 1. Actualizar broker_id en el cliente (usa admin para bypassear RLS)
    const { error: clientUpdateError } = await supabaseAdmin
      .from('clients')
      .update({ 
        broker_id: newBrokerId
      })
      .eq('id', clientId);

    if (clientUpdateError) {
      console.error('Error updating client:', clientUpdateError);
      throw new Error('Error al actualizar cliente');
    }

    // 2. Actualizar broker_id en todas las pólizas del cliente (usa admin para bypassear RLS)
    const { error: policiesUpdateError } = await supabaseAdmin
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

    // 3. Obtener percent_default de ambos brokers (usar admin para bypassear RLS)
    const { data: oldBroker } = await supabaseAdmin
      .from('brokers')
      .select('percent_default')
      .eq('id', oldBrokerId)
      .single();

    const { data: newBroker } = await supabaseAdmin
      .from('brokers')
      .select('percent_default')
      .eq('id', newBrokerId)
      .single();

    if (!oldBroker || !newBroker) {
      throw new Error('No se pudieron obtener los datos de los brokers');
    }

    const percentOld = oldBroker.percent_default || 0;
    const percentNew = newBroker.percent_default || 0;

    console.log(`[REASSIGN] Broker antiguo: ${oldBrokerId} (${percentOld}%), Broker nuevo: ${newBrokerId} (${percentNew}%)`);

    if (percentOld === 0 || percentNew === 0) {
      throw new Error('Los brokers deben tener porcentajes de comisión configurados');
    }

    // 4. Procesar cada comm_item: calcular comisiones y preparar pending_items
    //    check-commissions envía:
    //      - gross_amount: monto bruto del reporte (commission_raw)
    //      - broker_commission: gross_amount * (percentOld / 100) = lo que se le pagó al broker antiguo
    //    Para el nuevo broker:
    //      - commission_raw = gross_amount (el monto bruto original)
    //      - broker_commission_new = gross_amount * (percentNew / 100)
    const pendingItemsToCreate: any[] = [];
    let totalDebt = 0;
    let totalNewCommissions = 0;
    const processedCommItems: any[] = [];

    for (const fortnight of commissionsData) {
      for (const item of fortnight.items) {
        // Lo que se le pagó al broker antiguo
        const commissionPaid = item.broker_commission || 0;
        
        // gross_amount es el monto bruto del reporte (= commission_raw)
        // Si check-commissions envió gross_amount, usarlo directamente
        // Si no, hacer cálculo reverso: commissionPaid / (percentOld / 100)
        const commissionRaw = item.gross_amount || (commissionPaid / (percentOld / 100));
        
        // Calcular nueva comisión: commission_raw * (percentNew / 100)
        const newCommission = commissionRaw * (percentNew / 100);

        totalDebt += commissionPaid;
        totalNewCommissions += newCommission;

        pendingItemsToCreate.push({
          policy_number: item.policy_number,
          insured_name: item.insured_name || null,
          insurer_id: item.insurer_id || null,
          commission_raw: commissionRaw,
          fortnight_id: fortnight.fortnight_id || null,
          status: 'in_review',
          assigned_broker_id: newBrokerId,
          assigned_by: user.id,
          assigned_at: new Date().toISOString(),
          assignment_notes: `Reasignación de broker. Bruto: $${commissionRaw.toFixed(2)}. Comm antiguo: $${commissionPaid.toFixed(2)} (${percentOld}%). Comm nuevo: $${newCommission.toFixed(2)} (${percentNew}%).`,
          _broker_commission: newCommission
        });

        processedCommItems.push({
          comm_item_id: item.id || null,
          policy_number: item.policy_number,
          fortnight_id: fortnight.fortnight_id,
          old_commission: commissionPaid,
          new_commission: newCommission,
          commission_raw: commissionRaw
        });
      }
    }

    console.log(`[REASSIGN] Items procesados: ${processedCommItems.length}. Deuda total: $${totalDebt.toFixed(2)}. Nuevas comisiones: $${totalNewCommissions.toFixed(2)}`);

    // 5. Crear pending_items (requerido por adjustment_report_items FK)
    const pendingInserts = pendingItemsToCreate.map(({ _broker_commission, ...rest }) => rest);
    
    const { data: createdPendingItems, error: pendingError } = await supabaseAdmin
      .from('pending_items')
      .insert(pendingInserts)
      .select();

    if (pendingError || !createdPendingItems) {
      console.error('Error creating pending_items for reassignment:', pendingError);
      throw new Error('Error al crear items pendientes para reasignación');
    }

    console.log(`[REASSIGN] Creados ${createdPendingItems.length} pending_items`);

    // 6. Crear reporte de ajustes PRE-APROBADO para nuevo broker
    const { data: report, error: reportError } = await supabaseAdmin
      .from('adjustment_reports')
      .insert({
        broker_id: newBrokerId,
        status: 'approved',
        total_amount: totalNewCommissions,
        broker_notes: `Reasignación automática de cliente desde otro broker. ${createdPendingItems.length} comisiones recalculadas.`,
        admin_notes: `AUTO-APROBADO: Reasignación de broker. Cliente ID: ${clientId}. Broker anterior: ${oldBrokerId} (${percentOld}%). Total comisiones antiguas: $${totalDebt.toFixed(2)}. Broker nuevo: ${newBrokerId} (${percentNew}%). Total comisiones nuevas: $${totalNewCommissions.toFixed(2)}.`,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (reportError || !report) {
      console.error('Error creating adjustment report:', reportError);
      throw new Error('Error al crear reporte de ajustes');
    }

    console.log(`[REASSIGN] Reporte de ajustes creado: ${report.id}`);

    // 7. Crear adjustment_report_items vinculando pending_items al reporte
    const reportItemsToInsert = createdPendingItems.map((pendingItem: any, index: number) => ({
      report_id: report.id,
      pending_item_id: pendingItem.id,
      commission_raw: pendingItem.commission_raw,
      broker_commission: pendingItemsToCreate[index]._broker_commission
    }));

    const { error: itemsError } = await supabaseAdmin
      .from('adjustment_report_items')
      .insert(reportItemsToInsert);

    if (itemsError) {
      console.error('Error creating adjustment report items:', itemsError);
      // Rollback
      await supabaseAdmin.from('adjustment_reports').delete().eq('id', report.id);
      await supabaseAdmin.from('pending_items').delete().in('id', createdPendingItems.map((p: any) => p.id));
      throw new Error('Error al crear items del reporte de ajustes');
    }

    console.log(`[REASSIGN] ${reportItemsToInsert.length} items vinculados al reporte`);

    // 8. Crear adelanto (deuda) para el broker antiguo
    const { data: advance, error: advanceError } = await supabaseAdmin
      .from('advances')
      .insert({
        broker_id: oldBrokerId,
        amount: Math.abs(totalDebt), // Positivo = adelanto/deuda que debe devolver
        reason: `DEUDA por reasignación de cliente. Cliente reasignado a otro corredor. Total comisiones a recuperar: $${totalDebt.toFixed(2)}. Esta deuda se irá descontando de futuras comisiones.`,
        status: 'PENDING',
        created_by: user.id,
        is_recurring: false
      })
      .select()
      .single();

    if (advanceError) {
      console.error('Error creating advance:', advanceError);
      throw new Error('Error al crear deuda para broker anterior');
    }

    return NextResponse.json({
      success: true,
      message: `Cliente reasignado exitosamente. Deuda de $${totalDebt.toFixed(2)} creada al broker anterior. Reporte de ajustes PRE-APROBADO creado para nuevo broker por $${totalNewCommissions.toFixed(2)}. Esperando confirmación de pago manual.`,
      adjustmentsCreated: true,
      details: {
        advanceId: advance.id,
        debtAmount: totalDebt,
        adjustmentReportId: report.id,
        adjustmentItemsCount: reportItemsToInsert.length,
        oldBrokerId: oldBrokerId,
        oldBrokerPercent: percentOld,
        newBrokerId: newBrokerId,
        newBrokerPercent: percentNew,
        totalOldCommissions: totalDebt,
        totalNewCommissions: totalNewCommissions,
        processedCommItems: processedCommItems,
        note: 'El reporte de ajustes está PRE-APROBADO y aparece en "Ajustes Aprobados" esperando confirmación de pago manual por master.'
      }
    });

  } catch (error: any) {
    console.error('Error in reassign-broker:', error);
    return NextResponse.json({ 
      error: error.message || 'Error al reasignar corredor' 
    }, { status: 500 });
  }
}
