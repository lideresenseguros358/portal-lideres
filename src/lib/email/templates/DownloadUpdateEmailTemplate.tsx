/**
 * Download Update Email Template
 * Template para notificación de documento actualizado en Descargas
 */

import { BaseEmailTemplate } from './BaseEmailTemplate';

export interface DownloadUpdateEmailData {
  userName: string;
  insurerName: string;
  docName: string;
  deepLink: string;
}

export function getDownloadUpdateEmailContent(data: DownloadUpdateEmailData): { subject: string; html: string } {
  const { userName, insurerName, docName, deepLink } = data;

  const content = `
    <p>Estimado/a <strong>${userName}</strong>,</p>
    <p>Te informamos que se ha actualizado un documento en la sección de <strong>Descargas</strong>.</p>
    
    <div style="background: #E8F5FD; padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 4px solid #2196F3;">
      <p style="margin: 0 0 15px 0; font-size: 18px; font-weight: 600; color: #010139;">
        📥 Documento Actualizado
      </p>
      <p style="margin: 5px 0;"><strong>Aseguradora:</strong> ${insurerName}</p>
      <p style="margin: 5px 0;"><strong>Documento:</strong> ${docName}</p>
    </div>
    
    <p>Ve a la sección de <strong>Descargas</strong> para obtener la última versión del documento.</p>
    
    <p style="background: #F7F7F7; padding: 15px; border-radius: 8px; font-size: 14px; color: #6D6D6D;">
      💡 <strong>Tip:</strong> Asegúrate de descargar la versión más reciente para tener la información actualizada.
    </p>
  `;

  const html = BaseEmailTemplate({
    preheader: `Documento actualizado: ${docName} - ${insurerName}`,
    title: `Descargas actualizadas en ${insurerName}`,
    content,
    ctaText: 'Ir a Descargas',
    ctaUrl: deepLink,
    footerText: 'Portal Líderes - Descargas'
  });

  return {
    subject: `Descargas actualizadas: ${docName} - ${insurerName}`,
    html
  };
}
