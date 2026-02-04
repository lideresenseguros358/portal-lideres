/**
 * Client Birthday Email Template
 * Plantilla para notificar al broker sobre cumpleaños de cliente
 * Redactado como felicitación al cliente con info útil para el broker
 */

import { BaseEmailTemplate } from './BaseEmailTemplate';

export interface ClientBirthdayEmailData {
  clientName: string;
  brokerName: string;
  clientEmail?: string;
  clientPhone?: string;
  birthDate: string; // YYYY-MM-DD
  policies: Array<{
    policy_number: string;
    insurer_name: string;
    ramo: string;
    renewal_date: string; // YYYY-MM-DD
    status: string;
  }>;
}

export function getClientBirthdayEmailContent(data: ClientBirthdayEmailData): { subject: string; html: string } {
  const { clientName, brokerName, clientEmail, clientPhone, birthDate, policies } = data;

  // Formatear fecha de cumpleaños
  const birthDateObj = new Date(birthDate);
  const formattedBirthDate = birthDateObj.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long'
  });

  // Filtrar pólizas activas
  const activePolicies = policies.filter(p => p.status === 'ACTIVA');
  
  // Agrupar pólizas por proximidad de renovación
  const today = new Date();
  const nextMonthPolicies = activePolicies.filter(p => {
    const renewalDate = new Date(p.renewal_date);
    const diffTime = renewalDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 && diffDays <= 60; // Próximas a renovar en 60 días
  });

  const title = `🎂 ¡Feliz Cumpleaños ${clientName.split(' ')[0]}!`;
  const preheader = `${clientName} cumple años hoy - Información de pólizas`;

  const content = `
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="font-size: 48px; margin-bottom: 10px;">🎉</div>
      <p style="font-size: 20px; font-weight: 600; color: #010139; margin: 10px 0;">
        ¡Feliz Cumpleaños, ${clientName}!
      </p>
      <p style="font-size: 16px; color: #6D6D6D; margin: 10px 0;">
        En este día especial, queremos desearle lo mejor
      </p>
    </div>

    <div style="background: linear-gradient(135deg, #f0f7ff 0%, #e6f4ff 100%); padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 4px solid #8AAA19;">
      <p style="margin: 0 0 15px 0; font-size: 14px; font-weight: 600; color: #010139; text-transform: uppercase; letter-spacing: 0.5px;">
        📋 Para: ${brokerName}
      </p>
      <p style="margin: 8px 0; color: #23262F;">
        <strong style="color: #010139;">Cliente:</strong> ${clientName}
      </p>
      <p style="margin: 8px 0; color: #23262F;">
        <strong style="color: #010139;">Fecha de nacimiento:</strong> ${formattedBirthDate}
      </p>
      ${clientEmail ? `
      <p style="margin: 8px 0; color: #23262F;">
        <strong style="color: #010139;">Email:</strong> ${clientEmail}
      </p>
      ` : ''}
      ${clientPhone ? `
      <p style="margin: 8px 0; color: #23262F;">
        <strong style="color: #010139;">Teléfono:</strong> ${clientPhone}
      </p>
      ` : ''}
    </div>

    ${activePolicies.length > 0 ? `
    <div style="margin: 30px 0;">
      <h3 style="font-size: 18px; font-weight: 600; color: #010139; margin: 0 0 20px 0; display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 24px;">📋</span>
        Pólizas Activas del Cliente
      </h3>
      
      ${activePolicies.map((policy, index) => {
        const renewalDate = new Date(policy.renewal_date);
        const formattedRenewal = renewalDate.toLocaleDateString('es-ES', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
        
        const diffTime = renewalDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const isNearRenewal = diffDays > 0 && diffDays <= 60;
        
        return `
        <div style="background: ${isNearRenewal ? '#fff9e6' : '#f7f7f7'}; padding: 18px; border-radius: 10px; margin-bottom: 12px; border-left: 4px solid ${isNearRenewal ? '#FFC107' : '#8AAA19'};">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
            <div>
              <p style="margin: 0; font-size: 15px; font-weight: 600; color: #010139;">
                ${policy.ramo || 'Seguro'}
              </p>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #6D6D6D;">
                ${policy.insurer_name}
              </p>
            </div>
            <span style="background: ${isNearRenewal ? '#FFC107' : '#8AAA19'}; color: white; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600;">
              ACTIVA
            </span>
          </div>
          <p style="margin: 8px 0 0 0; font-size: 13px; color: #23262F;">
            <strong style="color: #010139;">Póliza:</strong> ${policy.policy_number}
          </p>
          <p style="margin: 6px 0 0 0; font-size: 13px; color: #23262F;">
            <strong style="color: #010139;">Renovación:</strong> ${formattedRenewal}
            ${isNearRenewal ? `<span style="color: #FF6B00; font-weight: 600;"> (en ${diffDays} días)</span>` : ''}
          </p>
        </div>
        `;
      }).join('')}
    </div>
    ` : ''}

    ${nextMonthPolicies.length > 0 ? `
    <div style="background: #fff3cd; padding: 20px; border-radius: 10px; margin: 25px 0; border-left: 4px solid #FFC107;">
      <p style="margin: 0 0 10px 0; font-weight: 600; color: #856404;">
        ⏰ Oportunidad de Renovación
      </p>
      <p style="margin: 0; font-size: 14px; color: #856404;">
        Este cliente tiene <strong>${nextMonthPolicies.length}</strong> ${nextMonthPolicies.length === 1 ? 'póliza próxima' : 'pólizas próximas'} a renovar en los próximos 60 días.
        Es un excelente momento para contactarlo y revisar sus coberturas.
      </p>
    </div>
    ` : ''}

    <div style="margin: 30px 0; padding: 25px; background: linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%); border-radius: 12px; border: 2px solid #8AAA19;">
      <p style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #010139; text-align: center;">
        💡 Recomendación para el Broker
      </p>
      <p style="margin: 0; font-size: 14px; color: #23262F; line-height: 1.7;">
        El cumpleaños es el momento perfecto para:
      </p>
      <ul style="margin: 12px 0 0 0; padding-left: 20px; color: #23262F; font-size: 14px; line-height: 1.8;">
        <li>Fortalecer la relación con tu cliente</li>
        <li>Recordarle sobre sus pólizas activas</li>
        <li>Revisar si necesita actualizar sus coberturas</li>
        <li>Ofrecer productos adicionales que puedan beneficiarlo</li>
      </ul>
    </div>

    ${!clientEmail && !clientPhone ? `
    <div style="background: #fff3cd; padding: 18px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #FFC107;">
      <p style="margin: 0; font-size: 13px; color: #856404;">
        ⚠️ <strong>Importante:</strong> Este cliente no tiene email ni teléfono registrado.
        Actualiza su información de contacto para mejorar la comunicación.
      </p>
    </div>
    ` : ''}

    <p style="margin: 25px 0 15px 0; font-size: 15px; color: #23262F; text-align: center;">
      Aprovecha este día especial para contactar a tu cliente y fortalecer tu relación profesional. 🎊
    </p>
  `;

  const html = BaseEmailTemplate({
    preheader,
    title,
    content,
    ctaText: 'Ver Cliente en Portal',
    ctaUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/db`,
    footerText: 'Portal Líderes - Recordatorios de Cumpleaños'
  });

  return {
    subject: `🎂 Cumpleaños de ${clientName} - Oportunidad de contacto`,
    html
  };
}
