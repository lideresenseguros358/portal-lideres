// ═══════════════════════════════════════════════════════
// OPERACIONES — Types & Enums (V2 — Unified ops_cases)
// ═══════════════════════════════════════════════════════

// ── Case Type (maps to ops_case_type_enum in DB) ──
export type OpsCaseType = 'renovacion' | 'peticion' | 'urgencia';

// ── Case Status (maps to ops_case_status_enum in DB) ──
// Renovaciones: pendiente, en_revision, aplazado, cerrado_renovado, cerrado_cancelado
// Peticiones:   pendiente, en_gestion, enviado, cerrado, perdido
// Urgencias:    pendiente, en_atencion, resuelto, cerrado
export type OpsCaseStatus =
  | 'pendiente'
  | 'en_revision'
  | 'aplazado'
  | 'cerrado_renovado'
  | 'cerrado_cancelado'
  | 'en_gestion'
  | 'enviado'
  | 'cerrado'
  | 'perdido'
  | 'en_atencion'
  | 'resuelto';

// Status subsets per case type (for UI filtering)
export const RENEWAL_STATUSES: OpsCaseStatus[] = ['pendiente', 'en_revision', 'aplazado', 'cerrado_renovado', 'cerrado_cancelado'];
export const PETITION_STATUSES: OpsCaseStatus[] = ['pendiente', 'en_gestion', 'enviado', 'cerrado', 'perdido'];
export const URGENCY_STATUSES: OpsCaseStatus[] = ['pendiente', 'en_atencion', 'resuelto', 'cerrado'];

// Closed statuses (case is done)
export const CLOSED_STATUSES: OpsCaseStatus[] = ['cerrado_renovado', 'cerrado_cancelado', 'cerrado', 'perdido', 'resuelto'];

// ── Morosidad Status (maps to ops_morosidad_status_enum in DB) ──
export type OpsMorosidadStatus = 'al_dia' | 'atrasado' | 'pago_recibido' | 'cancelado';

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
  | 'first_response'
  | 'navigation';

// ── Entity Types ──
export type OpsEntityType =
  | 'case'
  | 'renewal'
  | 'petition'
  | 'urgency'
  | 'morosidad'
  | 'email'
  | 'policy'
  | 'client'
  | 'session';

// ── Email Thread Status ──
export type EmailThreadStatus = 'ABIERTO' | 'CERRADO' | 'NO_CLASIFICADO';

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

// ── Unified Case (ops_cases) ──
export interface OpsCase {
  id: string;
  ticket: string;
  case_type: OpsCaseType;
  status: OpsCaseStatus;

  // Relations
  policy_id: string | null;
  client_id: string | null;
  client_name: string | null;
  insurer_name: string | null;
  policy_number: string | null;
  renewal_date: string | null;
  ramo: string | null;

  // Assignment
  assigned_master_id: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
  first_response_at: string | null;
  closed_at: string | null;

  // SLA
  sla_breached: boolean;

  // Urgency specifics
  urgency_flag: boolean;
  chat_thread_id: string | null;
  severity: string | null;
  category: string | null;

  // Renovation specifics
  aplazado_until: string | null;
  cancellation_reason: string | null;
  new_start_date: string | null;
  new_end_date: string | null;
  last_email_summary: string | null;

  // Petition specifics
  client_email: string | null;
  client_phone: string | null;
  cedula: string | null;
  source: string | null;
  details: Record<string, any> | null;
}

// ── Case History (ops_case_history) ──
export interface OpsCaseHistory {
  id: string;
  case_id: string;
  changed_by: string | null;
  change_type: string;
  before_state: Record<string, any> | null;
  after_state: Record<string, any> | null;
  related_message_id: string | null;
  created_at: string;
}

// ── Activity Log (ops_activity_log) ──
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

// ── Email Thread (ops_email_threads) ──
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

// ── Email Message (ops_email_messages) ──
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

// ── Case Message (ops_case_messages — IMAP sync) ──
export type OpsMsgDirection = 'inbound' | 'outbound';
export type OpsMsgProvider = 'zoho_imap' | 'zepto';

export interface OpsCaseMessage {
  id: string;
  case_id: string | null;
  unclassified: boolean;
  direction: OpsMsgDirection;
  provider: OpsMsgProvider;
  message_id: string;
  in_reply_to: string | null;
  references: string | null;
  from_email: string;
  to_emails: string[];
  subject: string;
  body_text: string | null;
  body_html: string | null;
  received_at: string;
  created_at: string;
  metadata: Record<string, any>;
}

