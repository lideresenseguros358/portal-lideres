/**
 * Delinquency Update Email Template
 * Template para notificación de actualización de morosidad
 */

import { BaseEmailTemplate } from './BaseEmailTemplate';

export interface DelinquencyUpdateEmailData {
  brokerName: string;
  insurerName: string;
  cutoffDate: string; // YYYY-MM-DD
  recordsCount: number;
  totalDebt: number;
  records: Array<{
    policyNumber: string;
    clientName: string;
    totalDebt: number;
    daysOverdue: string;
  }>;
}

export function getDelinquencyUpdateEmailContent(data: DelinquencyUpdateEmailData): { subject: string; html: string } {
  const { brokerName, insurerName, cutoffDate, recordsCount, totalDebt, records } = data;

  const formattedDate = new Date(cutoffDate).toLocaleDateString('es-PA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const formatMoney = (amount: number) => 
    new Intl.NumberFormat('es-PA', { style: 'currency', currency: 'USD' }).format(amount);

  // Mostrar máximo 10 registros en el email
  const displayRecords = records.slice(0, 10);
  const hasMore = records.length > 10;

  const content = `
    <p>Estimado/a <strong>${brokerName}</strong>,</p>
    <p>Se han cargado <strong>${recordsCount} nuevo${recordsCount > 1 ? 's' : ''} reporte${recordsCount > 1 ? 's' : ''} de morosidad</strong> de <strong>${insurerName}</strong> que afectan a tus clientes.</p>
    
    <!-- Total en Mora -->
    <div style="background: linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%); padding: 30px; border-radius: 12px; margin: 25px 0; border-left: 6px solid #FF9800; box-shadow: 0 2px 8px rgba(255, 152, 0, 0.15);">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #6D6D6D; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
        ⚠️ Total en Morosidad
      </p>
      <p style="margin: 0; font-size: 36px; font-weight: 700; color: #D32F2F;">
        ${formatMoney(totalDebt)}
      </p>
      <p style="margin: 10px 0 0 0; font-size: 14px; color: #6D6D6D;">
        📅 Corte: ${formattedDate}
      </p>
    </div>
    
    <!-- Lista de Clientes en Mora -->
    <div style="background: #FFFFFF; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px solid #FFE0B2;">
      <p style="margin: 0 0 15px 0; font-size: 16px; font-weight: 600; color: #010139;">
        📋 Clientes Afectados ${hasMore ? `(Mostrando ${displayRecords.length} de ${recordsCount})` : ''}
      </p>
      
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #F7F7F7; border-bottom: 2px solid #E0E0E0;">
            <th style="padding: 10px; text-align: left; font-size: 13px; color: #6D6D6D; font-weight: 600;">Cliente</th>
            <th style="padding: 10px; text-align: left; font-size: 13px; color: #6D6D6D; font-weight: 600;">Póliza</th>
            <th style="padding: 10px; text-align: center; font-size: 13px; color: #6D6D6D; font-weight: 600;">Días</th>
            <th style="padding: 10px; text-align: right; font-size: 13px; color: #6D6D6D; font-weight: 600;">Deuda</th>
          </tr>
        </thead>
        <tbody>
          ${displayRecords.map(record => `
            <tr style="border-bottom: 1px solid #F0F0F0;">
              <td style="padding: 12px 10px; font-size: 14px; color: #23262F;">
                <strong>${record.clientName}</strong>
              </td>
              <td style="padding: 12px 10px; font-size: 13px; color: #6D6D6D; font-family: monospace;">
                ${record.policyNumber}
              </td>
              <td style="padding: 12px 10px; text-align: center;">
                <span style="display: inline-block; padding: 4px 8px; background: ${
                  record.daysOverdue === '90+' ? '#FFEBEE' :
                  record.daysOverdue === '61-90' ? '#FFF3E0' :
                  record.daysOverdue === '31-60' ? '#FFF8E1' :
                  record.daysOverdue === '1-30' ? '#E8F5E9' : '#F5F5F5'
                }; border-radius: 4px; font-size: 12px; font-weight: 600; color: ${
                  record.daysOverdue === '90+' ? '#D32F2F' :
                  record.daysOverdue === '61-90' ? '#FF6F00' :
                  record.daysOverdue === '31-60' ? '#F57C00' :
                  record.daysOverdue === '1-30' ? '#388E3C' : '#6D6D6D'
                };">
                  ${record.daysOverdue}
                </span>
              </td>
              <td style="padding: 12px 10px; text-align: right; font-size: 15px; font-weight: 600; color: #D32F2F;">
                ${formatMoney(record.totalDebt)}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      ${hasMore ? `
        <p style="margin: 15px 0 0 0; text-align: center; font-size: 14px; color: #6D6D6D;">
          ... y ${records.length - displayRecords.length} cliente${records.length - displayRecords.length > 1 ? 's' : ''} más
        </p>
      ` : ''}
    </div>
    
    <p style="background: #FFEBEE; padding: 15px; border-radius: 8px; font-size: 14px; color: #6D6D6D; border-left: 4px solid #D32F2F;">
      🚨 <strong>Acción Requerida:</strong> Contacta a estos clientes lo antes posible para gestionar los pagos pendientes y evitar cancelaciones de póliza.
    </p>
    
    <p style="margin-top: 25px;">
      Puedes ver el detalle completo y exportar reportes en la sección de <strong>Morosidad</strong> del portal.
    </p>
  `;

  const deepLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/delinquency?insurer=${insurerName}&date=${cutoffDate}`;

  const html = BaseEmailTemplate({
    preheader: `${recordsCount} cliente${recordsCount > 1 ? 's' : ''} en mora - ${insurerName}`,
    title: '⚠️ Nuevos Reportes de Morosidad',
    content,
    ctaText: 'Ver Detalle en Portal',
    ctaUrl: deepLink,
    footerText: 'Portal Líderes - Gestión de Morosidad'
  });

  return {
    subject: `⚠️ Morosidad: ${recordsCount} cliente${recordsCount > 1 ? 's' : ''} afectado${recordsCount > 1 ? 's' : ''} - ${insurerName}`,
    html
  };
}
