import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { event_id } = await request.json();

    if (!event_id) {
      return NextResponse.json(
        { error: 'event_id is required' },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseServer();

    // Get event details (even if canceled)
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('title, start_at')
      .eq('id', event_id)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
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
        message: 'No attendees to notify',
      });
    }

    // Create notifications
    const notifications = brokerIds.map(brokerId => ({
      broker_id: brokerId,
      target: `/agenda`,
      title: '\u26a0\ufe0f Evento cancelado',
      body: `${event.title} ha sido cancelado.`,
    }));

    if (notifications.length > 0) {
      await supabase.from('notifications').insert(notifications);
    }

    return NextResponse.json({
      success: true,
      notified: notifications.length,
    });
  } catch (error: any) {
    console.error('Error creating cancellation notifications:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
