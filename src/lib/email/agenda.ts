/**
 * HELPERS DE CORREOS PARA MÓDULO AGENDA
 * ======================================
 * Funciones para enviar correos desde el módulo de Agenda
 * SMTP: portal@lideresenseguros.com
 */

import { createClient } from '@supabase/supabase-js';
import { sendEmail, sendEmailBatch } from '@/server/email/sendEmail';
import { renderEmailTemplate } from '@/server/email/renderer';
import { generateDedupeKey } from '@/server/email/dedupe';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const appUrl = process.env.APP_BASE_URL || 'https://portal.lideresenseguros.com';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Notificar creación de evento
 */
export async function notifyEventCreated(eventId: string): Promise<void> {
  // Tabla correcta: events
  const { data: event, error } = await supabase
    .from('events')
    .select(`
      id,
      title,
      details,
      start_at,
      end_at,
      location_name,
      created_by,
      audience,
      allow_rsvp
    `)
    .eq('id', eventId)
    .single();

  if (error || !event) {
    console.error('[AGENDA] Error fetching event:', error);
    return;
  }

  // Obtener info del creador
  const { data: creator } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', event.created_by)
    .single();

  // Obtener emails de asistentes según audiencia
  let attendees: any[] = [];
  
  if (event.audience === 'ALL') {
    // Todos los brokers
    const { data: brokers } = await supabase
      .from('brokers')
      .select('id, name, p_id')
      .eq('active', true);
    
    if (brokers && brokers.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', brokers.map(b => b.p_id));
      attendees = profiles || [];
    }
  } else {
    // Audiencia específica
    const { data: selectedBrokers } = await supabase
      .from('event_audience')
      .select('broker_id')
      .eq('event_id', eventId);
    
    if (selectedBrokers && selectedBrokers.length > 0) {
      const { data: brokers } = await supabase
        .from('brokers')
        .select('id, name, p_id')
        .in('id', selectedBrokers.map(sb => sb.broker_id));
      
      if (brokers && brokers.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', brokers.map(b => b.p_id));
        attendees = profiles || [];
      }
    }
  }

  if (!attendees || attendees.length === 0) return;

  // URLs para RSVP si es necesario
  const rsvpYesUrl = event.allow_rsvp ? `${appUrl}/api/agenda/rsvp?eventId=${eventId}&response=yes` : undefined;
  const rsvpNoUrl = event.allow_rsvp ? `${appUrl}/api/agenda/rsvp?eventId=${eventId}&response=no` : undefined;

  // Formatear fecha y hora
  const eventDate = new Date(event.start_at).toLocaleDateString('es-PA', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const eventTime = new Date(event.start_at).toLocaleTimeString('es-PA', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  // Enviar a cada asistente
  const emails = attendees.map(attendee => ({
    to: attendee.email,
    subject: `📅 Nuevo evento: ${event.title}`,
    html: renderEmailTemplate('agendaCreated', {
      userName: attendee.full_name,
      eventTitle: event.title,
      description: event.details,
      eventDate,
      eventTime,
      location: event.location_name,
      createdBy: creator?.full_name || 'Sistema',
      needsRsvp: event.allow_rsvp,
      rsvpYesUrl,
      rsvpNoUrl,
      portalUrl: appUrl,
    }),
    fromType: 'PORTAL' as const,
    template: 'agendaCreated' as const,
    dedupeKey: generateDedupeKey(attendee.email, 'agendaCreated', eventId),
    metadata: { eventId, attendeeId: attendee.id },
  }));

  await sendEmailBatch(emails);
}

/**
 * Notificar actualización de evento
 */
export async function notifyEventUpdated(eventId: string, changes: any[]): Promise<void> {
  const { data: event, error } = await supabase
    .from('events')
    .select(`
      id,
      title,
      details,
      start_at,
      end_at,
      location_name,
      created_by,
      audience,
      allow_rsvp
    `)
    .eq('id', eventId)
    .single();

  if (error || !event) return;

  const { data: updater } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', event.created_by)
    .single();

  // Obtener asistentes (mismo código que notifyEventCreated)
  let attendees: any[] = [];
  
  if (event.audience === 'ALL') {
    const { data: brokers } = await supabase
      .from('brokers')
      .select('id, name, p_id')
      .eq('active', true);
    
    if (brokers && brokers.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', brokers.map(b => b.p_id));
      attendees = profiles || [];
    }
  } else {
    const { data: selectedBrokers } = await supabase
      .from('event_audience')
      .select('broker_id')
      .eq('event_id', eventId);
    
    if (selectedBrokers && selectedBrokers.length > 0) {
      const { data: brokers } = await supabase
        .from('brokers')
        .select('id, name, p_id')
        .in('id', selectedBrokers.map(sb => sb.broker_id));
      
      if (brokers && brokers.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', brokers.map(b => b.p_id));
        attendees = profiles || [];
      }
    }
  }

  if (!attendees || attendees.length === 0) return;

  const eventDate = new Date(event.start_at).toLocaleDateString('es-PA', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const eventTime = new Date(event.start_at).toLocaleTimeString('es-PA', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  const emails = attendees.map(attendee => ({
    to: attendee.email,
    subject: `🔄 Evento actualizado: ${event.title}`,
    html: renderEmailTemplate('agendaUpdated', {
      userName: attendee.full_name,
      eventTitle: event.title,
      description: event.details,
      eventDate,
      eventTime,
      location: event.location_name,
      updatedBy: updater?.full_name || 'Sistema',
      changes,
      portalUrl: appUrl,
    }),
    fromType: 'PORTAL' as const,
    template: 'agendaUpdated' as const,
    dedupeKey: generateDedupeKey(attendee.email, 'agendaUpdated', `${eventId}-${eventDate}`),
    metadata: { eventId, attendeeId: attendee.id, changes },
  }));

  await sendEmailBatch(emails);
}

/**
 * Notificar eliminación de evento
 */
export async function notifyEventDeleted(eventId: string, deletionData: any): Promise<void> {
  // Los datos del evento eliminado deben pasarse en deletionData
  const { event, attendees } = deletionData;

  if (!attendees || attendees.length === 0) return;

  const emails = attendees.map((attendee: any) => ({
    to: attendee.email,
    subject: `🗑️ Evento cancelado: ${event.title}`,
    html: renderEmailTemplate('agendaDeleted', {
      userName: attendee.full_name,
      eventTitle: event.title,
      eventDate: event.event_date,
      eventTime: event.event_time,
      location: event.location,
      deletedBy: deletionData.deletedBy || 'Sistema',
      reason: deletionData.reason,
      rescheduled: deletionData.rescheduled,
      newDate: deletionData.newDate,
      newTime: deletionData.newTime,
      portalUrl: appUrl,
    }),
    fromType: 'PORTAL' as const,
    template: 'agendaDeleted' as const,
    dedupeKey: generateDedupeKey(attendee.email, 'agendaDeleted', eventId),
    metadata: { eventId, attendeeId: attendee.id },
  }));

  await sendEmailBatch(emails);
}

/**
 * Enviar recordatorios de eventos (ejecutar 1 día antes)
 */
export async function sendEventReminders(): Promise<{ sent: number; failed: number }> {
  // Obtener eventos de mañana
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const { data: events, error } = await supabase
    .from('events')
    .select(`
      id,
      title,
      details,
      start_at,
      location_name,
      audience
    `)
    .gte('start_at', tomorrow.toISOString())
    .lte('start_at', tomorrowEnd.toISOString())
    .is('canceled_at', null);

  if (error || !events || events.length === 0) {
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const event of events) {
    // Obtener asistentes según audiencia
    let attendees: any[] = [];
    
    if (event.audience === 'ALL') {
      const { data: brokers } = await supabase
        .from('brokers')
        .select('id, name, p_id')
        .eq('active', true);
      
      if (brokers && brokers.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', brokers.map(b => b.p_id));
        attendees = profiles || [];
      }
    } else {
      const { data: selectedBrokers } = await supabase
        .from('event_audience')
        .select('broker_id')
        .eq('event_id', event.id);
      
      if (selectedBrokers && selectedBrokers.length > 0) {
        const { data: brokers } = await supabase
          .from('brokers')
          .select('id, name, p_id')
          .in('id', selectedBrokers.map(sb => sb.broker_id));
        
        if (brokers && brokers.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', brokers.map(b => b.p_id));
          attendees = profiles || [];
        }
      }
    }

    if (!attendees || attendees.length === 0) continue;

    const eventDate = new Date(event.start_at).toLocaleDateString('es-PA', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const eventTime = new Date(event.start_at).toLocaleTimeString('es-PA', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    const emails = attendees.map(attendee => ({
      to: attendee.email,
      subject: `📅 Recordatorio: ${event.title} - Mañana`,
      html: renderEmailTemplate('agendaReminder', {
        userName: attendee.full_name,
        eventTitle: event.title,
        description: event.details,
        eventDate,
        eventTime,
        location: event.location_name,
        portalUrl: appUrl,
      }),
      fromType: 'PORTAL' as const,
      template: 'agendaReminder' as const,
      dedupeKey: generateDedupeKey(attendee.email, 'agendaReminder', `${event.id}-${eventDate}`),
      metadata: { eventId: event.id, attendeeId: attendee.id },
    }));

    const result = await sendEmailBatch(emails);
    sent += result.sent;
    failed += result.failed;
  }

  return { sent, failed };
}
