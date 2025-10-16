/**
 * Base Email Template
 * Template HTML base para todos los emails con branding corporativo
 */

import { EMAIL_CONFIG } from '../client';

export interface BaseEmailProps {
  preheader?: string;
  title: string;
  content: string | React.ReactNode;
  ctaText?: string;
  ctaUrl?: string;
  footerText?: string;
}

export function BaseEmailTemplate({
  preheader,
  title,
  content,
  ctaText,
  ctaUrl,
  footerText = 'Portal Líderes - Sistema de Gestión de Seguros'
}: BaseEmailProps) {
  const { colors, logoUrl, baseUrl } = EMAIL_CONFIG;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: ${colors.backgroundAlt};
      color: ${colors.text};
      line-height: 1.6;
    }
    .email-wrapper {
      width: 100%;
      background-color: ${colors.backgroundAlt};
      padding: 20px 0;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: ${colors.background};
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(1, 1, 57, 0.1);
    }
    .email-header {
      background: linear-gradient(135deg, ${colors.primary} 0%, #020252 100%);
      padding: 30px 20px;
      text-align: center;
    }
    .email-logo {
      max-width: 180px;
      height: auto;
    }
    .email-body {
      padding: 40px 30px;
    }
    .email-title {
      font-size: 24px;
      font-weight: 700;
      color: ${colors.primary};
      margin: 0 0 20px 0;
      text-align: center;
    }
    .email-content {
      font-size: 16px;
      color: ${colors.text};
      margin: 20px 0;
    }
    .email-content p {
      margin: 15px 0;
    }
    .email-cta {
      text-align: center;
      margin: 30px 0;
    }
    .email-cta-button {
      display: inline-block;
      background-color: ${colors.secondary};
      color: ${colors.background} !important;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      transition: background-color 0.3s ease;
    }
    .email-cta-button:hover {
      background-color: #6f8815;
    }
    .email-footer {
      background-color: ${colors.backgroundAlt};
      padding: 25px 30px;
      text-align: center;
      font-size: 13px;
      color: ${colors.textLight};
    }
    .email-footer p {
      margin: 8px 0;
    }
    .email-footer a {
      color: ${colors.secondary};
      text-decoration: none;
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
      .email-body {
        padding: 25px 20px;
      }
      .email-title {
        font-size: 20px;
      }
      .email-content {
        font-size: 15px;
      }
      .email-cta-button {
        padding: 12px 24px;
        font-size: 15px;
      }
    }
  </style>
</head>
<body>
  ${preheader ? `<div class="preheader">${preheader}</div>` : ''}
  
  <div class="email-wrapper">
    <div class="email-container">
      <!-- Header -->
      <div class="email-header">
        <img src="${logoUrl}" alt="Portal Líderes" class="email-logo">
      </div>
      
      <!-- Body -->
      <div class="email-body">
        <h1 class="email-title">${title}</h1>
        <div class="email-content">
          ${typeof content === 'string' ? content : ''}
        </div>
        
        ${ctaText && ctaUrl ? `
        <div class="email-cta">
          <a href="${ctaUrl}" class="email-cta-button">${ctaText}</a>
        </div>
        ` : ''}
      </div>
      
      <!-- Footer -->
      <div class="email-footer">
        <p>${footerText}</p>
        <p>
          <a href="${baseUrl}">Portal Líderes</a> | 
          <a href="${baseUrl}/soporte">Soporte</a>
        </p>
        <p style="margin-top: 15px; font-size: 12px;">
          Este es un correo automático. Por favor no responder a este mensaje.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}
