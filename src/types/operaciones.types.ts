// ═══════════════════════════════════════════════════════
// OPERACIONES — Types & Enums
// ═══════════════════════════════════════════════════════

// ── Renewal Statuses ──
export type RenewalStatus =
  | 'PENDIENTE'
  | 'EN_REVISION'
  | 'APLAZADO'
  | 'RENOVADO'
  | 'CANCELADO';

// ── Petition Statuses ──
export type PetitionStatus =
  | 'PENDIENTE'
  | 'EN_GESTION'
  | 'ENVIADO'
  | 'CERRADO'
  | 'PERDIDO';

// ── Urgency Statuses ──
export type UrgencyStatus =
  | 'ABIERTO'
  | 'EN_ATENCION'
  | 'RESUELTO'
  | 'ESCALADO';

// ── Morosidad Statuses ──
export type MorosidadStatus =
  | 'AL_DIA'
  | 'ATRASADO'
  | 'PAGO_RECIBIDO'
  | 'CANCELADO';

// ── Activity Action Types ──
export type ActivityActionType =
  | 'session_start'
  | 'session_end'
  | 'status_change'
  | 'email_sent'
  | 'chat_reply'
  | 'document_attached'
  | 'case_created'
  | 'case_assigned'
  | 'note_added'
  | 'renewal_confirmed'
  | 'cancellation_confirmed'
  | 'navigation';

// ── Entity Types ──
export type OpsEntityType =
  | 'renewal'
  | 'petition'
  | 'urgency'
  | 'morosidad'
  | 'email'
  | 'policy'
  | 'client'
  | 'session';

// ── Email Thread Status ──
export type EmailThreadStatus =
  | 'ABIERTO'
  | 'CERRADO'
  | 'NO_CLASIFICADO';

// ── Email Direction ──
export type EmailDirection = 'INBOUND' | 'OUTBOUND';

// ── Operaciones Tab Keys ──
export type OpsTab =
  | 'resumen'
  | 'renovaciones'
  | 'peticiones'
  | 'urgencias'
  | 'morosidad'
  | 'equipo'
  | 'logs'
  | 'config';

// ═══════════════════════════════════════════════════════
// DB Row Interfaces
// ═══════════════════════════════════════════════════════

export interface OpsActivityLog {
  id: string;
  user_id: string;
  action_type: ActivityActionType;
  entity_type: OpsEntityType | null;
  entity_id: string | null;
  created_at: string;
  metadata: Record<string, any> | null;
  session_block_id: string | null;
}

export interface OpsRenewal {
  id: string;
  ticket_number: string; // REN-YYMM-XXXXX
  policy_id: string;
  policy_number: string;
  client_id: string;
  client_name: string;
  insurer_id: string;
  insurer_name: string;
  renewal_date: string;
  status: RenewalStatus;
  assigned_to: string | null;
  postponed_date: string | null;
  cancellation_reason: string | null;
  new_start_date: string | null;
  new_end_date: string | null;
  last_email_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpsPetition {
  id: string;
  ticket_number: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  cedula: string | null;
  ramo: string; // VIDA, INCENDIO, HOGAR, etc.
  status: PetitionStatus;
  assigned_to: string | null;
  source: string; // cotizador form
  details: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface OpsUrgency {
  id: string;
  chat_thread_id: string;
  client_name: string | null;
  severity: 'low' | 'medium' | 'high';
  category: string;
  status: UrgencyStatus;
  sla_deadline: string | null;
  first_response_at: string | null;
  resolution_sentiment: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpsEmailThread {
  id: string;
  ticket_id: string | null;
  ticket_type: 'renewal' | 'petition' | 'general' | null;
  subject: string;
  from_email: string;
  to_email: string;
  status: EmailThreadStatus;
  last_message_at: string;
  created_at: string;
}

export interface OpsEmailMessage {
  id: string;
  thread_id: string;
  direction: EmailDirection;
  from_email: string;
  to_email: string;
  subject: string;
  body_html: string | null;
  body_text: string | null;
  has_attachments: boolean;
  message_id_header: string | null;
  in_reply_to: string | null;
  created_at: string;
}

export interface OpsConfig {
  id: string;
  key: string;
  value: any;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface OpsTeamMetric {
  id: string;
  user_id: string;
  user_name: string;
  period_type: 'day' | 'week' | 'month' | 'year';
  period_start: string;
  period_end: string;
  total_hours: number;
  avg_daily_hours: number;
  renewals_handled: number;
  quotes_made: number;
  emissions_made: number;
  conversion_rate: number;
  unattended_cases: number;
  urgencies_handled: number;
  urgency_effectiveness: number;
  unproductive_days: number;
  created_at: string;
}

// ── Ticket number generator ──
export function generateTicketNumber(prefix: string): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const rand = String(Math.floor(10000 + Math.random() * 90000));
  return `${prefix}-${yy}${mm}-${rand}`;
}
