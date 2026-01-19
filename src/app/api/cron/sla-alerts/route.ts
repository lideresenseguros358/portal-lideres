import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { calculateEffectiveSLADate } from '@/lib/ticketing/sla-calculator';

/**
 * CRON JOB: Alertas de SLA próximo a vencer
 * Frecuencia: Cada 6 horas
 * 
 * Configurar en Supabase SQL Editor con el comando de schedule para ejecutar cada 6 horas
 */

export async function POST(request: Request) {
  try {
    // Verificar autorización
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await getSupabaseServer();
    
    // Buscar casos con SLA próximo a vencer (2 días o menos)
    // No incluir casos cerrados o aplazados
    const { data: cases, error } = await supabase
      .from('cases')
      .select(`
        id,
        ticket_ref,
        client_name,
        policy_number,
        status_v2,
        sla_date,
        sla_paused,
        sla_accumulated_pause_days,
        admin_id,
        broker_id,
        profiles:admin_id(email, full_name),
        brokers:broker_id(email, name)
      `)
      .not('sla_date', 'is', null)
      .not('status_v2', 'in', '("CERRADO_APROBADO","CERRADO_RECHAZADO","APLAZADO")');

    if (error) {
      console.error('Error fetching cases for SLA alerts:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!cases || cases.length === 0) {
      return NextResponse.json({ 
        ok: true, 
        message: 'No cases with SLA',
        count: 0 
      });
    }

    // Filtrar casos con SLA <= 2 días
    const now = new Date();
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    
    const casesNearExpiry = cases.filter(c => {
      if (c.sla_paused) return false; // No alertar si está pausado
      
      const effectiveSLA = new Date(c.sla_date!);
      // Agregar días pausados acumulados
      effectiveSLA.setDate(effectiveSLA.getDate() + (c.sla_accumulated_pause_days || 0));
      
      return effectiveSLA <= twoDaysFromNow;
    });

    if (casesNearExpiry.length === 0) {
      return NextResponse.json({ 
        ok: true, 
        message: 'No cases near SLA expiry',
        count: 0 
      });
    }

    // Clasificar por urgencia
    const expired = [];
    const expiringToday = [];
    const expiringTomorrow = [];
    const expiringIn2Days = [];

    for (const c of casesNearExpiry) {
      const effectiveSLA = new Date(c.sla_date!);
      effectiveSLA.setDate(effectiveSLA.getDate() + (c.sla_accumulated_pause_days || 0));
      
      const hoursUntilExpiry = (effectiveSLA.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      if (hoursUntilExpiry < 0) {
        expired.push(c);
      } else if (hoursUntilExpiry <= 24) {
        expiringToday.push(c);
      } else if (hoursUntilExpiry <= 48) {
        expiringTomorrow.push(c);
      } else {
        expiringIn2Days.push(c);
      }
    }

    // Crear notificaciones para masters
    const notifications = [];

    for (const c of expired) {
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          broker_id: c.broker_id,
          target: `/cases/${c.id}`,
          title: `⚠️ SLA VENCIDO`,
          body: `El caso ${c.ticket_ref || c.id} (${c.client_name}) tiene el SLA vencido`,
          notification_type: 'other',
          priority: 'HIGH',
          metadata: {
            case_id: c.id,
            ticket_ref: c.ticket_ref,
            sla_date: c.sla_date,
          },
        });

      if (!notifError) notifications.push({ case_id: c.id, type: 'EXPIRED' });
    }

    for (const c of expiringToday) {
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          broker_id: c.broker_id,
          target: `/cases/${c.id}`,
          title: `⏰ SLA vence HOY`,
          body: `El caso ${c.ticket_ref || c.id} (${c.client_name}) vence hoy`,
          notification_type: 'other',
          priority: 'HIGH',
          metadata: {
            case_id: c.id,
            ticket_ref: c.ticket_ref,
            sla_date: c.sla_date,
          },
        });

      if (!notifError) notifications.push({ case_id: c.id, type: 'TODAY' });
    }

    for (const c of expiringTomorrow) {
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          broker_id: c.broker_id,
          target: `/cases/${c.id}`,
          title: `⏱️ SLA vence MAÑANA`,
          body: `El caso ${c.ticket_ref || c.id} (${c.client_name}) vence mañana`,
          notification_type: 'other',
          priority: 'MEDIUM',
          metadata: {
            case_id: c.id,
            ticket_ref: c.ticket_ref,
            sla_date: c.sla_date,
          },
        });

      if (!notifError) notifications.push({ case_id: c.id, type: 'TOMORROW' });
    }

    // Log en security logs
    for (const c of casesNearExpiry) {
      await supabase
        .from('case_security_logs')
        .insert({
          case_id: c.id,
          action_type: 'SLA_ALERT_SENT',
          actor_email: 'system@cron',
          actor_role: 'system',
          metadata: {
            sla_date: c.sla_date,
            sla_accumulated_pause_days: c.sla_accumulated_pause_days,
          },
        });
    }

    return NextResponse.json({ 
      ok: true, 
      message: `SLA alerts processed`,
      summary: {
        total: casesNearExpiry.length,
        expired: expired.length,
        expiringToday: expiringToday.length,
        expiringTomorrow: expiringTomorrow.length,
        expiringIn2Days: expiringIn2Days.length,
      },
      notifications: notifications.length,
    });

  } catch (error) {
    console.error('Unexpected error in sla-alerts cron:', error);
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
