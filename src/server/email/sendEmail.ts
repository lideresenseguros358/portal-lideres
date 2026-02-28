/**
 * FUNCIÓN CENTRAL DE ENVÍO DE CORREOS — ZeptoMail REST API
 * =========================================================
 * Maneja envío, dedupe, logging y errores.
 * Todos los correos salen vía ZeptoMail REST API (no SMTP).
 * 
 * Env vars:
 *   ZEPTO_API_KEY  — ZeptoMail Send Mail Token (or ZEPTO_SMTP_PASS as fallback)
 *   ZEPTO_SENDER   — Sender email (default: portal@lideresenseguros.com)
 */

import { createClient } from '@supabase/supabase-js';
import { checkDedupe } from './dedupe';
import { htmlToText } from './renderer';
import type { SendEmailParams, EmailLogRecord } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const ZEPTO_API_URL = 'https://api.zeptomail.com/v1.1/email';
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1_000;

function getZeptoConfig() {
  const apiKey = process.env.ZEPTO_API_KEY || process.env.ZEPTO_SMTP_PASS || '';
  const sender = process.env.ZEPTO_SENDER || 'portal@lideresenseguros.com';
  const senderName = process.env.ZEPTO_SENDER_NAME || 'Líderes en Seguros';
  return { apiKey, sender, senderName };
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Low-level ZeptoMail REST send with retries + backoff.
 * Returns { ok, messageId, error }.
 */
async function zeptoSend(
  to: string | string[],
  subject: string,
  htmlBody: string,
  textBody: string,
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const { apiKey, sender, senderName } = getZeptoConfig();

  if (!apiKey) {
    console.error('[EMAIL-ZEPTO] No ZEPTO_API_KEY configured');
    return { ok: false, error: 'ZEPTO_API_KEY not configured' };
  }

  const recipients = (Array.isArray(to) ? to : [to]).map(addr => ({
    email_address: { address: addr, name: addr },
  }));

  const body = {
    from: { address: sender, name: senderName },
    to: recipients,
    subject,
    htmlbody: htmlBody,
    textbody: textBody,
  };

  let lastError = '';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
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
        console.log(`[EMAIL-ZEPTO] ✓ Sent (attempt ${attempt}). MessageId: ${messageId}`);
        return { ok: true, messageId };
      }

      const errText = await res.text();
      lastError = `HTTP ${res.status}: ${errText.substring(0, 300)}`;
      console.error(`[EMAIL-ZEPTO] Attempt ${attempt} failed:`, lastError);

      // Don't retry client errors (except 429 rate limit)
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        return { ok: false, error: lastError };
      }
    } catch (err: any) {
      lastError = err.message || 'Network error';
      console.error(`[EMAIL-ZEPTO] Attempt ${attempt} exception:`, lastError);
    }

    if (attempt < MAX_RETRIES) {
      const delay = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
      console.log(`[EMAIL-ZEPTO] Waiting ${delay}ms before retry...`);
      await sleep(delay);
    }
  }

  return { ok: false, error: lastError };
}

/**
 * Enviar correo electrónico vía ZeptoMail REST API
 */
