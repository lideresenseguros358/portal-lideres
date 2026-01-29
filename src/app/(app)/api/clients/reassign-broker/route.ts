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
        broker_id: newBrokerId,
        ...clientData,
        updated_at: new Date().toISOString()
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

    // 3. Obtener percent_default de ambos brokers
    const { data: oldBroker } = await supabase
      .from('brokers')
      .select('percent_default')
      .eq('id', oldBrokerId)
      .single();

    const { data: newBroker } = await supabase
      .from('brokers')
      .select('percent_default')
      .eq('id', newBrokerId)
      .single();

    if (!oldBroker || !newBroker) {
      throw new Error('No se pudieron obtener los datos de los brokers');
    }

    const percentOld = oldBroker.percent_default || 0;
    const percentNew = newBroker.percent_default || 0;

    if (percentOld === 0 || percentNew === 0) {
      throw new Error('Los brokers deben tener porcentajes de comisión configurados');
    }

    // 4. Procesar cada comm_item y crear adjustment_report_items
    const reportItems = [];
    let totalDebt = 0;
    let totalNewCommissions = 0;
    const processedCommItems = [];

    for (const fortnight of commissionsData) {
      for (const item of fortnight.items) {
        // Comisión que recibió el broker antiguo (YA PAGADA en comm_items)
        const commissionPaid = item.broker_commission;
        
        // CALCULAR EN REVERSA: comision_pagada / percent_antiguo = comision_bruta
        const commissionRaw = commissionPaid / (percentOld / 100);
        
        // CALCULAR NUEVA COMISIÓN: comision_bruta * percent_nuevo = comision_nueva
        const newCommission = commissionRaw * (percentNew / 100);

        totalDebt += commissionPaid;
        totalNewCommissions += newCommission;

        // Crear item para adjustment_report (reporte de ajustes pre-aprobado)
        reportItems.push({
          policy_number: item.policy_number,
          insured_name: item.insured_name || null,
          insurer_id: item.insurer_id || null,
          commission_raw: commissionRaw,
          broker_commission: newCommission,
          pending_item_id: null, // No viene de pending_items, viene de reasignación
          notes: `Reasignación desde broker anterior. Comm original: $${commissionPaid.toFixed(2)} (${percentOld}%). Bruto: $${commissionRaw.toFixed(2)}. Nueva comm: $${newCommission.toFixed(2)} (${percentNew}%).`
        });

        // Registrar comm_item procesado para referencia
        processedCommItems.push({
          comm_item_id: item.comm_item_id || null,
          policy_number: item.policy_number,
          fortnight_id: fortnight.fortnight_id,
          old_commission: commissionPaid,
          new_commission: newCommission
        });
      }
    }

    // 5. Crear reporte de ajustes PRE-APROBADO para nuevo broker
    const { data: report, error: reportError } = await supabase
      .from('adjustment_reports')
      .insert({
        broker_id: newBrokerId,
        status: 'approved', // ← PRE-APROBADO automáticamente
        total_amount: totalNewCommissions,
        broker_notes: `Reasignación automática de cliente desde otro broker. ${reportItems.length} comisiones recalculadas.`,
        admin_notes: `AUTO-APROBADO: Reasignación de broker. Cliente ID: ${clientId}. Broker anterior: ${oldBrokerId} (${percentOld}%). Total comisiones antiguas: $${totalDebt.toFixed(2)}. Broker nuevo: ${newBrokerId} (${percentNew}%). Total comisiones nuevas: $${totalNewCommissions.toFixed(2)}. Deuda creada al broker anterior. Esperando confirmación de pago manual por master.`,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (reportError || !report) {
      console.error('Error creating adjustment report:', reportError);
      throw new Error('Error al crear reporte de ajustes');
    }

    // 6. Insertar items del reporte
    const itemsToInsert = reportItems.map(item => ({
      ...item,
      report_id: report.id
    }));

    const { error: itemsError } = await (supabase as any)
      .from('adjustment_report_items')
      .insert(itemsToInsert);

    if (itemsError) {
      console.error('Error creating adjustment report items:', itemsError);
      // Rollback: eliminar el reporte
      await supabase.from('adjustment_reports').delete().eq('id', report.id);
      throw new Error('Error al crear items del reporte de ajustes');
    }

    // 7. Crear adelanto (deuda) para el broker antiguo
    const { data: advance, error: advanceError } = await supabase
      .from('advances')
      .insert({
        broker_id: oldBrokerId,
        amount: -Math.abs(totalDebt), // Negativo = deuda
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
        adjustmentItemsCount: reportItems.length,
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
