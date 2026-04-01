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
  ramo?: string;   // 'AUTO' | 'VIDA' | 'INCENDIO' | 'CONTENIDO' | 'SALUD'
  stage?: 1 | 2;   // 1 = first email (1h), 2 = second email (24h)
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

function ramoConfig(ramo?: string): { emoji: string; productLabel: string; ctaLabel: string; reasons: { icon: string; bold: string; text: string }[] } {
  const r = (ramo || 'AUTO').toUpperCase();
  if (r === 'VIDA') return {
    emoji: '💚', productLabel: 'seguro de vida',
    ctaLabel: 'Completar mi Seguro de Vida',
    reasons: [
      { icon: '🛡', bold: 'Protege a tu familia.', text: 'Un seguro de vida garantiza tranquilidad financiera para tus seres queridos.' },
      { icon: '📈', bold: 'Ahorro + protección.', text: 'Algunas pólizas combinan ahorro con cobertura, haciendo crecer tu dinero.' },
      { icon: '💰', bold: 'Cuanto antes, mejor precio.', text: 'Las primas son más bajas cuando contratas joven y sano.' },
      { icon: '⚡', bold: 'Proceso sencillo.', text: 'Completa tu solicitud en pocos minutos desde cualquier dispositivo.' },
    ],
  };
  if (r === 'INCENDIO') return {
    emoji: '🏠', productLabel: 'seguro de incendio',
    ctaLabel: 'Completar mi Seguro de Incendio',
    reasons: [
      { icon: '🔥', bold: 'Los siniestros no avisan.', text: 'Un incendio puede ocurrir en cualquier momento — protege tu patrimonio.' },
      { icon: '🏗', bold: 'Protege tu inversión.', text: 'Tu propiedad es uno de tus activos más valiosos.' },
      { icon: '💰', bold: 'Planes accesibles.', text: 'Coberturas adaptadas al valor de tu propiedad con primas competitivas.' },
      { icon: '⚡', bold: 'Cotización rápida.', text: 'Obtén tu póliza en minutos, sin complicaciones.' },
    ],
  };
  if (r === 'CONTENIDO') return {
    emoji: '🏡', productLabel: 'seguro de contenido/hogar',
    ctaLabel: 'Completar mi Seguro de Hogar',
    reasons: [
      { icon: '🛋', bold: 'Protege tus pertenencias.', text: 'Muebles, electrónicos y artículos valiosos merecen estar asegurados.' },
      { icon: '🔒', bold: 'Tranquilidad total.', text: 'Ante robo, incendio o daños, tu patrimonio estará cubierto.' },
      { icon: '💰', bold: 'Coberturas flexibles.', text: 'Elige el nivel de protección que se adapte a tus necesidades.' },
      { icon: '⚡', bold: 'Proceso 100% digital.', text: 'Sin papeleo innecesario, todo desde tu celular o computador.' },
    ],
  };
  if (r === 'SALUD') return {
    emoji: '🏥', productLabel: 'seguro de salud',
    ctaLabel: 'Completar mi Seguro de Salud',
    reasons: [
      { icon: '🩺', bold: 'Tu salud es lo primero.', text: 'Accede a los mejores médicos y hospitales cuando lo necesites.' },
      { icon: '💊', bold: 'Sin gastos inesperados.', text: 'Evita que una emergencia médica afecte tus finanzas.' },
      { icon: '💰', bold: 'Planes a tu medida.', text: 'Coberturas individuales y familiares con deducibles flexibles.' },
      { icon: '⚡', bold: 'Solicitud rápida.', text: 'Completa tu proceso en minutos y queda protegido de inmediato.' },
    ],
  };
  // Default: AUTO
  return {
    emoji: '🚗', productLabel: 'seguro de auto',
    ctaLabel: 'Completar mi Seguro',
    reasons: [
      { icon: '🛡', bold: 'Los accidentes no avisan.', text: 'Cada día sin seguro es un riesgo innecesario para ti y tu familia.' },
      { icon: '⚖', bold: 'Es obligatorio por ley.', text: 'En Panamá, circular sin seguro vigente puede resultar en multas y sanciones.' },
      { icon: '💰', bold: 'Planes de pago flexibles.', text: 'Paga en cómodas cuotas mensuales con tarjeta de crédito.' },
      { icon: '⚡', bold: 'Emisión en minutos.', text: 'Completa tu póliza 100% en línea, sin papeleo innecesario.' },
    ],
  };
}

