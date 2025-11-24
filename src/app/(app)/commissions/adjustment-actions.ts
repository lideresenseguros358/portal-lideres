'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * Obtener el contexto de autenticación
 */
async function getAuthContext() {
  const supabase = await getSupabaseServer();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    throw new Error('No autenticado');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const { data: broker } = await supabase
    .from('brokers')
    .select('id')
    .eq('p_id', user.id)
    .single();

  return {
    userId: user.id,
    role: profile?.role || 'broker',
    brokerId: broker?.id || null
  };
}

/**
 * Crear un reporte de ajuste agrupado
 * Broker selecciona múltiples items y los envía en un solo reporte
 */
export async function actionCreateAdjustmentReport(
  itemIds: string[],
  notes: string
) {
  try {
    console.log('[actionCreateAdjustmentReport] Iniciando con items:', itemIds);
    const { brokerId, userId } = await getAuthContext();
    console.log('[actionCreateAdjustmentReport] BrokerId:', brokerId);
    if (!brokerId) {
      return { ok: false, error: 'No se encontró información del broker' };
    }

    const supabase = await getSupabaseServer();

    // Obtener los pending items seleccionados
    console.log('[actionCreateAdjustmentReport] Buscando pending items...');
    const { data: pendingItems, error: itemsError } = await supabase
      .from('pending_items')
      .select('*')
      .in('id', itemIds);
    console.log('[actionCreateAdjustmentReport] Pending items encontrados:', pendingItems?.length);

    if (itemsError || !pendingItems || pendingItems.length === 0) {
      return { ok: false, error: 'No se encontraron items pendientes' };
    }

    // Verificar que ningún item ya esté en un reporte
    const { data: existingReportItems } = await supabase
      .from('adjustment_report_items')
      .select('pending_item_id')
      .in('pending_item_id', itemIds);

    if (existingReportItems && existingReportItems.length > 0) {
      return { ok: false, error: 'Algunos items ya están en un reporte existente' };
    }

    // Obtener porcentaje del broker
    const { data: brokerData } = await supabase
      .from('brokers')
      .select('percent_default')
      .eq('id', brokerId)
      .single();

    const brokerPercent = brokerData?.percent_default || 0;

    // Calcular total
    let totalBrokerCommission = 0;
    const reportItems: any[] = [];

    pendingItems.forEach((item: any) => {
      const commissionRaw = Math.abs(Number(item.commission_raw) || 0);
      const brokerCommission = commissionRaw * (brokerPercent / 100);
      totalBrokerCommission += brokerCommission;

      reportItems.push({
        pending_item_id: item.id,
        commission_raw: commissionRaw,
        broker_commission: brokerCommission
      });
    });

    // Crear el reporte
    console.log('[actionCreateAdjustmentReport] Creando reporte con total:', totalBrokerCommission);
    const { data: report, error: reportError } = await supabase
      .from('adjustment_reports')
      .insert({
        broker_id: brokerId,
        status: 'pending',
        total_amount: totalBrokerCommission,
        broker_notes: notes || null
      })
      .select()
      .single();
    console.log('[actionCreateAdjustmentReport] Reporte creado:', report?.id);

    if (reportError || !report) {
      console.error('Error creating report:', reportError);
      return { ok: false, error: 'Error al crear el reporte' };
    }

    // Insertar los items del reporte
    const itemsToInsert = reportItems.map(item => ({
      ...item,
      report_id: report.id
    }));
    console.log('[actionCreateAdjustmentReport] Insertando items del reporte:', itemsToInsert.length);

    const { error: itemsInsertError } = await supabase
      .from('adjustment_report_items')
      .insert(itemsToInsert);
    console.log('[actionCreateAdjustmentReport] Items insertados correctamente');

    if (itemsInsertError) {
      console.error('Error inserting report items:', itemsInsertError);
      // Rollback: eliminar el reporte
      await supabase.from('adjustment_reports').delete().eq('id', report.id);
      return { ok: false, error: 'Error al crear items del reporte' };
    }

    // Actualizar status de pending_items a 'in_review'
    console.log('[actionCreateAdjustmentReport] Actualizando status de pending_items a in_review...');
    const { error: updateError } = await supabase
      .from('pending_items')
      .update({ status: 'in_review' })
      .in('id', itemIds);
    if (updateError) {
      console.error('[actionCreateAdjustmentReport] Error actualizando status:', updateError);
    } else {
      console.log('[actionCreateAdjustmentReport] Status actualizado correctamente');
    }

    // Enviar notificación a Master
    try {
      // Obtener nombre del broker
      const { data: brokerData } = await supabase
        .from('brokers')
        .select('name')
        .eq('id', brokerId)
        .single();

      const brokerName = brokerData?.name || 'Broker';

      // Obtener usuarios Master
      const { data: masterProfiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('role', 'master');

      if (masterProfiles && masterProfiles.length > 0) {
        // Crear notificación para cada Master
        const notifications = masterProfiles.map((master: any) => ({
          target: master.id,
          broker_id: brokerId,
          notification_type: 'commission' as const,
          title: 'Nuevo Reporte de Ajustes',
          body: `${brokerName} ha enviado un reporte de ajustes con ${pendingItems.length} item(s) por un total de $${totalBrokerCommission.toFixed(2)}`,
          meta: {
            report_id: report.id,
            broker_id: brokerId,
            broker_name: brokerName,
            items_count: pendingItems.length,
            total_amount: totalBrokerCommission
          }
        }));

        await supabase.from('notifications').insert(notifications);
      }
    } catch (notifError) {
      console.error('Error enviando notificación:', notifError);
      // No fallar si la notificación falla
    }

    revalidatePath('/commissions');
    
    return { 
      ok: true, 
      message: 'Reporte enviado exitosamente',
      reportId: report.id 
    };
  } catch (error) {
    console.error('[actionCreateAdjustmentReport] Error:', error);
    return { 
      ok: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * Obtener reportes de ajustes
 * Para Broker: solo sus reportes
 * Para Master: todos los reportes
 */
export async function actionGetAdjustmentReports(status?: 'pending' | 'approved' | 'rejected' | 'paid') {
  try {
    const { role, brokerId } = await getAuthContext();
    const supabase = await getSupabaseServer();

    let query = supabase
      .from('adjustment_reports')
      .select(`
        *,
        brokers!inner(name),
        adjustment_report_items!inner(
          *,
          pending_items!inner(
            policy_number,
            insured_name,
            insurers(name)
          )
        )
      `)
      .order('created_at', { ascending: false });

    // Filtrar por broker si no es master
    if (role !== 'master' && brokerId) {
      query = query.eq('broker_id', brokerId);
    }

    // Filtrar por status si se proporciona
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching reports:', error);
      return { ok: false, error: 'Error al obtener reportes' };
    }

    // Formatear datos
    const formattedReports = (data || []).map((report: any) => ({
      id: report.id,
      broker_id: report.broker_id,
      broker_name: report.brokers?.name || 'N/A',
      status: report.status,
      total_amount: Number(report.total_amount) || 0,
      notes: report.broker_notes,
      admin_notes: report.admin_notes,
      payment_mode: report.payment_mode,
      fortnight_id: report.fortnight_id,
      paid_date: report.paid_date,
      rejected_reason: report.rejected_reason,
      created_at: report.created_at,
      reviewed_at: report.reviewed_at,
      items: (report.adjustment_report_items || []).map((item: any) => ({
        id: item.id,
        policy_number: item.pending_items?.policy_number || 'N/A',
        insured_name: item.pending_items?.insured_name || 'N/A',
        commission_raw: Number(item.commission_raw) || 0,
        broker_commission: Number(item.broker_commission) || 0,
        insurer_name: item.pending_items?.insurers?.name || 'N/A'
      }))
    }));

    return { ok: true, data: formattedReports };
  } catch (error) {
    console.error('[actionGetAdjustmentReports] Error:', error);
    return { 
      ok: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * Aprobar un reporte de ajuste (Master)
 * Permite elegir modalidad de pago: inmediato o siguiente quincena
 */
export async function actionApproveAdjustmentReport(
  reportId: string,
  paymentMode: 'immediate' | 'next_fortnight',
  adminNotes: string
) {
  try {
    const { role, userId } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'No autorizado' };
    }

    const supabase = await getSupabaseServer();

    // Obtener el reporte
    const { data: report, error: reportError } = await supabase
      .from('adjustment_reports')
      .select('*, adjustment_report_items(*)')
      .eq('id', reportId)
      .single();

    if (reportError || !report) {
      return { ok: false, error: 'Reporte no encontrado' };
    }

    if (report.status !== 'pending') {
      return { ok: false, error: 'El reporte ya fue revisado' };
    }

    const updateData: any = {
      status: paymentMode === 'immediate' ? 'paid' : 'approved',
      payment_mode: paymentMode,
      admin_notes: adminNotes || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId
    };

    // Si es pago inmediato, marcar como pagado ahora
    if (paymentMode === 'immediate') {
      updateData.paid_date = new Date().toISOString();
    }

    // Si es siguiente quincena, asignar a la próxima quincena DRAFT
    if (paymentMode === 'next_fortnight') {
      const { data: draftFortnight } = await supabase
        .from('fortnights')
        .select('id')
        .eq('status', 'DRAFT')
        .order('period_start', { ascending: false })
        .limit(1)
        .single();

      if (draftFortnight) {
        updateData.fortnight_id = draftFortnight.id;
      }
    }

    // Actualizar el reporte
    const { error: updateError } = await supabase
      .from('adjustment_reports')
      .update(updateData)
      .eq('id', reportId);

    if (updateError) {
      console.error('Error updating report:', updateError);
      return { ok: false, error: 'Error al aprobar reporte' };
    }

    // Actualizar status de pending_items a 'assigned'
    const itemIds = report.adjustment_report_items.map((item: any) => item.pending_item_id);
    await supabase
      .from('pending_items')
      .update({ 
        status: 'assigned',
        assigned_broker_id: report.broker_id,
        assigned_at: new Date().toISOString()
      })
      .in('id', itemIds);

    // Crear registros en temp_client_imports (preliminar)
    // Obtener datos completos de los pending_items
    const { data: pendingItemsData } = await supabase
      .from('pending_items')
      .select(`
        policy_number,
        insured_name,
        insurer_id,
        insurers!inner(name)
      `)
      .in('id', itemIds);

    // Obtener email del broker
    const { data: brokerData } = await supabase
      .from('brokers')
      .select('p_id, profiles!inner(email)')
      .eq('id', report.broker_id)
      .single();

    const brokerEmail = (brokerData as any)?.profiles?.email;

    if (pendingItemsData && brokerEmail) {
      const tempImports = pendingItemsData.map((item: any) => ({
        client_name: item.insured_name || 'POR COMPLETAR',
        policy_number: item.policy_number,
        insurer_name: item.insurers?.name || 'N/A',
        broker_email: brokerEmail,
        source: 'ajuste_pendiente',
        created_by: userId,
        import_status: 'pending' // Broker debe completar datos
      }));

      await (supabase as any)
        .from('temp_client_imports')
        .insert(tempImports);
    }

    revalidatePath('/commissions');
    
    return { 
      ok: true, 
      message: `Reporte aprobado - ${paymentMode === 'immediate' ? 'Pagado inmediatamente' : 'Se sumará en siguiente quincena'}` 
    };
  } catch (error) {
    console.error('[actionApproveAdjustmentReport] Error:', error);
    return { 
      ok: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * Rechazar un reporte de ajuste (Master)
 */
export async function actionRejectAdjustmentReport(
  reportId: string,
  reason: string
) {
  try {
    const { role, userId } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'No autorizado' };
    }

    const supabase = await getSupabaseServer();

    // Obtener el reporte con sus items
    const { data: report, error: reportError } = await supabase
      .from('adjustment_reports')
      .select('*, adjustment_report_items(*)')
      .eq('id', reportId)
      .single();

    if (reportError || !report) {
      return { ok: false, error: 'Reporte no encontrado' };
    }

    if (report.status !== 'pending') {
      return { ok: false, error: 'El reporte ya fue revisado' };
    }

    // Actualizar el reporte
    const { error: updateError } = await supabase
      .from('adjustment_reports')
      .update({
        status: 'rejected',
        rejected_reason: reason,
        reviewed_at: new Date().toISOString(),
        reviewed_by: userId
      })
      .eq('id', reportId);

    if (updateError) {
      console.error('Error updating report:', updateError);
      return { ok: false, error: 'Error al rechazar reporte' };
    }

    // Restaurar status de pending_items a 'open'
    const itemIds = report.adjustment_report_items.map((item: any) => item.pending_item_id);
    await supabase
      .from('pending_items')
      .update({ status: 'open' })
      .in('id', itemIds);

    revalidatePath('/commissions');
    
    return { 
      ok: true, 
      message: 'Reporte rechazado' 
    };
  } catch (error) {
    console.error('[actionRejectAdjustmentReport] Error:', error);
    return { 
      ok: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

/**
 * Generar archivo TXT para Banco General (pagos inmediatos)
 * Formato: TIPO_CUENTA|CUENTA|MONTO|NOMBRE|DESCRIPCION|FECHA
 */
export async function actionGenerateBankTXT(reportIds: string[]) {
  try {
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'No autorizado' };
    }

    const supabase = await getSupabaseServer();

    // Obtener reportes con payment_mode='immediate' y status='approved'
    const { data: reports, error: reportsError } = await supabase
      .from('adjustment_reports')
      .select(`
        id,
        total_amount,
        created_at,
        brokers!inner(
          name,
          nombre_completo,
          tipo_cuenta,
          bank_account_no
        )
      `)
      .in('id', reportIds)
      .eq('payment_mode', 'immediate')
      .in('status', ['approved', 'paid']);

    if (reportsError || !reports || reports.length === 0) {
      return { ok: false, error: 'No se encontraron reportes para pago inmediato' };
    }

    // Generar contenido TXT
    const fecha = new Date().toLocaleDateString('es-PA').replace(/\//g, '/');
    let txtContent = '';

    reports.forEach((report: any) => {
      const broker = report.brokers;
      const tipoCuenta = broker.tipo_cuenta || 'AHORROS';
      const cuenta = broker.bank_account_no || '';
      const monto = Math.abs(Number(report.total_amount)).toFixed(2);
      const nombre = (broker.nombre_completo || broker.name).toUpperCase();
      const descripcion = 'AJUSTES';

      // Formato: TIPO_CUENTA|CUENTA|MONTO|NOMBRE|DESCRIPCION|FECHA
      txtContent += `${tipoCuenta}|${cuenta}|${monto}|${nombre}|${descripcion}|${fecha}\n`;
    });

    return {
      ok: true,
      data: {
        content: txtContent,
        filename: `AJUSTES_BG_${Date.now()}.txt`,
        count: reports.length
      }
    };
  } catch (error) {
    console.error('[actionGenerateBankTXT] Error:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * Confirmar reportes como pagados (después de descargar TXT)
 */
export async function actionConfirmReportsPaid(reportIds: string[]) {
  try {
    const { role, userId } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'No autorizado' };
    }

    const supabase = await getSupabaseServer();

    // Actualizar reportes a status='paid'
    const { error: updateError } = await supabase
      .from('adjustment_reports')
      .update({
        status: 'paid',
        paid_date: new Date().toISOString()
      })
      .in('id', reportIds)
      .eq('payment_mode', 'immediate')
      .eq('status', 'approved');

    if (updateError) {
      console.error('Error confirming paid:', updateError);
      return { ok: false, error: 'Error al confirmar pagos' };
    }

    revalidatePath('/commissions');

    return {
      ok: true,
      message: `${reportIds.length} reporte(s) confirmado(s) como pagado(s)`
    };
  } catch (error) {
    console.error('[actionConfirmReportsPaid] Error:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * Editar un reporte de ajuste (Master)
 * Permite agregar o quitar items del reporte
 */
export async function actionEditAdjustmentReport(
  reportId: string,
  itemIdsToAdd: string[],
  itemIdsToRemove: string[]
) {
  try {
    const { role, userId } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'No autorizado' };
    }

    const supabase = await getSupabaseServer();

    // Obtener el reporte
    const { data: report, error: reportError } = await supabase
      .from('adjustment_reports')
      .select('broker_id, status')
      .eq('id', reportId)
      .single();

    if (reportError || !report) {
      return { ok: false, error: 'Reporte no encontrado' };
    }

    if (report.status !== 'pending') {
      return { ok: false, error: 'Solo se pueden editar reportes pendientes' };
    }

    // Obtener porcentaje del broker
    const { data: brokerData } = await supabase
      .from('brokers')
      .select('percent_default')
      .eq('id', report.broker_id)
      .single();

    const brokerPercent = brokerData?.percent_default || 0;

    // 1. Eliminar items del reporte
    if (itemIdsToRemove.length > 0) {
      const { error: deleteError } = await supabase
        .from('adjustment_report_items')
        .delete()
        .in('pending_item_id', itemIdsToRemove)
        .eq('report_id', reportId);

      if (deleteError) {
        console.error('Error deleting items:', deleteError);
        return { ok: false, error: 'Error al eliminar items del reporte' };
      }

      // Actualizar status de pending_items de vuelta a 'open'
      await supabase
        .from('pending_items')
        .update({ status: 'open' })
        .in('id', itemIdsToRemove);
    }

    // 2. Agregar nuevos items
    if (itemIdsToAdd.length > 0) {
      // Obtener datos de los pending_items
      const { data: pendingItems } = await supabase
        .from('pending_items')
        .select('id, gross_amount')
        .in('id', itemIdsToAdd);

      if (pendingItems) {
        const itemsToInsert = pendingItems.map((item: any) => {
          const commissionRaw = Math.abs(Number(item.gross_amount) || 0);
          const brokerCommission = commissionRaw * (brokerPercent / 100);

          return {
            report_id: reportId,
            pending_item_id: item.id,
            commission_raw: commissionRaw,
            broker_commission: brokerCommission
          };
        });

        const { error: insertError } = await supabase
          .from('adjustment_report_items')
          .insert(itemsToInsert);

        if (insertError) {
          console.error('Error inserting items:', insertError);
          return { ok: false, error: 'Error al agregar items al reporte' };
        }

        // Actualizar status de pending_items a 'in_review'
        await supabase
          .from('pending_items')
          .update({ status: 'in_review' })
          .in('id', itemIdsToAdd);
      }
    }

    // 3. Recalcular total del reporte
    const { data: items } = await supabase
      .from('adjustment_report_items')
      .select('broker_commission')
      .eq('report_id', reportId);

    const newTotal = (items || []).reduce((sum, i: any) => sum + Number(i.broker_commission || 0), 0);

    const { error: updateError } = await supabase
      .from('adjustment_reports')
      .update({ total_amount: newTotal })
      .eq('id', reportId);

    if (updateError) {
      console.error('Error updating total:', updateError);
      return { ok: false, error: 'Error al actualizar total del reporte' };
    }

    revalidatePath('/commissions');

    return {
      ok: true,
      message: 'Reporte editado exitosamente'
    };
  } catch (error) {
    console.error('[actionEditAdjustmentReport] Error:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * Obtener ajustes pagados del broker (para tab "Pagados")
 */
export async function actionGetPaidAdjustments() {
  try {
    const { brokerId } = await getAuthContext();
    if (!brokerId) {
      return { ok: false, error: 'No se encontró información del broker' };
    }

    const supabase = await getSupabaseServer();

    const { data, error } = await supabase
      .from('adjustment_reports')
      .select(`
        *,
        adjustment_report_items(
          *,
          pending_items(policy_number, insured_name, insurers(name))
        )
      `)
      .eq('broker_id', brokerId)
      .eq('status', 'paid')
      .order('paid_date', { ascending: false });

    if (error) {
      console.error('Error fetching paid adjustments:', error);
      return { ok: false, error: 'Error al obtener ajustes pagados' };
    }

    return { ok: true, data: data || [] };
  } catch (error) {
    console.error('[actionGetPaidAdjustments] Error:', error);
    return { 
      ok: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}
