// Tipos de póliza por Ramo
export const POLICY_TYPES = {
  generales: [
    { key: 'auto', label: 'Auto', order: 1 },
    { key: 'incendio', label: 'Incendio', order: 2 },
    { key: 'multipoliza', label: 'Multipóliza', order: 3 },
    { key: 'rc', label: 'Responsabilidad Civil', order: 4 },
    { key: 'fianzas', label: 'Fianzas', order: 5 },
    { key: 'flotas', label: 'Flotas', order: 6 },
    { key: 'car', label: 'CAR (Todo Riesgo Construcción)', order: 7 },
    { key: 'casco_marino', label: 'Casco Marino', order: 8 },
    { key: 'casco_aereo', label: 'Casco Aéreo', order: 9 },
    { key: 'transporte', label: 'Transporte', order: 10 },
    { key: 'carga', label: 'Carga', order: 11 },
    { key: 'otros', label: 'Otros', order: 12 }
  ],
  personas: [
    { key: 'vida_assa', label: 'VIDA ASSA', order: 1, featured: true },
    { key: 'vida', label: 'Vida (otras)', order: 2 },
    { key: 'salud', label: 'Salud', order: 3 },
    { key: 'ap', label: 'Accidentes Personales', order: 4 },
    { key: 'colectivos', label: 'Colectivos', order: 5 }
  ]
};

// Requisitos NO descargables (solo guía visual)
export const REQUIREMENTS_MAP: Record<string, string[]> = {
  // VIDA ASSA - EMISIÓN
  vida_assa: [
    '📋 PARA EMISIÓN:',
    '  • Solicitud (obligatorio)',
    '  • Cédula (obligatorio)',
    '  • Cotización (obligatorio)',
    '  • Formulario de pago (obligatorio)',
    '  • Autorización (obligatorio solo si es web)',
    '  • Cuestionarios (opcional)',
    '  • Exámenes (opcional)',
    '  • Informe de activos y pasivos (opcional)',
    '',
    '📋 REHABILITACIÓN:',
    '  • Formulario de rehabilitación',
    '  • Conoce tu cliente',
    '  • Formulario de pago',
    '  • Cédula',
    '  • FATCA',
    '  • Certificado de salud',
    '',
    '📋 MODIFICACIÓN:',
    '  • Formulario de cambios múltiples',
    '  • Cotización',
    '  • Conoce tu cliente',
    '',
    '📋 CANCELACIÓN:',
    '  • Carta de cancelación',
    '  • Cédula',
    '  • Formulario de rescate',
    '  • Formulario de reembolso',
    '  • Conoce tu cliente',
    '  • FATCA',
    '',
    '📋 RECLAMOS VIDA:',
    '  • Formulario de reclamo',
    '  • Certificado de defunción',
    '  • FATCA',
    '  • Conoce tu cliente',
    '  • Cédula'
  ],
  
  // VIDA (OTRAS ASEGURADORAS)
  vida: [
    '📋 PARA EMISIÓN (Otras Aseguradoras):',
    '  • Solicitud (obligatorio)',
    '  • Cédula (obligatorio)',
    '  • Cotización (obligatorio)',
    '  • Formulario de pago (obligatorio)',
    '  • Cuestionarios (opcional)',
    '  • Exámenes (opcional)',
    '  • Informe de activos y pasivos (opcional)',
    '',
    '💡 Para otros trámites ver requisitos VIDA ASSA'
  ],
  
  // SALUD
  salud: [
    '📋 PARA EMISIÓN:',
    '  • Solicitud (obligatorio)',
    '  • Cédula (obligatorio)',
    '  • Cotización (obligatorio)',
    '  • Formulario de pago (obligatorio)',
    '  • Cuestionario COVID (opcional)',
    '  • Tarjeta de vacunas (opcional)',
    '  • Certificado de salud (opcional)',
    '  • Informe pediátrico (opcional)',
    '',
    '💡 Para otros trámites: mismo formato que VIDA'
  ],
  
  // ACCIDENTES PERSONALES
  ap: [
    '📋 PARA EMISIÓN:',
    '  • Solicitud (obligatorio)',
    '  • Cédula (obligatorio)',
    '  • Cotización (obligatorio)',
    '  • Formulario de pago (obligatorio)',
    '',
    '💡 Para otros trámites: mismo formato que VIDA'
  ],
  
  // AUTO - COBERTURA COMPLETA
  auto: [
    '📋 PARA EMISIÓN (Cobertura Completa):',
    '  • Solicitud (obligatorio)',
    '  • Cédula (obligatorio)',
    '  • Cotización (obligatorio)',
    '  • Formulario de pago (obligatorio)',
    '  • Fotos inspección (opcional)',
    '  • Formulario inspección (opcional)',
    '  • Conoce tu cliente (opcional)',
    '',
    '📋 PARA COTIZACIÓN:',
    '  • Cédula (obligatorio)',
    '  • Solicitud (obligatorio)',
    '  • Todos los demás opcionales',
    '',
    '📋 OTROS TRÁMITES (Cancelación, Rehabilitación, Modificación, Cambio Corredor, Reclamo):',
    '  • Carta (obligatorio)',
    '  • Cédula (obligatorio)',
    '  • Solicitud (obligatorio)'
  ],
  
  // INCENDIO
  incendio: [
    '📋 PARA EMISIÓN:',
    '  • Solicitud (obligatorio)',
    '  • Cédula (obligatorio)',
    '  • Cotización (obligatorio)',
    '  • Formulario de pago (obligatorio)',
    '',
    '📋 PARA COTIZACIÓN:',
    '  • Cédula (obligatorio)',
    '  • Solicitud (obligatorio)',
    '',
    '📋 OTROS TRÁMITES:',
    '  • Carta (obligatorio)',
    '  • Cédula (obligatorio)',
    '  • Solicitud (obligatorio)'
  ],
  
  // MULTIPÓLIZA / TODO RIESGO
  multipoliza: [
    '📋 PARA EMISIÓN:',
    '  • Solicitud (obligatorio)',
    '  • Cédula (obligatorio)',
    '  • Cotización (obligatorio)',
    '  • Formulario de pago (obligatorio)',
    '',
    '📋 PARA COTIZACIÓN:',
    '  • Cédula (obligatorio)',
    '  • Solicitud (obligatorio)',
    '',
    '📋 OTROS TRÁMITES:',
    '  • Carta (obligatorio)',
    '  • Cédula (obligatorio)',
    '  • Solicitud (obligatorio)'
  ],
  
  // RESPONSABILIDAD CIVIL
  rc: [
    '📋 PARA EMISIÓN:',
    '  • Solicitud (obligatorio)',
    '  • Cédula (obligatorio)',
    '  • Cotización (obligatorio)',
    '  • Formulario de pago (obligatorio)',
    '',
    '📋 PARA COTIZACIÓN:',
    '  • Cédula (obligatorio)',
    '  • Solicitud (obligatorio)',
    '',
    '📋 OTROS TRÁMITES:',
    '  • Carta (obligatorio)',
    '  • Cédula (obligatorio)',
    '  • Solicitud (obligatorio)'
  ],
  
  // FIANZAS
  fianzas: [
    '📋 PARA EMISIÓN:',
    '  • Solicitud (obligatorio)',
    '  • Cédula (obligatorio)',
    '  • Cotización (obligatorio)',
    '  • Formulario de pago (obligatorio)',
    '',
    '📋 PARA COTIZACIÓN:',
    '  • Cédula (obligatorio)',
    '  • Solicitud (obligatorio)',
    '',
    '📋 OTROS TRÁMITES:',
    '  • Carta (obligatorio)',
    '  • Cédula (obligatorio)',
    '  • Solicitud (obligatorio)'
  ],
  
  // EQUIPOS (Electrónico, Pesado, etc.)
  car: [
    '📋 PARA EMISIÓN:',
    '  • Solicitud (obligatorio)',
    '  • Cédula (obligatorio)',
    '  • Cotización (obligatorio)',
    '  • Formulario de pago (obligatorio)',
    '',
    '💡 Mismo formato que otros ramos generales'
  ],
  
  // CASCO MARINO
  casco_marino: [
    '📋 PARA EMISIÓN:',
    '  • Solicitud (obligatorio)',
    '  • Cédula (obligatorio)',
    '  • Cotización (obligatorio)',
    '  • Formulario de pago (obligatorio)'
  ],
  
  // CASCO AÉREO
  casco_aereo: [
    '📋 PARA EMISIÓN:',
    '  • Solicitud (obligatorio)',
    '  • Cédula (obligatorio)',
    '  • Cotización (obligatorio)',
    '  • Formulario de pago (obligatorio)'
  ],
  
  // TRANSPORTE / CARGA
  transporte: [
    '📋 PARA EMISIÓN:',
    '  • Solicitud (obligatorio)',
    '  • Cédula (obligatorio)',
    '  • Cotización (obligatorio)',
    '  • Formulario de pago (obligatorio)'
  ],
  
  carga: [
    '📋 PARA EMISIÓN:',
    '  • Solicitud (obligatorio)',
    '  • Cédula (obligatorio)',
    '  • Cotización (obligatorio)',
    '  • Formulario de pago (obligatorio)'
  ],
  
  // FLOTAS
  flotas: [
    '📋 PARA EMISIÓN:',
    '  • Solicitud (obligatorio)',
    '  • Cédula (obligatorio)',
    '  • Cotización (obligatorio)',
    '  • Formulario de pago (obligatorio)',
    '  • Lista de vehículos'
  ]
};

