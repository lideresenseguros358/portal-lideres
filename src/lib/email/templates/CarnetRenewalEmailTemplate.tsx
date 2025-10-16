/**
 * Carnet Renewal Email Template
 * Email de notificación para renovación de carnet del corredor
 */

import { EMAIL_CONFIG } from '../client';

export interface CarnetRenewalEmailData {
  brokerName: string;
  brokerEmail: string;
  expiryDate: string;
  daysUntilExpiry: number;
  urgency: 'critical' | 'warning' | 'expired';
}

function buildCarnetEmailHtml(data: CarnetRenewalEmailData): string {
  const { colors, baseUrl } = EMAIL_CONFIG;
  
  const getUrgencyColor = () => {
    switch (data.urgency) {
      case 'critical':
        return '#EF4444';
      case 'warning':
        return '#F59E0B';
      case 'expired':
        return '#DC2626';
      default:
        return '#F59E0B';
    }
  };

  const getUrgencyIcon = () => {
    switch (data.urgency) {
      case 'critical':
        return '🚨';
      case 'warning':
        return '⚠️';
      case 'expired':
        return '❌';
      default:
        return '⚠️';
    }
  };

  const getTitle = () => {
    if (data.daysUntilExpiry < 0) {
      return 'Carnet Vencido - Acción Requerida';
    } else if (data.daysUntilExpiry === 0) {
      return 'Tu Carnet Vence Hoy';
    } else if (data.daysUntilExpiry <= 30) {
      return 'Renovación de Carnet Próxima';
    } else {
      return 'Renovación de Carnet - 60 Días';
    }
  };

  const getMessage = () => {
    if (data.daysUntilExpiry < 0) {
      const daysExpired = Math.abs(data.daysUntilExpiry);
      return `Tu carnet venció hace ${daysExpired} día${daysExpired !== 1 ? 's' : ''}. Es necesario renovarlo inmediatamente para continuar operando.`;
    } else if (data.daysUntilExpiry === 0) {
      return 'Tu carnet vence hoy. Es urgente que inicies el proceso de renovación.';
    } else if (data.daysUntilExpiry <= 30) {
      return `Tu carnet vencerá en ${data.daysUntilExpiry} día${data.daysUntilExpiry !== 1 ? 's' : ''}. Te recomendamos iniciar el proceso de renovación lo antes posible.`;
    } else {
      return `Tu carnet vencerá en ${data.daysUntilExpiry} días. Este es un recordatorio anticipado para que planifiques tu renovación.`;
    }
  };

  const urgencyColor = getUrgencyColor();
  const urgencyIcon = getUrgencyIcon();
  const title = getTitle();
  const message = getMessage();

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${colors.backgroundAlt}; color: ${colors.text}; line-height: 1.6;">
  <div style="width: 100%; background-color: ${colors.backgroundAlt}; padding: 40px 20px;">
    <div style="max-width: 600px; margin: 0 auto; background-color: ${colors.background}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%); padding: 32px 24px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 12px;">
          ${urgencyIcon}
        </div>
        <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff;">
          ${title}
        </h1>
      </div>

      <!-- Content -->
      <div style="padding: 32px 24px;">
        <p style="font-size: 16px; margin-bottom: 24px; color: ${colors.text};">
          Hola <strong>${data.brokerName}</strong>,
        </p>

        <!-- Urgency Banner -->
        <div style="background-color: ${urgencyColor}15; border-left: 4px solid ${urgencyColor}; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
          <p style="margin: 0; font-size: 15px; color: ${colors.text}; font-weight: 500;">
            ${message}
          </p>
        </div>

        <!-- Carnet Details -->
        <div style="background-color: ${colors.backgroundAlt}; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 12px 0; font-size: 14px; color: ${colors.textLight}; border-bottom: 1px solid ${colors.backgroundAlt};">
                Corredor:
              </td>
              <td style="padding: 12px 0; font-size: 15px; font-weight: 600; text-align: right; color: ${colors.text}; border-bottom: 1px solid ${colors.backgroundAlt};">
                ${data.brokerName}
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0; font-size: 14px; color: ${colors.textLight}; border-bottom: 1px solid ${colors.backgroundAlt};">
                Email:
              </td>
              <td style="padding: 12px 0; font-size: 15px; font-weight: 600; text-align: right; color: ${colors.text}; border-bottom: 1px solid ${colors.backgroundAlt};">
                ${data.brokerEmail}
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0; font-size: 14px; color: ${colors.textLight};">
                Fecha de Vencimiento:
              </td>
              <td style="padding: 12px 0; font-size: 16px; font-weight: 700; text-align: right; color: ${urgencyColor};">
                ${data.expiryDate}
              </td>
            </tr>
          </table>
        </div>

        <!-- Action Required -->
        <div style="background-color: #FFF9E6; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 700; color: ${colors.primary};">
            📋 Pasos para Renovar tu Carnet:
          </h3>
          <ol style="margin: 0; padding-left: 20px; color: ${colors.text}; font-size: 14px;">
            <li style="margin-bottom: 8px;">Contacta a la Superintendencia de Seguros y Reaseguros de Panamá</li>
            <li style="margin-bottom: 8px;">Prepara la documentación requerida</li>
            <li style="margin-bottom: 8px;">Realiza el pago correspondiente</li>
            <li style="margin-bottom: 8px;">Actualiza la fecha en el sistema una vez renovado</li>
          </ol>
        </div>

        <!-- CTA Button -->
        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${baseUrl}/account" style="display: inline-block; padding: 14px 32px; background-color: ${colors.secondary}; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600; box-shadow: 0 4px 12px rgba(138, 170, 25, 0.3);">
            Ir a Mi Cuenta
          </a>
        </div>

        <p style="font-size: 14px; color: ${colors.textLight}; text-align: center; margin: 0;">
          Para cualquier duda, contacta al administrador del sistema.
        </p>
      </div>

      <!-- Footer -->
      <div style="background-color: ${colors.backgroundAlt}; padding: 24px; text-align: center; border-top: 1px solid ${colors.backgroundAlt};">
        <p style="margin: 0 0 8px 0; font-size: 12px; color: ${colors.textLight};">
          Este es un mensaje automático del Portal Líderes en Seguros
        </p>
        <p style="margin: 0; font-size: 11px; color: ${colors.textLight};">
          © 2025 Líderes en Seguros | Regulado y Supervisado por la Superintendencia de Seguros y Reaseguros de Panamá
        </p>
      </div>
      
    </div>
  </div>
</body>
</html>
  `;
}

export function getCarnetRenewalEmailContent(data: CarnetRenewalEmailData): { subject: string; html: string } {
  const subject = data.daysUntilExpiry < 0
    ? `🚨 URGENTE: Tu Carnet ha Vencido`
    : data.daysUntilExpiry === 0
    ? `⚠️ Tu Carnet Vence HOY - ${data.brokerName}`
    : data.daysUntilExpiry <= 30
    ? `⚠️ Renovación de Carnet en ${data.daysUntilExpiry} días - ${data.brokerName}`
    : `📋 Recordatorio: Renovación de Carnet en ${data.daysUntilExpiry} días`;

  const html = buildCarnetEmailHtml(data);

  return { subject, html };
}
