/**
 * ZOHO IMAP CONFIG — Tramites (Pendientes)
 * ==========================================
 * Validates and returns IMAP connection config
 * using ZOHO_IMAP_USER_TRAMITES / ZOHO_IMAP_PASS_TRAMITES env vars.
 *
 * Isolated from the portal@ config used by Operaciones (Renovaciones).
 */

import type { ZohoImapConfig } from './zohoImapConfig';

/**
 * Get validated Zoho IMAP config for tramites@lideresenseguros.com.
 * Throws with clear message if env vars are missing.
 */
export function getZohoImapConfigTramites(): ZohoImapConfig {
  const user = process.env.ZOHO_IMAP_USER_TRAMITES || '';
  const pass = process.env.ZOHO_IMAP_PASS_TRAMITES || '';

  const missing: string[] = [];
  if (!user) missing.push('ZOHO_IMAP_USER_TRAMITES');
  if (!pass) missing.push('ZOHO_IMAP_PASS_TRAMITES');

  if (missing.length > 0) {
    throw new Error(`[IMAP-CONFIG-TRAMITES] Missing env vars: ${missing.join(', ')}`);
  }

  return {
    host: 'imap.zoho.com',
    port: 993,
    secure: true,
    auth: { user, pass },
  };
}

/**
 * Check env status without throwing.
 */
export function checkImapEnvStatusTramites(): {
  configured: boolean;
  hasUser: boolean;
  hasPass: boolean;
  host: string;
  port: number;
} {
  return {
    configured: !!(process.env.ZOHO_IMAP_USER_TRAMITES && process.env.ZOHO_IMAP_PASS_TRAMITES),
    hasUser: !!process.env.ZOHO_IMAP_USER_TRAMITES,
    hasPass: !!process.env.ZOHO_IMAP_PASS_TRAMITES,
    host: 'imap.zoho.com',
    port: 993,
  };
}
