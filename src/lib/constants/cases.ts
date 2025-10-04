// =====================================================
// CONSTANTS FOR CASES (Pendientes/Trámites)
// =====================================================

export const MANAGEMENT_TYPES = {
  COTIZACION: 'Cotización',
  EMISION: 'Emisión',
  REHABILITACION: 'Rehabilitación',
  MODIFICACION: 'Modificación',
  CANCELACION: 'Cancelación',
  CAMBIO_CORREDOR: 'Cambio de corredor',
  EMISION_EXPRESS: 'Emisión express (oficina)',
  RECLAMO: 'Reclamo',
} as const;

export type ManagementType = keyof typeof MANAGEMENT_TYPES;

export const CASE_STATUS_LABELS = {
  PENDIENTE_REVISION: 'Pendiente revisión',
  EN_PROCESO: 'En proceso',
  FALTA_DOC: 'Falta documentación',
  APLAZADO: 'Aplazado',
  RECHAZADO: 'Rechazado',
  APROBADO_PEND_PAGO: 'Aprobado pend. pago',
  EMITIDO: 'Emitido',
  CERRADO: 'Cerrado',
} as const;

export const CASE_SECTIONS = {
  RAMOS_GENERALES: 'Ramos Generales',
  VIDA_ASSA: 'Vida ASSA',
  OTROS_PERSONAS: 'Otros Personas',
  SIN_CLASIFICAR: 'Sin clasificar',
} as const;

export const CASE_SECTION_LABELS = CASE_SECTIONS;

export const CASE_STATUSES = {
  PENDIENTE_REVISION: 'Pendiente revisión',
  EN_PROCESO: 'En proceso',
  FALTA_DOC: 'Falta documentación',
  APLAZADO: 'Aplazado',
  RECHAZADO: 'Rechazado',
  APROBADO_PEND_PAGO: 'Aprobado pend. pago',
  EMITIDO: 'Emitido',
  CERRADO: 'Cerrado',
} as const;

// Deterministic classification keywords
export const INSURER_KEYWORDS: Record<string, string[]> = {
  'ASSA': ['assa', 'assaseguros', 'assa seguros'],
  'MAPFRE': ['mapfre'],
  'FEDPA': ['fedpa', 'federación patronal'],
  'SURA': ['sura'],
  'QUALITAS': ['qualitas'],
  'AIG': ['aig', 'american international'],
  'ACE': ['ace', 'chubb'],
  'OCEAN': ['ocean', 'oceánica'],
};

export const SECTION_KEYWORDS = {
  VIDA_ASSA: [
    'vida assa',
    'vida web',
    'seguro de vida assa',
    'póliza de vida assa',
    'emision vida assa',
  ],
  RAMOS_GENERALES: [
    'auto',
    'vehículo',
    'incendio',
    'robo',
    'responsabilidad civil',
    'todo riesgo',
    'multiriesgo',
  ],
  OTROS_PERSONAS: [
    'salud',
    'accidentes personales',
    'ap',
    'gastos médicos',
    'colectivo',
  ],
};

export const MANAGEMENT_KEYWORDS = {
  COTIZACION: ['cotización', 'cotizacion', 'presupuesto', 'tarifa'],
  EMISION: ['emisión', 'emision', 'emitir', 'nueva póliza', 'nueva poliza'],
  REHABILITACION: ['rehabilitación', 'rehabilitacion', 'reactivar', 'reactivación'],
  MODIFICACION: ['modificación', 'modificacion', 'cambio de', 'ajuste'],
  CANCELACION: ['cancelación', 'cancelacion', 'anular', 'baja'],
  CAMBIO_CORREDOR: ['cambio de corredor', 'cambio corredor', 'transferir agente'],
  RECLAMO: ['reclamo', 'siniestro', 'claim'],
};

