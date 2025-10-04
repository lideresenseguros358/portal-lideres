import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * Cron job to send event reminders
 * Schedule: Every hour
 * Sends reminders 24h and 1h before events
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (for security)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await getSupabaseServer();
    const now = new Date();

    // Calculate time windows
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in24HoursPlus = new Date(in24Hours.getTime() + 60 * 60 * 1000); // +1h tolerance

    const in1Hour = new Date(now.getTime() + 60 * 60 * 1000);
    const in1HourPlus = new Date(in1Hour.getTime() + 30 * 60 * 1000); // +30min tolerance

    // Get events happening in ~24 hours
    const { data: events24h } = await supabase
      .from('events')
      .select('id, title, start_at')
      .is('canceled_at', null)
      .gte('start_at', in24Hours.toISOString())
      .lte('start_at', in24HoursPlus.toISOString());

    // Get events happening in ~1 hour
    const { data: events1h } = await supabase
      .from('events')
      .select('id, title, start_at')
      .is('canceled_at', null)
      .gte('start_at', in1Hour.toISOString())
      .lte('start_at', in1HourPlus.toISOString());

    let reminders24h = 0;
    let reminders1h = 0;

    // Send 24h reminders
    if (events24h && events24h.length > 0) {
      for (const event of events24h) {
        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/notifications/agenda/event-reminder`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event_id: event.id,
                offset: '24h',
              }),
            }
          );

          if (response.ok) {
            const result = await response.json();
            reminders24h += result.notified || 0;
          }
        } catch (error) {
          console.error(`Error sending 24h reminder for event ${event.id}:`, error);
        }
      }
    }

    // Send 1h reminders
    if (events1h && events1h.length > 0) {
      for (const event of events1h) {
        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/notifications/agenda/event-reminder`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event_id: event.id,
                offset: '1h',
              }),
            }
          );

          if (response.ok) {
            const result = await response.json();
            reminders1h += result.notified || 0;
          }
        } catch (error) {
          console.error(`Error sending 1h reminder for event ${event.id}:`, error);
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      events_24h: events24h?.length || 0,
      events_1h: events1h?.length || 0,
      reminders_24h: reminders24h,
      reminders_1h: reminders1h,
      total_reminders: reminders24h + reminders1h,
    });
  } catch (error: any) {
    console.error('Error in agenda reminders cron:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
