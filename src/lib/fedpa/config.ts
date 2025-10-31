/**
 * Configuración de FEDPA
 * Corredor: LÍDERES EN SEGUROS, S.A. (código 836)
 * Dual API: EmisorPlan (2024) + Emisor Externo (2021)
 */

export const FEDPA_CONFIG = {
  DEV: {
    // Credenciales
    usuario: 'lider836',
    clave: 'lider836',
    ambiente: 'DEV',
    corredor: '836',
    
    // URLs Base
    emisorPlanUrl: 'https://wscanales.segfedpa.com/EmisorPlan',
    emisorExternoUrl: 'https://wscanales.segfedpa.com/EmisorFedpa.Api',
  },
  PROD: {
    // Credenciales
    usuario: 'lider836',
    clave: 'lider836',
    ambiente: 'PROD',
    corredor: '836',
    
    // URLs Base
    emisorPlanUrl: 'https://wscanales.segfedpa.com/EmisorPlan',
    emisorExternoUrl: 'https://wscanales.segfedpa.com/EmisorFedpa.Api',
  },
} as const;

export type FedpaEnvironment = keyof typeof FEDPA_CONFIG;

// ============================================
// ENDPOINTS EMISOR PLAN (2024)
// ============================================

export const EMISOR_PLAN_ENDPOINTS = {
  // Autenticación
  GENERAR_TOKEN: '/api/generartoken',
  
  // Planes y Beneficios
  PLANES: '/api/planes',
  BENEFICIOS: '/api/planes/beneficios', // ?plan={idPlan}
  
  // Documentos
  SUBIR_DOCUMENTOS: '/api/subirdocumentos',
  
  // Emisión
  EMITIR_POLIZA: '/api/emitirpoliza',
} as const;

// ============================================
// ENDPOINTS EMISOR EXTERNO (2021)
// ============================================

export const EMISOR_EXTERNO_ENDPOINTS = {
  // Catálogos
  CONSULTAR_LIMITES: '/api/Polizas/consultar_limites_externos',
  CONSULTAR_PLANES_CC: '/api/Polizas/consultar_planes_cc_externos',
  CONSULTAR_BENEFICIOS: '/api/Polizas/consultar_beneficios_planes_externos',
  CONSULTAR_USOS: '/api/Polizas/consultar_uso_externos',
  
  // Cotización
  GET_COTIZACION: '/api/Polizas/get_cotizacion',
  
  // Emisión
  GET_NRO_POLIZA: '/api/Polizas/get_nropoliza',
  CREAR_POLIZA: '/api/Polizas/crear_poliza_auto_cc_externos',
} as const;

// ============================================
// CONSTANTES DE NEGOCIO
// ============================================

export const FEDPA_RAMOS = {
  AUTO: '04',
  AUTO_SUBRAMO: '07',
} as const;

export const TIPOS_IDENTIFICACION = {
  CEDULA: 'Cédula',
  RUC: 'RUC',
  PASAPORTE: 'Pasaporte',
} as const;

export const SEXO = {
  MASCULINO: 'M',
  FEMENINO: 'F',
} as const;

export const PEP_VALUES = {
  NO: 0,
  SI: 1,
} as const;

// Nombres EXACTOS de archivos para inspección
export const TIPOS_DOCUMENTOS = {
  DOCUMENTO_IDENTIDAD: 'documento_identidad',
  LICENCIA_CONDUCIR: 'licencia_conducir',
  REGISTRO_VEHICULAR: 'registro_vehicular',
} as const;

// MIME types permitidos
export const ALLOWED_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/bmp',
  'image/webp',
  'image/tiff',
  'image/svg+xml',
] as const;

// Tamaño máximo por archivo (10MB)
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

// TTL del token (50 minutos)
export const TOKEN_TTL_MS = 50 * 60 * 1000;

// Retry config
export const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

// Validaciones
export const VALIDATION_RULES = {
  // Formato fecha: dd/mm/yyyy
  dateFormat: /^\d{2}\/\d{2}\/\d{4}$/,
  
  // Formato placa Panamá: ABC-1234 o ABC 1234
  placa: /^[A-Z]{1,3}[-\s]?\d{1,4}$/,
  
  // Cédula Panamá: 8-123-456
  cedula: /^\d{1,2}-\d{1,4}-\d{1,5}$/,
  
  // RUC Panamá
  ruc: /^\d{1,3}-\d{1,6}-\d{1,6}-DV-\d{1,2}$/,
  
  // Pasaporte
  pasaporte: /^[A-Z0-9]{6,12}$/,
  
  // VIN: 17 caracteres alfanuméricos
  vin: /^[A-HJ-NPR-Z0-9]{17}$/,
  
  // Email
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  
  // Teléfono Panamá: 1234-5678 o 6123-4567
  telefono: /^\d{4}-\d{4}$/,
};

// Cache config
export const CACHE_TTL = {
  TOKEN: TOKEN_TTL_MS,
  PLANES: 24 * 60 * 60 * 1000, // 24 horas
  CATALOGOS: 24 * 60 * 60 * 1000, // 24 horas
} as const;

// Estados de emisión
export const ESTADOS_EMISION = {
  BORRADOR: 'BORRADOR',
  COTIZADO: 'COTIZADO',
  DOCUMENTOS_CARGADOS: 'DOCUMENTOS_CARGADOS',
  EMITIDO: 'EMITIDO',
  ERROR: 'ERROR',
} as const;

// Tipos de planes
export const TIPOS_PLAN = {
  DANOS_TERCEROS: 'DAÑOS A TERCEROS',
  COBERTURA_COMPLETA: 'COBERTURA COMPLETA',
} as const;
