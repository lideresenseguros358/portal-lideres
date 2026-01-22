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
  if (portalTransport) return portalTransport;

  portalTransport = nodemailer.createTransport({
    host: process.env.ZOHO_SMTP_HOST || 'smtppro.zoho.com',
    port: parseInt(process.env.ZOHO_SMTP_PORT || '465'),
    secure: process.env.ZOHO_SMTP_SECURE === 'true',
    auth: {
      user: process.env.ZOHO_SMTP_USER,
      pass: process.env.ZOHO_SMTP_PASS,
    },
  });

  return portalTransport;
}

/**
 * Crear transporte SMTP para TRAMITES
 */
function createTramitesTransport(): Transporter {
  if (tramitesTransport) return tramitesTransport;

  tramitesTransport = nodemailer.createTransport({
    host: process.env.ZOHO_SMTP_HOST || 'smtppro.zoho.com',
    port: parseInt(process.env.ZOHO_SMTP_PORT || '465'),
    secure: process.env.ZOHO_SMTP_SECURE === 'true',
    auth: {
      user: process.env.ZOHO_SMTP_USER_TRAMITES,
      pass: process.env.ZOHO_SMTP_PASS_TRAMITES,
    },
  });

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
    const transport = getTransport(type);
    await transport.verify();
    return true;
  } catch (error) {
    console.error(`[SMTP] Error verificando conexión ${type}:`, error);
    return false;
  }
}
