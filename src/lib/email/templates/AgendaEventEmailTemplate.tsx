/**
 * Agenda Event Email Template
 * Template para notificación de eventos de agenda
 */

import { BaseEmailTemplate } from './BaseEmailTemplate';

export interface AgendaEventEmailData {
  brokerName: string;
  eventTitle: string;
  eventDescription?: string;
  eventDate: string; // YYYY-MM-DD
  eventTime?: string; // HH:MM
  eventLocation?: string;
  eventType: 'new' | 'updated'; // nuevo o fecha cambiada
  assignedBrokers?: string[]; // nombres de brokers específicos
  isForAllBrokers: boolean;
}

export function getAgendaEventEmailContent(data: AgendaEventEmailData): { subject: string; html: string } {
  const { 
    brokerName, 
    eventTitle, 
    eventDescription, 
    eventDate, 
    eventTime,
    eventLocation,
    eventType,
    assignedBrokers,
    isForAllBrokers
  } = data;

  const formattedDate = new Date(eventDate).toLocaleDateString('es-PA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const isNewEvent = eventType === 'new';
  const eventTypeText = isNewEvent ? 'Nuevo Evento' : 'Evento Reprogramado';
  const eventIcon = isNewEvent ? '📅' : '🔄';

  const content = `
    <p>Estimado/a <strong>${brokerName}</strong>,</p>
    <p>${isNewEvent ? 'Se ha creado un nuevo evento' : 'Se ha reprogramado un evento'} en la agenda${isForAllBrokers ? ' para todos los brokers' : ''}.</p>
    
    <!-- Título del Evento -->
    <div style="background: linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%); padding: 30px; border-radius: 12px; margin: 25px 0; border-left: 6px solid #2196F3; box-shadow: 0 2px 8px rgba(33, 150, 243, 0.15);">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #6D6D6D; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
        ${eventIcon} ${eventTypeText}
      </p>
      <p style="margin: 0; font-size: 28px; font-weight: 700; color: #010139;">
        ${eventTitle}
      </p>
    </div>
    
    <!-- Detalles del Evento -->
    <div style="background: #F7F7F7; padding: 20px; border-radius: 10px; margin: 20px 0;">
      <p style="margin: 0 0 15px 0; font-size: 16px; font-weight: 600; color: #010139;">
        📋 Detalles del Evento
      </p>
      
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #E0E0E0;">
          <td style="padding: 12px 0; color: #6D6D6D; font-size: 15px; width: 120px;">
            📅 Fecha
          </td>
          <td style="padding: 12px 0; font-weight: 600; font-size: 15px; color: #010139;">
            ${formattedDate}
          </td>
        </tr>
        ${eventTime ? `
        <tr style="border-bottom: 1px solid #E0E0E0;">
          <td style="padding: 12px 0; color: #6D6D6D; font-size: 15px;">
            🕐 Hora
          </td>
          <td style="padding: 12px 0; font-weight: 600; font-size: 15px; color: #010139;">
            ${eventTime}
          </td>
        </tr>
        ` : ''}
        ${eventLocation ? `
        <tr style="border-bottom: 1px solid #E0E0E0;">
          <td style="padding: 12px 0; color: #6D6D6D; font-size: 15px;">
            📍 Lugar
          </td>
          <td style="padding: 12px 0; font-weight: 600; font-size: 15px; color: #010139;">
            ${eventLocation}
          </td>
        </tr>
        ` : ''}
        ${!isForAllBrokers && assignedBrokers && assignedBrokers.length > 0 ? `
        <tr>
          <td style="padding: 12px 0; color: #6D6D6D; font-size: 15px; vertical-align: top;">
            👥 Invitados
          </td>
          <td style="padding: 12px 0; font-weight: 600; font-size: 15px; color: #010139;">
            ${assignedBrokers.join(', ')}
          </td>
        </tr>
        ` : ''}
      </table>
    </div>
    
    ${eventDescription ? `
    <!-- Descripción -->
    <div style="background: #FFFFFF; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px solid #E3F2FD;">
      <p style="margin: 0 0 10px 0; font-size: 15px; font-weight: 600; color: #010139;">
        📝 Descripción
      </p>
      <p style="margin: 0; font-size: 14px; color: #23262F; line-height: 1.6;">
        ${eventDescription}
      </p>
    </div>
    ` : ''}
    
    ${isForAllBrokers ? `
    <p style="background: #E8F5E9; padding: 15px; border-radius: 8px; font-size: 14px; color: #6D6D6D; border-left: 4px solid #4CAF50;">
      ✅ <strong>Evento general:</strong> Este evento es para todos los brokers de la oficina.
    </p>
    ` : `
    <p style="background: #FFF3E0; padding: 15px; border-radius: 8px; font-size: 14px; color: #6D6D6D; border-left: 4px solid #FF9800;">
      👤 <strong>Evento específico:</strong> Este evento está asignado a brokers específicos.
    </p>
    `}
    
    <p style="margin-top: 25px;">
      Puedes ver todos los detalles y gestionar tu agenda en la sección de <strong>Agenda</strong> del portal.
    </p>
  `;

  const deepLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/agenda`;

  const html = BaseEmailTemplate({
    preheader: `${eventTypeText}: ${eventTitle} - ${formattedDate}`,
    title: `${eventIcon} ${eventTypeText}`,
    content,
    ctaText: 'Ver en Agenda',
    ctaUrl: deepLink,
    footerText: 'Portal Líderes - Gestión de Agenda'
  });

  const subjectPrefix = isNewEvent ? '📅 Nuevo Evento' : '🔄 Evento Reprogramado';

  return {
    subject: `${subjectPrefix}: ${eventTitle} - ${formattedDate}`,
    html
  };
}
