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
      animation: shimmer 8s infinite;
    }
    @keyframes shimmer {
      0%, 100% { transform: translate(-50%, -50%) rotate(0deg); }
      50% { transform: translate(-30%, -30%) rotate(180deg); }
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
      font-size: 28px;
      font-weight: 700;
      color: ${colors.primary};
      margin: 0 0 24px 0;
      text-align: center;
      line-height: 1.3;
      letter-spacing: -0.5px;
    }
    .email-brand-accent {
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
      margin: 24px 0;
      line-height: 1.7;
    }
    .email-content p {
      margin: 16px 0;
    }
    .email-content strong {
      color: ${colors.primary};
      font-weight: 600;
    }
    .email-cta {
      text-align: center;
      margin: 36px 0;
    }
    .email-cta-button {
      display: inline-block;
      background: linear-gradient(135deg, ${colors.secondary} 0%, #6f8815 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 16px 40px;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(138, 170, 25, 0.3);
      transition: all 0.3s ease;
    }
    .email-cta-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(138, 170, 25, 0.4);
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
    .email-footer a:hover {
      color: ${colors.primary};
    }
    .email-footer-brand {
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
      .email-wrapper {
        padding: 15px 0;
      }
      .email-header {
        padding: 30px 20px;
      }
      .email-body {
        padding: 30px 20px;
      }
      .email-title {
        font-size: 22px;
      }
      .email-content {
        font-size: 15px;
      }
      .email-cta-button {
        padding: 14px 28px;
        font-size: 15px;
      }
      .email-logo {
        max-width: 160px;
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
        <span class="email-brand-accent"></span>
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
        <p class="email-footer-brand">Líderes en Seguros</p>
        <p>${footerText}</p>
        <p style="margin-top: 12px;">
          <a href="${baseUrl}">Portal Web</a> | 
          <a href="${baseUrl}/soporte">Soporte Técnico</a>
        </p>
        <p style="margin-top: 16px; font-size: 12px; color: #999;">
          Este es un correo automático generado por el Portal Líderes.<br>
          Por favor no responder directamente a este mensaje.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}
