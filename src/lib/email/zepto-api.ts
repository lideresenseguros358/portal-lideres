/**
 * ZeptoMail — Direct API Email Module
 * ====================================
 * Uses ZeptoMail REST API (not SMTP) for reliability.
 * 3 retries with exponential backoff.
 * Used for urgent chat escalation emails.
 * 
 * Env vars:
 *   ZEPTO_API_KEY    — ZeptoMail Send Mail Token
 *   ZEPTO_SENDER     — Sender email (e.g. portal@lideresenseguros.com)
 */

const ZEPTO_API_URL = 'https://api.zeptomail.com/v1.1/email';
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1000;

interface ZeptoSendParams {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  replyTo?: string;
}

interface ZeptoSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  attempts: number;
}

function getConfig() {
  const apiKey = process.env.ZEPTO_API_KEY || process.env.ZEPTO_SMTP_PASS || '';
  const sender = process.env.ZEPTO_SENDER || 'portal@lideresenseguros.com';
  const senderName = process.env.ZEPTO_SENDER_NAME || 'Líderes en Seguros';
  return { apiKey, sender, senderName };
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Send email via ZeptoMail REST API with 3 retries + exponential backoff.
 */
export async function sendZeptoEmail(params: ZeptoSendParams): Promise<ZeptoSendResult> {
  const { apiKey, sender, senderName } = getConfig();

  if (!apiKey) {
    console.error('[ZEPTO-API] No ZEPTO_API_KEY configured');
    return { success: false, error: 'ZEPTO_API_KEY not configured', attempts: 0 };
  }

  const requestBody = {
    from: { address: sender, name: senderName },
    to: [{ email_address: { address: params.to, name: params.to } }],
    subject: params.subject,
    htmlbody: params.htmlBody,
    textbody: params.textBody || '',
    ...(params.replyTo ? { reply_to: [{ address: params.replyTo }] } : {}),
  };

  let lastError = '';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[ZEPTO-API] Attempt ${attempt}/${MAX_RETRIES} — Sending to ${params.to}`);

      const response = await fetch(ZEPTO_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Zoho-encrtoken ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        const messageId = data?.data?.[0]?.message_id || data?.request_id || 'unknown';
        console.log(`[ZEPTO-API] ✓ Email sent (attempt ${attempt}). MessageId: ${messageId}`);
        return { success: true, messageId, attempts: attempt };
      }

      const errorText = await response.text();
      lastError = `HTTP ${response.status}: ${errorText.substring(0, 300)}`;
      console.error(`[ZEPTO-API] Attempt ${attempt} failed:`, lastError);

      // Don't retry on 4xx (client errors) except 429 (rate limit)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return { success: false, error: lastError, attempts: attempt };
      }

    } catch (err: any) {
      lastError = err.message || 'Network error';
      console.error(`[ZEPTO-API] Attempt ${attempt} exception:`, lastError);
    }

    // Exponential backoff before retry
    if (attempt < MAX_RETRIES) {
      const delay = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
      console.log(`[ZEPTO-API] Waiting ${delay}ms before retry...`);
      await sleep(delay);
    }
  }

  console.error(`[ZEPTO-API] ✗ All ${MAX_RETRIES} attempts failed.`);
  return { success: false, error: lastError, attempts: MAX_RETRIES };
}

// ════════════════════════════════════════════
// Escalation Email Builder
// ════════════════════════════════════════════

interface EscalationEmailData {
  threadId: string;
  phoneE164: string;
  clientName: string | null;
  category: string;
  severity: string;
  executiveSummary: string[];
  suggestedNextStep: string;
  tags: string[];
  messages: { direction: string; body: string; created_at: string; ai_generated?: boolean }[];
  threadLink: string;
}

/**
 * Build and send an urgent escalation email for a chat thread.
 */
export async function sendEscalationEmail(data: EscalationEmailData): Promise<ZeptoSendResult> {
  const ESCALATION_EMAIL = 'contacto@lideresenseguros.com';

  const severityLabel = data.severity === 'high' ? '🔴 ALTA' : data.severity === 'medium' ? '🟡 MEDIA' : '🟢 BAJA';
  const categoryLabel = data.category.toUpperCase();

  const summaryHtml = data.executiveSummary.length > 0
    ? `<ul style="margin:0;padding-left:20px;">${data.executiveSummary.map(s => `<li>${s}</li>`).join('')}</ul>`
    : '<em>Sin resumen</em>';

  const tagsHtml = data.tags.length > 0
    ? data.tags.map(t => `<span style="background:#f3f4f6;border:1px solid #d1d5db;border-radius:4px;padding:2px 8px;font-size:12px;margin-right:4px;">${t}</span>`).join(' ')
    : '—';

  // Message history (last 30 or all)
  const msgSlice = data.messages.slice(-30);
  const historyHtml = msgSlice.map(m => {
    const dir = m.direction === 'inbound' ? '👤 Cliente' : m.ai_generated ? '🤖 LISSA AI' : '👨‍💼 Portal';
    const time = new Date(m.created_at).toLocaleString('es-PA');
    return `<div style="margin-bottom:8px;padding:8px;background:${m.direction === 'inbound' ? '#eff6ff' : '#f0fdf4'};border-radius:6px;font-size:13px;">
      <strong>${dir}</strong> <span style="color:#9ca3af;font-size:11px;">${time}</span><br/>
      ${m.body.replace(/\n/g, '<br/>')}
    </div>`;
  }).join('');

  const subject = `[URGENTE][ADM COT CHATS] ${severityLabel} — ${data.phoneE164} — ${data.clientName || 'Sin nombre'}`;

  const htmlBody = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;margin:0;padding:0;background:#f9fafb;">
  <div style="max-width:640px;margin:0 auto;background:white;">
    <!-- Header -->
    <div style="background:#dc2626;color:white;padding:20px 24px;">
      <h1 style="margin:0;font-size:20px;">⚠️ CASO URGENTE DETECTADO</h1>
      <p style="margin:4px 0 0;font-size:13px;opacity:0.9;">ADM COT Chats — Escalamiento automático</p>
    </div>

    <!-- Info table -->
    <div style="padding:20px 24px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;width:160px;">Thread ID</td><td style="padding:8px 12px;border:1px solid #e5e7eb;"><code>${data.threadId}</code></td></tr>
        <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Teléfono</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">${data.phoneE164}</td></tr>
        <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Cliente</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">${data.clientName || 'No identificado'}</td></tr>
        <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Categoría</td><td style="padding:8px 12px;border:1px solid #e5e7eb;color:#dc2626;font-weight:bold;">${categoryLabel}</td></tr>
        <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Severidad</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">${severityLabel}</td></tr>
        <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Tags</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">${tagsHtml}</td></tr>
      </table>

      <!-- Summary -->
      <div style="margin-top:16px;padding:12px;background:#fef2f2;border-left:4px solid #dc2626;border-radius:4px;">
        <strong style="color:#991b1b;">Resumen Ejecutivo:</strong>
        ${summaryHtml}
      </div>

      <!-- Suggested next step -->
      <div style="margin-top:12px;padding:12px;background:#eff6ff;border-left:4px solid #2563eb;border-radius:4px;">
        <strong style="color:#1e40af;">Acción Sugerida:</strong>
        <p style="margin:4px 0 0;">${data.suggestedNextStep || 'Revisar conversación'}</p>
      </div>

      <!-- Link -->
      <div style="margin-top:20px;text-align:center;">
        <a href="${data.threadLink}" style="display:inline-block;background:#010139;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;">
          Ver conversación en el Portal
        </a>
      </div>

      <!-- History -->
      <div style="margin-top:24px;">
        <h3 style="color:#374151;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">Historial de Mensajes (${msgSlice.length})</h3>
        ${historyHtml}
      </div>

      <!-- Footer -->
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;">
        <p>Generado automáticamente por ADM COT Chats — ${new Date().toLocaleString('es-PA')}</p>
        <p>Líderes en Seguros, S.A. | portal.lideresenseguros.com</p>
      </div>
    </div>
  </div>
</body></html>`;

  return sendZeptoEmail({
    to: ESCALATION_EMAIL,
    subject,
    htmlBody: htmlBody,
  });
}

/**
 * Build and send assignment notification email.
 */
export async function sendAssignmentEmail(params: {
  masterEmail: string;
  masterName: string;
  threadId: string;
  phoneE164: string;
  clientName: string | null;
  preview: string | null;
  threadLink: string;
}): Promise<ZeptoSendResult> {
  const subject = `[ADM COT CHATS] Conversación asignada — ${params.phoneE164}`;

  const htmlBody = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;margin:0;padding:0;background:#f9fafb;">
  <div style="max-width:640px;margin:0 auto;background:white;">
    <div style="background:#010139;color:white;padding:20px 24px;">
      <h1 style="margin:0;font-size:18px;">💬 Conversación Asignada</h1>
    </div>
    <div style="padding:20px 24px;">
      <p>Hola <strong>${params.masterName}</strong>,</p>
      <p>Se te ha asignado una conversación de WhatsApp:</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Teléfono</td><td style="padding:8px;border:1px solid #e5e7eb;">${params.phoneE164}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Cliente</td><td style="padding:8px;border:1px solid #e5e7eb;">${params.clientName || 'No identificado'}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Último mensaje</td><td style="padding:8px;border:1px solid #e5e7eb;">${params.preview || '—'}</td></tr>
      </table>
      <p>LISSA AI ha sido desactivada para esta conversación. Los mensajes entrantes no recibirán respuesta automática hasta que atiendas o reasignes a LISSA AI.</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${params.threadLink}" style="display:inline-block;background:#010139;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;">Ver Conversación</a>
      </div>
      <div style="font-size:11px;color:#9ca3af;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:12px;">
        Generado por ADM COT Chats — ${new Date().toLocaleString('es-PA')}
      </div>
    </div>
  </div>
</body></html>`;

  return sendZeptoEmail({
    to: params.masterEmail,
    subject,
    htmlBody,
  });
}
