'use server';

import { getSupabaseServer } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

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
 * Procesar comisiones retenidas (asociarlas a siguiente quincena)
 * Similar a ajustes pero sin opción de pago inmediato
 */
export async function actionProcessRetainedCommissions(params: {
  retained_ids: string[];
  payment_mode: 'next_fortnight'; // Solo esta opción
}) {
  try {
    console.log('[actionProcessRetainedCommissions] Iniciando procesamiento de retenidos...');
    const { role, userId } = await getAuthContext();
    
    if (role !== 'master') {
      return { ok: false, error: 'No autorizado' };
    }

    const { retained_ids, payment_mode } = params;

    if (!retained_ids || retained_ids.length === 0) {
      return { ok: false, error: 'Debe seleccionar al menos una retención' };
    }

    const supabase = getSupabaseAdmin();

    // Obtener las retenciones seleccionadas
    const { data: retainedCommissions, error: fetchError } = await supabase
      .from('retained_commissions')
      .select(`
        id,
        broker_id,
        fortnight_id,
        net_amount,
        brokers!inner(name)
      `)
      .in('id', retained_ids)
      .eq('status', 'pending');

    if (fetchError || !retainedCommissions || retainedCommissions.length === 0) {
      console.error('Error fetching retained commissions:', fetchError);
      return { ok: false, error: 'No se encontraron retenciones pendientes' };
    }

    // Buscar o crear quincena DRAFT para asociar las retenciones
    const { data: draftFortnight, error: fortnightError } = await supabase
      .from('fortnights')
      .select('id')
      .eq('status', 'DRAFT')
      .order('period_start', { ascending: false })
      .limit(1)
      .single();

    if (fortnightError || !draftFortnight) {
      console.error('No se encontró quincena DRAFT:', fortnightError);
      return { ok: false, error: 'No existe una quincena DRAFT para asociar las retenciones. Por favor crea una nueva quincena.' };
    }

    // Actualizar retenciones: asociar a quincena DRAFT
    const { error: updateError } = await supabase
      .from('retained_commissions')
      .update({
        status: 'associated_to_fortnight',
        applied_fortnight_id: draftFortnight.id,
        updated_at: new Date().toISOString()
      })
      .in('id', retained_ids);

    if (updateError) {
      console.error('Error updating retained commissions:', updateError);
      return { ok: false, error: 'Error al asociar retenciones a quincena' };
    }

    // Crear notificaciones para brokers
    const brokerGroups = new Map<string, { broker_id: string; p_id?: string; total: number; count: number }>();
    
    for (const retained of retainedCommissions) {
      const brokerId = retained.broker_id;
      if (!brokerGroups.has(brokerId)) {
        const { data: brokerData } = await supabase
          .from('brokers')
          .select('p_id')
          .eq('id', brokerId)
          .single();

        brokerGroups.set(brokerId, {
          broker_id: brokerId,
          p_id: brokerData?.p_id,
          total: 0,
          count: 0
        });
      }
      
      const group = brokerGroups.get(brokerId)!;
      group.total += retained.net_amount;
      group.count += 1;
    }

    // Insertar notificaciones
    for (const [_, group] of brokerGroups) {
      if (group.p_id) {
        try {
          await supabase
            .from('notifications')
            .insert({
              target: group.p_id,
              broker_id: group.broker_id,
              notification_type: 'commission',
              title: 'Retenciones Liberadas',
              body: `Se liberaron ${group.count} retención(es) por $${group.total.toLocaleString('en-US', { minimumFractionDigits: 2 })} para pago en la siguiente quincena`,
              meta: {
                retained_count: group.count,
                total_amount: group.total,
                fortnight_id: draftFortnight.id
              }
            });
        } catch (notifError) {
          console.error('Error creating notification:', notifError);
        }
      }
    }

    console.log('[actionProcessRetainedCommissions] Retenciones asociadas a quincena:', draftFortnight.id);
    revalidatePath('/commissions');

    return {
      ok: true,
      message: `${retained_ids.length} retención(es) asociada(s) a la siguiente quincena`,
      fortnightId: draftFortnight.id
    };
  } catch (error) {
    console.error('[actionProcessRetainedCommissions] Error:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * Obtener retenciones pagadas (historial)
 */
export async function actionGetPaidRetained() {
  try {
    const { role } = await getAuthContext();
    
    if (role !== 'master') {
      return { ok: false, error: 'No autorizado' };
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('retained_commissions')
      .select(`
        id,
        broker_id,
        fortnight_id,
        applied_fortnight_id,
        gross_amount,
        discount_amount,
        net_amount,
        status,
        created_at,
        updated_at,
        insurers_detail,
        brokers!inner(name),
        fortnights!retained_commissions_fortnight_id_fkey(period_start, period_end),
        applied_fortnight:fortnights!retained_commissions_applied_fortnight_id_fkey(period_start, period_end)
      `)
      .in('status', ['associated_to_fortnight', 'paid'])
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching paid retained:', error);
      return { ok: false, error: 'Error al obtener retenciones pagadas' };
    }

    return { ok: true, data: data || [] };
  } catch (error) {
    console.error('[actionGetPaidRetained] Error:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}
