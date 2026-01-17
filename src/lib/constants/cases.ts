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

// Tipos de póliza
export const POLICY_TYPES = {
  AUTO: 'Auto',
  VIDA: 'Vida',
  SALUD: 'Salud',
  INCENDIO: 'Incendio',
  TODO_RIESGO: 'Todo Riesgo',
  RESPONSABILIDAD_CIVIL: 'Responsabilidad Civil',
  ACCIDENTES_PERSONALES: 'Accidentes Personales',
  OTROS: 'Otros',
} as const;

export type PolicyType = keyof typeof POLICY_TYPES;

// Función para obtener documentos requeridos según tipo de póliza y tipo de gestión
export function getRequiredDocuments(policyType: PolicyType | '', managementType: string, isAssaLife: boolean = false): { label: string; required: boolean; standardName: string }[] {
  // Para COTIZACIÓN: solo cédula y solicitud obligatorios
  if (managementType === 'COTIZACION') {
    return [
      { label: 'Cédula', required: true, standardName: 'cedula' },
      { label: 'Solicitud', required: true, standardName: 'solicitud' },
      { label: 'Cotización', required: false, standardName: 'cotizacion' },
      { label: 'Formulario de pago', required: false, standardName: 'formulario_pago' },
    ];
  }

  // Para EMISIÓN según tipo de póliza
  if (managementType === 'EMISION') {
    // VIDA ASSA
    if (policyType === 'VIDA' && isAssaLife) {
      return [
        { label: 'Solicitud', required: true, standardName: 'solicitud' },
        { label: 'Cédula', required: true, standardName: 'cedula' },
        { label: 'Cotización', required: true, standardName: 'cotizacion' },
        { label: 'Formulario de pago', required: true, standardName: 'formulario_pago' },
        { label: 'Autorización', required: false, standardName: 'autorizacion' }, // Obligatorio si es web
        { label: 'Cuestionarios', required: false, standardName: 'cuestionarios' },
        { label: 'Exámenes', required: false, standardName: 'examenes' },
        { label: 'Informe de activos y pasivos', required: false, standardName: 'informe_activos_pasivos' },
      ];
    }

    // SALUD
    if (policyType === 'SALUD') {
      return [
        { label: 'Solicitud', required: true, standardName: 'solicitud' },
        { label: 'Cédula', required: true, standardName: 'cedula' },
        { label: 'Cotización', required: true, standardName: 'cotizacion' },
        { label: 'Formulario de pago', required: true, standardName: 'formulario_pago' },
        { label: 'Cuestionario COVID', required: false, standardName: 'cuestionario_covid' },
        { label: 'Tarjeta de vacunas', required: false, standardName: 'tarjeta_vacunas' },
        { label: 'Certificado de salud', required: false, standardName: 'certificado_salud' },
        { label: 'Informe pediátrico', required: false, standardName: 'informe_pediatrico' },
      ];
    }

    // ACCIDENTES PERSONALES
    if (policyType === 'ACCIDENTES_PERSONALES') {
      return [
        { label: 'Solicitud', required: true, standardName: 'solicitud' },
        { label: 'Cédula', required: true, standardName: 'cedula' },
        { label: 'Cotización', required: true, standardName: 'cotizacion' },
        { label: 'Formulario de pago', required: true, standardName: 'formulario_pago' },
      ];
    }

    // AUTO cobertura completa
    if (policyType === 'AUTO') {
      return [
        { label: 'Solicitud', required: true, standardName: 'solicitud' },
        { label: 'Cédula', required: true, standardName: 'cedula' },
        { label: 'Cotización', required: true, standardName: 'cotizacion' },
        { label: 'Formulario de pago', required: true, standardName: 'formulario_pago' },
        { label: 'Fotos inspección', required: false, standardName: 'fotos_inspeccion' },
        { label: 'Formulario inspección', required: false, standardName: 'formulario_inspeccion' },
        { label: 'Conoce tu cliente', required: false, standardName: 'conoce_cliente' },
      ];
    }

    // INCENDIO, TODO_RIESGO, RESPONSABILIDAD_CIVIL, OTROS ramos generales
    if (['INCENDIO', 'TODO_RIESGO', 'RESPONSABILIDAD_CIVIL', 'OTROS'].includes(policyType)) {
      return [
        { label: 'Solicitud', required: true, standardName: 'solicitud' },
        { label: 'Cédula', required: true, standardName: 'cedula' },
        { label: 'Cotización', required: true, standardName: 'cotizacion' },
        { label: 'Formulario de pago', required: true, standardName: 'formulario_pago' },
      ];
    }
  }

  // Para REHABILITACIÓN en ramos personas
  if (managementType === 'REHABILITACION' && ['VIDA', 'SALUD', 'ACCIDENTES_PERSONALES'].includes(policyType)) {
    return [
      { label: 'Formulario de rehabilitación', required: true, standardName: 'formulario_rehabilitacion' },
      { label: 'Conoce tu cliente', required: true, standardName: 'conoce_cliente' },
      { label: 'Formulario de pago', required: true, standardName: 'formulario_pago' },
      { label: 'Cédula', required: true, standardName: 'cedula' },
      { label: 'FATCA', required: true, standardName: 'fatca' },
      { label: 'Certificado de salud', required: true, standardName: 'certificado_salud' },
    ];
  }

  // Para MODIFICACIÓN en ramos personas
  if (managementType === 'MODIFICACION' && ['VIDA', 'SALUD', 'ACCIDENTES_PERSONALES'].includes(policyType)) {
    return [
      { label: 'Formulario de cambios múltiples', required: true, standardName: 'formulario_cambios' },
      { label: 'Cotización', required: true, standardName: 'cotizacion' },
      { label: 'Conoce tu cliente', required: true, standardName: 'conoce_cliente' },
    ];
  }

  // Para CANCELACIÓN en ramos personas
  if (managementType === 'CANCELACION' && ['VIDA', 'SALUD', 'ACCIDENTES_PERSONALES'].includes(policyType)) {
    return [
      { label: 'Carta de cancelación', required: true, standardName: 'carta_cancelacion' },
      { label: 'Cédula', required: true, standardName: 'cedula' },
      { label: 'Formulario de rescate', required: true, standardName: 'formulario_rescate' },
      { label: 'Formulario de reembolso', required: true, standardName: 'formulario_reembolso' },
      { label: 'Conoce tu cliente', required: true, standardName: 'conoce_cliente' },
      { label: 'FATCA', required: true, standardName: 'fatca' },
    ];
  }

  // Para RECLAMO en vida
  if (managementType === 'RECLAMO' && policyType === 'VIDA') {
    return [
      { label: 'Formulario de reclamo', required: true, standardName: 'formulario_reclamo' },
      { label: 'Certificado de defunción', required: true, standardName: 'certificado_defuncion' },
      { label: 'FATCA', required: true, standardName: 'fatca' },
      { label: 'Conoce tu cliente', required: true, standardName: 'conoce_cliente' },
      { label: 'Cédula', required: true, standardName: 'cedula' },
    ];
  }

  // Para otros trámites en ramos generales (CANCELACION, REHABILITACION, MODIFICACION, CAMBIO_CORREDOR, RECLAMO)
  if (['CANCELACION', 'REHABILITACION', 'MODIFICACION', 'CAMBIO_CORREDOR', 'RECLAMO'].includes(managementType)) {
    if (['AUTO', 'INCENDIO', 'TODO_RIESGO', 'RESPONSABILIDAD_CIVIL', 'OTROS'].includes(policyType)) {
      return [
        { label: 'Carta', required: true, standardName: 'carta' },
        { label: 'Cédula', required: true, standardName: 'cedula' },
        { label: 'Solicitud', required: true, standardName: 'solicitud' },
      ];
    }
  }

  // Default: documentos básicos
  return [
    { label: 'Cédula', required: true, standardName: 'cedula' },
    { label: 'Solicitud', required: true, standardName: 'solicitud' },
  ];
}

