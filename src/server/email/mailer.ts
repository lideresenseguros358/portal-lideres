/**
 * NODEMAILER TRANSPORTS - ZEPTOMAIL SMTP
 * =======================================
 * Todos los correos salen vía ZeptoMail SMTP desde portal@lideresenseguros.com
 * Se mantiene la API dual (PORTAL/TRAMITES) por compatibilidad, pero ambos
 * usan el mismo transporte Zepto.
 * 
 * Configuración ZeptoMail:
 * - Host: smtp.zeptomail.com
 * - Port: 465 (SSL)
 * - User: emailapikey
 * - Pass: (API key de ZeptoMail)
 * - From: portal@lideresenseguros.com
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

let zeptoTransport: Transporter | null = null;

/**
 * Crear transporte SMTP ZeptoMail (singleton)
 */
function createZeptoTransport(): Transporter {
  if (zeptoTransport) {
    return zeptoTransport;
  }

  const host = process.env.ZEPTO_SMTP_HOST || 'smtp.zeptomail.com';
  const port = parseInt(process.env.ZEPTO_SMTP_PORT || '465');
  const secure = port === 465;
  const user = process.env.ZEPTO_SMTP_USER;
  const pass = process.env.ZEPTO_SMTP_PASS;

  console.log('[SMTP-ZEPTO] Creando transporte ZeptoMail');
  console.log('[SMTP-ZEPTO] Host:', host);
  console.log('[SMTP-ZEPTO] Port:', port);
  console.log('[SMTP-ZEPTO] Secure:', secure);
  console.log('[SMTP-ZEPTO] User:', user ? '✓ Configurado' : '✗ NO configurado');
  console.log('[SMTP-ZEPTO] Pass:', pass ? '✓ Configurado' : '✗ NO configurado');

  if (!user || !pass) {
    console.error('[SMTP-ZEPTO] ✗ ZEPTO_SMTP_USER o ZEPTO_SMTP_PASS no configurados');
  }

  zeptoTransport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    // ZeptoMail requiere TLS 1.2+
    tls: {
      minVersion: 'TLSv1.2',
    },
    logger: process.env.NODE_ENV === 'development',
    debug: process.env.NODE_ENV === 'development',
  });

  console.log('[SMTP-ZEPTO] ✓ Transporte creado exitosamente');
  return zeptoTransport;
}

/**
 * Obtener transporte según tipo
 * Ambos tipos usan ZeptoMail — se mantiene la firma por compatibilidad
 */
export function getTransport(type: 'PORTAL' | 'TRAMITES'): Transporter {
  return createZeptoTransport();
}

/**
 * Obtener dirección FROM según tipo
 * ZeptoMail: todos los correos salen desde portal@lideresenseguros.com
 */
export function getFromAddress(type: 'PORTAL' | 'TRAMITES'): string {
  return 'Líderes en Seguros <portal@lideresenseguros.com>';
}

/**
 * Verificar conexión SMTP
 */
export async function verifyConnection(type: 'PORTAL' | 'TRAMITES'): Promise<boolean> {
  try {
    console.log(`[SMTP-ZEPTO] Verificando conexión (${type})...`);
    const transport = getTransport(type);
    await transport.verify();
    console.log(`[SMTP-ZEPTO] ✓ Conexión verificada exitosamente`);
    return true;
  } catch (error: any) {
    console.error(`[SMTP-ZEPTO] ✗ Error verificando conexión:`, {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    });
    return false;
  }
}

/**
 * Resetear transporte (útil para tests o reconexión)
 */
export function resetTransport(): void {
  if (zeptoTransport) {
    zeptoTransport.close();
    zeptoTransport = null;
    console.log('[SMTP-ZEPTO] Transporte reseteado');
  }
}