export function buildAbandonmentRecoveryHtml(data: AbandonmentRecoveryData): string {
  const { colors, logoUrl, baseUrl } = EMAIL_CONFIG;
  const firstName = data.clientName?.split(' ')[0] || 'Estimado(a) cliente';
  const rc = ramoConfig(data.ramo);
  const coverageLabel = data.coverageType || rc.productLabel;
  const stepDesc = stepLabel(data.lastStep);
  const isStage2 = data.stage === 2;

  // Stage 2 uses more urgent messaging
  const titleText = isStage2
    ? `¡${firstName}, tu cotización está por expirar!`
    : `¡No dejes sin protección lo que más importa!`;
  const subtitleText = isStage2
    ? `Última oportunidad para completar tu ${rc.productLabel}`
    : `Tu cotización de ${rc.productLabel} está a un paso`;
  const preheaderText = isStage2
    ? `${firstName}, tu cotización de ${rc.productLabel} está a punto de vencer. Complétala ahora.`
    : `${firstName}, tu cotización de ${rc.productLabel} te espera. Protégete hoy.`;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>No olvides tu ${rc.productLabel}</title>
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
  <div class="preheader">${preheaderText}</div>

  <div class="email-wrapper">
    <div class="email-container">
      <!-- Header -->
      <div class="email-header">
        <img src="${logoUrl}" alt="Líderes en Seguros" class="email-logo">
      </div>

      <!-- Body -->
      <div class="email-body">
        <span class="brand-accent"></span>
        <h1 class="email-title">${titleText}</h1>
        <p class="email-subtitle">${subtitleText}</p>

        <div class="email-content">
          <p>Hola <strong>${firstName}</strong>,</p>

          ${isStage2
            ? `<p>Te escribimos nuevamente porque tu cotización de <strong>${coverageLabel}</strong> sigue disponible, pero <strong>no por mucho tiempo</strong>. Sabemos que la vida es ocupada, pero asegurarte solo toma unos minutos y la tranquilidad que obtienes no tiene precio.</p>`
            : `<p>Notamos que iniciaste el proceso de cotización de tu <strong>${coverageLabel}</strong> pero no pudiste completarlo. ¡No te preocupes! Tu información está guardada y puedes retomar donde lo dejaste.</p>`
          }

          <div class="highlight-box">
            <p><strong>Tu progreso:</strong> Llegaste hasta "${stepDesc}"</p>
            ${data.insurer ? `<p><strong>Aseguradora:</strong> ${data.insurer}</p>` : ''}
          </div>

          <div class="reasons-list">
            <h3>¿Por qué completar tu ${rc.productLabel} hoy?</h3>
            ${rc.reasons.map(r => `
            <div class="reason-item">
              <div class="reason-icon">${r.icon}</div>
              <div class="reason-text"><strong>${r.bold}</strong> ${r.text}</div>
            </div>`).join('')}
          </div>

          <div class="cta-section">
            <a href="${baseUrl}/cotizadores" class="cta-button">${rc.ctaLabel}</a>
            <p class="urgency-note">${isStage2 ? '¡No dejes pasar esta oportunidad!' : 'El proceso toma menos de 5 minutos'}</p>
          </div>

          <p style="font-size: 14px; color: ${colors.textLight};">¿Tienes dudas o necesitas orientación? <strong style="color: ${colors.primary};">Lissa</strong>, tu asesora virtual de Líderes en Seguros, está disponible 24/7 para responder todas tus preguntas y acompañarte durante el proceso.</p>
          <div style="text-align:center; margin: 20px 0 8px;">
            <a href="https://wa.me/50768339167" style="display:inline-flex;align-items:center;gap:8px;background:#25D366;color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:700;">
              💬 Chatear con Lissa
            </a>
          </div>
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
        <p>Tu aliado de confianza en protección</p>
        <p style="margin-top: 12px;">
          <a href="${baseUrl}/cotizadores">Cotizar Ahora</a> |
          <a href="https://wa.me/50768339167">WhatsApp</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}
