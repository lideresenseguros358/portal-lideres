/**
 * ESCALATION MODULE — Critical case email alerts
 * ================================================
 * Sends urgent email to contacto@lideresenseguros.com
 * when a critical/extreme case is detected.
 * Uses the existing ZeptoMail SMTP system.
 */

import { sendEmail } from '@/server/email/sendEmail';

const ESCALATION_EMAIL = 'contacto@lideresenseguros.com';

export interface EscalationData {
  clientName: string | null;
  cedula: string | null;
  phone: string | null;
  channel: 'whatsapp' | 'portal';
  intent: string;
  conversationHistory: { role: string; content: string; timestamp?: string }[];
  triggerMessage: string;
  sessionId?: string;
}

/**
 * Send escalation email for critical cases
 */
export async function sendEscalationAlert(data: EscalationData): Promise<boolean> {
  try {
    const historyHtml = data.conversationHistory
      .map(m => {
        const roleLabel = m.role === 'user' ? '👤 Cliente' : '🤖 Asistente';
        const ts = m.timestamp ? ` <small style="color:#999">(${m.timestamp})</small>` : '';
        return `<p><strong>${roleLabel}:</strong>${ts}<br/>${escapeHtml(m.content)}</p>`;
      })
      .join('');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #dc2626; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">⚠️ ALERTA WhatsApp - Caso crítico</h2>
        </div>
        <div style="border: 1px solid #e5e7eb; border-top: 0; padding: 24px; border-radius: 0 0 8px 8px;">
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-weight: bold; width: 140px;">Cliente</td>
              <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${escapeHtml(data.clientName || 'No identificado')}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-weight: bold;">Cédula</td>
              <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${escapeHtml(data.cedula || '—')}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-weight: bold;">Teléfono</td>
              <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${escapeHtml(data.phone || '—')}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-weight: bold;">Canal</td>
              <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${data.channel === 'whatsapp' ? '📱 WhatsApp' : '💻 Portal'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-weight: bold;">Intención</td>
              <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; color: #dc2626; font-weight: bold;">${escapeHtml(data.intent)}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-weight: bold;">Timestamp</td>
              <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${new Date().toISOString()}</td>
            </tr>
          </table>

          <h3 style="color: #374151; border-bottom: 2px solid #dc2626; padding-bottom: 8px;">Mensaje detonante</h3>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
            <p style="margin: 0; color: #991b1b;">${escapeHtml(data.triggerMessage)}</p>
          </div>

          <h3 style="color: #374151; border-bottom: 2px solid #6b7280; padding-bottom: 8px;">Historial completo de conversación</h3>
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px;">
            ${historyHtml || '<p style="color: #9ca3af;">Sin historial previo</p>'}
          </div>

          <p style="color: #6b7280; font-size: 12px; margin-top: 24px; text-align: center;">
            Generado automáticamente por el sistema de chat de Líderes en Seguros
          </p>
        </div>
      </div>
    `;

    const result = await sendEmail({
      to: ESCALATION_EMAIL,
      subject: `⚠️ ALERTA ${data.channel === 'whatsapp' ? 'WhatsApp' : 'Chat Portal'} - Caso crítico — ${data.clientName || 'Cliente no identificado'}`,
      html,
      fromType: 'PORTAL',
      metadata: {
        type: 'chat_escalation',
        channel: data.channel,
        intent: data.intent,
        phone: data.phone,
      },
    });

    if (result.success) {
      console.log('[ESCALATION] Alert email sent to', ESCALATION_EMAIL);
      return true;
    } else {
      console.error('[ESCALATION] Failed to send:', result.error);
      return false;
    }
  } catch (err) {
    console.error('[ESCALATION] Error sending alert:', err);
    return false;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
