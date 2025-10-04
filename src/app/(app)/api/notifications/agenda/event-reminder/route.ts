import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { event_id, offset } = await request.json();

    if (!event_id || !offset) {
      return NextResponse.json(
        { error: 'event_id and offset are required' },
        { status: 400 }
      );
    }

    if (!['24h', '1h'].includes(offset)) {
      return NextResponse.json(
        { error: 'offset must be "24h" or "1h"' },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseServer();

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('title, start_at')
      .eq('id', event_id)
      .is('canceled_at', null)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found or canceled' },
        { status: 404 }
      );
    }

    // Get attendees who RSVP'd going
    const { data: attendees } = await supabase
      .from('event_attendees')
      .select('broker_id')
      .eq('event_id', event_id)
      .eq('status', 'going');

    const brokerIds = (attendees || []).map(a => a.broker_id);

    if (brokerIds.length === 0) {
      return NextResponse.json({
        success: true,
        notified: 0,
        message: 'No confirmed attendees to notify',
      });
    }

    // Get profiles for these brokers
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .in('broker_id', brokerIds);

    const userIds = (profiles || []).map(p => p.id);

    const offsetText = offset === '24h' ? 'mañana' : 'en 1 hora';
    const icon = offset === '24h' ? '📅' : '⏰';

    // Create notifications
    const notifications = brokerIds.map(brokerId => ({
      broker_id: brokerId,
      target: `/agenda?y=${new Date(event.start_at).getFullYear()}&m=${new Date(event.start_at).getMonth() + 1}`,
      title: `${icon} Recordatorio de evento`,
      body: `${event.title} es ${offsetText}`,
    }));

    if (notifications.length > 0) {
      await supabase.from('notifications').insert(notifications);
    }

    return NextResponse.json({
      success: true,
      notified: notifications.length,
      offset,
    });
  } catch (error: any) {
    console.error('Error creating reminder notifications:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