// ASSA ticket patterns
export const ASSA_TICKET_PATTERNS = [
  /TICKET[:\s#]*(\d+)/i,
  /TK[:\s#]*(\d+)/i,
  /Caso[:\s#]*(\d+)/i,
  /Case[:\s#]*(\d+)/i,
];

// Default SLA days by section
export const DEFAULT_SLA_DAYS = {
  RAMOS_GENERALES: 10,
  VIDA_ASSA: 8,
  OTROS_PERSONAS: 12,
  SIN_CLASIFICAR: 7,
} as const;

// SLA status thresholds
export const SLA_THRESHOLDS = {
  WARNING_DAYS: 5, // Show warning when 5 days remaining
  EXPIRED_DAYS: 0, // Red when expired
  AUTO_TRASH_DAYS: 7, // Auto-trash if 7 days after expiry
} as const;

// Status colors for UI
export const STATUS_COLORS = {
  PENDIENTE_REVISION: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  EN_PROCESO: 'bg-blue-100 text-blue-800 border-blue-300',
  FALTA_DOC: 'bg-orange-100 text-orange-800 border-orange-300',
  APLAZADO: 'bg-purple-100 text-purple-800 border-purple-300',
  RECHAZADO: 'bg-red-100 text-red-800 border-red-300',
  APROBADO_PEND_PAGO: 'bg-green-100 text-green-800 border-green-300',
  EMITIDO: 'bg-green-100 text-green-800 border-green-300',
  CERRADO: 'bg-gray-100 text-gray-800 border-gray-300',
} as const;

// SLA semaphore colors
export const getSLAColor = (daysRemaining: number | null): string => {
  if (daysRemaining === null) return 'text-gray-400';
  if (daysRemaining < 0) return 'text-red-600'; // Vencido
  if (daysRemaining <= SLA_THRESHOLDS.WARNING_DAYS) return 'text-orange-600'; // Por vencer
  return 'text-green-600'; // En tiempo
};

export const getSLABadgeColor = (daysRemaining: number | null): string => {
  if (daysRemaining === null) return 'bg-gray-100 text-gray-800 border-gray-300';
  if (daysRemaining < 0) return 'bg-red-100 text-red-800 border-red-300';
  if (daysRemaining <= SLA_THRESHOLDS.WARNING_DAYS) return 'bg-orange-100 text-orange-800 border-orange-300';
  return 'bg-green-100 text-green-800 border-green-300';
};

export const getSLALabel = (daysRemaining: number | null): string => {
  if (daysRemaining === null) return 'Sin SLA';
  if (daysRemaining < 0) return `Vencido (${Math.abs(daysRemaining)}d)`;
  if (daysRemaining === 0) return 'Vence hoy';
  if (daysRemaining === 1) return 'Vence mañana';
  if (daysRemaining <= SLA_THRESHOLDS.WARNING_DAYS) return `${daysRemaining}d restantes`;
  return `${daysRemaining} días`;
};

// Comment channels
export const COMMENT_CHANNELS = {
  aseguradora: 'Aseguradora',
  oficina: 'Oficina (Interno)',
} as const;

// History action labels
export const HISTORY_ACTION_LABELS = {
  EMAIL_INGRESO: 'Correo recibido',
  EMAIL_UPDATE: 'Correo actualizado',
  CLASSIFY_CHANGE: 'Reclasificado',
  STATE_CHANGE: 'Estado cambiado',
  FILE_UPLOADED: 'Archivo adjuntado',
  FILE_DELETED: 'Archivo eliminado',
  COMMENT_ADDED: 'Comentario agregado',
  CHECKLIST_UPDATED: 'Checklist actualizado',
  ASSIGNED: 'Asignado',
  POSTPONED: 'Aplazado',
  CLOSED: 'Cerrado',
  DELETED: 'Eliminado',
  CLAIMED: 'Marcado como "mío"',
} as const;

// Default checklist items
export const DEFAULT_CHECKLIST = [
  { label: 'Cédula del asegurado', required: true, completed: false },
  { label: 'Formulario firmado', required: true, completed: false },
  { label: 'Póliza anterior (si aplica)', required: false, completed: false },
  { label: 'Comprobante de pago', required: true, completed: false },
  { label: 'Inspección (si aplica)', required: false, completed: false },
  { label: 'Tarjeta de circulación (autos)', required: false, completed: false },
  { label: 'Certificado médico (vida)', required: false, completed: false },
];
