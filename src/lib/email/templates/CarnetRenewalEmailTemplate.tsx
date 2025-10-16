/**
 * Carnet Renewal Email Template
 * Email de notificación para renovación de carnet del corredor
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EMAIL_CONFIG } from '../client';

export interface CarnetRenewalEmailData {
  brokerName: string;
  brokerEmail: string;
  expiryDate: string;
  daysUntilExpiry: number;
  urgency: 'critical' | 'warning' | 'expired';
}

export function CarnetRenewalEmailTemplate({ data }: { data: CarnetRenewalEmailData }) {
  const { colors, baseUrl } = EMAIL_CONFIG;
  
  const getUrgencyColor = () => {
    switch (data.urgency) {
      case 'critical':
        return '#EF4444'; // Rojo
      case 'warning':
        return '#F59E0B'; // Naranja
      case 'expired':
        return '#DC2626'; // Rojo oscuro
      default:
        return '#F59E0B';
    }
  };

  const getUrgencyIcon = () => {
    switch (data.urgency) {
      case 'critical':
        return '🚨';
      case 'warning':
        return '⚠️';
      case 'expired':
        return '❌';
      default:
        return '⚠️';
    }
  };

  const getTitle = () => {
    if (data.daysUntilExpiry < 0) {
      return 'Carnet Vencido - Acción Requerida';
    } else if (data.daysUntilExpiry === 0) {
      return 'Tu Carnet Vence Hoy';
    } else if (data.daysUntilExpiry <= 30) {
      return 'Renovación de Carnet Próxima';
    } else {
      return 'Renovación de Carnet - 60 Días';
    }
  };

  const getMessage = () => {
    if (data.daysUntilExpiry < 0) {
      const daysExpired = Math.abs(data.daysUntilExpiry);
      return `Tu carnet venció hace ${daysExpired} día${daysExpired !== 1 ? 's' : ''}. Es necesario renovarlo inmediatamente para continuar operando.`;
    } else if (data.daysUntilExpiry === 0) {
      return 'Tu carnet vence hoy. Es urgente que inicies el proceso de renovación.';
    } else if (data.daysUntilExpiry <= 30) {
      return `Tu carnet vencerá en ${data.daysUntilExpiry} día${data.daysUntilExpiry !== 1 ? 's' : ''}. Te recomendamos iniciar el proceso de renovación lo antes posible.`;
    } else {
      return `Tu carnet vencerá en ${data.daysUntilExpiry} días. Este es un recordatorio anticipado para que planifiques tu renovación.`;
    }
  };

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      lineHeight: '1.6',
      color: colors.text,
      backgroundColor: colors.backgroundAlt,
      padding: '40px 20px',
    }}>
      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
        backgroundColor: colors.background,
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
      }}>
        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
          padding: '32px 24px',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '12px',
          }}>
            {getUrgencyIcon()}
          </div>
          <h1 style={{
            margin: '0',
            fontSize: '24px',
            fontWeight: '700',
            color: '#ffffff',
          }}>
            {getTitle()}
          </h1>
        </div>

        {/* Content */}
        <div style={{ padding: '32px 24px' }}>
          <p style={{
            fontSize: '16px',
            marginBottom: '24px',
            color: colors.text,
          }}>
            Hola <strong>{data.brokerName}</strong>,
          </p>

          {/* Urgency Banner */}
          <div style={{
            backgroundColor: `${getUrgencyColor()}15`,
            borderLeft: `4px solid ${getUrgencyColor()}`,
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '24px',
          }}>
            <p style={{
              margin: '0',
              fontSize: '15px',
              color: colors.text,
              fontWeight: '500',
            }}>
              {getMessage()}
            </p>
          </div>

          {/* Carnet Details */}
          <div style={{
            backgroundColor: colors.backgroundAlt,
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '24px',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{
                    padding: '12px 0',
                    fontSize: '14px',
                    color: colors.textLight,
                    borderBottom: `1px solid ${colors.backgroundAlt}`,
                  }}>
                    Corredor:
                  </td>
                  <td style={{
                    padding: '12px 0',
                    fontSize: '15px',
                    fontWeight: '600',
                    textAlign: 'right',
                    color: colors.text,
                    borderBottom: `1px solid ${colors.backgroundAlt}`,
                  }}>
                    {data.brokerName}
                  </td>
                </tr>
                <tr>
                  <td style={{
                    padding: '12px 0',
                    fontSize: '14px',
                    color: colors.textLight,
                    borderBottom: `1px solid ${colors.backgroundAlt}`,
                  }}>
                    Email:
                  </td>
                  <td style={{
                    padding: '12px 0',
                    fontSize: '15px',
                    fontWeight: '600',
                    textAlign: 'right',
                    color: colors.text,
                    borderBottom: `1px solid ${colors.backgroundAlt}`,
                  }}>
                    {data.brokerEmail}
                  </td>
                </tr>
                <tr>
                  <td style={{
                    padding: '12px 0',
                    fontSize: '14px',
                    color: colors.textLight,
                  }}>
                    Fecha de Vencimiento:
                  </td>
                  <td style={{
                    padding: '12px 0',
                    fontSize: '16px',
                    fontWeight: '700',
                    textAlign: 'right',
                    color: getUrgencyColor(),
                  }}>
                    {data.expiryDate}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Action Required */}
          <div style={{
            backgroundColor: '#FFF9E6',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '24px',
          }}>
            <h3 style={{
              margin: '0 0 12px 0',
              fontSize: '16px',
              fontWeight: '700',
              color: colors.primary,
            }}>
              📋 Pasos para Renovar tu Carnet:
            </h3>
            <ol style={{
              margin: '0',
              paddingLeft: '20px',
              color: colors.text,
              fontSize: '14px',
            }}>
              <li style={{ marginBottom: '8px' }}>Contacta a la Superintendencia de Seguros y Reaseguros de Panamá</li>
              <li style={{ marginBottom: '8px' }}>Prepara la documentación requerida</li>
              <li style={{ marginBottom: '8px' }}>Realiza el pago correspondiente</li>
              <li style={{ marginBottom: '8px' }}>Actualiza la fecha en el sistema una vez renovado</li>
            </ol>
          </div>

          {/* CTA Button */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <a
              href={`${baseUrl}/account`}
              style={{
                display: 'inline-block',
                padding: '14px 32px',
                backgroundColor: colors.secondary,
                color: '#ffffff',
                textDecoration: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: '600',
                boxShadow: '0 4px 12px rgba(138, 170, 25, 0.3)',
              }}
            >
              Ir a Mi Cuenta
            </a>
          </div>

          <p style={{
            fontSize: '14px',
            color: colors.textLight,
            textAlign: 'center',
            margin: '0',
          }}>
            Para cualquier duda, contacta al administrador del sistema.
          </p>
        </div>

        {/* Footer */}
        <div style={{
          backgroundColor: colors.backgroundAlt,
          padding: '24px',
          textAlign: 'center',
          borderTop: `1px solid ${colors.backgroundAlt}`,
        }}>
          <p style={{
            margin: '0 0 8px 0',
            fontSize: '12px',
            color: colors.textLight,
          }}>
            Este es un mensaje automático del Portal Líderes en Seguros
          </p>
          <p style={{
            margin: '0',
            fontSize: '11px',
            color: colors.textLight,
          }}>
            © 2025 Líderes en Seguros | Regulado y Supervisado por la Superintendencia de Seguros y Reaseguros de Panamá
          </p>
        </div>
      </div>
    </div>
  );
}

export function getCarnetRenewalEmailContent(data: CarnetRenewalEmailData): { subject: string; html: string } {
  const subject = data.daysUntilExpiry < 0
    ? `🚨 URGENTE: Tu Carnet ha Vencido`
    : data.daysUntilExpiry === 0
    ? `⚠️ Tu Carnet Vence HOY - ${data.brokerName}`
    : data.daysUntilExpiry <= 30
    ? `⚠️ Renovación de Carnet en ${data.daysUntilExpiry} días - ${data.brokerName}`
    : `📋 Recordatorio: Renovación de Carnet en ${data.daysUntilExpiry} días`;

  const html = renderToStaticMarkup(<CarnetRenewalEmailTemplate data={data} />);

  return { subject, html };
}
