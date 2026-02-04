'use client';

import { useState, useEffect } from 'react';
import { supabaseClient } from '@/lib/supabase/client';
import MiniCalendarAgenda from './MiniCalendarAgenda';

interface AgendaWidgetProps {
  userId: string;
  brokerId: string | null;
}

export default function AgendaWidget({ userId, brokerId }: AgendaWidgetProps) {
  const [events, setEvents] = useState<{ date: string; title: string; event_type: string; end_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, brokerId]);

  const loadEvents = async () => {
    try {
      const client = supabaseClient();
      
      // Get current month and next month
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);

      let query = client
        .from('events')
        .select('id, title, start_at, end_at, event_type, audience')
        .is('canceled_at', null)
        .gte('start_at', startDate.toISOString())
        .lte('start_at', endDate.toISOString())
        .order('start_at', { ascending: true });

      const { data: eventsData } = await query;

      if (eventsData) {
        // Filter by audience if broker
        let filteredEvents = eventsData as any[];
        
        if (brokerId) {
          // Get event_audience for this broker
          const { data: audienceEvents } = await client
            .from('event_audience')
            .select('event_id')
            .eq('broker_id', brokerId);

          const audienceEventIds = new Set((audienceEvents || []).map(a => a.event_id));

          filteredEvents = (eventsData as any[]).filter((event: any) => 
            event.audience === 'ALL' || audienceEventIds.has(event.id)
          );
        }

        // Map to format for MiniCalendar with event_type and end_at
        const mappedEvents = filteredEvents.map((event: any) => ({
          date: event.start_at,
          title: event.title,
          event_type: event.event_type || 'normal',
          end_at: event.end_at || event.start_at,
        }));

        setEvents(mappedEvents);
      }
    } catch (error) {
      console.error('Error loading agenda events:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex w-full h-full items-center justify-center rounded-2xl bg-white p-5 shadow-[0_18px_40px_rgba(1,1,57,0.12)]">
        <div className="animate-spin w-8 h-8 border-4 border-[#010139] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return <MiniCalendarAgenda events={events} />;
}
