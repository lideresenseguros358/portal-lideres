/**
 * Operaciones Email Templates
 * ===========================
 * HTML email templates for ops case communications.
 * Unified branded template with:
 *   - Office logo + header
 *   - Consistent styling
 *   - Regulatory footer (Superintendencia de Seguros)
 *
 * Templates:
 *   - Payment link: sends a payment link to the client
 *   - Case notification: generic case update notification
 *   - Generic branded wrapper (for raw emails too)
 */

const BRAND_COLOR = '#010139';
const ACCENT_COLOR = '#8AAA19';
const LOGO_URL = 'https://portal.lideresenseguros.com/logo_alternativo.png';
const PORTAL_URL = 'https://portal.lideresenseguros.com';
const REGULATORY_TEXT = 'Regulado y Supervisado por la Superintendencia de Seguros y Reaseguros de Panamá — Licencia PJ750';

const baseWrapper = (content: string) => `
<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Líderes en Seguros</title>
</head>
<body style="font-family:'Segoe UI',Tahoma,Arial,sans-serif;margin:0;padding:0;background:#f0f2f5;-webkit-font-smoothing:antialiased;">
  <!-- Outer wrapper -->
  <div style="max-width:640px;margin:0 auto;padding:24px 16px;">

    <!-- Main card -->
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">

      <!-- Header with logo -->
      <div style="background:linear-gradient(135deg, ${BRAND_COLOR} 0%, #020270 100%);padding:28px 32px;text-align:center;">
        <a href="${PORTAL_URL}" target="_blank" style="text-decoration:none;">
          <img src="${LOGO_URL}" alt="Líderes en Seguros" width="180" style="display:inline-block;max-width:180px;height:auto;" />
        </a>
      </div>

      <!-- Accent bar -->
      <div style="height:4px;background:linear-gradient(90deg, ${ACCENT_COLOR} 0%, #b8d430 100%);"></div>

      <!-- Body content -->
      <div style="padding:32px 32px 28px;">
        ${content}
      </div>

      <!-- Signature / Closing -->
      <div style="padding:0 32px 24px;">
        <div style="border-top:1px solid #e5e7eb;padding-top:20px;">
          <p style="margin:0;font-size:14px;color:#374151;font-weight:600;">Líderes en Seguros, S.A.</p>
          <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">Tel: 223-2373 | contacto@lideresenseguros.com</p>
          <p style="margin:2px 0 0;font-size:13px;color:#6b7280;">
            <a href="${PORTAL_URL}" style="color:${BRAND_COLOR};text-decoration:none;">portal.lideresenseguros.com</a>
          </p>
        </div>
      </div>

      <!-- Regulatory Footer -->
      <div style="background:#010139;padding:16px 32px;text-align:center;">
        <p style="margin:0 0 6px;font-size:10px;color:#9ca3af;line-height:1.5;">
          ${REGULATORY_TEXT}
        </p>
        <img src="${PORTAL_URL}/aseguradoras/logo-SSRP.png" alt="SSRP" width="80" height="auto" style="display:inline-block;max-width:80px;opacity:0.85;" />
      </div>

      <!-- Informational Footer -->
      <div style="background:#f9fafb;padding:12px 32px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;line-height:1.5;">
          Si tiene dudas, puede responder directamente a este correo.
        </p>
      </div>

    </div>

  </div>
</body></html>`;

/**
 * Wraps any raw HTML content in the branded template.
 * Use this for the generic send_email action so ALL outbound emails get branding.
 */
export function wrapInBrandedTemplate(bodyHtml: string): string {
  return baseWrapper(bodyHtml);
}

// ════════════════════════════════════════════
// PAYMENT LINK EMAIL
// ════════════════════════════════════════════

export interface PaymentLinkEmailParams {
  clientName: string;
  policyNumber?: string;
  insurerName?: string;
  ticket: string;
  caseType: 'renovacion' | 'peticion' | 'urgencia';
  paymentLink: string;
  amount?: string;
  concept?: string;
  expiresAt?: string;
  senderName?: string;
}

const CASE_TYPE_LABELS: Record<string, string> = {
  renovacion: 'Renovación',
  peticion: 'Petición',
  urgencia: 'Urgencia',
};

