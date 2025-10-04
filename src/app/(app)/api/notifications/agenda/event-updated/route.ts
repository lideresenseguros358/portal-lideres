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

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('title, start_at, audience')
      .eq('id', event_id)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Get attendees who RSVP'd
    const { data: attendees } = await supabase
      .from('event_attendees')
      .select('broker_id')
      .eq('event_id', event_id)
      .eq('status', 'going');

    const attendeeBrokerIds = (attendees || []).map(a => a.broker_id);

    // Also get audience
    let audienceBrokerIds: string[] = [];
    
    if (event.audience === 'ALL') {
      const { data: brokers } = await supabase.from('brokers').select('id');
      audienceBrokerIds = (brokers || []).map(b => b.id);
    } else {
      const { data: audienceList } = await supabase
        .from('event_audience')
        .select('broker_id')
        .eq('event_id', event_id);
      audienceBrokerIds = (audienceList || []).map(a => a.broker_id);
    }

    // Combine both lists (unique)
    const brokerIds = [...new Set([...attendeeBrokerIds, ...audienceBrokerIds])];

    // Get profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .in('broker_id', brokerIds);

    const userIds = (profiles || []).map(p => p.id);

    // Create notifications
    const notifications = brokerIds.map(brokerId => ({
      broker_id: brokerId,
      target: `/agenda?y=${new Date(event.start_at).getFullYear()}&m=${new Date(event.start_at).getMonth() + 1}`,
      title: '\u270f\ufe0f Evento actualizado',
      body: `${event.title} ha sido modificado. Revisa los cambios.`,
    }));

    if (notifications.length > 0) {
      await supabase.from('notifications').insert(notifications);
    }

    return NextResponse.json({
      success: true,
      notified: notifications.length,
    });
  } catch (error: any) {
    console.error('Error creating update notifications:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
