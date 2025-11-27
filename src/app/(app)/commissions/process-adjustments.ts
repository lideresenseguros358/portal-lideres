'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * Obtener contexto de autenticación
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

  return {
    userId: user.id,
    role: profile?.role || 'broker',
  };
}

/**
 * Procesar reportes aprobados según método de pago
 * - immediate: Genera TXT, confirma pagado, crea preliminares
 * - next_fortnight: Asocia a quincena DRAFT, espera cierre
 */
export async function actionProcessApprovedReports(
  reportIds: string[],
  paymentMode: 'immediate' | 'next_fortnight'
) {
  try {
    console.log('[actionProcessApprovedReports] Procesando reportes:', reportIds, 'Modo:', paymentMode);
    const { role, userId } = await getAuthContext();
    
    if (role !== 'master') {
      return { ok: false, error: 'No autorizado' };
    }

    const supabase = getSupabaseAdmin();

    // Obtener reportes aprobados
    const { data: reports, error: reportsError } = await supabase
      .from('adjustment_reports')
      .select(`
        id,
        broker_id,
        total_amount,
        status,
        adjustment_report_items(
          pending_item_id,
          pending_items(
            policy_number,
            insured_name,
            insurer_id,
            insurers(name)
          )
        )
      `)
      .in('id', reportIds)
      .eq('status', 'approved');

    if (reportsError || !reports || reports.length === 0) {
      return { ok: false, error: 'No se encontraron reportes aprobados' };
    }

    if (paymentMode === 'immediate') {
      // MODO: PAGAR YA
      console.log('[actionProcessApprovedReports] Modo pagar ya - marcando como pagados...');
      
      // 1. Actualizar reportes a status='paid'
      const { error: updateError } = await supabase
        .from('adjustment_reports')
        .update({
          status: 'paid',
          payment_mode: 'immediate',
          paid_date: new Date().toISOString()
        })
        .in('id', reportIds);

      if (updateError) {
        console.error('Error updating reports:', updateError);
        return { ok: false, error: 'Error al marcar reportes como pagados' };
      }

      // 2. Crear registros en preliminar (temp_client_import)
      await createPreliminarRecords(supabase, reports, userId);

      // 3. Crear notificaciones para brokers
      for (const report of reports) {
        try {
          const { data: brokerData } = await supabase
            .from('brokers')
            .select('p_id')
            .eq('id', report.broker_id)
            .single();

          if (brokerData?.p_id) {
            await supabase
              .from('notifications')
              .insert({
                target: brokerData.p_id,
                broker_id: report.broker_id,
                notification_type: 'commission',
                title: 'Ajuste Pagado',
                body: `Tu ajuste de $${report.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ha sido procesado para pago inmediato`,
                meta: {
                  report_id: report.id,
                  amount: report.total_amount,
                  payment_mode: 'immediate'
                }
              });
          }
        } catch (notifError) {
          console.error('Error creating notification for broker:', notifError);
        }
      }

      console.log('[actionProcessApprovedReports] Reportes marcados como pagados');
      revalidatePath('/commissions');

      return {
        ok: true,
        message: `${reportIds.length} reporte(s) marcado(s) como pagado(s)`,
        mode: 'immediate',
        reportIds: reportIds
      };

    } else {
      // MODO: SIGUIENTE QUINCENA
      console.log('[actionProcessApprovedReports] Modo siguiente quincena - buscando quincena DRAFT...');

      // 1. Buscar quincena DRAFT
      const { data: draftFortnight, error: fortnightError } = await supabase
        .from('fortnights')
        .select('id, period_start, period_end')
        .eq('status', 'DRAFT')
        .order('period_start', { ascending: false })
        .limit(1)
        .single();

      if (fortnightError || !draftFortnight) {
        return { 
          ok: false, 
          error: 'No se encontró una quincena DRAFT. Debes crear una quincena nueva primero.' 
        };
      }

      // 2. Actualizar reportes con fortnight_id y payment_mode
      const { error: updateError } = await supabase
        .from('adjustment_reports')
        .update({
          payment_mode: 'next_fortnight',
          fortnight_id: draftFortnight.id
        })
        .in('id', reportIds);

      if (updateError) {
        console.error('Error updating reports:', updateError);
        return { ok: false, error: 'Error al asociar reportes a quincena' };
      }

      // 3. Crear notificaciones para brokers
      for (const report of reports) {
        try {
          const { data: brokerData } = await supabase
            .from('brokers')
            .select('p_id')
            .eq('id', report.broker_id)
            .single();

          if (brokerData?.p_id) {
            await supabase
              .from('notifications')
              .insert({
                target: brokerData.p_id,
                broker_id: report.broker_id,
                notification_type: 'commission',
                title: 'Ajuste Asociado a Quincena',
                body: `Tu ajuste de $${report.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} se pagará en la siguiente quincena`,
                meta: {
                  report_id: report.id,
                  amount: report.total_amount,
                  payment_mode: 'next_fortnight',
                  fortnight_id: draftFortnight.id
                }
              });
          }
        } catch (notifError) {
          console.error('Error creating notification for broker:', notifError);
        }
      }

      console.log('[actionProcessApprovedReports] Reportes asociados a quincena DRAFT:', draftFortnight.id);
      revalidatePath('/commissions');

      return {
        ok: true,
        message: `${reportIds.length} reporte(s) asociado(s) a la siguiente quincena`,
        mode: 'next_fortnight',
        fortnightId: draftFortnight.id
      };
    }
  } catch (error) {
    console.error('[actionProcessApprovedReports] Error:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * Crear registros en temp_client_import (preliminar)
 * Tabla: temp_client_import (singular)
 */
async function createPreliminarRecords(
  supabase: any,
  reports: any[],
  userId: string
) {
  try {
    console.log('[createPreliminarRecords] Creando registros preliminares en temp_client_import...');
    
    const preliminarRecords: any[] = [];

    for (const report of reports) {
      // Crear un registro por cada item del reporte
      for (const item of (report.adjustment_report_items || [])) {
        const pendingItem = item.pending_items;
        
        if (pendingItem) {
          preliminarRecords.push({
            broker_id: report.broker_id,
            client_name: pendingItem.insured_name || 'POR COMPLETAR',
            policy_number: pendingItem.policy_number,
            insurer_id: pendingItem.insurer_id,
            source: 'ajuste_pagado',
            source_id: report.id, // ID del adjustment_report
            status: 'pending',
            migrated: false,
            notes: `Ajuste pagado el ${new Date().toLocaleDateString('es-PA')}. Requiere completar datos del cliente.`
          });
        }
      }
    }

    if (preliminarRecords.length > 0) {
      const { error: insertError } = await supabase
        .from('temp_client_import')
        .insert(preliminarRecords);

      if (insertError) {
        console.error('Error inserting preliminar records:', insertError);
        // No fallar todo el proceso si falla preliminar
      } else {
        console.log(`[createPreliminarRecords] ${preliminarRecords.length} registros preliminares creados`);
        
        // TODO: Crear notificación al broker para que complete los datos
        // await supabase.from('notifications').insert({
        //   target: broker.p_id,
        //   broker_id: report.broker_id,
        //   notification_type: 'info',
        //   title: 'Nuevos Clientes en Preliminar',
        //   body: `Tienes ${preliminarRecords.length} cliente(s) pendiente(s) de completar datos`
        // });
      }
    }
  } catch (error) {
    console.error('[createPreliminarRecords] Error:', error);
    // No fallar el proceso principal
  }
}

/**
 * Obtener reportes aprobados listos para procesar
 */
export async function actionGetApprovedReports() {
  try {
    const { role } = await getAuthContext();
    
    if (role !== 'master') {
      return { ok: false, error: 'No autorizado' };
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('adjustment_reports')
      .select(`
        *,
        brokers!inner(name),
        adjustment_report_items(
          *,
          pending_items(
            policy_number,
            insured_name,
            insurers(name)
          )
        )
      `)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching approved reports:', error);
      return { ok: false, error: 'Error al obtener reportes aprobados' };
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
    console.error('[actionGetApprovedReports] Error:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}