export function buildPaymentLinkEmail(params: PaymentLinkEmailParams): { subject: string; html: string; text: string } {
  const caseLabel = CASE_TYPE_LABELS[params.caseType] || params.caseType;
  const subject = `[${params.ticket}] Enlace de pago — ${caseLabel}${params.policyNumber ? ` — Póliza ${params.policyNumber}` : ''}`;

  const amountRow = params.amount
    ? `<tr><td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb;width:140px;">Monto</td><td style="padding:10px 14px;border:1px solid #e5e7eb;font-size:18px;font-weight:700;color:${BRAND_COLOR};">$${params.amount}</td></tr>`
    : '';
  const conceptRow = params.concept
    ? `<tr><td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb;">Concepto</td><td style="padding:10px 14px;border:1px solid #e5e7eb;">${params.concept}</td></tr>`
    : '';
  const expiresRow = params.expiresAt
    ? `<tr><td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb;">Vigencia</td><td style="padding:10px 14px;border:1px solid #e5e7eb;">${params.expiresAt}</td></tr>`
    : '';

  const content = `
    <p style="font-size:15px;color:#374151;margin:0 0 16px;">
      Estimado/a <strong>${params.clientName}</strong>,
    </p>
    <p style="font-size:14px;color:#374151;margin:0 0 20px;">
      Le enviamos el enlace para realizar su pago correspondiente a su trámite de <strong>${caseLabel}</strong>.
    </p>

    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
      <tr><td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb;width:140px;">Caso</td><td style="padding:10px 14px;border:1px solid #e5e7eb;">${params.ticket}</td></tr>
      ${params.policyNumber ? `<tr><td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb;">Póliza</td><td style="padding:10px 14px;border:1px solid #e5e7eb;">${params.policyNumber}</td></tr>` : ''}
      ${params.insurerName ? `<tr><td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb;">Aseguradora</td><td style="padding:10px 14px;border:1px solid #e5e7eb;">${params.insurerName}</td></tr>` : ''}
      ${amountRow}
      ${conceptRow}
      ${expiresRow}
    </table>

    <!-- PAYMENT LINK BUTTON -->
    <div style="text-align:center;margin:28px 0;">
      <a href="${params.paymentLink}" target="_blank" style="display:inline-block;background:${ACCENT_COLOR};color:white;padding:14px 40px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.5px;">
        Realizar Pago
      </a>
    </div>

    <!-- Fallback link -->
    <p style="font-size:12px;color:#9ca3af;text-align:center;margin:0 0 20px;word-break:break-all;">
      Si el botón no funciona, copie y pegue este enlace en su navegador:<br/>
      <a href="${params.paymentLink}" style="color:${BRAND_COLOR};">${params.paymentLink}</a>
    </p>

    <div style="background:#fef9c3;border:1px solid #fde68a;border-radius:6px;padding:12px 16px;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;color:#92400e;">
        <strong>⚠️ Importante:</strong> Una vez realizado el pago, por favor envíenos el comprobante respondiendo a este correo.
      </p>
    </div>

    <p style="font-size:14px;color:#374151;margin:0;">
      Quedamos atentos ante cualquier consulta.
    </p>
    ${params.senderName ? `<p style="font-size:14px;color:#374151;margin:8px 0 0;font-weight:600;">${params.senderName}</p>` : ''}
  `;

  const text = `Estimado/a ${params.clientName},

Le enviamos el enlace para realizar su pago correspondiente a su trámite de ${caseLabel}.

Caso: ${params.ticket}
${params.policyNumber ? `Póliza: ${params.policyNumber}\n` : ''}${params.insurerName ? `Aseguradora: ${params.insurerName}\n` : ''}${params.amount ? `Monto: $${params.amount}\n` : ''}${params.concept ? `Concepto: ${params.concept}\n` : ''}
Enlace de pago: ${params.paymentLink}

Importante: Una vez realizado el pago, por favor envíenos el comprobante respondiendo a este correo.

Quedamos atentos ante cualquier consulta.
${params.senderName || 'Líderes en Seguros'}`;

  return { subject, html: baseWrapper(content), text };
}

// ════════════════════════════════════════════
// CASE NOTIFICATION EMAIL
// ════════════════════════════════════════════

export interface CaseNotificationEmailParams {
  clientName: string;
  ticket: string;
  caseType: string;
  policyNumber?: string;
  insurerName?: string;
  bodyHtml: string;
  bodyText?: string;
  senderName?: string;
}

export function buildCaseNotificationEmail(params: CaseNotificationEmailParams): { subject: string; html: string; text: string } {
  const caseLabel = CASE_TYPE_LABELS[params.caseType] || params.caseType;
  const subject = `[${params.ticket}] ${caseLabel}${params.policyNumber ? ` — Póliza ${params.policyNumber}` : ''}`;

  const content = `
    <p style="font-size:15px;color:#374151;margin:0 0 16px;">
      Estimado/a <strong>${params.clientName}</strong>,
    </p>
    <div style="font-size:14px;color:#374151;line-height:1.6;">
      ${params.bodyHtml}
    </div>
    <p style="font-size:14px;color:#374151;margin:20px 0 0;">
      Quedamos atentos ante cualquier consulta.
    </p>
    ${params.senderName ? `<p style="font-size:14px;color:#374151;margin:8px 0 0;font-weight:600;">${params.senderName}</p>` : ''}
  `;

  return {
    subject,
    html: baseWrapper(content),
    text: params.bodyText || `Estimado/a ${params.clientName},\n\n${params.bodyHtml.replace(/<[^>]*>/g, '')}\n\nQuedamos atentos.\n${params.senderName || 'Líderes en Seguros'}`,
  };
}
