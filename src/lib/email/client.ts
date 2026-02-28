/**
 * Email Client — ZeptoMail REST API
 * ===================================
 * Configuración centralizada para envío de emails vía ZeptoMail REST API.
 * Todos los correos salen por portal@lideresenseguros.com
 */

const ZEPTO_API_URL = 'https://api.zeptomail.com/v1.1/email';

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
 * Función helper para enviar emails vía ZeptoMail REST API
 */
export async function sendEmail(options: SendEmailOptions) {
  try {
    const apiKey = process.env.ZEPTO_API_KEY || process.env.ZEPTO_SMTP_PASS || '';
    const sender = process.env.ZEPTO_SENDER || 'portal@lideresenseguros.com';
    const senderName = process.env.ZEPTO_SENDER_NAME || 'Líderes en Seguros';

    if (!apiKey) {
      console.error('[EMAIL-CLIENT] No ZEPTO_API_KEY configured');
      return { success: false, error: 'ZEPTO_API_KEY not configured' };
    }

    const toAddrs = Array.isArray(options.to) ? options.to : [options.to];
    const recipients = toAddrs.map(addr => ({
      email_address: { address: addr, name: addr },
    }));

    const ccRecipients = options.cc
      ? (Array.isArray(options.cc) ? options.cc : [options.cc]).map(addr => ({
          email_address: { address: addr, name: addr },
        }))
      : undefined;

    const bccRecipients = options.bcc
      ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]).map(addr => ({
          email_address: { address: addr, name: addr },
        }))
      : undefined;

    const body: Record<string, any> = {
      from: { address: sender, name: senderName },
      to: recipients,
      subject: options.subject,
      htmlbody: options.html,
      textbody: options.text || '',
    };

    if (ccRecipients && ccRecipients.length > 0) body.cc = ccRecipients;
    if (bccRecipients && bccRecipients.length > 0) body.bcc = bccRecipients;
    if (options.replyTo) body.reply_to = [{ address: options.replyTo }];

    const res = await fetch(ZEPTO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Zoho-encrtoken ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      const messageId = data?.data?.[0]?.message_id || data?.request_id || 'unknown';
      console.log(`[EMAIL-CLIENT] ✓ Sent via ZeptoMail API. MessageId: ${messageId}`);
      return { success: true, data: { id: messageId } };
    }

    const errText = await res.text();
    console.error(`[EMAIL-CLIENT] ZeptoMail API error (${res.status}):`, errText.substring(0, 300));
    return { success: false, error: `HTTP ${res.status}: ${errText.substring(0, 200)}` };
  } catch (error) {
    console.error('[EMAIL-CLIENT] Error enviando email vía ZeptoMail:', error);
    return { success: false, error };
  }
}