// ── Config (ops_config) ──
export interface OpsConfig {
  id: string;
  key: string;
  value: any;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

// ── Daily Metrics (ops_metrics_daily) ──
export interface OpsMetricsDaily {
  id: string;
  user_id: string;
  date: string;
  hours_worked: number;
  cases_handled: number;
  renewals_handled: number;
  petitions_handled: number;
  urgencies_handled: number;
  emissions_confirmed: number;
  conversions_count: number;
  sla_breaches: number;
  unresolved_cases: number;
  productivity_score: number;
  low_productivity: boolean;
}

// ── User Session (ops_user_sessions) ──
export interface OpsUserSession {
  id: string;
  user_id: string;
  session_start: string;
  session_end: string | null;
  duration_minutes: number;
  block_id: string | null;
}

// ── Productivity Flag (ops_productivity_flags) ──
export interface OpsProductivityFlag {
  id: string;
  user_id: string;
  date: string;
  low_productivity: boolean;
  monthly_avg_cases: number;
  actual_cases: number;
  threshold_pct: number;
  note: string | null;
}

// ── Morosidad View Row (ops_morosidad_view) ──
export interface OpsMorosidadRow {
  policy_id: string;
  policy_number: string;
  ramo: string | null;
  renewal_date: string | null;
  policy_status: string;
  client_id: string;
  client_name: string;
  cedula: string | null;
  client_email: string | null;
  client_phone: string | null;
  insurer_name: string | null;
  payment_id: string | null;
  payment_amount: number | null;
  payment_date: string | null;
  payment_status: string | null;
  is_recurring: boolean;
  recurrence_id: string | null;
  recurrence_status: string | null;
  next_due_date: string | null;
  total_installments: number | null;
  installment_amount: number | null;
  morosidad_status: OpsMorosidadStatus;
  days_overdue: number;
}

// ── Team Metric (legacy ops_team_metrics, still used for aggregated periods) ──
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

// ── Status badge colors ──
export const STATUS_COLORS: Record<OpsCaseStatus, { bg: string; text: string }> = {
  pendiente:          { bg: 'bg-amber-100',  text: 'text-amber-800'  },
  en_revision:        { bg: 'bg-blue-100',   text: 'text-blue-800'   },
  aplazado:           { bg: 'bg-purple-100', text: 'text-purple-800' },
  cerrado_renovado:   { bg: 'bg-green-100',  text: 'text-green-800'  },
  cerrado_cancelado:  { bg: 'bg-red-100',    text: 'text-red-800'    },
  en_gestion:         { bg: 'bg-blue-100',   text: 'text-blue-800'   },
  enviado:            { bg: 'bg-teal-100',   text: 'text-teal-800'   },
  cerrado:            { bg: 'bg-green-100',  text: 'text-green-800'  },
  perdido:            { bg: 'bg-red-100',    text: 'text-red-800'    },
  en_atencion:        { bg: 'bg-orange-100', text: 'text-orange-800' },
  resuelto:           { bg: 'bg-green-100',  text: 'text-green-800'  },
};

// ── Status display labels ──
export const STATUS_LABELS: Record<OpsCaseStatus, string> = {
  pendiente:          'Pendiente',
  en_revision:        'En Revisión',
  aplazado:           'Aplazado',
  cerrado_renovado:   'Renovado',
  cerrado_cancelado:  'Cancelado',
  en_gestion:         'En Gestión',
  enviado:            'Enviado',
  cerrado:            'Cerrado',
  perdido:            'Perdido',
  en_atencion:        'En Atención',
  resuelto:           'Resuelto',
};

// ── Ticket number generator ──
export function generateTicketNumber(prefix: 'REN' | 'PET' | 'URG'): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const rand = String(Math.floor(10000 + Math.random() * 90000));
  return `${prefix}-${yy}${mm}-${rand}`;
}

// ── SLA thresholds (hours) ──
export const SLA_THRESHOLDS = {
  RENOVATION_FIRST_RESPONSE: 48,  // wall-clock hours
  PETITION_FIRST_RESPONSE: 48,    // wall-clock hours
  URGENCY_FIRST_RESPONSE: 24,     // business hours (Mon-Fri 9-17)
} as const;

// ═══════════════════════════════════════════════════════
// AI Evaluation Types
// ═══════════════════════════════════════════════════════

export type SentimentLabel = 'positive' | 'neutral' | 'negative';

export interface OpsAiEvaluation {
  id: string;
  case_id: string;
  source_type: 'adm_cot_chat' | 'ops_email_thread';
  source_id: string | null;
  evaluated_at: string;
  evaluator_version: string;
  final_sentiment_label: SentimentLabel;
  final_sentiment_score: number;
  effectiveness_score: number;
  escalation_recommended: boolean;
  unresolved_signals: string[];
  rationale: string | null;
  evidence: Record<string, any>;
  created_at: string;
}

export interface OpsAiMemoryItem {
  id: string;
  created_at: string;
  created_by: string;
  domain: 'quejas' | 'pagos' | 'renovaciones' | 'politicas' | 'tono' | 'procedimiento';
  title: string;
  content: string;
  tags: string[];
  confidence: number;
  last_used_at: string | null;
  metadata: Record<string, any>;
}

export interface OpsAiTrainingEvent {
  id: string;
  created_at: string;
  case_id: string | null;
  event_type: 'learn_from_human_reply' | 'learn_policy_update' | 'score_case';
  payload: Record<string, any>;
  model_provider: string | null;
  model_name: string | null;
  success: boolean;
  error: string | null;
}
