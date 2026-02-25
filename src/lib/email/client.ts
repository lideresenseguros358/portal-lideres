/**
 * Email Client - ZeptoMail SMTP
 * ==============================
 * Configuración centralizada para envío de emails vía ZeptoMail.
 * Todos los correos salen por portal@lideresenseguros.com vía ZeptoMail SMTP
 */

import { getTransport, getFromAddress } from '@/server/email/mailer';

// Configuración por defecto
export const EMAIL_CONFIG = {
  from: 'Líderes en Seguros <portal@lideresenseguros.com>',
  replyTo: 'portal@lideresenseguros.com',
  
  // URLs base para links y assets
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
  logoUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/logo.png`,
  
  // Colores corporativos
  colors: {
    primary: '#010139',   // Azul profundo
    secondary: '#8AAA19', // Oliva
    text: '#23262F',
    textLight: '#6D6D6D',
    background: '#FFFFFF',
    backgroundAlt: '#F7F7F7',
  }
} as const;

/**
 * Interfaz para opciones de email
 */
export interface SendEmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

/**
 * Función helper para enviar emails vía ZeptoMail SMTP
 */
export async function sendEmail(options: SendEmailOptions) {
  try {
    const transport = getTransport('PORTAL');
    const from = getFromAddress('PORTAL');

    const info = await transport.sendMail({
      from,
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo || EMAIL_CONFIG.replyTo,
    });

    return { success: true, data: { id: info.messageId } };
  } catch (error) {
    console.error('[EMAIL-CLIENT] Error enviando email vía ZeptoMail:', error);
    return { success: false, error };
  }
}
