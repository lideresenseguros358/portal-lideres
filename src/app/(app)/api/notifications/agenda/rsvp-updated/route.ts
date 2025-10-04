import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { event_id, broker_id, status } = await request.json();

    if (!event_id || !broker_id || !status) {
      return NextResponse.json(
        { error: 'event_id, broker_id, and status are required' },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseServer();

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('title, created_by')
      .eq('id', event_id)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Get broker name
    const { data: broker } = await supabase
      .from('brokers')
      .select('name')
      .eq('id', broker_id)
      .single();

    if (!event.created_by || !broker) {
      return NextResponse.json({
        success: true,
        notified: 0,
        message: 'No event creator or broker found',
      });
    }

    const statusText = status === 'going' ? 'confirmó asistencia' : 'canceló su asistencia';
    const icon = status === 'going' ? '✅' : '❌';

    // Get the broker_id of the creator (if they are a broker)
    const { data: creatorProfile } = await supabase
      .from('profiles')
      .select('broker_id')
      .eq('id', event.created_by)
      .single();

    if (!creatorProfile?.broker_id) {
      return NextResponse.json({
        success: true,
        notified: 0,
        message: 'Creator is not a broker',
      });
    }

    // Create notification for event creator
    const notification = {
      broker_id: creatorProfile.broker_id,
      target: `/agenda`,
      title: `${icon} RSVP actualizado`,
      body: `${broker.name} ${statusText} a "${event.title}"`,
    };

    await supabase.from('notifications').insert([notification]);

    return NextResponse.json({
      success: true,
      notified: 1,
    });
  } catch (error: any) {
    console.error('Error creating RSVP notification:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
