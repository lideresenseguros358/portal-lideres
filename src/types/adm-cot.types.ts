/**
 * ADM COT — TypeScript types for the quotation admin module
 * Maps 1:1 to Supabase tables: adm_cot_*
 */

// ════════════════════════════════════════════
// ENUMS
// ════════════════════════════════════════════

export type QuoteStatus = 'COTIZADA' | 'EMITIDA' | 'FALLIDA' | 'ABANDONADA';
export type PaymentStatus = 'PENDIENTE' | 'AGRUPADO' | 'PAGADO' | 'DEVOLUCION';
export type PaymentGroupStatus = 'PENDIENTE' | 'PARCIAL' | 'PAGADO';
export type RecurrenceFrequency = 'MENSUAL' | 'SEMESTRAL';
export type RecurrenceStatus = 'ACTIVA' | 'PAUSADA' | 'CANCELADA' | 'COMPLETADA';
export type ChatClassification = 'CONSULTA' | 'COTIZACION' | 'SOPORTE' | 'QUEJA' | 'QUEJA_COMPLEJA';
export type ChatStatus = 'ABIERTO' | 'ESCALADO' | 'CERRADO';

// ════════════════════════════════════════════
// 1. COTIZACIONES LOG
// ════════════════════════════════════════════

export interface AdmCotQuote {
  id: string;
  quote_ref: string;
  client_name: string;
  cedula: string | null;
  email: string | null;
  phone: string | null;
  ip_address: string | null;
  region: string | null;
  device: string | null;
  user_agent: string | null;
  status: QuoteStatus;
  insurer: string;
  ramo: string;
  coverage_type: string | null;
  plan_name: string | null;
  annual_premium: number | null;
  vehicle_info: Record<string, any> | null;
  quote_payload: Record<string, any> | null;
  last_step: string | null;
  steps_log: Array<{ step: string; ts: string }> | null;
  quoted_at: string;
  emitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type AdmCotQuoteInsert = Omit<AdmCotQuote, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

// ════════════════════════════════════════════
// 2. EXPEDIENTES DE EMISIÓN
// ════════════════════════════════════════════

export interface ExpedienteDocument {
  name: string;
  path: string;
  type: string;
  size: number;
  uploaded_at: string;
}

export interface AuditEntry {
  action: string;
  by: string;
  at: string;
  detail: string;
}

export interface AdmCotExpediente {
  id: string;
  quote_id: string | null;
  nro_poliza: string | null;
  insurer: string;
  ramo: string;
  coverage_type: string | null;
  client_name: string;
  cedula: string | null;
  email: string | null;
  phone: string | null;
  asset_info: Record<string, any> | null;
  annual_premium: number | null;
  payment_method: string | null;
  installments: number;
  documents: ExpedienteDocument[];
  signature_url: string | null;
  signature_at: string | null;
  veracidad_accepted: boolean;
  veracidad_ip: string | null;
  veracidad_at: string | null;
  veracidad_user_agent: string | null;
  audit_log: AuditEntry[];
  ip_address: string | null;
  region: string | null;
  user_agent: string | null;
  emitted_at: string;
  created_at: string;
  updated_at: string;
}

export type AdmCotExpedienteInsert = Omit<AdmCotExpediente, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

// ════════════════════════════════════════════
// 3. PAGOS
// ════════════════════════════════════════════

export interface AdmCotPayment {
  id: string;
  expediente_id: string | null;
  quote_id: string | null;
  client_name: string;
  cedula: string | null;
  nro_poliza: string | null;
  amount: number;
  currency: string;
  insurer: string;
  ramo: string;
  status: PaymentStatus;
  group_id: string | null;
  payment_source: string | null;
  payment_ref: string | null;
  payment_date: string | null;
  is_recurring: boolean;
  recurrence_id: string | null;
  installment_num: number | null;
  is_refund: boolean;
  refund_bank: string | null;
  refund_account: string | null;
  refund_account_type: string | null;
  refund_reason: string | null;
  notes: Record<string, any> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type AdmCotPaymentInsert = Omit<AdmCotPayment, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

// ════════════════════════════════════════════
// 4. AGRUPACIONES DE PAGO
// ════════════════════════════════════════════

export interface AdmCotPaymentGroup {
  id: string;
  bank_reference: string | null;
  total_amount: number;
  paid_amount: number;
  status: PaymentGroupStatus;
  insurers: string[];
  payment_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ════════════════════════════════════════════
// 5. HISTORIAL BANCO
// ════════════════════════════════════════════

export interface BankHistoryPaymentItem {
  payment_id: string;
  client: string;
  poliza: string;
  amount: number;
}

export interface AdmCotBankHistory {
  id: string;
  group_id: string | null;
  bank_reference: string;
  amount: number;
  transfer_date: string | null;
  payments: BankHistoryPaymentItem[];
  is_refund: boolean;
  executed_by: string | null;
  executed_at: string;
  notes: string | null;
  created_at: string;
}

// ════════════════════════════════════════════
// 6. RECURRENCIAS
// ════════════════════════════════════════════

export interface RecurrenceScheduleItem {
  num: number;
  due_date: string;
  status: 'PENDIENTE' | 'PAGADO' | 'VENCIDO';
  payment_id: string | null;
}

export interface AdmCotRecurrence {
  id: string;
  expediente_id: string | null;
  nro_poliza: string | null;
  client_name: string;
  cedula: string | null;
  insurer: string;
  total_installments: number;
  frequency: RecurrenceFrequency;
  installment_amount: number;
  status: RecurrenceStatus;
  start_date: string;
  end_date: string;
  next_due_date: string | null;
  schedule: RecurrenceScheduleItem[];
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ════════════════════════════════════════════
// 7. SEGUIMIENTO DE CHATS
// ════════════════════════════════════════════

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  ts: string;
}

export interface AdmCotChat {
  id: string;
  phone: string | null;
  email: string | null;
  cedula: string | null;
  session_id: string | null;
  region: string | null;
  classification: ChatClassification;
  status: ChatStatus;
  is_escalated: boolean;
  escalation_reason: string | null;
  escalation_email_sent: boolean;
  ai_summary: string | null;
  messages: ChatMessage[];
  task_id: string | null;
  started_at: string;
  last_message_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ════════════════════════════════════════════
// 8. DASHBOARD KPIs
// ════════════════════════════════════════════

export interface KpiByInsurer {
  [insurer: string]: { quotes: number; emissions: number };
}

export interface AbandonmentStep {
  step: string;
  count: number;
  pct: number;
}

export interface EndpointError {
  endpoint: string;
  count: number;
  last_error: string;
}

export interface HourlyHeatmapEntry {
  hour: number;
  day: number; // 0=Sun … 6=Sat
  count: number;
}

export interface AdmCotKpiSnapshot {
  id: string;
  snapshot_date: string;
  environment: string;
  quotes_today: number;
  quotes_week: number;
  quotes_month: number;
  emissions_today: number;
  emissions_week: number;
  emissions_month: number;
  conversion_rate: number;
  avg_time_to_emit: number;
  by_insurer: KpiByInsurer;
  by_ramo: Record<string, number>;
  abandonment: AbandonmentStep[];
  by_device: Record<string, number>;
  by_region: Record<string, number>;
  endpoint_errors: EndpointError[];
  pending_payments_total: number;
  payments_by_insurer: Record<string, number>;
  refunds_total: number;
  hourly_heatmap: HourlyHeatmapEntry[];
  created_at: string;
}

// ════════════════════════════════════════════
// FILTER / UI HELPERS
// ════════════════════════════════════════════

export interface AdmCotFilters {
  dateFrom?: string;
  dateTo?: string;
  insurer?: string;
  ramo?: string;
  status?: string;
  region?: string;
  search?: string;
}

export interface AdmCotPagination {
  page: number;
  pageSize: number;
  total: number;
}

/** Masking helpers — used in UI to protect sensitive data */
export function maskIp(ip: string | null): string {
  if (!ip) return '—';
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.***.**`;
  return '***';
}

export function maskCedula(cedula: string | null): string {
  if (!cedula) return '—';
  if (cedula.length <= 4) return '****';
  return '***' + cedula.slice(-4);
}

export function maskEmail(email: string | null): string {
  if (!email) return '—';
  const at = email.indexOf('@');
  if (at <= 1) return '***@' + email.slice(at + 1);
  return email[0] + '***@' + email.slice(at + 1);
}

export function maskPhone(phone: string | null): string {
  if (!phone) return '—';
  if (phone.length <= 4) return '****';
  return '***' + phone.slice(-4);
}

export function maskName(name: string | null): string {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? '';
  if (parts.length === 1) {
    return first.length > 2 ? first.slice(0, 2) + '***' : first;
  }
  return first + ' ' + parts.slice(1).map(p => (p[0] ?? '') + '***').join(' ');
}
