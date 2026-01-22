/**
 * TIPOS PARA SISTEMA DE CORREOS
 * ==============================
 * Tipos centralizados para todo el sistema de email
 */

export type EmailFromType = 'PORTAL' | 'TRAMITES';

export type EmailTemplate = 
  | 'renewalReminder'
  | 'renewalConfirm'
  | 'birthdayClient'
  | 'birthdayBroker'
  | 'commissionPaid'
  | 'commissionAdjustmentPaid'
  | 'preliminarIncomplete'
  | 'morosidadImported'
  | 'pendienteCreated'
  | 'pendienteUpdated'
  | 'pendienteClosedApproved'
  | 'pendienteClosedRejected'
  | 'pendienteAplazado'
  | 'pendientesDailyDigest'
  | 'agendaCreated'
  | 'agendaUpdated'
  | 'agendaDeleted'
  | 'agendaReminder';

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  fromType: EmailFromType;
  dedupeKey?: string;
  metadata?: Record<string, any>;
  template?: EmailTemplate;
}

export interface EmailLogRecord {
  id: string;
  to: string;
  subject: string;
  template: string | null;
  dedupe_key: string | null;
  status: 'sent' | 'failed' | 'skipped';
  error: string | null;
  metadata: any;
  created_at: string;
}

export interface TemplateData {
  [key: string]: any;
}
