// =====================================================
// TICKETING SYSTEM - TYPE DEFINITIONS
// =====================================================

export type CaseStatusSimplified = 
  | 'NUEVO'
  | 'EN_PROCESO'
  | 'PENDIENTE_CLIENTE'
  | 'PENDIENTE_BROKER'
  | 'ENVIADO'
  | 'APLAZADO'
  | 'CERRADO_APROBADO'
  | 'CERRADO_RECHAZADO';

// =====================================================
// CATALOG TYPES
// =====================================================

export interface RamoCatalog {
  id: string;
  code: string; // 01-99
  name: string;
  description?: string | null;
  sla_days_default: number;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface AseguradoraCatalog {
  id: string;
  code: string; // 01-99
  name: string;
  short_name?: string | null;
  insurer_id?: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface TramiteCatalog {
  id: string;
  code: string; // 1-99
  name: string;
  description?: string | null;
  requires_policy_number: boolean;
  sla_modifier: number;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// =====================================================
// TICKET TYPES
// =====================================================

export interface TicketSequence {
  id: string;
  year_month: string; // AAMM
  ramo_code: string;
  aseguradora_code: string;
  tramite_code: string;
  last_correlative: number;
  created_at: string;
  updated_at: string;
}

export interface TicketComponents {
  yearMonth: string; // AAMM (2601)
  ramoCode: string; // 03
  aseguradoraCode: string; // 01
  tramiteCode: string; // 01
  correlative: string; // 001
  fullTicket: string; // 260103010001
}

export interface CaseTicketHistory {
  id: string;
  case_id: string;
  old_ticket?: string | null;
  new_ticket: string;
  reason: 'INITIAL_GENERATION' | 'RAMO_CHANGED' | 'INSURER_CHANGED' | 'TRAMITE_CHANGED' | 'REOPENED';
  changed_by?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
}

// =====================================================
// VACATION CONFIG
// =====================================================

export interface VacationConfig {
  id: string;
  master_email: string;
  master_name: string;
  is_on_vacation: boolean;
  vacation_start?: string | null;
  vacation_end?: string | null;
  backup_email?: string | null;
  auto_reassign: boolean;
  created_at: string;
  updated_at: string;
}

// =====================================================
// SECURITY LOGS
// =====================================================

export interface CaseSecurityLog {
  id: string;
  case_id: string;
  action_type: string;
  actor_id?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;
  field_changed?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
}

// =====================================================
// UNCLASSIFIED EMAILS
// =====================================================

export interface UnclassifiedEmail {
  id: string;
  message_id?: string | null;
  thread_id?: string | null;
  from_email: string;
  from_name?: string | null;
  subject?: string | null;
  body_text?: string | null;
  body_html?: string | null;
  received_at: string;
  grouped_until?: string | null;
  assigned_to_case_id?: string | null;
  assigned_at?: string | null;
  assigned_by?: string | null;
  status: 'PENDING' | 'GROUPED' | 'ASSIGNED' | 'DISCARDED';
  confidence_score?: number | null;
  metadata?: Record<string, any> | null;
  created_at: string;
}

// =====================================================
// EXTENDED CASE TYPE
// =====================================================

export interface CaseWithTicketing {
  id: string;
  ticket_ref?: string | null;
  ramo_code?: string | null;
  aseguradora_code?: string | null;
  tramite_code?: string | null;
  status_v2: CaseStatusSimplified;
  is_classified: boolean;
  classified_at?: string | null;
  sla_paused: boolean;
  sla_paused_at?: string | null;
  sla_paused_reason?: string | null;
  sla_accumulated_pause_days: number;
  aplazar_months?: number | null;
  aplazar_notify_at?: string | null;
  reopened_from_ticket?: string | null;
  reopen_count: number;
  final_policy_number?: string | null;
  ticket_generated_at?: string | null;
  classification_changed_count: number;
  // ... otros campos del caso original
}

// =====================================================
// STATUS LABELS AND COLORS
// =====================================================

export const STATUS_LABELS_V2: Record<CaseStatusSimplified, string> = {
  NUEVO: 'Nuevo',
  EN_PROCESO: 'En proceso',
  PENDIENTE_CLIENTE: 'Pendiente cliente',
  PENDIENTE_BROKER: 'Pendiente broker',
  ENVIADO: 'Enviado',
  APLAZADO: 'Aplazado',
  CERRADO_APROBADO: 'Cerrado aprobado',
  CERRADO_RECHAZADO: 'Cerrado rechazado',
};

export const STATUS_COLORS_V2: Record<CaseStatusSimplified, string> = {
  NUEVO: 'bg-blue-100 text-blue-800 border-blue-300',
  EN_PROCESO: 'bg-purple-100 text-purple-800 border-purple-300',
  PENDIENTE_CLIENTE: 'bg-orange-100 text-orange-800 border-orange-300',
  PENDIENTE_BROKER: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  ENVIADO: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  APLAZADO: 'bg-gray-100 text-gray-800 border-gray-300',
  CERRADO_APROBADO: 'bg-green-100 text-green-800 border-green-300',
  CERRADO_RECHAZADO: 'bg-red-100 text-red-800 border-red-300',
};

export const STATUS_ICONS_V2: Record<CaseStatusSimplified, string> = {
  NUEVO: '🆕',
  EN_PROCESO: '⚙️',
  PENDIENTE_CLIENTE: '👤',
  PENDIENTE_BROKER: '🤝',
  ENVIADO: '📤',
  APLAZADO: '⏸️',
  CERRADO_APROBADO: '✅',
  CERRADO_RECHAZADO: '❌',
};

// =====================================================
// MASTER ASSIGNMENT RULES
// =====================================================

export const MASTER_ASSIGNMENT_RULES = {
  RAMOS_GENERALES: {
    email: 'yiraramos@lideresenseguros.com',
    name: 'Yira Ramos',
  },
  VIDA_ASSA: {
    email: 'lucianieto@lideresenseguros.com',
    name: 'Lucía Nieto',
  },
  OTROS_PERSONAS: {
    email: 'lucianieto@lideresenseguros.com',
    name: 'Lucía Nieto',
  },
} as const;

export const MASTER_SPECIAL_EMAILS = [
  'lucianieto@lideresenseguros.com',
  'yiraramos@lideresenseguros.com',
  'javiersamudio@lideresenseguros.com',
  'didimosamudio@lideresenseguros.com',
] as const;

// =====================================================
// SECTION MAPPING
// =====================================================

export type CaseSection = 'VIDA_ASSA' | 'RAMOS_GENERALES' | 'OTROS_PERSONAS' | 'SIN_CLASIFICAR';

export const SECTION_LABELS: Record<CaseSection, string> = {
  VIDA_ASSA: '🔵 Vida ASSA',
  RAMOS_GENERALES: '🟢 Ramos Generales',
  OTROS_PERSONAS: '🟣 Ramo Personas',
  SIN_CLASIFICAR: '⚪ Sin clasificar',
};

export const SECTION_COLORS: Record<CaseSection, string> = {
  VIDA_ASSA: 'border-l-4 border-blue-500',
  RAMOS_GENERALES: 'border-l-4 border-green-500',
  OTROS_PERSONAS: 'border-l-4 border-purple-500',
  SIN_CLASIFICAR: 'border-l-4 border-gray-400',
};

// =====================================================
// APLAZAR OPTIONS
// =====================================================

export const APLAZAR_MONTHS_OPTIONS = [
  { value: 1, label: '1 mes' },
  { value: 2, label: '2 meses' },
  { value: 3, label: '3 meses' },
  { value: 4, label: '4 meses' },
  { value: 5, label: '5 meses' },
  { value: 6, label: '6 meses' },
] as const;
