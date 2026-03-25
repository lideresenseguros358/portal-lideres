/**
 * Insurer Payment Links & Auto-Pay Contact Info
 * =============================================
 * Used in installment reminder emails and morosidad emails.
 */

export interface InsurerPaymentInfo {
  payUrl: string;
  autoPayText: string;
  autoPayUrl?: string;
  autoPayEmail?: string;
  label: string;
}

const INSURER_MAP: Record<string, InsurerPaymentInfo> = {
  FEDPA: {
    payUrl: 'https://wscanales.segfedpa.com/multipagos/',
    autoPayText: 'Para programar pagos automáticos contactar a:',
    autoPayEmail: 'mercadeo@segfedpa.com',
    label: 'FEDPA Seguros',
  },
  INTERNACIONAL: {
    payUrl: 'https://www.iseguros.com/pagosis/',
    autoPayText: 'Para programar pagos automáticos:',
    autoPayUrl: 'https://www.iseguros.com/mediosdepago.html',
    label: 'Internacional de Seguros',
  },
  REGIONAL: {
    payUrl: 'https://contactoenlinea.laregionaldeseguros.com:7443/ords/f?p=PAGOS:CONSULTA',
    autoPayText: 'Para programar pagos automáticos contactar a:',
    autoPayEmail: 'cobros@laregionaldeseguros.com',
    label: 'La Regional de Seguros',
  },
  ANCON: {
    payUrl: 'https://app.asegurancon.com/pago_online/',
    autoPayText: 'Para programar pagos automáticos contactar a:',
    autoPayEmail: 'atencionalcliente@asegurancon.com',
    label: 'ANCON Seguros',
  },
};

/** Resolve insurer payment info from a free-form insurer name string. */
export function getInsurerPaymentInfo(insurerName: string): InsurerPaymentInfo {
  const upper = (insurerName || '').toUpperCase();
  if (upper.includes('FEDPA')) return INSURER_MAP.FEDPA!;
  if (upper.includes('INTERNACION') || upper.includes('IS ') || upper === 'IS' || upper.includes('ISEGUROS')) return INSURER_MAP.INTERNACIONAL!;
  if (upper.includes('REGIONAL')) return INSURER_MAP.REGIONAL!;
  if (upper.includes('ANCON')) return INSURER_MAP.ANCON!;
  // Default fallback
  return {
    payUrl: '#',
    autoPayText: 'Contactar directamente con la aseguradora para programar pagos automáticos.',
    label: insurerName || 'su aseguradora',
  };
}

/** Build the insurer payment button + autopay footer HTML block. */
export function buildInsurerPaymentBlock(info: InsurerPaymentInfo, btnText = 'Realizar pago en la aseguradora'): string {
  const autoPayLine = info.autoPayUrl
    ? `<a href="${info.autoPayUrl}" style="color:#8AAA19;font-weight:700;">${info.autoPayUrl}</a>`
    : info.autoPayEmail
    ? `<a href="mailto:${info.autoPayEmail}" style="color:#8AAA19;font-weight:700;">${info.autoPayEmail}</a>`
    : '';

  return `
<div style="text-align:center;margin:24px 0 8px;">
  <a href="${info.payUrl}" target="_blank" style="display:inline-block;padding:15px 36px;background:#010139;color:white;text-decoration:none;font-weight:700;font-size:15px;border-radius:12px;letter-spacing:0.3px;box-shadow:0 4px 14px rgba(1,1,57,0.25);">${btnText}</a>
  <p style="margin:10px 0 0;font-size:11px;color:#6b7280;">Haga clic para pagar directamente en el portal de ${info.label}</p>
</div>
<div style="background:#f8faff;border:1px solid #e0e7ff;border-radius:10px;padding:14px 18px;margin:16px 0;font-size:12px;color:#374151;line-height:1.6;">
  <strong style="color:#010139;">💳 ¿Desea programar sus pagos automáticos?</strong><br/>
  ${info.autoPayText} ${autoPayLine}.<br/>
  Afiliar su póliza a débito automático le evita preocupaciones y garantiza cobertura continua.
</div>`;
}
