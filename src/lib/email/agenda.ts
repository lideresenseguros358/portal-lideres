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
  // Asumiendo estructura de tabla agenda_events
  const { data: event, error } = await supabase
    .from('agenda_events')
    .select(`
      id,
      title,
      description,
      event_date,
      event_time,
      location,
      created_by,
      attendees,
      needs_rsvp
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

  // Obtener emails de asistentes
  const attendeeIds = event.attendees || [];
  if (attendeeIds.length === 0) return;

  const { data: attendees } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', attendeeIds);

  if (!attendees) return;

  // URLs para RSVP si es necesario
  const rsvpYesUrl = event.needs_rsvp ? `${appUrl}/api/agenda/rsvp?eventId=${eventId}&response=yes` : undefined;
  const rsvpNoUrl = event.needs_rsvp ? `${appUrl}/api/agenda/rsvp?eventId=${eventId}&response=no` : undefined;

  // Enviar a cada asistente
  const emails = attendees.map(attendee => ({
    to: attendee.email,
    subject: `📅 Nuevo evento: ${event.title}`,
    html: renderEmailTemplate('agendaCreated', {
      userName: attendee.full_name,
      eventTitle: event.title,
      description: event.description,
      eventDate: event.event_date,
      eventTime: event.event_time,
      location: event.location,
      createdBy: creator?.full_name || 'Sistema',
      needsRsvp: event.needs_rsvp,
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
    .from('agenda_events')
    .select(`
      id,
      title,
      description,
      event_date,
      event_time,
      location,
      updated_by,
      attendees
    `)
    .eq('id', eventId)
    .single();

  if (error || !event) return;

  const { data: updater } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', event.updated_by)
    .single();

  const attendeeIds = event.attendees || [];
  if (attendeeIds.length === 0) return;

  const { data: attendees } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', attendeeIds);

  if (!attendees) return;

  const emails = attendees.map(attendee => ({
    to: attendee.email,
    subject: `🔄 Evento actualizado: ${event.title}`,
    html: renderEmailTemplate('agendaUpdated', {
      userName: attendee.full_name,
      eventTitle: event.title,
      description: event.description,
      eventDate: event.event_date,
      eventTime: event.event_time,
      location: event.location,
      updatedBy: updater?.full_name || 'Sistema',
      changes,
      portalUrl: appUrl,
    }),
    fromType: 'PORTAL' as const,
    template: 'agendaUpdated' as const,
    dedupeKey: generateDedupeKey(attendee.email, 'agendaUpdated', `${eventId}-${event.event_date}`),
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
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const { data: events, error } = await supabase
    .from('agenda_events')
    .select(`
      id,
      title,
      description,
      event_date,
      event_time,
      location,
      attendees
    `)
    .eq('event_date', tomorrowStr);

  if (error || !events || events.length === 0) {
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const event of events) {
    const attendeeIds = event.attendees || [];
    if (attendeeIds.length === 0) continue;

    const { data: attendees } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', attendeeIds);

    if (!attendees) continue;

    const emails = attendees.map(attendee => ({
      to: attendee.email,
      subject: `📅 Recordatorio: ${event.title} - Mañana`,
      html: renderEmailTemplate('agendaReminder', {
        userName: attendee.full_name,
        eventTitle: event.title,
        description: event.description,
        eventDate: event.event_date,
        eventTime: event.event_time,
        location: event.location,
        portalUrl: appUrl,
      }),
      fromType: 'PORTAL' as const,
      template: 'agendaReminder' as const,
      dedupeKey: generateDedupeKey(attendee.email, 'agendaReminder', `${event.id}-${event.event_date}`),
      metadata: { eventId: event.id, attendeeId: attendee.id },
    }));

    const result = await sendEmailBatch(emails);
    sent += result.sent;
    failed += result.failed;
  }

  return { sent, failed };
}
