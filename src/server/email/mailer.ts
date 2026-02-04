/**
 * NODEMAILER TRANSPORTS - DUAL SMTP
 * ==================================
 * Dos transportes separados para PORTAL y TRAMITES
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

let portalTransport: Transporter | null = null;
let tramitesTransport: Transporter | null = null;

/**
 * Crear transporte SMTP para PORTAL
 */
function createPortalTransport(): Transporter {
  if (portalTransport) {
    console.log('[SMTP-PORTAL] Reutilizando transporte existente');
    return portalTransport;
  }

  console.log('[SMTP-PORTAL] Creando nuevo transporte SMTP');
  const port = parseInt(process.env.ZOHO_SMTP_PORT || '465');
  const secure = port === 465; // Puerto 465 SIEMPRE requiere secure: true
  
  console.log('[SMTP-PORTAL] Host:', process.env.ZOHO_SMTP_HOST || 'smtppro.zoho.com');
  console.log('[SMTP-PORTAL] Port:', port);
  console.log('[SMTP-PORTAL] Secure:', secure);
  console.log('[SMTP-PORTAL] User:', process.env.ZOHO_SMTP_USER_PORTAL ? '✓ Configurado' : '✗ NO configurado');
  console.log('[SMTP-PORTAL] Pass:', process.env.ZOHO_SMTP_PASS_PORTAL ? '✓ Configurado' : '✗ NO configurado');

  portalTransport = nodemailer.createTransport({
    host: process.env.ZOHO_SMTP_HOST || 'smtppro.zoho.com',
    port,
    secure,
    auth: {
      user: process.env.ZOHO_SMTP_USER_PORTAL,
      pass: process.env.ZOHO_SMTP_PASS_PORTAL,
    },
    logger: true,
    debug: process.env.NODE_ENV === 'development',
  });

  console.log('[SMTP-PORTAL] Transporte creado exitosamente');
  return portalTransport;
}

/**
 * Crear transporte SMTP para TRAMITES
 */
function createTramitesTransport(): Transporter {
  if (tramitesTransport) {
    console.log('[SMTP-TRAMITES] Reutilizando transporte existente');
    return tramitesTransport;
  }

  console.log('[SMTP-TRAMITES] Creando nuevo transporte SMTP');
  const port = parseInt(process.env.ZOHO_SMTP_PORT || '465');
  const secure = port === 465; // Puerto 465 SIEMPRE requiere secure: true
  
  console.log('[SMTP-TRAMITES] Host:', process.env.ZOHO_SMTP_HOST || 'smtppro.zoho.com');
  console.log('[SMTP-TRAMITES] Port:', port);
  console.log('[SMTP-TRAMITES] Secure:', secure);
  console.log('[SMTP-TRAMITES] User:', process.env.ZOHO_SMTP_USER_TRAMITES ? '✓ Configurado' : '✗ NO configurado');
  console.log('[SMTP-TRAMITES] Pass:', process.env.ZOHO_SMTP_PASS_TRAMITES ? '✓ Configurado' : '✗ NO configurado');

  tramitesTransport = nodemailer.createTransport({
    host: process.env.ZOHO_SMTP_HOST || 'smtppro.zoho.com',
    port,
    secure,
    auth: {
      user: process.env.ZOHO_SMTP_USER_TRAMITES,
      pass: process.env.ZOHO_SMTP_PASS_TRAMITES,
    },
    logger: true,
    debug: process.env.NODE_ENV === 'development',
  });

  console.log('[SMTP-TRAMITES] Transporte creado exitosamente');
  return tramitesTransport;
}

/**
 * Obtener transporte según tipo
 */
export function getTransport(type: 'PORTAL' | 'TRAMITES'): Transporter {
  if (type === 'PORTAL') {
    return createPortalTransport();
  } else {
    return createTramitesTransport();
  }
}

/**
 * Obtener dirección FROM según tipo
 */
export function getFromAddress(type: 'PORTAL' | 'TRAMITES'): string {
  if (type === 'PORTAL') {
    return process.env.EMAIL_FROM_PORTAL || 'Líderes en Seguros <portal@lideresenseguros.com>';
  } else {
    return process.env.EMAIL_FROM_TRAMITES || 'Líderes en Seguros <tramites@lideresenseguros.com>';
  }
}

/**
 * Verificar conexión SMTP
 */
export async function verifyConnection(type: 'PORTAL' | 'TRAMITES'): Promise<boolean> {
  try {
    console.log(`[SMTP-${type}] Verificando conexión...`);
    const transport = getTransport(type);
    await transport.verify();
    console.log(`[SMTP-${type}] ✓ Conexión verificada exitosamente`);
    return true;
  } catch (error: any) {
    console.error(`[SMTP-${type}] ✗ Error verificando conexión:`, {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    });
    return false;
  }
}