// Legacy: mantener por compatibilidad
export const REQUIRED_DOCUMENTS: Record<PolicyType, { label: string; required: boolean; standardName: string }[]> = {
  AUTO: [
    { label: 'Solicitud', required: true, standardName: 'solicitud' },
    { label: 'Cédula', required: true, standardName: 'cedula' },
    { label: 'Cotización', required: true, standardName: 'cotizacion' },
    { label: 'Formulario de pago', required: true, standardName: 'formulario_pago' },
  ],
  VIDA: [
    { label: 'Solicitud', required: true, standardName: 'solicitud' },
    { label: 'Cédula', required: true, standardName: 'cedula' },
    { label: 'Cotización', required: true, standardName: 'cotizacion' },
    { label: 'Formulario de pago', required: true, standardName: 'formulario_pago' },
  ],
  SALUD: [
    { label: 'Solicitud', required: true, standardName: 'solicitud' },
    { label: 'Cédula', required: true, standardName: 'cedula' },
    { label: 'Cotización', required: true, standardName: 'cotizacion' },
    { label: 'Formulario de pago', required: true, standardName: 'formulario_pago' },
  ],
  INCENDIO: [
    { label: 'Solicitud', required: true, standardName: 'solicitud' },
    { label: 'Cédula', required: true, standardName: 'cedula' },
    { label: 'Cotización', required: true, standardName: 'cotizacion' },
    { label: 'Formulario de pago', required: true, standardName: 'formulario_pago' },
  ],
  TODO_RIESGO: [
    { label: 'Solicitud', required: true, standardName: 'solicitud' },
    { label: 'Cédula', required: true, standardName: 'cedula' },
    { label: 'Cotización', required: true, standardName: 'cotizacion' },
    { label: 'Formulario de pago', required: true, standardName: 'formulario_pago' },
  ],
  RESPONSABILIDAD_CIVIL: [
    { label: 'Solicitud', required: true, standardName: 'solicitud' },
    { label: 'Cédula', required: true, standardName: 'cedula' },
    { label: 'Cotización', required: true, standardName: 'cotizacion' },
    { label: 'Formulario de pago', required: true, standardName: 'formulario_pago' },
  ],
  ACCIDENTES_PERSONALES: [
    { label: 'Solicitud', required: true, standardName: 'solicitud' },
    { label: 'Cédula', required: true, standardName: 'cedula' },
    { label: 'Cotización', required: true, standardName: 'cotizacion' },
    { label: 'Formulario de pago', required: true, standardName: 'formulario_pago' },
  ],
  OTROS: [
    { label: 'Cédula', required: true, standardName: 'cedula' },
    { label: 'Solicitud', required: true, standardName: 'solicitud' },
  ],
};

// Default checklist items (legacy - se mantiene por compatibilidad)
export const DEFAULT_CHECKLIST = [
  { label: 'Cédula del asegurado', required: true, completed: false },
  { label: 'Formulario firmado', required: true, completed: false },
  { label: 'Póliza anterior (si aplica)', required: false, completed: false },
  { label: 'Comprobante de pago', required: true, completed: false },
  { label: 'Inspección (si aplica)', required: false, completed: false },
  { label: 'Tarjeta de circulación (autos)', required: false, completed: false },
  { label: 'Certificado médico (vida)', required: false, completed: false },
];
