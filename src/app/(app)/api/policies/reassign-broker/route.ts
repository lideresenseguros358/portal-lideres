import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * POST /api/policies/reassign-broker
 * Reasigna UNA póliza específica a un nuevo corredor.
 * 
 * Lógica:
 * - Si el cliente solo tiene 1 póliza → reasignación a nivel de cliente (mismo flujo existente)
 * - Si el cliente tiene 2+ pólizas → duplicar cliente bajo nuevo broker (o reusar existente) + mover póliza
 * 
 * Si makeAdjustments = true:
 *   - Crea adelanto (deuda) al broker antiguo por comisiones pagadas de esta póliza
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
      policyId,
      clientId,
      oldBrokerId, 
      newBrokerId, 
      makeAdjustments,
      commissionsData
    } = body;

    if (!policyId || !clientId || !oldBrokerId || !newBrokerId) {
      return NextResponse.json({ 
        error: 'policyId, clientId, oldBrokerId y newBrokerId son requeridos' 
      }, { status: 400 });
    }

    if (oldBrokerId === newBrokerId) {
      return NextResponse.json({ 
        error: 'El corredor nuevo es igual al actual' 
      }, { status: 400 });
    }

    // 1. Obtener datos del cliente y contar sus pólizas
    const [{ data: clientData }, { data: clientPolicies }] = await Promise.all([
      supabaseAdmin.from('clients').select('*').eq('id', clientId).single(),
      supabaseAdmin.from('policies').select('id').eq('client_id', clientId)
    ]);

    if (!clientData) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const totalPolicies = clientPolicies?.length || 0;
    console.log(`[POLICY REASSIGN] Cliente ${clientId} tiene ${totalPolicies} póliza(s)`);

    let targetClientId: string;
    let isClientLevelReassignment = false;

    if (totalPolicies <= 1) {
      // ========================================
      // CASO 1: Cliente tiene solo 1 póliza
      // → Reasignación a nivel de cliente (sin duplicar)
      // ========================================
      console.log('[POLICY REASSIGN] Solo 1 póliza → reasignación a nivel de cliente');
      isClientLevelReassignment = true;

      // Actualizar broker_id del cliente
      const { error: clientUpdateError } = await supabaseAdmin
        .from('clients')
        .update({ broker_id: newBrokerId })
        .eq('id', clientId);

      if (clientUpdateError) {
        console.error('Error updating client:', clientUpdateError);
        throw new Error('Error al actualizar cliente');
      }

      // Actualizar broker_id de la póliza
      const { error: policyUpdateError } = await supabaseAdmin
        .from('policies')
        .update({ broker_id: newBrokerId })
        .eq('id', policyId);

      if (policyUpdateError) {
        console.error('Error updating policy:', policyUpdateError);
        throw new Error('Error al actualizar póliza');
      }

      targetClientId = clientId;

    } else {
      // ========================================
      // CASO 2: Cliente tiene 2+ pólizas
      // → Duplicar cliente (o reusar existente) + mover solo esta póliza
      // ========================================
      console.log('[POLICY REASSIGN] Múltiples pólizas → duplicar cliente o reusar existente');

      // Verificar si ya existe un cliente con el mismo national_id bajo el nuevo broker
      let existingClientUnderNewBroker = null;
      if (clientData.national_id) {
        const { data: existing } = await supabaseAdmin
          .from('clients')
          .select('id, name, broker_id')
          .eq('national_id', clientData.national_id)
          .eq('broker_id', newBrokerId)
          .single();

        if (existing) {
          existingClientUnderNewBroker = existing;
          console.log(`[POLICY REASSIGN] Cliente existente encontrado bajo nuevo broker: ${existing.id} (${existing.name})`);
        }
      }

      if (existingClientUnderNewBroker) {
        // Reusar cliente existente bajo el nuevo broker
        targetClientId = existingClientUnderNewBroker.id;
      } else {
        // Duplicar el cliente bajo el nuevo broker
        // national_id tiene unique constraint global, así que el duplicado
        // se crea sin national_id para evitar violación de constraint.
        // El registro original mantiene el national_id.
        const { id, created_at, ...clientFields } = clientData;
        const { data: newClient, error: newClientError } = await supabaseAdmin
          .from('clients')
          .insert({
            ...clientFields,
            broker_id: newBrokerId,
            national_id: null, // Evitar violación de unique constraint
          })
          .select()
          .single();

        if (newClientError || !newClient) {
          console.error('Error creating duplicate client:', newClientError);
          throw new Error('Error al duplicar cliente');
        }

        targetClientId = newClient.id;
        console.log(`[POLICY REASSIGN] Cliente duplicado creado: ${targetClientId} (sin national_id para evitar constraint)`);
      }

      // Mover la póliza al cliente destino con el nuevo broker
      const { error: movePolicyError } = await supabaseAdmin
        .from('policies')
        .update({ 
          client_id: targetClientId,
          broker_id: newBrokerId 
        })
        .eq('id', policyId);

      if (movePolicyError) {
        console.error('Error moving policy:', movePolicyError);
        throw new Error('Error al mover póliza al nuevo cliente');
      }

      console.log(`[POLICY REASSIGN] Póliza ${policyId} movida a cliente ${targetClientId}`);
    }

    // ========================================
    // AJUSTES DE COMISIONES (común a ambos casos)
    // ========================================
    if (!makeAdjustments || !commissionsData || commissionsData.length === 0) {
      const modeText = isClientLevelReassignment 
        ? 'Cliente y póliza reasignados sin ajustes retroactivos'
        : 'Póliza reasignada a nuevo cliente sin ajustes retroactivos';
      
      return NextResponse.json({
        success: true,
        message: modeText,
        adjustmentsCreated: false,
        isClientLevelReassignment,
        targetClientId
      });
    }

    // 3. Obtener percent_default de ambos brokers y nombre del cliente
    const [{ data: oldBroker }, { data: newBroker }] = await Promise.all([
      supabaseAdmin.from('brokers').select('percent_default, name').eq('id', oldBrokerId).single(),
      supabaseAdmin.from('brokers').select('percent_default, name').eq('id', newBrokerId).single(),
    ]);

    if (!oldBroker || !newBroker) {
      throw new Error('No se pudieron obtener los datos de los brokers');
    }

    const clientName = clientData.name || 'Cliente';
    const percentOld = oldBroker.percent_default || 0;
    const percentNew = newBroker.percent_default || 0;

    console.log(`[POLICY REASSIGN] Broker antiguo: ${oldBrokerId} (${percentOld}%), Broker nuevo: ${newBrokerId} (${percentNew}%)`);

    if (percentOld === 0 || percentNew === 0) {
      throw new Error('Los brokers deben tener porcentajes de comisión configurados');
    }

    // 4. Procesar cada comm_item
    const pendingItemsToCreate: any[] = [];
    let totalDebt = 0;
    let totalNewCommissions = 0;
    const processedCommItems: any[] = [];

    for (const fortnight of commissionsData) {
      for (const item of fortnight.items) {
        const commissionPaid = item.broker_commission || 0;
        const commissionRaw = percentOld !== 0 ? (commissionPaid / percentOld) : commissionPaid;
        const newCommission = commissionRaw * percentNew;

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
          assignment_notes: `Reasignación de póliza individual. Bruto: $${commissionRaw.toFixed(2)}. Comm antiguo: $${commissionPaid.toFixed(2)} (${percentOld}%). Comm nuevo: $${newCommission.toFixed(2)} (${percentNew}%).`,
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

    console.log(`[POLICY REASSIGN] Items procesados: ${processedCommItems.length}. Deuda total: $${totalDebt.toFixed(2)}. Nuevas comisiones: $${totalNewCommissions.toFixed(2)}`);

    // Info para notas legibles
    const uniquePolicies = [...new Set(processedCommItems.map((i: any) => i.policy_number).filter(Boolean))];
    const uniqueFortnights = [...new Set(commissionsData.map((f: any) => f.fortnight_id).filter(Boolean))];
    const uniqueInsurerIds = [...new Set(pendingItemsToCreate.map((i: any) => i.insurer_id).filter(Boolean))];

    let insurerNames: string[] = [];
    if (uniqueInsurerIds.length > 0) {
      const { data: insurers } = await supabaseAdmin
        .from('insurers')
        .select('name')
        .in('id', uniqueInsurerIds);
      insurerNames = (insurers || []).map((i: any) => i.name).filter(Boolean);
    }

    const policyText = uniquePolicies.length === 1 ? uniquePolicies[0] : `${uniquePolicies.length} pólizas`;
    const insurerText = insurerNames.length === 1 ? insurerNames[0] : (insurerNames.length > 1 ? insurerNames.join(', ') : '');
    const fortnightText = uniqueFortnights.length === 1 ? '1 quincena' : 'Varias quincenas';

    // 5. Crear pending_items
    const pendingInserts = pendingItemsToCreate.map(({ _broker_commission, ...rest }) => rest);
    
    const { data: createdPendingItems, error: pendingError } = await supabaseAdmin
      .from('pending_items')
      .insert(pendingInserts)
      .select();

    if (pendingError || !createdPendingItems) {
      console.error('Error creating pending_items for policy reassignment:', pendingError);
      throw new Error('Error al crear items pendientes para reasignación');
    }

    // 6. Crear reporte de ajustes PRE-APROBADO para nuevo broker
    const { data: report, error: reportError } = await supabaseAdmin
      .from('adjustment_reports')
      .insert({
        broker_id: newBrokerId,
        status: 'approved',
        total_amount: totalNewCommissions,
        broker_notes: `Ajuste por reasignación de póliza individual.`,
        admin_notes: `Reasignación de póliza. Cliente: ${clientName}. Póliza: ${policyText}. ${insurerText ? `Aseguradora: ${insurerText}. ` : ''}${fortnightText}. Broker anterior: ${oldBroker.name || oldBrokerId}. Total deuda: $${totalDebt.toFixed(2)}. Total nuevas comisiones: $${totalNewCommissions.toFixed(2)}.`,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (reportError || !report) {
      console.error('Error creating adjustment report:', reportError);
      throw new Error('Error al crear reporte de ajustes');
    }

    // 7. Crear adjustment_report_items
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

    // 8. Crear adelanto (deuda) para el broker antiguo
    const advanceReason = [
      `DEUDA por reasignación de póliza.`,
      `Cliente: ${clientName}.`,
      `Póliza: ${policyText}.`,
      insurerText ? `Aseguradora: ${insurerText}.` : '',
      `${fortnightText}.`,
    ].filter(Boolean).join(' ');

    const { data: advance, error: advanceError } = await supabaseAdmin
      .from('advances')
      .insert({
        broker_id: oldBrokerId,
        amount: Math.abs(totalDebt),
        reason: advanceReason,
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
      message: `Póliza reasignada exitosamente. Deuda de $${totalDebt.toFixed(2)} creada al broker anterior. Reporte de ajustes PRE-APROBADO creado para nuevo broker por $${totalNewCommissions.toFixed(2)}.`,
      adjustmentsCreated: true,
      isClientLevelReassignment,
      targetClientId,
      details: {
        advanceId: advance.id,
        debtAmount: totalDebt,
        adjustmentReportId: report.id,
        adjustmentItemsCount: reportItemsToInsert.length,
        oldBrokerId,
        oldBrokerPercent: percentOld,
        newBrokerId,
        newBrokerPercent: percentNew,
        totalOldCommissions: totalDebt,
        totalNewCommissions,
        processedCommItems,
        note: 'El reporte de ajustes está PRE-APROBADO y aparece en "Ajustes Aprobados" esperando confirmación de pago manual por master.'
      }
    });

  } catch (error: any) {
    console.error('Error in policy reassign-broker:', error);
    return NextResponse.json({ 
      error: error.message || 'Error al reasignar corredor de póliza' 
    }, { status: 500 });
  }
}
