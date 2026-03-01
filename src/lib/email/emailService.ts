/**
 * CENTRALIZED EMAIL SERVICE
 * =========================
 * Single entry point for sending emails in the portal.
 * Forces Zepto API in production, validates env vars strictly.
 *
 * Usage:
 *   import { emailService } from '@/lib/email/emailService';
 *   const result = await emailService.send({ to, subject, html });
 */

const ZEPTO_API_URL = 'https://api.zeptomail.com/v1.1/email';
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1_000;

export interface EmailSendParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface EmailSendResult {
  success: boolean;
  provider: 'zepto-api' | 'none';
  messageId?: string;
  error?: string;
  error_code?: string;
  vercel_env?: string;
  debug?: Record<string, any>;
}

export interface EmailEnvStatus {
  configured: boolean;
  provider: 'zepto-api' | 'none';
  vercel_env: string;
  hasApiKey: boolean;
  hasSender: boolean;
  hasSenderName: boolean;
  sender: string;
  senderName: string;
  apiUrl: string;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Validate that all required Zepto env vars are present.
 * Returns { valid, missing[] }.
 */
function validateEnv(): { valid: boolean; missing: string[] } {
  const required: Record<string, string | undefined> = {
    ZEPTO_API_KEY: process.env.ZEPTO_API_KEY,
    ZEPTO_SENDER: process.env.ZEPTO_SENDER,
    ZEPTO_SENDER_NAME: process.env.ZEPTO_SENDER_NAME,
  };

  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  return { valid: missing.length === 0, missing };
}

/**
 * Get environment status for debugging.
 */
function getEnvStatus(): EmailEnvStatus {
  const vercelEnv = process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown';
  const apiKey = process.env.ZEPTO_API_KEY || '';
  const sender = process.env.ZEPTO_SENDER || 'portal@lideresenseguros.com';
  const senderName = process.env.ZEPTO_SENDER_NAME || 'Líderes en Seguros';

  return {
    configured: !!apiKey,
    provider: apiKey ? 'zepto-api' : 'none',
    vercel_env: vercelEnv,
    hasApiKey: !!apiKey,
    hasSender: !!process.env.ZEPTO_SENDER,
    hasSenderName: !!process.env.ZEPTO_SENDER_NAME,
    sender,
    senderName,
    apiUrl: ZEPTO_API_URL,
  };
}

/**
 * Send email via Zepto REST API with retries + exponential backoff.
 */
async function send(params: EmailSendParams): Promise<EmailSendResult> {
  const vercelEnv = process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown';
  const isProduction = process.env.VERCEL_ENV === 'production';

  // Debug log (server-side only, temporary for production debugging)
  console.log('[EMAIL-SERVICE] ═══════════════════════════════════');
  console.log('[EMAIL-SERVICE] Environment debug:', {
    hasApiKey: !!process.env.ZEPTO_API_KEY,
    sender: process.env.ZEPTO_SENDER,
    senderName: process.env.ZEPTO_SENDER_NAME,
    vercelEnv: process.env.VERCEL_ENV,
    nodeEnv: process.env.NODE_ENV,
    isProduction,
  });

  // Strict env validation
  const { valid, missing } = validateEnv();
  if (!valid) {
    const errorMsg = `Missing Zepto configuration: ${missing.join(', ')}`;
    console.error(`[EMAIL-SERVICE] ✗ ${errorMsg}`);
    return {
      success: false,
      provider: 'none',
      error: errorMsg,
      error_code: 'MISSING_ENV_VARS',
      vercel_env: vercelEnv,
      debug: { missing },
    };
  }

  // In production, ALWAYS force Zepto API (never SMTP)
  if (isProduction) {
    console.log('[EMAIL-SERVICE] Production detected → forcing Zepto API');
  }

  const apiKey = process.env.ZEPTO_API_KEY!;
  const sender = process.env.ZEPTO_SENDER || 'portal@lideresenseguros.com';
  const senderName = process.env.ZEPTO_SENDER_NAME || 'Líderes en Seguros';

  const recipients = (Array.isArray(params.to) ? params.to : [params.to]).map((addr) => ({
    email_address: { address: addr, name: addr },
  }));

  const body = {
    from: { address: sender, name: senderName },
    to: recipients,
    subject: params.subject,
    htmlbody: params.html,
    textbody: params.text || '',
  };

  let lastError = '';
  let lastErrorCode = '';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[EMAIL-SERVICE] Attempt ${attempt}/${MAX_RETRIES} → ${ZEPTO_API_URL}`);

      const res = await fetch(ZEPTO_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: apiKey,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        const messageId = data?.data?.[0]?.message_id || data?.request_id || 'unknown';
        console.log(`[EMAIL-SERVICE] ✓ Sent (attempt ${attempt}). MessageId: ${messageId}`);
        return {
          success: true,
          provider: 'zepto-api',
          messageId,
          vercel_env: vercelEnv,
        };
      }

      // Parse error
      const errText = await res.text();
      lastError = `HTTP ${res.status}: ${errText.substring(0, 500)}`;
      lastErrorCode = `HTTP_${res.status}`;
      console.error(`[EMAIL-SERVICE] Attempt ${attempt} failed:`, lastError);

      // Classify error for UI
      if (res.status === 401 || res.status === 403) {
        lastErrorCode = 'AUTH_FAILED';
        lastError = `Authentication failed (${res.status}). Check ZEPTO_API_KEY. Response: ${errText.substring(0, 200)}`;
        // Don't retry auth errors
        return {
          success: false,
          provider: 'zepto-api',
          error: lastError,
          error_code: lastErrorCode,
          vercel_env: vercelEnv,
        };
      }

      if (res.status === 400) {
        lastErrorCode = 'BAD_REQUEST';
        // Possibly domain not verified or bad sender
        if (errText.includes('domain') || errText.includes('sender')) {
          lastErrorCode = 'DOMAIN_NOT_VERIFIED';
        }
        return {
          success: false,
          provider: 'zepto-api',
          error: lastError,
          error_code: lastErrorCode,
          vercel_env: vercelEnv,
        };
      }

      // Don't retry client errors (except 429 rate limit)
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        return {
          success: false,
          provider: 'zepto-api',
          error: lastError,
          error_code: lastErrorCode,
          vercel_env: vercelEnv,
        };
      }
    } catch (err: any) {
      lastError = err.message || 'Network error';
      lastErrorCode = 'NETWORK_ERROR';
      console.error(`[EMAIL-SERVICE] Attempt ${attempt} exception:`, lastError);

      if (lastError.includes('ECONNREFUSED') || lastError.includes('ENOTFOUND')) {
        lastErrorCode = 'DNS_ERROR';
      }
      if (lastError.includes('SSL') || lastError.includes('TLS') || lastError.includes('certificate')) {
        lastErrorCode = 'SSL_ERROR';
      }
    }

    if (attempt < MAX_RETRIES) {
      const delay = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
      console.log(`[EMAIL-SERVICE] Waiting ${delay}ms before retry...`);
      await sleep(delay);
    }
  }

  console.error(`[EMAIL-SERVICE] ✗ All ${MAX_RETRIES} attempts failed.`);
  return {
    success: false,
    provider: 'zepto-api',
    error: lastError,
    error_code: lastErrorCode,
    vercel_env: vercelEnv,
  };
}

export const emailService = {
  send,
  validateEnv,
  getEnvStatus,
};
