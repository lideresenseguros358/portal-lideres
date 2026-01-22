/**
 * CRON ENDPOINT - Aplazados Check
 * ================================
 * Endpoint llamado diariamente a las 09:00 America/Panama (14:00 UTC)
 * Revisa casos Aplazados cuya fecha de revisión ya venció
 * Crea notificaciones para que master decida: reabrir o cerrar definitivo
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTodayStartPanama } from '@/lib/timezone/time';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    // Verificar autorización
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('[CRON APLAZADOS] Unauthorized request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[CRON APLAZADOS] Starting aplazados check');

    const supabase = await createClient();
    const today = getTodayStartPanama();

    // Buscar casos aplazados vencidos
    const { data: aplazadosVencidos, error: fetchError } = await supabase
      .from('cases')
      .select('id, ticket, broker_id, assigned_master_id, aplazado_until, aplazado_months')
      .eq('estado_simple', 'Aplazado')
      .lte('aplazado_until', today.toISOString().split('T')[0]) // Fecha <= hoy
      .is('deleted_at', null);

    if (fetchError) {
      throw new Error(`Error fetching aplazados: ${fetchError.message}`);
    }

    console.log(`[CRON APLAZADOS] Found ${aplazadosVencidos?.length || 0} vencidos`);

    if (!aplazadosVencidos || aplazadosVencidos.length === 0) {
      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        aplazadosVencidos: 0,
      });
    }

    // Crear notificación para cada caso vencido
    const notificaciones = [];

    for (const caso of aplazadosVencidos) {
      // Crear notificación para master asignado
      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: caso.assigned_master_id,
        type: 'APLAZADO_VENCIDO',
        title: 'Caso Aplazado Vencido',
        message: `El caso ${caso.ticket} venció su plazo de aplazamiento. Requiere decisión: reabrir o cerrar definitivo.`,
        link: `/pendientes/${caso.id}`,
        read: false,
      });

      if (!notifError) {
        notificaciones.push(caso.ticket);
      }

      // Crear evento de historial
      await supabase.from('case_history_events').insert({
        case_id: caso.id,
        event_type: 'aplazado_vencido',
        payload: {
          aplazado_until: caso.aplazado_until,
          aplazado_months: caso.aplazado_months,
        },
        created_by_role: 'system',
        visible_to_broker: false, // Oculto para broker
      });

      // Audit log
      await supabase.from('security_audit_logs').insert({
        actor_type: 'system',
        action: 'APLAZADO_VENCIDO',
        entity_type: 'case',
        entity_id: caso.id,
        after: { ticket: caso.ticket, vencido: true },
      });
    }

    console.log(`[CRON APLAZADOS] Created ${notificaciones.length} notifications`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      aplazadosVencidos: aplazadosVencidos.length,
      notificacionesCreadas: notificaciones.length,
      tickets: notificaciones,
    });
  } catch (error: any) {
    console.error('[CRON APLAZADOS] Fatal error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
