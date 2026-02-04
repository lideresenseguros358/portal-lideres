/**
 * Renewal Request Email Template
 * Plantilla para solicitar confirmación de renovación AL CLIENTE
 * Con botones SI/NO que envían respuesta a tramites@lideresenseguros.com
 */

import { BaseEmailTemplate } from './BaseEmailTemplate';

export interface RenewalRequestEmailData {
  clientName: string;
  policyNumber: string;
  insurerName: string;
  ramo: string;
  renewalDate: string; // YYYY-MM-DD
  startDate: string; // YYYY-MM-DD
  brokerName: string;
  brokerEmail?: string;
  brokerPhone?: string;
  clientId: string;
  policyId: string;
}

export function getRenewalRequestEmailContent(data: RenewalRequestEmailData): { subject: string; html: string } {
  const { 
    clientName, 
    policyNumber, 
    insurerName, 
    ramo, 
    renewalDate, 
    startDate,
    brokerName,
    brokerEmail,
    brokerPhone,
    clientId,
    policyId
  } = data;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  // Formatear fechas
  const formattedRenewalDate = new Date(renewalDate).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const formattedStartDate = new Date(startDate).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Calcular días hasta renovación
  const today = new Date();
  const renewal = new Date(renewalDate);
  const diffTime = renewal.getTime() - today.getTime();
  const daysUntilRenewal = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // URLs para botones SI/NO (enviarán email a tramites@)
  const yesUrl = `${baseUrl}/api/renewal-response?response=yes&clientId=${clientId}&policyId=${policyId}`;
  const noUrl = `${baseUrl}/api/renewal-response?response=no&clientId=${clientId}&policyId=${policyId}`;

  const title = `🔄 Renovación de su Póliza de ${ramo}`;
  const preheader = `Su póliza vence el ${formattedRenewalDate} - Confirme su renovación`;

  const content = `
    <p style="font-size: 18px; font-weight: 600; color: #010139; margin-bottom: 20px;">
      Estimado/a ${clientName},
    </p>

    <p style="font-size: 16px; color: #23262F; line-height: 1.7; margin-bottom: 20px;">
      Su póliza de seguro está próxima a renovar. Queremos asegurarnos de que continúe protegido/a 
      con la cobertura que mejor se adapte a sus necesidades.
    </p>

    <!-- Información de la Póliza -->
    <div style="background: linear-gradient(135deg, #e3f2fd 0%, #e1f5fe 100%); padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 6px solid #010139;">
      <h3 style="margin: 0 0 18px 0; font-size: 16px; font-weight: 600; color: #010139; text-transform: uppercase; letter-spacing: 0.5px;">
        📋 Detalles de su Póliza
      </h3>
      
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid rgba(1, 1, 57, 0.1);">
          <td style="padding: 10px 0; color: #6D6D6D; font-size: 14px;">
            <strong>Tipo de Seguro</strong>
          </td>
          <td style="padding: 10px 0; text-align: right; font-weight: 600; font-size: 14px; color: #010139;">
            ${ramo}
          </td>
        </tr>
        <tr style="border-bottom: 1px solid rgba(1, 1, 57, 0.1);">
          <td style="padding: 10px 0; color: #6D6D6D; font-size: 14px;">
            <strong>Aseguradora</strong>
          </td>
          <td style="padding: 10px 0; text-align: right; font-weight: 600; font-size: 14px; color: #010139;">
            ${insurerName}
          </td>
        </tr>
        <tr style="border-bottom: 1px solid rgba(1, 1, 57, 0.1);">
          <td style="padding: 10px 0; color: #6D6D6D; font-size: 14px;">
            <strong>Número de Póliza</strong>
          </td>
          <td style="padding: 10px 0; text-align: right; font-weight: 600; font-size: 14px; color: #010139;">
            ${policyNumber}
          </td>
        </tr>
        <tr style="border-bottom: 1px solid rgba(1, 1, 57, 0.1);">
          <td style="padding: 10px 0; color: #6D6D6D; font-size: 14px;">
            <strong>Vigencia Actual</strong>
          </td>
          <td style="padding: 10px 0; text-align: right; font-weight: 600; font-size: 14px; color: #010139;">
            Desde ${formattedStartDate}
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #6D6D6D; font-size: 14px;">
            <strong>Fecha de Renovación</strong>
          </td>
          <td style="padding: 10px 0; text-align: right; font-weight: 700; font-size: 16px; color: ${daysUntilRenewal <= 30 ? '#FF6B00' : '#8AAA19'};">
            ${formattedRenewalDate}
            ${daysUntilRenewal > 0 ? `<br><span style="font-size: 13px; color: #6D6D6D;">(en ${daysUntilRenewal} días)</span>` : ''}
          </td>
        </tr>
      </table>
    </div>

    ${daysUntilRenewal <= 30 && daysUntilRenewal > 0 ? `
    <div style="background: #fff3cd; padding: 18px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #FFC107;">
      <p style="margin: 0; font-size: 14px; color: #856404; line-height: 1.6;">
        ⏰ <strong>Su póliza vence en ${daysUntilRenewal} días.</strong> 
        Es importante que confirmemos su renovación lo antes posible para evitar quedar desprotegido/a.
      </p>
    </div>
    ` : ''}

    <!-- Pregunta Principal -->
    <div style="background: linear-gradient(135deg, #f0f7ff 0%, #e6f4ff 100%); padding: 30px; border-radius: 12px; margin: 30px 0; text-align: center; border: 2px solid #010139;">
      <p style="margin: 0 0 20px 0; font-size: 20px; font-weight: 700; color: #010139; line-height: 1.4;">
        ¿Desea revisar las coberturas de su póliza para proceder con la renovación?
      </p>
      
      <!-- Botones SI y NO -->
      <div style="display: flex; gap: 15px; justify-content: center; margin-top: 25px;">
        <!-- Botón SI -->
        <a href="${yesUrl}" style="display: inline-block; background: linear-gradient(135deg, #8AAA19 0%, #6f8815 100%); color: #ffffff !important; text-decoration: none; padding: 16px 50px; border-radius: 10px; font-size: 18px; font-weight: 700; box-shadow: 0 4px 12px rgba(138, 170, 25, 0.3); transition: all 0.3s ease;">
          ✅ SÍ, DESEO RENOVAR
        </a>
        
        <!-- Botón NO -->
        <a href="${noUrl}" style="display: inline-block; background: linear-gradient(135deg, #6D6D6D 0%, #555555 100%); color: #ffffff !important; text-decoration: none; padding: 16px 50px; border-radius: 10px; font-size: 18px; font-weight: 700; box-shadow: 0 4px 12px rgba(109, 109, 109, 0.3); transition: all 0.3s ease;">
          ❌ NO DESEO RENOVAR
        </a>
      </div>

      <p style="margin: 20px 0 0 0; font-size: 12px; color: #6D6D6D; line-height: 1.5;">
        Al hacer click en una de las opciones, se enviará su respuesta automáticamente a nuestro equipo.
      </p>
    </div>

    <!-- Información del Broker -->
    <div style="background: #f7f7f7; padding: 20px; border-radius: 10px; margin: 25px 0;">
      <h3 style="margin: 0 0 15px 0; font-size: 15px; font-weight: 600; color: #010139;">
        👤 Su Corredor Asignado
      </h3>
      <p style="margin: 8px 0; color: #23262F; font-size: 14px;">
        <strong style="color: #010139;">Nombre:</strong> ${brokerName}
      </p>
      ${brokerEmail ? `
      <p style="margin: 8px 0; color: #23262F; font-size: 14px;">
        <strong style="color: #010139;">Email:</strong> ${brokerEmail}
      </p>
      ` : ''}
      ${brokerPhone ? `
      <p style="margin: 8px 0; color: #23262F; font-size: 14px;">
        <strong style="color: #010139;">Teléfono:</strong> ${brokerPhone}
      </p>
      ` : ''}
      <p style="margin: 12px 0 0 0; font-size: 13px; color: #6D6D6D; line-height: 1.5;">
        Si tiene alguna pregunta o requiere información adicional antes de tomar su decisión, 
        no dude en contactar directamente a su corredor.
      </p>
    </div>

    <!-- Beneficios de Renovar -->
    <div style="margin: 30px 0; padding: 25px; background: linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%); border-radius: 12px; border: 2px solid #8AAA19;">
      <h3 style="margin: 0 0 15px 0; font-size: 16px; font-weight: 600; color: #010139; text-align: center;">
        💡 Beneficios de Renovar a Tiempo
      </h3>
      <ul style="margin: 12px 0 0 0; padding-left: 20px; color: #23262F; font-size: 14px; line-height: 1.8;">
        <li>Mantiene su protección continua sin interrupciones</li>
        <li>Evita períodos sin cobertura que podrían ser riesgosos</li>
        <li>Conserva sus condiciones y beneficios actuales</li>
        <li>Proceso de renovación más rápido y sencillo</li>
        <li>Asesoría personalizada para ajustar coberturas según sus necesidades</li>
      </ul>
    </div>

    <p style="margin: 25px 0 15px 0; font-size: 15px; color: #23262F; line-height: 1.7; text-align: center;">
      Estamos comprometidos en brindarle el mejor servicio y las coberturas que realmente necesita. 
      Su seguridad y tranquilidad son nuestra prioridad. 🛡️
    </p>
  `;

  const html = BaseEmailTemplate({
    preheader,
    title,
    content,
    footerText: 'Líderes en Seguros - Gestión de Renovaciones'
  });

  return {
    subject: `🔄 Renovación de Póliza ${policyNumber} - Vence ${formattedRenewalDate}`,
    html
  };
}
