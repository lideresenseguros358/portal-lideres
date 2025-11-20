/**
 * Commission Paid Email Template
 * Template para notificación de pago de quincena
 */

import { BaseEmailTemplate } from './BaseEmailTemplate';

export interface CommissionPaidEmailData {
  brokerName: string;
  periodLabel: string; // "del 1 al 15 de enero 2025"
  grossAmount: number;
  netAmount: number;
  discountAmount: number;
  fortnightId: string;
}

export function getCommissionPaidEmailContent(data: CommissionPaidEmailData): { subject: string; html: string } {
  const { brokerName, periodLabel, grossAmount, netAmount, discountAmount, fortnightId } = data;

  const formatMoney = (amount: number) => 
    new Intl.NumberFormat('es-PA', { style: 'currency', currency: 'USD' }).format(amount);

  const hasDiscounts = discountAmount > 0;

  const content = `
    <p>Estimado/a <strong>${brokerName}</strong>,</p>
    <p>¡Buenas noticias! Se han procesado los pagos correspondientes a la quincena <strong>${periodLabel}</strong>.</p>
    
    <!-- Monto Neto a Recibir -->
    <div style="background: linear-gradient(135deg, #F0F9E8 0%, #E8F5E0 100%); padding: 30px; border-radius: 12px; margin: 25px 0; border-left: 6px solid #8AAA19; box-shadow: 0 2px 8px rgba(138, 170, 25, 0.15);">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #6D6D6D; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
        💵 Monto Neto a Recibir
      </p>
      <p style="margin: 0; font-size: 36px; font-weight: 700; color: #8AAA19;">
        ${formatMoney(netAmount)}
      </p>
    </div>
    
    <!-- Detalle de Montos -->
    <div style="background: #F7F7F7; padding: 20px; border-radius: 10px; margin: 20px 0;">
      <p style="margin: 0 0 15px 0; font-size: 16px; font-weight: 600; color: #010139;">
        📊 Detalle de la Quincena
      </p>
      
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #E0E0E0;">
          <td style="padding: 12px 0; color: #6D6D6D; font-size: 15px;">
            Comisiones Brutas
          </td>
          <td style="padding: 12px 0; text-align: right; font-weight: 600; font-size: 15px; color: #010139;">
            ${formatMoney(grossAmount)}
          </td>
        </tr>
        ${hasDiscounts ? `
        <tr style="border-bottom: 1px solid #E0E0E0;">
          <td style="padding: 12px 0; color: #6D6D6D; font-size: 15px;">
            Descuentos Aplicados
          </td>
          <td style="padding: 12px 0; text-align: right; font-weight: 600; font-size: 15px; color: #D32F2F;">
            -${formatMoney(discountAmount)}
          </td>
        </tr>
        ` : ''}
        <tr style="background: #E8F5E0;">
          <td style="padding: 12px 0; font-weight: 700; font-size: 16px; color: #010139;">
            Total Neto
          </td>
          <td style="padding: 12px 0; text-align: right; font-weight: 700; font-size: 18px; color: #8AAA19;">
            ${formatMoney(netAmount)}
          </td>
        </tr>
      </table>
    </div>
    
    ${hasDiscounts ? `
    <p style="background: #FFF3E0; padding: 15px; border-radius: 8px; font-size: 14px; color: #6D6D6D; border-left: 4px solid #FF9800;">
      ⚠️ <strong>Nota:</strong> Se aplicaron descuentos por adelantos u otros conceptos. 
      Puedes ver el detalle completo en el portal.
    </p>
    ` : ''}
    
    <p style="margin-top: 25px;">
      Puedes revisar todos los detalles, descargas y comprobantes en la sección de <strong>Comisiones</strong> del portal.
    </p>
  `;

  const deepLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/comisiones?quincena=${fortnightId}`;

  const html = BaseEmailTemplate({
    preheader: `Pago procesado: ${formatMoney(netAmount)} - ${periodLabel}`,
    title: '💰 Comisiones Pagadas',
    content,
    ctaText: 'Ver Detalle en Portal',
    ctaUrl: deepLink,
    footerText: 'Portal Líderes - Gestión de Comisiones'
  });

  return {
    subject: `💵 Comisiones Pagadas - ${periodLabel}`,
    html
  };
}