export async function sendEmail(params: SendEmailParams): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
}> {
  const { to, subject, html, text, fromType, dedupeKey, metadata, template } = params;

  console.log('[EMAIL] ========== INICIANDO ENVÍO (ZeptoMail API) ==========');
  console.log('[EMAIL] To:', to);
  console.log('[EMAIL] Subject:', subject);
  console.log('[EMAIL] Template:', template || 'N/A');
  console.log('[EMAIL] FromType:', fromType);
  console.log('[EMAIL] DedupeKey:', dedupeKey || 'N/A');

  try {
    // 1. Verificar dedupe
    if (dedupeKey) {
      console.log('[EMAIL] Verificando dedupe...');
      const isDuplicate = await checkDedupe(dedupeKey);
      if (isDuplicate) {
        console.log(`[EMAIL] ⚠️ Correo duplicado omitido: ${dedupeKey}`);
        
        await logEmail({
          to: Array.isArray(to) ? to.join(',') : to,
          subject,
          template: template || null,
          dedupe_key: dedupeKey,
          status: 'skipped',
          error: 'Duplicate detected',
          metadata: metadata || {},
        });

        return { success: true, skipped: true };
      }
      console.log('[EMAIL] ✓ No es duplicado, continuando...');
    }

    // 2. Generar texto plano si no se proporcionó
    const plainText = text || htmlToText(html);
    console.log('[EMAIL] HTML length:', html.length, '| Text length:', plainText.length);

    // 3. Enviar correo vía ZeptoMail REST API
    console.log('[EMAIL] Enviando vía ZeptoMail REST API...');
    const result = await zeptoSend(to, subject, html, plainText);

    if (result.ok) {
      console.log(`[EMAIL] ✓ Enviado correctamente. MessageId: ${result.messageId}`);

      await logEmail({
        to: Array.isArray(to) ? to.join(',') : to,
        subject,
        template: template || null,
        dedupe_key: dedupeKey || null,
        status: 'sent',
        error: null,
        metadata: {
          messageId: result.messageId,
          fromType,
          transport: 'zepto-api',
          ...(metadata || {}),
        },
      });
      console.log('[EMAIL] ========== ENVÍO COMPLETADO ==========');
      return { success: true, messageId: result.messageId };
    }

    // Failed after retries
    console.error('[EMAIL] ✗ ERROR ENVIANDO CORREO:', result.error);

    await logEmail({
      to: Array.isArray(to) ? to.join(',') : to,
      subject,
      template: template || null,
      dedupe_key: dedupeKey || null,
      status: 'failed',
      error: result.error || 'Unknown error',
      metadata: {
        transport: 'zepto-api',
        ...(metadata || {}),
      },
    });
    console.log('[EMAIL] ========== ENVÍO FALLIDO ==========');
    return { success: false, error: result.error };

  } catch (error: any) {
    console.error('[EMAIL] ✗ EXCEPCIÓN INESPERADA:', error.message);

    await logEmail({
      to: Array.isArray(to) ? to.join(',') : to,
      subject,
      template: template || null,
      dedupe_key: dedupeKey || null,
      status: 'failed',
      error: error.message || 'Unknown error',
      metadata: {
        transport: 'zepto-api',
        ...(metadata || {}),
      },
    });

    return { success: false, error: error.message };
  }
}

/**
 * Registrar envío en email_logs
 */
async function logEmail(record: Omit<EmailLogRecord, 'id' | 'created_at'>): Promise<void> {
  try {
    const { error } = await supabase.from('email_logs').insert({
      to: record.to,
      subject: record.subject,
      template: record.template,
      dedupe_key: record.dedupe_key,
      status: record.status,
      error: record.error,
      metadata: record.metadata,
    });

    if (error) {
      console.error('[EMAIL] Error registrando log:', error);
    }
  } catch (err) {
    console.error('[EMAIL] Error crítico en logging:', err);
  }
}

/**
 * Enviar correos masivos usando cola con rate-limiting
 * 
 * DEPRECADO: Usa sendEmailQueue directamente para mayor control
 * Esta función se mantiene por compatibilidad pero internamente
 * usa el sistema de cola seguro con rate-limiting.
 * 
 * @deprecated Usar sendEmailQueue de './queue' en su lugar
 */
export async function sendEmailBatch(emails: SendEmailParams[]): Promise<{
  total: number;
  sent: number;
  failed: number;
  skipped: number;
}> {
  console.warn('[EMAIL] ⚠️ sendEmailBatch está deprecado, usa sendEmailQueue de ./queue');
  console.log('[EMAIL] Redirigiendo a cola con rate-limiting...');
  
  // Importar dinámicamente para evitar ciclos
  const { sendEmailQueue } = await import('./queue');
  
  const result = await sendEmailQueue(emails);
  
  // Retornar en formato compatible
  return {
    total: result.total,
    sent: result.sent,
    failed: result.failed,
    skipped: result.skipped,
  };
}