// Secciones típicas por tipo de póliza
export const DEFAULT_SECTIONS: Record<string, string[]> = {
  auto: ['Requisitos', 'Formularios', 'Anexos', 'Guías de Inspección'],
  vida_assa: ['Requisitos', 'Formularios', 'Solicitudes', 'Anexos', 'Guías Médicas'],
  vida: ['Requisitos', 'Formularios', 'Anexos'],
  salud: ['Requisitos', 'Formularios', 'Anexos', 'Red de Proveedores'],
  ap: ['Requisitos', 'Formularios', 'Anexos'],
  incendio: ['Requisitos', 'Formularios', 'Anexos', 'Planos y Avalúos'],
  multipoliza: ['Requisitos', 'Formularios', 'Anexos'],
  rc: ['Requisitos', 'Formularios', 'Anexos'],
  fianzas: ['Requisitos', 'Formularios', 'Contratos', 'Anexos']
};

// Nombres formateados de tipos de póliza
export function getPolicyTypeLabel(scope: string, key: string): string {
  const types = scope === 'generales' ? POLICY_TYPES.generales : POLICY_TYPES.personas;
  const type = types.find(t => t.key === key);
  return type?.label || key;
}

// Obtener requisitos no descargables
export function getRequirements(policyType: string): string[] {
  return REQUIREMENTS_MAP[policyType] || [];
}

// Verificar si un tipo es "featured"
export function isFeaturedType(scope: string, key: string): boolean {
  const types = scope === 'generales' ? POLICY_TYPES.generales : POLICY_TYPES.personas;
  const type = types.find(t => t.key === key);
  return !!(type && 'featured' in type && type.featured);
}
