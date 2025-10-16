/**
 * Commission Paid Email Template
 * Template para notificación de pago de quincena
 */

import { BaseEmailTemplate } from './BaseEmailTemplate';

export interface CommissionPaidEmailData {
  brokerName: string;
  quincenaId: string;
  quincenaPeriod: string; // "Q1-10-2025" o "Q2-10-2025"
  amount?: number;
  deepLink: string;
}

export function getCommissionPaidEmailContent(data: CommissionPaidEmailData): { subject: string; html: string } {
  const { brokerName, quincenaPeriod, amount, deepLink } = data;

  const formattedAmount = amount
    ? new Intl.NumberFormat('es-PA', { style: 'currency', currency: 'USD' }).format(amount)
    : null;

  const content = `
    <p>Estimado/a <strong>${brokerName}</strong>,</p>
    <p>Te informamos que se ha registrado el pago de la quincena <strong>${quincenaPeriod}</strong>.</p>
    
    <div style="background: linear-gradient(135deg, #F0F9E8 0%, #E8F5E0 100%); padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 4px solid #8AAA19;">
      <p style="margin: 0 0 10px 0; font-size: 16px; color: #6D6D6D;">
        💰 Quincena
      </p>
      <p style="margin: 0; font-size: 28px; font-weight: 700; color: #010139;">
        ${quincenaPeriod}
      </p>
      ${formattedAmount ? `
      <p style="margin: 15px 0 0 0; font-size: 20px; font-weight: 600; color: #8AAA19;">
        Monto: ${formattedAmount}
      </p>
      ` : ''}
    </div>
    
    <p>Puedes revisar los detalles completos de esta quincena en la sección de <strong>Comisiones</strong> del portal.</p>
    
    <p style="background: #F7F7F7; padding: 15px; border-radius: 8px; font-size: 14px; color: #6D6D6D;">
      💡 <strong>Recordatorio:</strong> Si tienes alguna duda sobre el cálculo o los descuentos aplicados, 
      puedes verificar todos los detalles en el portal o contactar al administrador.
    </p>
  `;

  const html = BaseEmailTemplate({
    preheader: `Pago registrado para quincena ${quincenaPeriod}`,
    title: 'Pago de quincena realizado',
    content,
    ctaText: 'Ver detalles en Comisiones',
    ctaUrl: deepLink,
    footerText: 'Portal Líderes - Gestión de Comisiones'
  });

  return {
    subject: `Pago de quincena ${quincenaPeriod} realizado`,
    html
  };
}
