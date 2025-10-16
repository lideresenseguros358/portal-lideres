/**
 * Guide Update Email Template
 * Template para notificación de guía actualizada
 */

import { BaseEmailTemplate } from './BaseEmailTemplate';

export interface GuideUpdateEmailData {
  userName: string;
  guideTitle: string;
  section: string;
  deepLink: string;
}

export function getGuideUpdateEmailContent(data: GuideUpdateEmailData): { subject: string; html: string } {
  const { userName, guideTitle, section, deepLink } = data;

  const content = `
    <p>Estimado/a <strong>${userName}</strong>,</p>
    <p>Te informamos que se ha actualizado una guía en el portal.</p>
    
    <div style="background: #F3E8FD; padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 4px solid #9C27B0;">
      <p style="margin: 0 0 15px 0; font-size: 18px; font-weight: 600; color: #010139;">
        📚 Guía Actualizada
      </p>
      <p style="margin: 5px 0;"><strong>Sección:</strong> ${section}</p>
      <p style="margin: 5px 0;"><strong>Título:</strong> ${guideTitle}</p>
    </div>
    
    <p>Revisa los cambios actualizados en la sección de <strong>Guías</strong> del portal.</p>
    
    <p style="background: #F7F7F7; padding: 15px; border-radius: 8px; font-size: 14px; color: #6D6D6D;">
      💡 <strong>Tip:</strong> Mantente al día con las últimas actualizaciones para aprovechar al máximo las herramientas del portal.
    </p>
  `;

  const html = BaseEmailTemplate({
    preheader: `Guía actualizada: ${guideTitle}`,
    title: 'Guías actualizadas',
    content,
    ctaText: 'Ver guía actualizada',
    ctaUrl: deepLink,
    footerText: 'Portal Líderes - Guías'
  });

  return {
    subject: `Guía actualizada: ${guideTitle}`,
    html
  };
}
