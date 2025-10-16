/**
 * Delinquency Update Email Template
 * Template para notificación de actualización de morosidad
 */

import { BaseEmailTemplate } from './BaseEmailTemplate';

export interface DelinquencyUpdateEmailData {
  userName: string;
  insurerName: string;
  asOfDate: string; // YYYY-MM-DD
  policiesCount?: number;
  totalDebt?: number;
  deepLink: string;
}

export function getDelinquencyUpdateEmailContent(data: DelinquencyUpdateEmailData): { subject: string; html: string } {
  const { userName, insurerName, asOfDate, policiesCount, totalDebt, deepLink } = data;

  const formattedDate = new Date(asOfDate).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const formattedDebt = totalDebt
    ? new Intl.NumberFormat('es-PA', { style: 'currency', currency: 'USD' }).format(totalDebt)
    : null;

  const content = `
    <p>Estimado/a <strong>${userName}</strong>,</p>
    <p>Se ha actualizado la información de morosidad de <strong>${insurerName}</strong> para el corte del <strong>${formattedDate}</strong>.</p>
    
    <div style="background: #FFF3CD; padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 4px solid #FFC107;">
      <p style="margin: 0 0 15px 0; font-size: 18px; font-weight: 600; color: #010139;">
        ⚠️ Actualización de Morosidad
      </p>
      <p style="margin: 5px 0;"><strong>Aseguradora:</strong> ${insurerName}</p>
      <p style="margin: 5px 0;"><strong>Corte:</strong> ${formattedDate}</p>
      ${policiesCount ? `<p style="margin: 5px 0;"><strong>Pólizas afectadas:</strong> ${policiesCount}</p>` : ''}
      ${formattedDebt ? `<p style="margin: 15px 0 0 0; font-size: 20px; font-weight: 700; color: #D22;">Total en mora: ${formattedDebt}</p>` : ''}
    </div>
    
    <p>Por favor, revisa la información actualizada y contacta a los clientes afectados para gestionar los pagos pendientes.</p>
    
    <p style="background: #F7F7F7; padding: 15px; border-radius: 8px; font-size: 14px; color: #6D6D6D;">
      💡 <strong>Recordatorio:</strong> Es importante mantener la morosidad controlada para evitar cancelaciones de pólizas.
    </p>
  `;

  const html = BaseEmailTemplate({
    preheader: `Morosidad actualizada para ${insurerName} - ${formattedDate}`,
    title: 'Morosidad actualizada',
    content,
    ctaText: 'Ver detalles de morosidad',
    ctaUrl: deepLink,
    footerText: 'Portal Líderes - Gestión de Morosidad'
  });

  return {
    subject: `Morosidad actualizada - ${insurerName} (${formattedDate})`,
    html
  };
}
