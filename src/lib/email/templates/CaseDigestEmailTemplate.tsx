/**
 * Case Digest Email Template
 * Template para resumen diario de movimientos en casos/pendientes
 */

import { BaseEmailTemplate } from './BaseEmailTemplate';

export interface CaseChange {
  caseId: string;
  caseTitle: string;
  changeType: 'attachment' | 'status' | 'comment' | 'reassignment' | 'other';
  changeDescription: string;
  timestamp: string;
}

export interface CaseDigestEmailData {
  userName: string;
  date: string; // YYYY-MM-DD
  changes: CaseChange[];
  deepLink: string;
}

export function getCaseDigestEmailContent(data: CaseDigestEmailData): { subject: string; html: string } {
  const { userName, date, changes, deepLink } = data;

  const formattedDate = new Date(date).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const changeIcons = {
    attachment: '📎',
    status: '🔄',
    comment: '💬',
    reassignment: '👤',
    other: '📝'
  };

  // Mostrar max 10 cambios en el email
  const displayedChanges = changes.slice(0, 10);
  const hasMore = changes.length > 10;

  const changesHtml = displayedChanges.map(change => `
    <div style="background: #F7F7F7; padding: 15px; border-radius: 8px; margin: 10px 0; border-left: 4px solid #8AAA19;">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #010139;">
        ${changeIcons[change.changeType]} ${change.caseTitle}
      </p>
      <p style="margin: 0; font-size: 14px; color: #6D6D6D;">
        ${change.changeDescription}
      </p>
      <p style="margin: 8px 0 0 0; font-size: 13px; color: #8A8A8A;">
        ${new Date(change.timestamp).toLocaleString('es-ES')}
      </p>
    </div>
  `).join('');

  const content = `
    <p>Estimado/a <strong>${userName}</strong>,</p>
    <p>Te presentamos el resumen de movimientos en tus casos del día <strong>${formattedDate}</strong>:</p>
    
    <div style="margin: 25px 0;">
      <p style="font-size: 18px; font-weight: 600; color: #010139; margin-bottom: 15px;">
        📊 Total de cambios: ${changes.length}
      </p>
      ${changesHtml}
      
      ${hasMore ? `
      <div style="background: #FFF3CD; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <p style="margin: 0; font-weight: 600;">
          + ${changes.length - 10} cambios adicionales
        </p>
        <p style="margin: 5px 0 0 0; font-size: 14px;">
          Haz clic en el botón de abajo para ver todos los detalles
        </p>
      </div>
      ` : ''}
    </div>
    
    <p>Mantente al día con todos los movimientos de tus casos en el Portal Líderes.</p>
  `;

  const html = BaseEmailTemplate({
    preheader: `${changes.length} movimientos en tus casos del ${formattedDate}`,
    title: 'Resumen de movimientos en tus casos (ayer)',
    content,
    ctaText: 'Ver todos los cambios',
    ctaUrl: deepLink,
    footerText: 'Portal Líderes - Gestión de Pendientes'
  });

  return {
    subject: `Resumen de movimientos en tus casos (${formattedDate})`,
    html
  };
}
