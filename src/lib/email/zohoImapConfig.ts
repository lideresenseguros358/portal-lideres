/**
 * ZOHO IMAP CONFIG — Portal Renovaciones
 * ========================================
 * Validates and returns IMAP connection config
 * using ZOHO_IMAP_USER_PORTAL / ZOHO_IMAP_PASS_PORTAL env vars.
 */

export interface ZohoImapConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

/**
 * Get validated Zoho IMAP config.
 * Throws with clear message if env vars are missing.
 */
export function getZohoImapConfig(): ZohoImapConfig {
  const user = process.env.ZOHO_IMAP_USER_PORTAL || '';
  const pass = process.env.ZOHO_IMAP_PASS_PORTAL || '';

  const missing: string[] = [];
  if (!user) missing.push('ZOHO_IMAP_USER_PORTAL');
  if (!pass) missing.push('ZOHO_IMAP_PASS_PORTAL');

  if (missing.length > 0) {
    throw new Error(`[IMAP-CONFIG] Missing env vars: ${missing.join(', ')}`);
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
export function checkImapEnvStatus(): {
  configured: boolean;
  hasUser: boolean;
  hasPass: boolean;
  host: string;
  port: number;
} {
  return {
    configured: !!(process.env.ZOHO_IMAP_USER_PORTAL && process.env.ZOHO_IMAP_PASS_PORTAL),
    hasUser: !!process.env.ZOHO_IMAP_USER_PORTAL,
    hasPass: !!process.env.ZOHO_IMAP_PASS_PORTAL,
    host: 'imap.zoho.com',
    port: 993,
  };
}
