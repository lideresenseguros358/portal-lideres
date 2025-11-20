/**
 * Send Notification Email
 * Helper para enviar emails de notificaciones
 */

import { sendEmail } from '@/lib/email/client';
import { markNotificationEmailSent } from './create';
import { getRenewalEmailContent } from '@/lib/email/templates/RenewalEmailTemplate';
import { getCaseDigestEmailContent } from '@/lib/email/templates/CaseDigestEmailTemplate';
import { getCommissionPaidEmailContent } from '@/lib/email/templates/CommissionPaidEmailTemplate';
import { getDelinquencyUpdateEmailContent } from '@/lib/email/templates/DelinquencyUpdateEmailTemplate';
import { getDownloadUpdateEmailContent } from '@/lib/email/templates/DownloadUpdateEmailTemplate';
import { getGuideUpdateEmailContent } from '@/lib/email/templates/GuideUpdateEmailTemplate';
import { getCarnetRenewalEmailContent } from '@/lib/email/templates/CarnetRenewalEmailTemplate';
import { getAgendaEventEmailContent } from '@/lib/email/templates/AgendaEventEmailTemplate';
import type { NotificationType } from './utils';

export interface SendNotificationEmailParams {
  type: NotificationType;
  to: string | string[];
  cc?: string | string[];
  data: any;
  notificationId?: string;
}

export interface SendNotificationEmailResult {
  success: boolean;
  messageId?: string;
  error?: any;
}

/**
 * Envía email de notificación según el tipo
 */
export async function sendNotificationEmail(
  params: SendNotificationEmailParams
): Promise<SendNotificationEmailResult> {
  try {
    let emailContent: { subject: string; html: string } | null = null;

    // Generar contenido según tipo
    switch (params.type) {
      case 'renewal':
        emailContent = getRenewalEmailContent(params.data);
        break;
      
      case 'case_digest':
        emailContent = getCaseDigestEmailContent(params.data);
        break;
      
      case 'commission':
        emailContent = getCommissionPaidEmailContent(params.data);
        break;
      
      case 'delinquency':
        emailContent = getDelinquencyUpdateEmailContent(params.data);
        break;
      
      case 'download':
        emailContent = getDownloadUpdateEmailContent(params.data);
        break;
      
      case 'guide':
        emailContent = getGuideUpdateEmailContent(params.data);
        break;
      
      case 'carnet_renewal':
        emailContent = getCarnetRenewalEmailContent(params.data);
        break;
      
      case 'agenda_event':
        emailContent = getAgendaEventEmailContent(params.data);
        break;
      
      default:
        throw new Error(`Tipo de notificación no soportado: ${params.type}`);
    }

    if (!emailContent) {
      throw new Error('No se pudo generar el contenido del email');
    }

    // Enviar email
    const result = await sendEmail({
      to: params.to,
      cc: params.cc,
      subject: emailContent.subject,
      html: emailContent.html
    });

    if (!result.success) {
      throw result.error;
    }

    // Marcar como enviado si hay notification ID
    if (params.notificationId) {
      await markNotificationEmailSent(params.notificationId);
    }

    return {
      success: true,
      messageId: (result.data as any)?.id
    };
  } catch (error) {
    console.error('Error enviando email de notificación:', error);
    return {
      success: false,
      error
    };
  }
}

/**
 * Helper para enviar email a destinatario principal + CC
 */
export async function sendNotificationEmailWithRecipients(
  type: NotificationType,
  primaryRecipient: string,
  ccRecipients: string[],
  data: any,
  notificationId?: string
): Promise<SendNotificationEmailResult> {
  return sendNotificationEmail({
    type,
    to: primaryRecipient,
    cc: ccRecipients.length > 0 ? ccRecipients : undefined,
    data,
    notificationId
  });
}
