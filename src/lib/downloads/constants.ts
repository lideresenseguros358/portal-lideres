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
  auto: [
    'Cédula / Pasaporte del asegurado',
    'Licencia de conducir vigente',
    'Registro vehicular (Título de Propiedad)',
    'Fotos de inspección completas:',
    '  • Vista frontal completa del vehículo',
    '  • Vista posterior completa del vehículo',
    '  • Vista lateral izquierda',
    '  • Vista lateral derecha',
    '  • Tablero de instrumentos (velocímetro visible)',
    '  • Odómetro (lectura clara del kilometraje)',
    '  • Asientos delanteros y traseros',
    '  • Número de chasis (grabado en el vehículo)',
    '  • Motor (número visible)',
    '  • Maletero (abierto y vacío)',
    '  • Juego de llaves completo'
  ],
  vida_assa: [
    'Cédula / Pasaporte del asegurado',
    'Formulario de solicitud firmado',
    'Exámenes médicos (según monto)',
    'Activos y Pasivos (opcional, según caso)'
  ],
  vida: [
    'Cédula / Pasaporte del asegurado',
    'Formulario de solicitud firmado',
    'Exámenes médicos (según aseguradora y monto)'
  ],
  salud: [
    'Cédula / Pasaporte del asegurado',
    'Formulario de solicitud firmado',
    'Declaración de salud',
    'Exámenes médicos (según plan)'
  ],
  ap: [
    'Cédula / Pasaporte del asegurado',
    'Formulario de solicitud firmado',
    'Declaración de salud básica'
  ],
  incendio: [
    'Cédula / Pasaporte del propietario',
    'Título de propiedad o contrato de arrendamiento',
    'Planos o descripción de la propiedad',
    'Fotos del inmueble (exterior e interior)',
    'Certificado de registro público (si aplica)'
  ],
  multipoliza: [
    'Cédula / Pasaporte del asegurado',
    'Inventario de bienes a asegurar',
    'Fotos de la propiedad',
    'Declaración de valores'
  ],
  rc: [
    'Cédula / Pasaporte',
    'RUC o cédula jurídica (para empresas)',
    'Descripción de actividades',
    'Declaración de información comercial'
  ],
  fianzas: [
    'RUC o cédula jurídica',
    'Estados financieros',
    'Contrato que respalda la fianza',
    'Cédula de representante legal'
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
