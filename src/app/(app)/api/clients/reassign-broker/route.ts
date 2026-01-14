import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * POST /api/clients/reassign-broker
 * Reasigna un cliente a un nuevo corredor con opción de ajustes retroactivos
 * Si makeAdjustments = true:
 *   - Crea adelanto (deuda) al broker antiguo
 *   - Crea pending_items para flujo de ajustes sin identificar
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

    // 4. Procesar cada quincena y crear pending_items
    const pendingItemsToCreate = [];
    let totalDebt = 0;
    let totalNewCommissions = 0;

    for (const fortnight of commissionsData) {
      for (const item of fortnight.items) {
        // Comisión que recibió el broker antiguo
        const commissionPaid = item.broker_commission;
        
        // CALCULAR EN REVERSA: comision_pagada / percent_antiguo = comision_bruta
        const commissionRaw = commissionPaid / (percentOld / 100);
        
        // CALCULAR NUEVA COMISIÓN: comision_bruta * percent_nuevo = comision_nueva
        const newCommission = commissionRaw * (percentNew / 100);

        totalDebt += commissionPaid;
        totalNewCommissions += newCommission;

        // Crear pending_item con status 'open' para flujo de ajustes sin identificar
        pendingItemsToCreate.push({
          policy_number: item.policy_number,
          insured_name: item.insured_name || null,
          insurer_id: item.insurer_id || null,
          commission_raw: commissionRaw,
          fortnight_id: fortnight.fortnight_id,
          status: 'open', // ← IMPORTANTE: status 'open' para que vaya a ajustes sin identificar
          assigned_broker_id: newBrokerId, // Ya asignado al nuevo broker
          assigned_by: user.id,
          assigned_at: new Date().toISOString(),
          assignment_notes: `Reasignación de broker. Broker anterior pagado: $${commissionPaid.toFixed(2)} (${percentOld}%). Comisión bruta: $${commissionRaw.toFixed(2)}. Nueva comisión: $${newCommission.toFixed(2)} (${percentNew}%). Requiere aprobación master.`
        });
      }
    }

    // 5. Insertar pending_items
    if (pendingItemsToCreate.length > 0) {
      const { error: pendingError } = await supabase
        .from('pending_items')
        .insert(pendingItemsToCreate);

      if (pendingError) {
        console.error('Error creating pending items:', pendingError);
        throw new Error('Error al crear items pendientes de ajuste');
      }
    }

    // 6. Crear adelanto (deuda) para el broker antiguo
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
      message: `Cliente reasignado. Deuda creada al broker anterior ($${totalDebt.toFixed(2)}). ${pendingItemsToCreate.length} ajustes pendientes de aprobación master.`,
      adjustmentsCreated: true,
      details: {
        advanceId: advance.id,
        debtAmount: totalDebt,
        pendingItemsCount: pendingItemsToCreate.length,
        oldBrokerPercent: percentOld,
        newBrokerPercent: percentNew,
        totalNewCommissions: totalNewCommissions,
        note: 'Los ajustes aparecerán en "Ajustes Sin Identificar" y requieren aprobación de master.'
      }
    });

  } catch (error: any) {
    console.error('Error in reassign-broker:', error);
    return NextResponse.json({ 
      error: error.message || 'Error al reasignar corredor' 
    }, { status: 500 });
  }
}
