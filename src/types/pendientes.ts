/**
 * TYPES - Módulo Pendientes
 * ==========================
 * Tipos TypeScript para el módulo de Pendientes
 * con sistema de tickets posicionales y estados simplificados
 */

export type EstadoSimple =
  | 'Nuevo'
  | 'Sin clasificar'
  | 'En proceso'
  | 'Pendiente cliente'
  | 'Pendiente broker'
  | 'Enviado'
  | 'Aplazado'
  | 'Cerrado aprobado'
  | 'Cerrado rechazado';

export type RamoBucket = 
  | 'vida_assa'
  | 'ramos_generales'
  | 'ramo_personas'
  | 'desconocido';

export interface CasoPendiente {
  id: string;
  ticket: string | null;
  created_at: string;
  updated_at: string;
  
  // Clasificación
  ramo_bucket: RamoBucket;
  ramo_code: string | null;
  aseguradora_code: string | null;
  tramite_code: string | null;
  tipo_poliza: string | null;
  
  // Estado
  estado_simple: EstadoSimple;
  
  // Asignación
  broker_id: string;
  assigned_master_id: string | null;
  detected_broker_email: string | null;
  
  // SLA
  sla_due_date: string | null;
  sla_paused_at: string | null;
  sla_accumulated_pause_hours: number;
  
  // Aplazado
  aplazado_until: string | null;
  aplazado_months: number | null;
  aplazar_reason: string | null;
  
  // AI
  ai_classification: any;
  ai_confidence: number | null;
  missing_fields: string[] | null;
  special_flags: string[] | null;
  
  // Relaciones
  brokers?: {
    name: string;
  };
  profiles?: {
    full_name: string;
    email: string;
  };
  
  // Contadores
  emails_count?: number;
  history_count?: number;
}

export interface InboundEmail {
  id: string;
  message_id: string;
  from_email: string | null;
  from_name: string | null;
  subject: string | null;
  subject_normalized: string | null;
  date_sent: string;
  body_text_normalized: string | null;
  attachments_count: number;
  created_at: string;
}

export interface CaseHistoryEvent {
  id: string;
  case_id: string;
  event_type: string;
  payload: any;
  created_by_role: 'system' | 'master' | 'broker';
  visible_to_broker: boolean;
  created_at: string;
  created_by_user_id: string | null;
  profiles?: {
    full_name: string;
  };
}

export interface CaseEmail {
  id: string;
  case_id: string;
  inbound_email_id: string;
  linked_at: string;
  linked_by: string;
  visible_to_broker: boolean;
  inbound_emails?: InboundEmail;
}

export interface FilterOptions {
  estado?: EstadoSimple;
  bucket?: RamoBucket;
  broker_id?: string;
  search?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
}

export interface QuickEditData {
  case_id: string;
  field: 'estado_simple' | 'sla_due_date' | 'assigned_master_id';
  value: any;
}
