'use server';

import { getSupabaseServer } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

export interface AgendaEvent {
  id: string;
  title: string;
  details: string | null;
  start_at: string;
  end_at: string;
  is_all_day: boolean;
  event_type: 'normal' | 'oficina_cerrada' | 'oficina_virtual';
  modality: 'virtual' | 'presencial' | 'hibrida';
  zoom_url: string | null;
  zoom_code: string | null;
  location_name: string | null;
  maps_url: string | null;
  allow_rsvp: boolean;
  audience: 'ALL' | 'SELECTED';
  created_by: string | null;
  created_at: string;
  updated_at: string;
  canceled_at: string | null;
  attendee_count?: number;
  user_rsvp_status?: string | null;
}

// Get events for a specific month
export async function actionGetEvents(params: {
  year: number;
  month: number;
  userId: string;
  role: string;
}) {
  try {
    const supabase = await getSupabaseServer();
    
    // Get user's broker_id if broker role
    let brokerId: string | null = null;
    if (params.role === 'broker') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('broker_id')
        .eq('id', params.userId)
        .single();
      brokerId = profile?.broker_id || null;
    }

    // Build date range for the month
    const startDate = new Date(params.year, params.month - 1, 1);
    const endDate = new Date(params.year, params.month, 0, 23, 59, 59);

    let query = supabase
      .from('events')
      .select('*')
      .is('canceled_at', null)
      .gte('start_at', startDate.toISOString())
      .lte('start_at', endDate.toISOString())
      .order('start_at', { ascending: true });

    const { data: events, error } = await query;

    if (error) {
      return { ok: false, error: error.message };
    }

    // Asegurar que todos los eventos tengan event_type (valor por defecto 'normal')
    let filteredEvents = (events || []).map(event => ({
      ...event,
      event_type: (event as any).event_type || 'normal',
    }));
    
    if (params.role === 'broker' && brokerId) {
      // Get events where broker is in audience
      const { data: audienceEvents } = await supabase
        .from('event_audience')
        .select('event_id')
        .eq('broker_id', brokerId);
      
      const audienceEventIds = new Set((audienceEvents || []).map(a => a.event_id));
      
      filteredEvents = filteredEvents.filter(event => 
        event.audience === 'ALL' || 
        audienceEventIds.has(event.id) ||
        event.created_by === params.userId
      );

      // Get user's RSVP status for each event
      const { data: rsvps } = await supabase
        .from('event_attendees')
        .select('event_id, status')
        .eq('broker_id', brokerId)
        .in('event_id', filteredEvents.map(e => e.id));

      const rsvpMap = new Map((rsvps || []).map(r => [r.event_id, r.status]));

      filteredEvents = filteredEvents.map(event => ({
        ...event,
        event_type: (event as any).event_type || 'normal',
        user_rsvp_status: rsvpMap.get(event.id) || null,
      }));
    }

    // Get attendee counts
    const eventIds = filteredEvents.map(e => e.id);
    if (eventIds.length > 0) {
      const { data: attendees } = await supabase
        .from('event_attendees')
        .select('event_id, status')
        .in('event_id', eventIds)
        .eq('status', 'going');

      const countMap = new Map<string, number>();
      (attendees || []).forEach(a => {
        countMap.set(a.event_id, (countMap.get(a.event_id) || 0) + 1);
      });

      filteredEvents = filteredEvents.map(event => ({
        ...event,
        event_type: (event as any).event_type || 'normal',
        attendee_count: countMap.get(event.id) || 0,
      }));
    } else {
      // Si no hay eventos, asegurar que tengan event_type
      filteredEvents = filteredEvents.map(event => ({
        ...event,
        event_type: (event as any).event_type || 'normal',
      }));
    }

    return { ok: true, data: filteredEvents as AgendaEvent[] };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

// Create event (Master only)
export async function actionCreateEvent(payload: {
  title: string;
  details: string;
  start_at: string;
  end_at: string;
  is_all_day: boolean;
  event_type: 'normal' | 'oficina_cerrada' | 'oficina_virtual';
  modality: 'virtual' | 'presencial' | 'hibrida';
  zoom_url?: string;
  zoom_code?: string;
  location_name?: string;
  maps_url?: string;
  allow_rsvp: boolean;
  audience: 'ALL' | 'SELECTED';
  selected_brokers?: string[];
  userId: string;
}) {
  try {
    const supabase = await getSupabaseServer();

    // Validate
    if (payload.end_at <= payload.start_at) {
      return { ok: false, error: 'Fecha de fin debe ser posterior a fecha de inicio' };
    }

    // Solo validar Zoom URL para eventos normales con modality virtual/hibrida
    if (payload.event_type === 'normal' && (payload.modality === 'virtual' || payload.modality === 'hibrida') && !payload.zoom_url) {
      return { ok: false, error: 'Zoom URL es requerido para eventos virtuales o híbridos' };
    }

    // Create event
    const { data: event, error } = await supabase
      .from('events')
      .insert({
        title: payload.title,
        details: payload.details,
        start_at: payload.start_at,
        end_at: payload.end_at,
        is_all_day: payload.is_all_day,
        event_type: payload.event_type,
        modality: payload.modality,
        zoom_url: payload.zoom_url || null,
        zoom_code: payload.zoom_code || null,
        location_name: payload.location_name || null,
        maps_url: payload.maps_url || null,
        allow_rsvp: payload.allow_rsvp,
        audience: payload.audience,
        created_by: payload.userId,
      })
      .select()
      .single();

    if (error) {
      return { ok: false, error: error.message };
    }

    // If SELECTED audience, insert into event_audience
    if (payload.audience === 'SELECTED' && payload.selected_brokers && payload.selected_brokers.length > 0) {
      const audienceRecords = payload.selected_brokers.map(brokerId => ({
        event_id: event.id,
        broker_id: brokerId,
      }));

      await supabase.from('event_audience').insert(audienceRecords);
    }

    // Notificar brokers en background (fire-and-forget)
    // NO bloquear la respuesta al usuario — el evento ya está creado en DB
    const eventId = event.id;
    const notifPayload = { ...payload };
    
    Promise.resolve().then(async () => {
      try {
        const { createNotification } = await import('@/lib/notifications/create');
        
        const eventDate = new Date(notifPayload.start_at).toISOString().split('T')[0];
        const eventTime = notifPayload.is_all_day ? undefined : new Date(notifPayload.start_at).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Panama' });
        const isForAllBrokers = notifPayload.audience === 'ALL';
        
        if (isForAllBrokers) {
          await createNotification({
            type: 'agenda_event' as const,
            target: 'ALL' as const,
            title: `📅 Nuevo Evento: ${notifPayload.title}`,
            body: `${notifPayload.title} - ${eventDate}${eventTime ? ` a las ${eventTime}` : ''}`,
            brokerId: undefined,
            meta: {
              event_id: eventId,
              event_title: notifPayload.title,
              event_date: eventDate,
              event_time: eventTime,
              modality: notifPayload.modality,
            },
            entityId: `agenda-${eventId}-all`,
          });
          console.log(`[actionCreateEvent] ✅ Notificación ALL creada para evento ${eventId}`);
        } else if (notifPayload.selected_brokers && notifPayload.selected_brokers.length > 0) {
          const sbClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
          const { data: selectedBrokers } = await sbClient
            .from('brokers')
            .select('id, name, p_id')
            .in('id', notifPayload.selected_brokers);
          
          for (const broker of (selectedBrokers || [])) {
            try {
              await createNotification({
                type: 'agenda_event' as const,
                target: 'BROKER' as const,
                title: `📅 Nuevo Evento: ${notifPayload.title}`,
                body: `${notifPayload.title} - ${eventDate}${eventTime ? ` a las ${eventTime}` : ''}`,
                brokerId: broker.p_id,
                meta: {
                  event_id: eventId,
                  event_title: notifPayload.title,
                  event_date: eventDate,
                  event_time: eventTime,
                  modality: notifPayload.modality,
                },
                entityId: `agenda-${eventId}-${broker.id}`,
              });
            } catch (brokerNotifError) {
              console.error(`[actionCreateEvent] Error notificando a broker ${broker.id}:`, brokerNotifError);
            }
          }
          console.log(`[actionCreateEvent] ✅ Notificaciones SELECTED creadas para evento ${eventId}`);
        }
      } catch (notifError) {
        console.error('[actionCreateEvent] Error enviando notificaciones:', notifError);
      }

      // Enviar correos SMTP profesionales
      try {
        const { notifyEventCreated } = await import('@/lib/email/agenda');
        await notifyEventCreated(eventId);
        console.log(`[actionCreateEvent] ✅ Correos SMTP enviados para evento ${eventId}`);
      } catch (emailError) {
        console.error('[actionCreateEvent] ⚠️ Error enviando correos SMTP:', emailError);
      }
    }).catch(err => {
      console.error('[actionCreateEvent] Error en background notifications:', err);
    });

    revalidatePath('/agenda');
    return { ok: true, data: event, message: 'Evento creado exitosamente' };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

// Update event (Master only)
export async function actionUpdateEvent(params: {
  id: string;
  payload: Partial<{
    title: string;
    details: string;
    start_at: string;
    end_at: string;
    is_all_day: boolean;
    event_type: 'normal' | 'oficina_cerrada' | 'oficina_virtual';
    modality: 'virtual' | 'presencial' | 'hibrida';
    zoom_url: string | null;
    zoom_code: string | null;
    location_name: string | null;
    maps_url: string | null;
    allow_rsvp: boolean;
    audience: 'ALL' | 'SELECTED';
    selected_brokers: string[];
  }>;
  userId: string;
}) {
  try {
    const supabase = await getSupabaseServer();

    // Obtener evento actual para verificar si cambió la fecha
    const { data: currentEvent } = await supabase
      .from('events')
      .select('*')
      .eq('id', params.id)
      .single();
    
    const dateChanged = params.payload.start_at && currentEvent && params.payload.start_at !== currentEvent.start_at;

    // Update event
    const { error } = await supabase
      .from('events')
      .update({
        ...params.payload,
        selected_brokers: undefined, // Remove this field
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .eq('created_by', params.userId);

    if (error) {
      return { ok: false, error: error.message };
    }

    // Update audience if provided
    if (params.payload.audience === 'SELECTED' && params.payload.selected_brokers) {
      // Delete existing audience
      await supabase.from('event_audience').delete().eq('event_id', params.id);

      // Insert new audience
      if (params.payload.selected_brokers.length > 0) {
        const audienceRecords = params.payload.selected_brokers.map(brokerId => ({
          event_id: params.id,
          broker_id: brokerId,
        }));
        await supabase.from('event_audience').insert(audienceRecords);
      }
    } else if (params.payload.audience === 'ALL') {
      // Clear audience if switching to ALL
      await supabase.from('event_audience').delete().eq('event_id', params.id);
    }

    // Notificar SOLO si cambió la fecha — fire-and-forget (no bloquear respuesta)
    if (dateChanged) {
      const updateEventId = params.id;
      const updatePayload = { ...params.payload };
      const currentTitle = currentEvent?.title;
      const currentStartAt = currentEvent?.start_at;
      const currentIsAllDay = currentEvent?.is_all_day;
      const currentDetails = currentEvent?.details;
      const currentLocationName = currentEvent?.location_name;
      const currentAudience = currentEvent?.audience;

      Promise.resolve().then(async () => {
        try {
          const { createNotification } = await import('@/lib/notifications/create');
          
          const title = updatePayload.title || currentTitle;
          const startAt = updatePayload.start_at || currentStartAt;
          const isAllDay = updatePayload.is_all_day ?? currentIsAllDay;
          const audience = updatePayload.audience || currentAudience;
          
          const eventDate = new Date(startAt).toISOString().split('T')[0];
          const eventTime = isAllDay ? undefined : new Date(startAt).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Panama' });
          const isForAllBrokers = audience === 'ALL';
          
          if (isForAllBrokers) {
            await createNotification({
              type: 'agenda_event' as const,
              target: 'ALL' as const,
              title: `🔄 Evento Reprogramado: ${title}`,
              body: `${title} - Nueva fecha: ${eventDate}${eventTime ? ` a las ${eventTime}` : ''}`,
              brokerId: undefined,
              meta: {
                event_id: updateEventId,
                event_title: title,
                event_date: eventDate,
                event_time: eventTime,
                date_changed: true,
              },
              entityId: `agenda-update-${updateEventId}-all-${eventDate}`,
            });
            console.log(`[actionUpdateEvent] ✅ Notificación ALL creada para evento actualizado ${updateEventId}`);
          } else {
            const brokerIds = updatePayload.selected_brokers || [];
            if (brokerIds.length > 0) {
              const sbClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
              const { data: selectedBrokers } = await sbClient
                .from('brokers')
                .select('id, name, p_id')
                .in('id', brokerIds);
              
              for (const broker of (selectedBrokers || [])) {
                try {
                  await createNotification({
                    type: 'agenda_event' as const,
                    target: 'BROKER' as const,
                    title: `🔄 Evento Reprogramado: ${title}`,
                    body: `${title} - Nueva fecha: ${eventDate}${eventTime ? ` a las ${eventTime}` : ''}`,
                    brokerId: broker.p_id,
                    meta: {
                      event_id: updateEventId,
                      event_title: title,
                      event_date: eventDate,
                      event_time: eventTime,
                      date_changed: true,
                    },
                    entityId: `agenda-update-${updateEventId}-${broker.id}-${eventDate}`,
                  });
                } catch (brokerNotifError) {
                  console.error(`[actionUpdateEvent] Error notificando a broker ${broker.id}:`, brokerNotifError);
                }
              }
              console.log(`[actionUpdateEvent] ✅ ${(selectedBrokers || []).length} notificaciones SELECTED creadas para evento actualizado ${updateEventId}`);
            }
          }

          // Enviar correos SMTP profesionales de actualización
          try {
            const { notifyEventUpdated } = await import('@/lib/email/agenda');
            await notifyEventUpdated(updateEventId, ['Fecha reprogramada']);
            console.log(`[actionUpdateEvent] ✅ Correos SMTP enviados para evento actualizado ${updateEventId}`);
          } catch (emailError) {
            console.error('[actionUpdateEvent] ⚠️ Error enviando correos SMTP:', emailError);
          }
        } catch (notifError) {
          console.error('[actionUpdateEvent] Error en sistema de notificaciones:', notifError);
        }
      }).catch(err => {
        console.error('[actionUpdateEvent] Error en background notifications:', err);
      });
    }

    revalidatePath('/agenda');

    return { ok: true, message: 'Evento actualizado exitosamente' };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

// Delete event (Master only)
export async function actionDeleteEvent(eventId: string, userId: string) {
  try {
    const supabase = await getSupabaseServer();

    // Soft delete by setting canceled_at
    const { error } = await supabase
      .from('events')
      .update({ canceled_at: new Date().toISOString() })
      .eq('id', eventId)
      .eq('created_by', userId);

    if (error) {
      return { ok: false, error: 'Error al cancelar evento' };
    }

    // Send notification
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/notifications/agenda/event-canceled`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId }),
      });
    } catch (notifError) {
      console.error('Error sending event cancellation notification:', notifError);
      // Don't fail the whole operation if notification fails
    }

    revalidatePath('/agenda');
    return { ok: true, message: 'Evento cancelado exitosamente' };
  } catch (error) {
    console.error('Error canceling event:', error);
    return { ok: false, error: 'Error inesperado al cancelar evento' };
  }
}

// RSVP to event (Broker)
export async function actionRSVP(params: {
  eventId: string;
  brokerId: string;
  status: 'going' | 'declined';
}) {
  try {
    const supabase = await getSupabaseServer();

    // Upsert RSVP
    const { error } = await supabase
      .from('event_attendees')
      .upsert({
        event_id: params.eventId,
        broker_id: params.brokerId,
        status: params.status,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'event_id,broker_id',
      });

    if (error) {
      return { ok: false, error: error.message };
    }

    // Send notification
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/notifications/agenda/rsvp-updated`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          event_id: params.eventId, 
          broker_id: params.brokerId, 
          status: params.status 
        }),
      });
    } catch (notifError) {
      console.error('Error sending RSVP notification:', notifError);
    }

    revalidatePath('/agenda');

    return { ok: true, message: params.status === 'going' ? 'Asistencia confirmada' : 'Asistencia cancelada' };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

// Get attendees list (Master)
export async function actionGetAttendees(eventId: string) {
  try {
    const supabase = await getSupabaseServer();

    const { data, error } = await supabase
      .from('event_attendees')
      .select(`
        status,
        updated_at,
        broker_id,
        brokers:broker_id (
          id,
          name
        )
      `)
      .eq('event_id', eventId)
      .eq('status', 'going');

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, data: data || [] };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

// Get all brokers (for audience selection)
export async function actionGetBrokers() {
  try {
    const supabase = await getSupabaseServer();

    const { data, error } = await supabase
      .from('brokers')
      .select('id, name')
      .order('name');

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, data: data || [] };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

// ========================================
// LINK LISSA RECURRENTE
// ========================================

export interface LissaConfig {
  lissa_recurring_link: string;
  lissa_meeting_code: string;
}

// Get LINK LISSA configuration
export async function actionGetLissaConfig() {
  try {
    const supabase = await getSupabaseServer();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: 'No autenticado' };
    }

    // Try to get existing config
    const { data, error } = await supabase
      .from('config_agenda')
      .select('lissa_recurring_link, lissa_meeting_code')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      return { ok: false, error: error.message };
    }

    // Return empty strings if no config exists
    return { 
      ok: true, 
      data: data || { 
        lissa_recurring_link: '', 
        lissa_meeting_code: '' 
      } 
    };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

// Save LINK LISSA configuration
export async function actionSaveLissaConfig(config: LissaConfig) {
  try {
    const supabase = await getSupabaseServer();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: 'No autenticado' };
    }

    // Check if config exists
    const { data: existing } = await supabase
      .from('config_agenda')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('config_agenda')
        .update({
          lissa_recurring_link: config.lissa_recurring_link,
          lissa_meeting_code: config.lissa_meeting_code,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) {
        return { ok: false, error: error.message };
      }
    } else {
      // Insert new
      const { error } = await supabase
        .from('config_agenda')
        .insert({
          user_id: user.id,
          lissa_recurring_link: config.lissa_recurring_link,
          lissa_meeting_code: config.lissa_meeting_code,
        });

      if (error) {
        return { ok: false, error: error.message };
      }
    }

    revalidatePath('/config');
    return { ok: true, message: 'Configuración guardada correctamente' };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}
