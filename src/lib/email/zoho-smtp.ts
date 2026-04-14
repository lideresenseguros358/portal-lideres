/**
 * Zoho SMTP — Outbound Email via Nodemailer
 * ==========================================
 * Sends emails through Zoho SMTP (smtppro.zoho.com:465).
 * Used for Operaciones outbound emails (Peticiones, Renovaciones, Urgencias).
 *
 * Env vars:
 *   ZOHO_SMTP_HOST         — default: smtppro.zoho.com
 *   ZOHO_SMTP_PORT         — default: 465
 *   ZOHO_SMTP_SECURE       — default: true
 *   ZOHO_SMTP_USER_PORTAL  — sender address
 *   ZOHO_SMTP_PASS_PORTAL  — sender password
 */

import nodemailer from 'nodemailer';

export interface SmtpAttachment {
  content: string;   // base64-encoded file content
  mime_type: string;
  name: string;
}

interface SmtpSendParams {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  replyTo?: string;
  attachments?: SmtpAttachment[];
}

export interface SmtpSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

function getTransport() {
  const host = process.env.ZOHO_SMTP_HOST || 'smtppro.zoho.com';
  const port = parseInt(process.env.ZOHO_SMTP_PORT || '465', 10);
  const secure = (process.env.ZOHO_SMTP_SECURE || 'true') === 'true';
  const user = process.env.ZOHO_SMTP_USER_PORTAL || '';
  const pass = process.env.ZOHO_SMTP_PASS_PORTAL || '';

  if (!user || !pass) {
    throw new Error('ZOHO_SMTP_USER_PORTAL / ZOHO_SMTP_PASS_PORTAL not configured');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

/**
 * Send email via Zoho SMTP.
 */
export async function sendZohoSmtpEmail(params: SmtpSendParams): Promise<SmtpSendResult> {
  const user = process.env.ZOHO_SMTP_USER_PORTAL || '';
  const senderName = 'Líderes en Seguros';

  try {
    const transport = getTransport();

    const attachments = (params.attachments || []).map(a => ({
      filename: a.name,
      content: Buffer.from(a.content, 'base64'),
      contentType: a.mime_type,
    }));

    const info = await transport.sendMail({
      from: `"${senderName}" <${user}>`,
      to: params.to,
      subject: params.subject,
      html: params.htmlBody,
      text: params.textBody || undefined,
      replyTo: params.replyTo || undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    console.log(`[ZOHO-SMTP] ✓ Email sent to ${params.to}. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error(`[ZOHO-SMTP] ✗ Failed to send to ${params.to}:`, err.message);
    return { success: false, error: err.message || 'SMTP error' };
  }
}
