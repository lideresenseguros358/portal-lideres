/**
 * Adjustment Report Email Template
 * Plantilla para notificar sobre reportes de ajustes aprobados y pagados
 * Incluye listado detallado de clientes, montos y fechas
 */

import { BaseEmailTemplate } from './BaseEmailTemplate';

export interface AdjustmentClient {
  client_name: string;
  policy_number: string;
  amount: number;
  payment_date?: string;
  insurer_name?: string;
}

export interface AdjustmentReportEmailData {
  brokerName: string;
  reportNumber: string;
  totalAmount: number;
  clientCount: number;
  clients: AdjustmentClient[];
  periodLabel?: string;
  notes?: string;
}

export function getAdjustmentReportEmailContent(data: AdjustmentReportEmailData): { subject: string; html: string } {
  const { brokerName, reportNumber, totalAmount, clientCount, clients, periodLabel, notes } = data;

  const formatMoney = (amount: number) => 
    new Intl.NumberFormat('es-PA', { style: 'currency', currency: 'USD' }).format(amount);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const content = `
    <p>Estimado/a <strong>${brokerName}</strong>,</p>
    <p>Se ha procesado el <strong>Reporte de Ajuste #${reportNumber}</strong> ${periodLabel ? `correspondiente al período <strong>${periodLabel}</strong>` : ''}.</p>
    
    <!-- Resumen del Reporte -->
    <div style="background: linear-gradient(135deg, #e3f2fd 0%, #e1f5fe 100%); padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 6px solid #010139;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div>
          <p style="margin: 0 0 8px 0; font-size: 13px; color: #6D6D6D; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
            📊 Total Clientes
          </p>
          <p style="margin: 0; font-size: 28px; font-weight: 700; color: #010139;">
            ${clientCount}
          </p>
        </div>
        <div>
          <p style="margin: 0 0 8px 0; font-size: 13px; color: #6D6D6D; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
            💰 Monto Total
          </p>
          <p style="margin: 0; font-size: 28px; font-weight: 700; color: #8AAA19;">
            ${formatMoney(totalAmount)}
          </p>
        </div>
      </div>
    </div>

    <!-- Listado de Clientes Pagados -->
    <div style="margin: 30px 0;">
      <h3 style="font-size: 18px; font-weight: 600; color: #010139; margin: 0 0 20px 0; display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 24px;">📋</span>
        Detalle de Clientes en el Reporte
      </h3>
      
      <div style="background: #ffffff; border: 2px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
        <!-- Header de tabla -->
        <div style="background: linear-gradient(135deg, #010139 0%, #001a4d 100%); padding: 12px 15px; display: grid; grid-template-columns: 2fr 1.5fr 1fr 1fr; gap: 10px;">
          <div style="color: #ffffff; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Cliente</div>
          <div style="color: #ffffff; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Póliza</div>
          <div style="color: #ffffff; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; text-align: right;">Monto</div>
          <div style="color: #ffffff; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; text-align: right;">Fecha</div>
        </div>
        
        <!-- Filas de clientes -->
        ${clients.map((client, index) => `
        <div style="padding: 14px 15px; display: grid; grid-template-columns: 2fr 1.5fr 1fr 1fr; gap: 10px; border-bottom: 1px solid #f0f0f0; background: ${index % 2 === 0 ? '#ffffff' : '#fafafa'};">
          <div>
            <div style="font-size: 14px; font-weight: 600; color: #010139; margin-bottom: 4px;">
              ${client.client_name}
            </div>
            ${client.insurer_name ? `
            <div style="font-size: 11px; color: #6D6D6D;">
              ${client.insurer_name}
            </div>
            ` : ''}
          </div>
          <div style="font-size: 13px; color: #23262F; align-self: center;">
            ${client.policy_number}
          </div>
          <div style="font-size: 14px; font-weight: 600; color: ${client.amount >= 0 ? '#8AAA19' : '#D32F2F'}; text-align: right; align-self: center;">
            ${formatMoney(client.amount)}
          </div>
          <div style="font-size: 12px; color: #6D6D6D; text-align: right; align-self: center;">
            ${formatDate(client.payment_date)}
          </div>
        </div>
        `).join('')}
        
        <!-- Total Footer -->
        <div style="background: linear-gradient(135deg, #f7f7f7 0%, #e8e8e8 100%); padding: 14px 15px; display: grid; grid-template-columns: 2fr 1.5fr 1fr 1fr; gap: 10px; border-top: 2px solid #010139;">
          <div style="font-size: 15px; font-weight: 700; color: #010139; align-self: center;">
            TOTAL
          </div>
          <div style="font-size: 13px; color: #6D6D6D; align-self: center;">
            ${clientCount} cliente${clientCount !== 1 ? 's' : ''}
          </div>
          <div style="font-size: 16px; font-weight: 700; color: #8AAA19; text-align: right; align-self: center;">
            ${formatMoney(totalAmount)}
          </div>
          <div></div>
        </div>
      </div>
    </div>

    ${notes ? `
    <div style="background: #fff9e6; padding: 18px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #FFC107;">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #856404; font-size: 14px;">
        📝 Notas del Reporte
      </p>
      <p style="margin: 0; font-size: 14px; color: #856404; line-height: 1.6;">
        ${notes}
      </p>
    </div>
    ` : ''}

    <!-- Resumen de Montos por Tipo -->
    ${(() => {
      const positiveClients = clients.filter(c => c.amount > 0);
      const negativeClients = clients.filter(c => c.amount < 0);
      const positiveTotal = positiveClients.reduce((sum, c) => sum + c.amount, 0);
      const negativeTotal = negativeClients.reduce((sum, c) => sum + Math.abs(c.amount), 0);
      
      if (positiveClients.length > 0 && negativeClients.length > 0) {
        return `
        <div style="background: #f7f7f7; padding: 20px; border-radius: 10px; margin: 25px 0;">
          <p style="margin: 0 0 15px 0; font-size: 16px; font-weight: 600; color: #010139;">
            💡 Resumen por Tipo
          </p>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div style="background: #e8f5e0; padding: 15px; border-radius: 8px; border-left: 4px solid #8AAA19;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #6D6D6D; font-weight: 600;">A FAVOR (Comisiones)</p>
              <p style="margin: 0; font-size: 20px; font-weight: 700; color: #8AAA19;">
                ${formatMoney(positiveTotal)}
              </p>
              <p style="margin: 6px 0 0 0; font-size: 11px; color: #6D6D6D;">
                ${positiveClients.length} cliente${positiveClients.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div style="background: #ffebee; padding: 15px; border-radius: 8px; border-left: 4px solid #D32F2F;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #6D6D6D; font-weight: 600;">EN CONTRA (Devoluciones)</p>
              <p style="margin: 0; font-size: 20px; font-weight: 700; color: #D32F2F;">
                ${formatMoney(negativeTotal)}
              </p>
              <p style="margin: 6px 0 0 0; font-size: 11px; color: #6D6D6D;">
                ${negativeClients.length} cliente${negativeClients.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
        `;
      }
      return '';
    })()}

    <div style="margin: 30px 0; padding: 20px; background: linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%); border-radius: 10px; border: 2px solid #8AAA19;">
      <p style="margin: 0 0 10px 0; font-size: 15px; font-weight: 600; color: #010139; text-align: center;">
        📥 Próximos Pasos
      </p>
      <p style="margin: 0; font-size: 14px; color: #23262F; line-height: 1.7; text-align: center;">
        Puedes descargar el reporte completo, ver el detalle de cada ajuste y revisar los documentos asociados desde el Portal Líderes.
      </p>
    </div>
  `;

  const deepLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/comisiones?tab=ajustes`;

  const html = BaseEmailTemplate({
    preheader: `Reporte de Ajuste #${reportNumber} - ${clientCount} clientes - ${formatMoney(totalAmount)}`,
    title: '📊 Reporte de Ajuste Procesado',
    content,
    ctaText: 'Ver Reporte Completo',
    ctaUrl: deepLink,
    footerText: 'Portal Líderes - Gestión de Ajustes'
  });

  return {
    subject: `📊 Reporte de Ajuste #${reportNumber} - ${clientCount} clientes pagados`,
    html
  };
}
