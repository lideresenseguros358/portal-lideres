/**
 * Input Sanitization & Validation Utilities
 * ==========================================
 * Central security library for all input handling.
 * Used by public endpoints, webhooks, and API routes.
 */

// ── HTML Entity Escaping (XSS Prevention) ──

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#96;',
};

/**
 * Escape HTML special characters to prevent XSS.
 * Use this whenever inserting user-controlled data into HTML responses.
 */
export function escapeHtml(str: string): string {
  return str.replace(/[&<>"'`/]/g, (char) => HTML_ESCAPE_MAP[char] || char);
}

// ── Input Sanitization ──

/**
 * Strip potentially dangerous characters from a general text input.
 * Removes null bytes, control characters (except newlines/tabs).
 */
export function sanitizeText(input: string, maxLength: number = 5000): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/\0/g, '')                    // null bytes
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // control chars (keep \n \r \t)
    .slice(0, maxLength)
    .trim();
}

/**
 * Validate and sanitize a cédula (Panamanian national ID).
 * Format: digits, hyphens, optional letters. Max 20 chars.
 */
export function sanitizeCedula(input: string): string | null {
  if (typeof input !== 'string') return null;
  const cleaned = input.trim().replace(/\s+/g, '');
  // Allow digits, hyphens, and letters (PE-, E-, N-, AV-, PI- prefixes)
  if (!/^[A-Za-z0-9\-]{3,20}$/.test(cleaned)) return null;
  return cleaned;
}

/**
 * Validate a UUID v4 format string.
 */
export function isValidUUID(input: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input);
}

/**
 * Validate an E.164 phone number.
 */
export function isValidPhone(input: string): boolean {
  return /^\+?[1-9]\d{6,14}$/.test(input.replace(/\s/g, ''));
}

/**
 * Validate email format (basic).
 */
export function isValidEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input) && input.length <= 254;
}

/**
 * Sanitize a URL to prevent open redirect attacks.
 * Only allows relative paths or URLs matching allowed origins.
 */
export function sanitizeRedirectUrl(
  url: string,
  allowedOrigins: string[] = [],
): string | null {
  // Allow relative paths starting with /
  if (url.startsWith('/') && !url.startsWith('//')) {
    // Block path traversal
    if (url.includes('..') || url.includes('\\')) return null;
    return url;
  }

  // Check against allowed origins
  try {
    const parsed = new URL(url);
    const isAllowed = allowedOrigins.some(
      (origin) => parsed.origin.toLowerCase() === origin.toLowerCase(),
    );
    return isAllowed ? url : null;
  } catch {
    return null;
  }
}

// ── SQL Injection Prevention ──

/**
 * Validate that a string contains only safe characters for use as
 * a column name or identifier. NEVER use user input as SQL identifiers
 * without this check.
 */
export function isSafeIdentifier(input: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/.test(input);
}

// ── Request Validation Helpers ──

/**
 * Validate a JSON body has exactly the expected shape.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateRequiredFields(
  body: Record<string, any>,
  fields: { name: string; type: 'string' | 'number' | 'boolean' | 'array' | 'object'; maxLength?: number }[],
): string | null {
  for (const field of fields) {
    const value = body[field.name];
    if (value === undefined || value === null) {
      return `Campo requerido: ${field.name}`;
    }
    if (field.type === 'array') {
      if (!Array.isArray(value)) return `${field.name} debe ser un array`;
    } else if (field.type === 'object') {
      if (typeof value !== 'object' || Array.isArray(value)) return `${field.name} debe ser un objeto`;
    } else if (typeof value !== field.type) {
      return `${field.name} debe ser de tipo ${field.type}`;
    }
    if (field.type === 'string' && field.maxLength && (value as string).length > field.maxLength) {
      return `${field.name} excede largo máximo de ${field.maxLength}`;
    }
  }
  return null;
}

// ── SSRF Prevention ──

/**
 * Validate a URL is not pointing to internal/private networks.
 */
export function isExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Block private/internal ranges
    const blocked = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '169.254.169.254', // AWS metadata
      'metadata.google.internal',
    ];
    if (blocked.includes(hostname)) return false;
    if (hostname.startsWith('10.')) return false;
    if (hostname.startsWith('192.168.')) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return false;
    if (hostname.endsWith('.internal') || hostname.endsWith('.local')) return false;

    // Only allow http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;

    return true;
  } catch {
    return false;
  }
}
