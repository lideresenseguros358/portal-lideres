import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * CRON JOB: Notificar casos aplazados que requieren reapertura
 * Frecuencia: Diaria a las 8:00 AM
 * 
 * Configurar en Supabase SQL Editor con el comando de schedule para ejecutar diariamente
 */

export async function POST(request: Request) {
  try {
    // Verificar autorización (secret key para cron jobs)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await getSupabaseServer();
    
    // Buscar casos aplazados que necesitan notificación
    const { data: aplazadoCases, error } = await supabase
      .from('cases')
      .select(`
        id,
        ticket_ref,
        client_name,
        policy_number,
        aplazar_months,
        aplazar_notify_at,
        postponed_until,
        aplazar_reason,
        admin_id,
        broker_id,
        profiles:admin_id(email, full_name),
        brokers:broker_id(email, name)
      `)
      .eq('status_v2', 'APLAZADO')
      .not('aplazar_notify_at', 'is', null)
      .lte('aplazar_notify_at', new Date().toISOString());

    if (error) {
      console.error('Error fetching aplazado cases:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!aplazadoCases || aplazadoCases.length === 0) {
      return NextResponse.json({ 
        ok: true, 
        message: 'No aplazado cases requiring notification',
        count: 0 
      });
    }

    // TODO: Enviar notificaciones por email (Resend)
    // Por ahora, solo registramos en logs
    const notifications = [];
    
    for (const caseItem of aplazadoCases) {
      // Crear notificación en sistema
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          broker_id: caseItem.broker_id,
          target: `/cases/${caseItem.id}`,
          title: `Caso aplazado requiere decisión`,
          body: `El caso ${caseItem.ticket_ref || caseItem.id} (${caseItem.client_name}) ha llegado a su fecha de notificación. Decide si reabrir o cerrar definitivamente.`,
          notification_type: 'other',
          meta: {
            case_id: caseItem.id,
            ticket_ref: caseItem.ticket_ref,
            postponed_until: caseItem.postponed_until,
            aplazar_reason: caseItem.aplazar_reason,
          },
        });

      if (notifError) {
        console.error(`Error creating notification for case ${caseItem.id}:`, notifError);
      }

      // TODO: Enviar email con Resend
      // await sendAplazadoNotificationEmail({
      //   to: caseItem.profiles?.email,
      //   case: caseItem,
      // });

      notifications.push({
        case_id: caseItem.id,
        ticket_ref: caseItem.ticket_ref,
        notified_at: new Date().toISOString(),
      });
    }

    // Log en security logs
    for (const caseItem of aplazadoCases) {
      await supabase
        .from('case_security_logs')
        .insert({
          case_id: caseItem.id,
          action_type: 'APLAZADO_NOTIFICATION_SENT',
          actor_email: 'system@cron',
          actor_role: 'system',
          metadata: {
            aplazar_notify_at: caseItem.aplazar_notify_at,
            postponed_until: caseItem.postponed_until,
          },
        });
    }

    return NextResponse.json({ 
      ok: true, 
      message: `Notifications sent for ${aplazadoCases.length} aplazado cases`,
      count: aplazadoCases.length,
      notifications,
    });

  } catch (error) {
    console.error('Unexpected error in notify-aplazados cron:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    error: 'Method not allowed. Use POST with proper authorization.' 
  }, { status: 405 });
}
