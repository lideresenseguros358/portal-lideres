/**
 * Renewal Email Template
 * Template para notificaciones de renovación de pólizas
 */

import { BaseEmailTemplate } from './BaseEmailTemplate';

export interface RenewalEmailData {
  clientName: string;
  policyNumber: string;
  insurerName: string;
  renewalDate: string; // YYYY-MM-DD
  condition: '30days' | 'sameday' | '7expired' | 'daily';
  brokerName: string;
  clientEmail?: string;
  deepLink: string;
}

export function getRenewalEmailContent(data: RenewalEmailData): { subject: string; html: string } {
  const { clientName, policyNumber, insurerName, renewalDate, condition, brokerName, clientEmail, deepLink } = data;

  // Formatear fecha
  const formattedDate = new Date(renewalDate).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Título y contenido según condición
  let title = '';
  let content = '';
  let preheader = '';

  switch (condition) {
    case '30days':
      title = '🔄 Póliza próxima a renovar en 30 días';
      preheader = `La póliza ${policyNumber} de ${clientName} renueva en 30 días`;
      content = `
        <p>Estimado/a <strong>${brokerName}</strong>,</p>
        <p>Te informamos que la siguiente póliza está próxima a renovar en <strong>30 días</strong>:</p>
        <div style="background: #F7F7F7; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Cliente:</strong> ${clientName}</p>
          <p style="margin: 5px 0;"><strong>Número de Póliza:</strong> ${policyNumber}</p>
          <p style="margin: 5px 0;"><strong>Aseguradora:</strong> ${insurerName}</p>
          <p style="margin: 5px 0;"><strong>Fecha de Renovación:</strong> ${formattedDate}</p>
        </div>
        ${!clientEmail ? `
        <p style="background: #FFF3CD; padding: 15px; border-radius: 8px; border-left: 4px solid #FFC107;">
          ⚠️ <strong>Importante:</strong> Este cliente NO tiene correo electrónico registrado en el sistema.
          Por favor, contacta al cliente directamente y actualiza su información tan pronto sea posible.
        </p>
        ` : ''}
        <p>Por favor, contacta al cliente para gestionar la renovación.</p>
      `;
      break;

    case 'sameday':
      title = '⏰ Póliza vence HOY';
      preheader = `La póliza ${policyNumber} de ${clientName} vence hoy`;
      content = `
        <p>Estimado/a <strong>${brokerName}</strong>,</p>
        <p style="color: #D22; font-weight: 600;">La siguiente póliza <strong>VENCE HOY</strong>:</p>
        <div style="background: #FFF3CD; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #FFC107;">
          <p style="margin: 5px 0;"><strong>Cliente:</strong> ${clientName}</p>
          <p style="margin: 5px 0;"><strong>Número de Póliza:</strong> ${policyNumber}</p>
          <p style="margin: 5px 0;"><strong>Aseguradora:</strong> ${insurerName}</p>
          <p style="margin: 5px 0;"><strong>Fecha de Vencimiento:</strong> ${formattedDate}</p>
        </div>
        ${!clientEmail ? `
        <p style="background: #FFE6E6; padding: 15px; border-radius: 8px; border-left: 4px solid #D22;">
          ⚠️ <strong>Urgente:</strong> Este cliente NO tiene correo electrónico registrado.
          Contacta inmediatamente por otros medios y actualiza su información.
        </p>
        ` : ''}
        <p><strong>Acción requerida:</strong> Contacta al cliente de inmediato para renovar la póliza.</p>
      `;
      break;

    case '7expired':
      title = '❌ Póliza vencida hace 7 días';
      preheader = `La póliza ${policyNumber} de ${clientName} venció hace 7 días`;
      content = `
        <p>Estimado/a <strong>${brokerName}</strong>,</p>
        <p style="color: #D22; font-weight: 600;">La siguiente póliza venció hace <strong>7 DÍAS</strong>:</p>
        <div style="background: #FFE6E6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #D22;">
          <p style="margin: 5px 0;"><strong>Cliente:</strong> ${clientName}</p>
          <p style="margin: 5px 0;"><strong>Número de Póliza:</strong> ${policyNumber}</p>
          <p style="margin: 5px 0;"><strong>Aseguradora:</strong> ${insurerName}</p>
          <p style="margin: 5px 0;"><strong>Fecha de Vencimiento:</strong> ${formattedDate}</p>
        </div>
        ${!clientEmail ? `
        <p style="background: #FFE6E6; padding: 15px; border-radius: 8px; border-left: 4px solid #D22;">
          ⚠️ <strong>Crítico:</strong> Cliente sin correo registrado. Contacta urgentemente y actualiza datos.
        </p>
        ` : ''}
        <p><strong>Acción urgente:</strong> Gestiona la renovación o actualiza la fecha en el sistema.</p>
      `;
      break;

    case 'daily':
      title = '🔴 Recordatorio diario - Póliza vencida';
      preheader = `Recordatorio: La póliza ${policyNumber} sigue vencida`;
      content = `
        <p>Estimado/a <strong>${brokerName}</strong>,</p>
        <p style="color: #D22; font-weight: 600;">Esta póliza continúa <strong>VENCIDA</strong>:</p>
        <div style="background: #FFE6E6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #D22;">
          <p style="margin: 5px 0;"><strong>Cliente:</strong> ${clientName}</p>
          <p style="margin: 5px 0;"><strong>Número de Póliza:</strong> ${policyNumber}</p>
          <p style="margin: 5px 0;"><strong>Aseguradora:</strong> ${insurerName}</p>
          <p style="margin: 5px 0;"><strong>Venció el:</strong> ${formattedDate}</p>
        </div>
        ${!clientEmail ? `
        <p style="background: #FFE6E6; padding: 15px; border-radius: 8px; border-left: 4px solid #D22;">
          ⚠️ Cliente sin correo registrado. Actualiza la información.
        </p>
        ` : ''}
        <p>Recibirás este recordatorio diariamente hasta que renueves la póliza o actualices la fecha.</p>
        <p><strong>Para detener estos recordatorios:</strong> Actualiza la fecha de renovación o elimina la póliza del sistema.</p>
      `;
      break;
  }

  const html = BaseEmailTemplate({
    preheader,
    title,
    content,
    ctaText: 'Ver en Portal Líderes',
    ctaUrl: deepLink,
    footerText: 'Portal Líderes - Gestión de Renovaciones'
  });

  return {
    subject: title,
    html
  };
}
