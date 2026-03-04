/**
 * CRON JOB: AGENDA REMINDERS
 * ===========================
 * Ejecuta cada hora
 * - Envía correos recordatorio 24h antes del evento (sendEventReminders)
 * - Crea notificaciones in-app 24h y 1h antes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEventReminders } from '@/lib/email/agenda';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  // Verificar autenticación del cron
  const cronSecret = request.headers.get('x-cron-secret');

  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[CRON AGENDA-REMINDERS] Starting...');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date();

    // ── 1. Send EMAIL reminders (events happening tomorrow) ──
    let emailResult = { sent: 0, failed: 0 };
    try {
      emailResult = await sendEventReminders();
      console.log('[CRON AGENDA-REMINDERS] Email reminders:', emailResult);
    } catch (err) {
      console.error('[CRON AGENDA-REMINDERS] Error sending email reminders:', err);
    }

    // ── 2. Create IN-APP notifications for events in ~24h ──
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in24HoursPlus = new Date(in24Hours.getTime() + 60 * 60 * 1000);

    const { data: events24h } = await supabase
      .from('events')
      .select('id, title, start_at, audience')
      .is('canceled_at', null)
      .gte('start_at', in24Hours.toISOString())
      .lte('start_at', in24HoursPlus.toISOString());

    let notifications24h = 0;

    if (events24h && events24h.length > 0) {
      for (const event of events24h) {
        const brokerIds = await getEventBrokerIds(supabase, event);
        if (brokerIds.length === 0) continue;

        const notifications = brokerIds.map(brokerId => ({
          broker_id: brokerId,
          target: `/agenda?y=${new Date(event.start_at).getFullYear()}&m=${new Date(event.start_at).getMonth() + 1}`,
          title: '📅 Recordatorio de evento',
          body: `${event.title} es mañana`,
        }));

        const { error } = await supabase.from('notifications').insert(notifications);
        if (!error) notifications24h += notifications.length;
      }
    }

    // ── 3. Create IN-APP notifications for events in ~1h ──
    const in1Hour = new Date(now.getTime() + 60 * 60 * 1000);
    const in1HourPlus = new Date(in1Hour.getTime() + 30 * 60 * 1000);

    const { data: events1h } = await supabase
      .from('events')
      .select('id, title, start_at, audience')
      .is('canceled_at', null)
      .gte('start_at', in1Hour.toISOString())
      .lte('start_at', in1HourPlus.toISOString());

    let notifications1h = 0;

    if (events1h && events1h.length > 0) {
      for (const event of events1h) {
        const brokerIds = await getEventBrokerIds(supabase, event);
        if (brokerIds.length === 0) continue;

        const notifications = brokerIds.map(brokerId => ({
          broker_id: brokerId,
          target: `/agenda?y=${new Date(event.start_at).getFullYear()}&m=${new Date(event.start_at).getMonth() + 1}`,
          title: '⏰ Evento en 1 hora',
          body: `${event.title} comienza en 1 hora`,
        }));

        const { error } = await supabase.from('notifications').insert(notifications);
        if (!error) notifications1h += notifications.length;
      }
    }

    const result = {
      success: true,
      timestamp: now.toISOString(),
      emails: emailResult,
      notifications_24h: notifications24h,
      notifications_1h: notifications1h,
      events_24h: events24h?.length || 0,
      events_1h: events1h?.length || 0,
    };

    console.log('[CRON AGENDA-REMINDERS] Done:', result);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[CRON AGENDA-REMINDERS] Fatal error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get broker IDs for an event based on its audience
 */
async function getEventBrokerIds(
  supabase: any,
  event: { id: string; audience: string }
): Promise<string[]> {
  if (event.audience === 'ALL') {
    const { data: brokers } = await supabase
      .from('brokers')
      .select('id')
      .eq('active', true);
    return (brokers || []).map((b: any) => b.id);
  }

  const { data: selected } = await supabase
    .from('event_audience')
    .select('broker_id')
    .eq('event_id', event.id);

  return (selected || []).map((s: any) => s.broker_id);
}
