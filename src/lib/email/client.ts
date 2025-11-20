/**
 * Email Client - Resend
 * Configuración centralizada para envío de emails
 */

import { Resend } from 'resend';

// Cliente singleton de Resend (lazy initialization)
let resendInstance: Resend | null = null;

function getResendClient(): Resend {
  if (!resendInstance) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY no está configurada en las variables de entorno');
    }
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

// Configuración por defecto
export const EMAIL_CONFIG = {
  from: process.env.RESEND_FROM_EMAIL || 'Líderes en Seguros <contacto@lideresenseguros.com>',
  replyTo: process.env.RESEND_REPLY_TO || 'contacto@lideresenseguros.com',
  
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
 * Función helper para enviar emails
 */
export async function sendEmail(options: SendEmailOptions) {
  try {
    const resend = getResendClient();
    const result = await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo || EMAIL_CONFIG.replyTo,
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Error enviando email:', error);
    return { success: false, error };
  }
}
