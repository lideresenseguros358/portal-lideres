'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

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
  notes: string,
  targetBrokerId?: string // Opcional: para que Master pueda crear reportes para brokers específicos
) {
  try {
    console.log('[actionCreateAdjustmentReport] Iniciando con items:', itemIds);
    const { brokerId, userId, role } = await getAuthContext();
    console.log('[actionCreateAdjustmentReport] BrokerId:', brokerId, 'Role:', role);
    
    // Determinar el broker_id del reporte: targetBrokerId (Master) o brokerId (Broker)
    const reportBrokerId = targetBrokerId || brokerId;
    
    if (!reportBrokerId) {
      return { ok: false, error: 'No se especificó el broker para el reporte' };
    }

    // Usar Admin para bypasear RLS en estas operaciones:
    // - Master creando reportes para otros brokers
    // - Broker buscando comm_items sin broker_id (necesita permisos especiales)
    // - Crear pending_items desde comm_items (requiere permisos de escritura)
    const supabase = getSupabaseAdmin();

    // Obtener los items seleccionados (pueden ser de pending_items O comm_items)
    console.log('[actionCreateAdjustmentReport] Buscando items en ambas tablas...');
    
    // 1. Buscar en pending_items
    const { data: pendingItems, error: pendingError } = await supabase
      .from('pending_items')
      .select('*')
      .in('id', itemIds);
    console.log('[actionCreateAdjustmentReport] Pending items encontrados:', pendingItems?.length || 0);

    // 2. Buscar en comm_items
    const { data: commItems, error: commError } = await supabase
      .from('comm_items')
      .select('*')
      .in('id', itemIds);
    console.log('[actionCreateAdjustmentReport] Comm items encontrados:', commItems?.length || 0);

    const allItems = [...(pendingItems || []), ...(commItems || [])];
    console.log('[actionCreateAdjustmentReport] Total items encontrados:', allItems.length);

    if (allItems.length === 0) {
      return { ok: false, error: 'No se encontraron items pendientes' };
    }

    // Verificar que ningún item de pending_items ya esté en un reporte
    const pendingItemIds = pendingItems?.map(i => i.id) || [];
    if (pendingItemIds.length > 0) {
      const { data: existingReportItems } = await supabase
        .from('adjustment_report_items')
        .select('pending_item_id')
        .in('pending_item_id', pendingItemIds);

      if (existingReportItems && existingReportItems.length > 0) {
        return { ok: false, error: 'Algunos items ya están en un reporte existente' };
      }
    }

    // Obtener porcentaje del broker
    const { data: brokerData } = await supabase
      .from('brokers')
      .select('percent_default')
      .eq('id', reportBrokerId)
      .single();

    const brokerPercent = brokerData?.percent_default || 0;

    // Calcular total (MISMO CÁLCULO QUE IMPORT)
    let totalBrokerCommission = 0;
    const reportItems: any[] = [];
    const itemsToCreateInPending: any[] = [];

    // Procesar pending_items (RESPETAR SIGNOS: positivos y negativos)
    (pendingItems || []).forEach((item: any) => {
      const commissionRaw = Number(item.commission_raw) || 0;
      const brokerCommission = commissionRaw * brokerPercent;
      totalBrokerCommission += brokerCommission;

      reportItems.push({
        pending_item_id: item.id,
        commission_raw: commissionRaw,
        broker_commission: brokerCommission
      });
    });

    // Procesar comm_items - crear pending_items para ellos (RESPETAR SIGNOS)
    (commItems || []).forEach((item: any) => {
      const grossAmount = Number(item.gross_amount) || 0;
      const brokerCommission = grossAmount * brokerPercent;
      totalBrokerCommission += brokerCommission;

      // Marcar para crear pending_item
      itemsToCreateInPending.push({
        originalCommItemId: item.id,
        commission_raw: grossAmount,
        broker_commission: brokerCommission,
        policy_number: item.policy_number,
        insured_name: item.insured_name,
        insurer_id: item.insurer_id,
        fortnight_id: item.fortnight_id
      });
    });

    // Crear pending_items para los comm_items
    if (itemsToCreateInPending.length > 0) {
      console.log('[actionCreateAdjustmentReport] Creando pending_items para comm_items:', itemsToCreateInPending.length);
      const { data: newPendingItems, error: createError } = await supabase
        .from('pending_items')
        .insert(itemsToCreateInPending.map(item => ({
          policy_number: item.policy_number,
          insured_name: item.insured_name,
          commission_raw: item.commission_raw,
          insurer_id: item.insurer_id,
          fortnight_id: item.fortnight_id,
          status: 'in_review',
          assigned_broker_id: reportBrokerId
        })))
        .select();

      if (createError || !newPendingItems) {
        console.error('[actionCreateAdjustmentReport] Error creando pending_items:', createError);
        return { ok: false, error: 'Error al procesar items de comisiones' };
      }

      console.log('[actionCreateAdjustmentReport] Pending items creados:', newPendingItems.length);

      // Agregar los nuevos pending_items a reportItems
      newPendingItems.forEach((newItem: any, index: number) => {
        reportItems.push({
          pending_item_id: newItem.id,
          commission_raw: itemsToCreateInPending[index].commission_raw,
          broker_commission: itemsToCreateInPending[index].broker_commission
        });
      });

      // Actualizar los comm_items originales para asignar el broker
      const commItemIdsToUpdate = itemsToCreateInPending.map(i => i.originalCommItemId);
      console.log('[actionCreateAdjustmentReport] Actualizando comm_items con broker_id:', commItemIdsToUpdate);
      const { error: updateCommError } = await supabase
        .from('comm_items')
        .update({ broker_id: reportBrokerId })
        .in('id', commItemIdsToUpdate);

      if (updateCommError) {
        console.error('[actionCreateAdjustmentReport] Error actualizando comm_items:', updateCommError);
        // No fallar por esto, el reporte ya está creado
      }
    }

    // Crear el reporte
    console.log('[actionCreateAdjustmentReport] Creando reporte con total:', totalBrokerCommission);
    const { data: report, error: reportError } = await supabase
      .from('adjustment_reports')
      .insert({
        broker_id: reportBrokerId,
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

    // Actualizar status de pending_items existentes a 'in_review' y asignar broker
    if (pendingItemIds.length > 0) {
      console.log('[actionCreateAdjustmentReport] Actualizando pending_items existentes...');
      const { error: updateError, data: updatedItems } = await supabase
        .from('pending_items')
        .update({ 
          status: 'in_review',
          assigned_broker_id: reportBrokerId // Asignar el broker al ítem
        })
        .in('id', pendingItemIds)
        .select();
    
      if (updateError) {
        console.error('[actionCreateAdjustmentReport] Error actualizando status:', updateError);
        console.error('[actionCreateAdjustmentReport] Error details:', JSON.stringify(updateError, null, 2));
      } else {
        console.log('[actionCreateAdjustmentReport] Pending items actualizados correctamente');
        console.log('[actionCreateAdjustmentReport] Items actualizados:', updatedItems?.length);
      }
    }

    // Enviar notificación a Master
    try {
      // Obtener nombre del broker
      const { data: brokerData } = await supabase
        .from('brokers')
        .select('name')
        .eq('id', reportBrokerId)
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
          broker_id: reportBrokerId,
          notification_type: 'commission' as const,
          title: 'Nuevo Reporte de Ajustes',
          body: `${brokerName} ha enviado un reporte de ajustes con ${allItems.length} item(s) por un total de $${totalBrokerCommission.toFixed(2)}`,
          meta: {
            report_id: report.id,
            broker_id: reportBrokerId,
            broker_name: brokerName,
            items_count: allItems.length,
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
        brokers!inner(name, percent_default),
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
    const formattedReports = (data || []).map((report: any) => {
      const brokerPercent = report.brokers?.percent_default || 1.0;
      
      // Calcular items con valores correctos
      const items = (report.adjustment_report_items || []).map((item: any) => {
        const commissionRaw = Number(item.commission_raw) || 0;
        // RECALCULAR correctamente: raw * percent (NO dividir por 100)
        const brokerCommission = commissionRaw * brokerPercent;
        
        return {
          id: item.id,
          policy_number: item.pending_items?.policy_number || 'N/A',
          insured_name: item.pending_items?.insured_name || 'N/A',
          commission_raw: commissionRaw,
          broker_commission: brokerCommission,
          insurer_name: item.pending_items?.insurers?.name || 'N/A'
        };
      });
      
      // RECALCULAR total sumando broker_commission de todos los items
      const totalAmount = items.reduce((sum: number, item: any) => sum + item.broker_commission, 0);
      
      return {
        id: report.id,
        broker_id: report.broker_id,
        broker_name: report.brokers?.name || 'N/A',
        broker_percent: brokerPercent,
        status: report.status,
        total_amount: totalAmount, // ← TOTAL CORRECTO
        notes: report.broker_notes,
        admin_notes: report.admin_notes,
        payment_mode: report.payment_mode,
        fortnight_id: report.fortnight_id,
        paid_date: report.paid_date,
        rejected_reason: report.rejected_reason,
        created_at: report.created_at,
        reviewed_at: report.reviewed_at,
        items: items
      };
    });

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
 * Solo cambia status a 'approved' - El pago se procesa después
 */
export async function actionApproveAdjustmentReport(
  reportId: string,
  adminNotes?: string
) {
  try {
    const { role, userId } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'No autorizado' };
    }

    // Usar Admin para bypasear RLS
    const supabase = getSupabaseAdmin();

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

    // Solo actualizar status a 'approved' y guardar notas
    const { error: updateError } = await supabase
      .from('adjustment_reports')
      .update({
        status: 'approved',
        admin_notes: adminNotes || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: userId
      })
      .eq('id', reportId);

    if (updateError) {
      console.error('Error updating report:', updateError);
      return { ok: false, error: 'Error al aprobar reporte' };
    }

    // Actualizar status de pending_items a 'assigned'
    console.log('[actionApproveAdjustmentReport] Actualizando pending items a status=assigned...');
    const itemIds = report.adjustment_report_items.map((item: any) => item.pending_item_id);
    const { error: assignError, data: assignedItems } = await supabase
      .from('pending_items')
      .update({ 
        status: 'assigned',
        assigned_broker_id: report.broker_id,
        assigned_at: new Date().toISOString()
      })
      .in('id', itemIds)
      .select();
    
    if (assignError) {
      console.error('[actionApproveAdjustmentReport] Error asignando items:', assignError);
    } else {
      console.log('[actionApproveAdjustmentReport] Items asignados:', assignedItems?.length);
    }

    // Crear notificación para el broker
    try {
      const { data: brokerData } = await supabase
        .from('brokers')
        .select('p_id, name')
        .eq('id', report.broker_id)
        .single();

      if (brokerData?.p_id) {
        await supabase
          .from('notifications')
          .insert({
            target: brokerData.p_id,
            broker_id: report.broker_id,
            notification_type: 'commission',
            title: 'Reporte de Ajustes Aprobado',
            body: `Tu reporte de ajustes por $${report.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ha sido aprobado`,
            meta: {
              report_id: reportId,
              amount: report.total_amount
            }
          });
      }
    } catch (notifError) {
      console.error('Error creating notification:', notifError);
      // No fallar si falla la notificación
    }

    revalidatePath('/commissions');
    
    return { 
      ok: true, 
      message: 'Reporte aprobado exitosamente' 
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

    // Usar Admin para bypasear RLS
    const supabase = getSupabaseAdmin();

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

    // Guardar info del broker para notificación ANTES de eliminar el reporte
    const brokerId = report.broker_id;
    const itemIds = report.adjustment_report_items.map((item: any) => item.pending_item_id);

    // PASO 1: Restaurar pending_items a 'open' ANTES de eliminar el reporte
    console.log('[actionRejectAdjustmentReport] Restaurando pending items a status=open...');
    const { error: restoreError, data: restoredItems } = await supabase
      .from('pending_items')
      .update({ 
        status: 'open',
        assigned_broker_id: null // Liberar para que pueda ser asignado a otro broker
      })
      .in('id', itemIds)
      .select();
    
    if (restoreError) {
      console.error('[actionRejectAdjustmentReport] Error restaurando items:', restoreError);
      return { ok: false, error: 'Error al restaurar items' };
    }
    console.log('[actionRejectAdjustmentReport] Items restaurados:', restoredItems?.length);

    // PASO 2: Eliminar adjustment_report_items (por CASCADE al eliminar el reporte)
    // PASO 3: Eliminar el reporte COMPLETAMENTE (como si nunca existió)
    console.log('[actionRejectAdjustmentReport] ELIMINANDO reporte completamente de la BD...');
    const { error: deleteReportError } = await supabase
      .from('adjustment_reports')
      .delete()
      .eq('id', reportId);

    if (deleteReportError) {
      console.error('[actionRejectAdjustmentReport] Error eliminando reporte:', deleteReportError);
      return { ok: false, error: 'Error al eliminar reporte rechazado' };
    }
    console.log('[actionRejectAdjustmentReport] Reporte eliminado completamente (como si nunca existió)');

    // Crear notificación para el broker (usar brokerId guardado ANTES de eliminar)
    try {
      const { data: brokerData } = await supabase
        .from('brokers')
        .select('p_id, name')
        .eq('id', brokerId)
        .single();

      if (brokerData?.p_id) {
        await supabase
          .from('notifications')
          .insert({
            target: brokerData.p_id,
            broker_id: brokerId,
            notification_type: 'commission',
            title: 'Reporte de Ajustes Rechazado',
            body: `Tu reporte fue rechazado y eliminado. Razón: ${reason}. Los items volvieron a estar disponibles.`,
            meta: {
              reason: reason,
              items_count: itemIds.length
            }
          });
      }
    } catch (notifError) {
      console.error('Error creating notification:', notifError);
      // No fallar si falla la notificación
    }

    revalidatePath('/commissions');

    return {
      ok: true,
      message: 'Reporte rechazado y eliminado. Los items volvieron a estar disponibles.'
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

      // Actualizar status de pending_items de vuelta a 'open' y liberar assigned_broker_id
      await supabase
        .from('pending_items')
        .update({ 
          status: 'open',
          assigned_broker_id: null // Liberar para que pueda ser asignado a otro broker
        })
        .in('id', itemIdsToRemove);
    }

    // 2. Agregar nuevos items
    if (itemIdsToAdd.length > 0) {
      // Obtener datos de los pending_items
      const { data: pendingItems } = await supabase
        .from('pending_items')
        .select('id, commission_raw')
        .in('id', itemIdsToAdd);

      if (pendingItems) {
        const itemsToInsert = pendingItems.map((item: any) => {
          const commissionRaw = Number(item.commission_raw) || 0; // RESPETAR SIGNOS
          const brokerCommission = commissionRaw * brokerPercent;

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

        // Actualizar status de pending_items a 'in_review' y asignar broker
        await supabase
          .from('pending_items')
          .update({ 
            status: 'in_review',
            assigned_broker_id: report.broker_id // Asignar el broker del reporte
          })
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

/**
 * Actualizar override percent de items individuales y recalcular comisiones
 */
export async function actionUpdateItemsOverridePercent(
  reportId: string,
  updates: Array<{ id: string; override_percent: number; broker_commission: number }>
) {
  try {
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'Solo Master puede editar override percent' };
    }

    const supabase = getSupabaseAdmin();

    // Actualizar cada item
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('adjustment_report_items')
        .update({
          override_percent: update.override_percent,
          broker_commission: update.broker_commission,
        })
        .eq('id', update.id);

      if (updateError) {
        console.error('Error updating item:', updateError);
        throw new Error(`Error al actualizar item ${update.id}`);
      }
    }

    // Recalcular total del reporte
    const { data: items } = await supabase
      .from('adjustment_report_items')
      .select('broker_commission')
      .eq('report_id', reportId);

    const newTotal = (items || []).reduce((sum, item) => sum + item.broker_commission, 0);

    const { error: updateTotalError } = await supabase
      .from('adjustment_reports')
      .update({ total_amount: newTotal })
      .eq('id', reportId);

    if (updateTotalError) {
      throw new Error('Error al actualizar total del reporte');
    }

    revalidatePath('/commissions');

    return { ok: true, message: 'Override percent actualizado correctamente' };
  } catch (error) {
    console.error('[actionUpdateItemsOverridePercent] Error:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * Unificar múltiples reportes del mismo broker en uno solo
 */
export async function actionUnifyAdjustmentReports(reportIds: string[]) {
  try {
    const { role } = await getAuthContext();
    if (role !== 'master') {
      return { ok: false, error: 'Solo Master puede unificar reportes' };
    }

    if (reportIds.length < 2) {
      return { ok: false, error: 'Debes seleccionar al menos 2 reportes para unificar' };
    }

    const supabase = getSupabaseAdmin();

    // Obtener todos los reportes seleccionados
    const { data: reports, error: reportsError } = await supabase
      .from('adjustment_reports')
      .select('*, adjustment_report_items(*)')
      .in('id', reportIds)
      .eq('status', 'pending');

    if (reportsError || !reports || reports.length === 0) {
      return { ok: false, error: 'No se encontraron reportes pendientes' };
    }

    // Verificar que todos sean del mismo broker
    const brokerIds = [...new Set(reports.map(r => r.broker_id))];
    if (brokerIds.length > 1) {
      return { ok: false, error: 'Todos los reportes deben ser del mismo broker' };
    }

    const brokerId = brokerIds[0];
    if (!brokerId) {
      return { ok: false, error: 'No se pudo identificar el broker' };
    }

    // Obtener todos los items de todos los reportes
    const allItems = reports.flatMap(r => r.adjustment_report_items || []);
    
    // Calcular total combinado
    const totalAmount = allItems.reduce((sum, item) => sum + item.broker_commission, 0);

    // Combinar notas
    const combinedNotes = reports
      .filter(r => r.broker_notes)
      .map((r, i) => `[Reporte ${i + 1}] ${r.broker_notes}`)
      .join('\n\n');

    // Crear nuevo reporte unificado
    const { data: newReport, error: createError } = await supabase
      .from('adjustment_reports')
      .insert([{
        broker_id: brokerId,
        total_amount: totalAmount,
        status: 'pending',
        broker_notes: combinedNotes || 'Reportes unificados',
      }])
      .select()
      .single();

    if (createError || !newReport) {
      throw new Error('Error al crear reporte unificado');
    }

    // Mover todos los items al nuevo reporte
    const { error: moveError } = await supabase
      .from('adjustment_report_items')
      .update({ report_id: newReport.id })
      .in('report_id', reportIds);

    if (moveError) {
      // Rollback: eliminar reporte creado
      await supabase.from('adjustment_reports').delete().eq('id', newReport.id);
      throw new Error('Error al mover items al reporte unificado');
    }

    // Eliminar reportes antiguos
    const { error: deleteError } = await supabase
      .from('adjustment_reports')
      .delete()
      .in('id', reportIds);

    if (deleteError) {
      console.error('Error eliminando reportes antiguos (no crítico):', deleteError);
    }

    revalidatePath('/commissions');

    return {
      ok: true,
      message: `${reportIds.length} reportes unificados exitosamente en un solo reporte`,
      newReportId: newReport.id
    };
  } catch (error) {
    console.error('[actionUnifyAdjustmentReports] Error:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}
