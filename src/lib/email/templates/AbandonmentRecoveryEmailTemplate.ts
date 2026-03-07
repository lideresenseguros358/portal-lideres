/**
 * Abandonment Recovery Email Template
 * Branded email sent to clients who abandoned the auto insurance quote/emission process.
 */

import { EMAIL_CONFIG } from '../client';

export interface AbandonmentRecoveryData {
  clientName: string;
  coverageType?: string; // 'Daños a Terceros' | 'Cobertura Completa'
  insurer?: string;
  lastStep?: string;
  quoteRef?: string;
}

/**
 * Step label in Spanish for the abandonment email
 */
function stepLabel(step: string | undefined): string {
  const map: Record<string, string> = {
    'payment': 'Selección de plan de pago',
    'emission-data': 'Datos personales',
    'vehicle': 'Datos del vehículo',
    'inspection': 'Inspección vehicular',
    'payment-info': 'Información de pago',
    'review': 'Revisión final',
    'emitir': 'Proceso de emisión',
    'inicio': 'Inicio del proceso',
  };
  return map[step || ''] || step || 'el proceso de cotización';
}

export function buildAbandonmentRecoveryHtml(data: AbandonmentRecoveryData): string {
  const { colors, logoUrl, baseUrl } = EMAIL_CONFIG;
  const firstName = data.clientName?.split(' ')[0] || 'Estimado(a) cliente';
  const coverageLabel = data.coverageType || 'Auto';
  const stepDesc = stepLabel(data.lastStep);

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>No olvides tu póliza de auto</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f0f2f5;
      color: ${colors.text};
      line-height: 1.6;
    }
    .email-wrapper {
      width: 100%;
      background-color: #f0f2f5;
      padding: 30px 0;
    }
    .email-container {
      max-width: 650px;
      margin: 0 auto;
      background-color: ${colors.background};
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(1, 1, 57, 0.12);
    }
    .email-header {
      background: linear-gradient(135deg, ${colors.primary} 0%, #001a4d 100%);
      padding: 40px 30px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .email-header::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
    }
    .email-logo {
      max-width: 200px;
      height: auto;
      position: relative;
      z-index: 1;
      filter: brightness(0) invert(1);
    }
    .email-body {
      padding: 45px 35px;
      background-color: #ffffff;
    }
    .email-title {
      font-size: 26px;
      font-weight: 700;
      color: ${colors.primary};
      margin: 0 0 8px 0;
      text-align: center;
      line-height: 1.3;
      letter-spacing: -0.5px;
    }
    .email-subtitle {
      font-size: 16px;
      color: ${colors.textLight};
      text-align: center;
      margin: 0 0 28px 0;
    }
    .brand-accent {
      display: block;
      width: 60px;
      height: 4px;
      background: linear-gradient(90deg, ${colors.secondary} 0%, ${colors.primary} 100%);
      margin: 0 auto 24px auto;
      border-radius: 2px;
    }
    .email-content {
      font-size: 16px;
      color: ${colors.text};
      line-height: 1.7;
    }
    .email-content p {
      margin: 16px 0;
    }
    .highlight-box {
      background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
      border-left: 4px solid #f59e0b;
      border-radius: 8px;
      padding: 20px 24px;
      margin: 24px 0;
    }
    .highlight-box p {
      margin: 4px 0;
      font-size: 15px;
    }
    .highlight-box strong {
      color: ${colors.primary};
    }
    .reasons-list {
      background-color: ${colors.backgroundAlt};
      border-radius: 12px;
      padding: 24px 28px;
      margin: 24px 0;
    }
    .reasons-list h3 {
      font-size: 17px;
      color: ${colors.primary};
      margin: 0 0 16px 0;
    }
    .reason-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin: 12px 0;
    }
    .reason-icon {
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      background: linear-gradient(135deg, ${colors.secondary}, #6f8815);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 14px;
      font-weight: 700;
      line-height: 1;
    }
    .reason-text {
      font-size: 15px;
      color: ${colors.text};
      line-height: 1.5;
    }
    .reason-text strong {
      color: ${colors.primary};
    }
    .cta-section {
      text-align: center;
      margin: 36px 0;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, ${colors.secondary} 0%, #6f8815 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 16px 48px;
      border-radius: 10px;
      font-size: 17px;
      font-weight: 700;
      box-shadow: 0 4px 12px rgba(138, 170, 25, 0.3);
      letter-spacing: 0.5px;
    }
    .urgency-note {
      text-align: center;
      font-size: 13px;
      color: ${colors.textLight};
      margin-top: 12px;
    }
    .email-footer {
      background: linear-gradient(135deg, #f7f7f7 0%, #e8e8e8 100%);
      padding: 30px 35px;
      text-align: center;
      font-size: 13px;
      color: ${colors.textLight};
      border-top: 3px solid ${colors.secondary};
    }
    .email-footer p {
      margin: 10px 0;
    }
    .email-footer a {
      color: ${colors.secondary};
      text-decoration: none;
      font-weight: 600;
    }
    .footer-brand {
      font-weight: 700;
      color: ${colors.primary};
      font-size: 14px;
    }
    .preheader {
      display: none;
      max-width: 0;
      max-height: 0;
      overflow: hidden;
      font-size: 1px;
      line-height: 1px;
      color: ${colors.background};
      opacity: 0;
    }
    @media only screen and (max-width: 600px) {
      .email-wrapper { padding: 15px 0; }
      .email-header { padding: 30px 20px; }
      .email-body { padding: 30px 20px; }
      .email-title { font-size: 22px; }
      .email-content { font-size: 15px; }
      .cta-button { padding: 14px 28px; font-size: 15px; }
      .email-logo { max-width: 160px; }
    }
  </style>
</head>
<body>
  <div class="preheader">${firstName}, tu cotización de seguro de auto te espera. Los accidentes no avisan — protege tu vehículo hoy.</div>

  <div class="email-wrapper">
    <div class="email-container">
      <!-- Header -->
      <div class="email-header">
        <img src="${logoUrl}" alt="Líderes en Seguros" class="email-logo">
      </div>

      <!-- Body -->
      <div class="email-body">
        <span class="brand-accent"></span>
        <h1 class="email-title">¡No dejes tu vehículo sin protección!</h1>
        <p class="email-subtitle">Tu cotización de seguro de auto está a un paso</p>

        <div class="email-content">
          <p>Hola <strong>${firstName}</strong>,</p>

          <p>Notamos que iniciaste el proceso de cotización de tu seguro de <strong>${coverageLabel}</strong> pero no pudiste completarlo. ¡No te preocupes! Tu información está guardada y puedes retomar donde lo dejaste.</p>

          <div class="highlight-box">
            <p><strong>Tu progreso:</strong> Llegaste hasta "${stepDesc}"</p>
            ${data.insurer ? `<p><strong>Aseguradora:</strong> ${data.insurer}</p>` : ''}
          </div>

          <div class="reasons-list">
            <h3>¿Por qué completar tu seguro hoy?</h3>

            <div class="reason-item">
              <div class="reason-icon">🛡</div>
              <div class="reason-text"><strong>Los accidentes no avisan.</strong> Cada día sin seguro es un riesgo innecesario para ti y tu familia.</div>
            </div>

            <div class="reason-item">
              <div class="reason-icon">⚖</div>
              <div class="reason-text"><strong>Es obligatorio por ley.</strong> En Panamá, circular sin seguro vigente puede resultar en multas y sanciones.</div>
            </div>

            <div class="reason-item">
              <div class="reason-icon">💰</div>
              <div class="reason-text"><strong>Planes de pago flexibles.</strong> Paga en cómodas cuotas mensuales con tarjeta de crédito.</div>
            </div>

            <div class="reason-item">
              <div class="reason-icon">⚡</div>
              <div class="reason-text"><strong>Emisión en minutos.</strong> Completa tu póliza 100% en línea, sin papeleo innecesario.</div>
            </div>
          </div>

          <div class="cta-section">
            <a href="${baseUrl}/cotizadores" class="cta-button">Completar mi Seguro</a>
            <p class="urgency-note">El proceso toma menos de 5 minutos</p>
          </div>

          <p style="font-size: 14px; color: ${colors.textLight};">Si tienes alguna duda o necesitas asesoría personalizada, no dudes en contactarnos. Nuestro equipo está listo para ayudarte a encontrar la mejor cobertura para tu vehículo.</p>
        </div>
      </div>

      <!-- Regulatory Footer -->
      <div style="background:#010139;padding:20px 35px;text-align:center;">
        <p style="margin:0 0 8px;font-size:11px;color:#9ca3af;line-height:1.5;">
          Regulado y Supervisado por la Superintendencia de Seguros y Reaseguros de Panamá | Licencia PJ750
        </p>
        <img src="${baseUrl}/aseguradoras/logo-SSRP.png" alt="SSRP" width="100" height="auto" style="display:inline-block;max-width:100px;opacity:0.85;" />
      </div>

      <!-- Informational Footer -->
      <div class="email-footer">
        <p class="footer-brand">Líderes en Seguros, S.A.</p>
        <p>Tu aliado de confianza en protección vehicular</p>
        <p style="margin-top: 12px;">
          <a href="${baseUrl}/cotizadores">Cotizar Ahora</a> |
          <a href="https://wa.me/50760001234">WhatsApp</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}
