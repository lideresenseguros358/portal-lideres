/**
 * Configuración de FEDPA
 * Corredor: LÍDERES EN SEGUROS, S.A. (código 836)
 * Dual API: EmisorPlan (2024) + Emisor Externo (2021)
 */

export const FEDPA_CONFIG = {
  DEV: {
    // Credenciales desde ENV vars
    usuario: process.env.USUARIO_FEDPA || '',
    clave: process.env.CLAVE_FEDPA || '',
    ambiente: 'DEV',
    corredor: '836',
    
    // URLs Base
    emisorPlanUrl: 'https://wscanales.segfedpa.com/EmisorPlan',
    emisorExternoUrl: 'https://wscanales.segfedpa.com/EmisorFedpa.Api',
    brokerIntegrationUrl: 'https://api.segfedpa.com:8085/BrokerIntegration',
  },
  PROD: {
    // Credenciales desde ENV vars
    usuario: process.env.USUARIO_FEDPA || '',
    clave: process.env.CLAVE_FEDPA || '',
    ambiente: 'PROD',
    corredor: '836',
    
    // URLs Base
    emisorPlanUrl: 'https://wscanales.segfedpa.com/EmisorPlan',
    emisorExternoUrl: 'https://wscanales.segfedpa.com/EmisorFedpa.Api',
    brokerIntegrationUrl: 'https://api.segfedpa.com:8085/BrokerIntegration',
  },
} as const;

export type FedpaEnvironment = keyof typeof FEDPA_CONFIG;

/**
 * Auto-detect FEDPA environment:
 * - Default: 'PROD' — real policy numbers via get_nropoliza_emitir
 *   (only PROD policies have downloadable carátulas via Broker Integration)
 * - Override: set FEDPA_FORCE_ENV=DEV in .env.local for test policy numbers
 *   (DEV policies use get_nropoliza and do NOT support carátula download)
 */
export function getFedpaDefaultEnv(): FedpaEnvironment {
  const forceEnv = process.env.FEDPA_FORCE_ENV?.toUpperCase();
  if (forceEnv === 'DEV' || forceEnv === 'PROD') {
    return forceEnv as FedpaEnvironment;
  }
  return 'PROD';
}

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
  
  // Carátula (genera/envía PDF de la póliza) — DEPRECATED: use BROKER_INTEGRATION_ENDPOINTS
  CARATULA_POLIZA: '/api/caratulaPoliza',
} as const;

// ============================================
// ENDPOINTS BROKER INTEGRATION (2026)
// Documentación: /public/API FEDPA/CARATULA/
// Base URL: https://api.segfedpa.com:8085/BrokerIntegration
// Auth: Basic (usuario:contraseña base64)
// ============================================

export const BROKER_INTEGRATION_ENDPOINTS = {
  // GET /Polizas/caratula?ramo=XX&subramo=XX&poliza=XXXXXX&secuencia=X
  // Returns application/pdf (200) or { success, msg } (400)
  CARATULA: '/Polizas/caratula',
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
  // Catálogo de vehículos (brand/model resolution — may not exist yet; fetched with try/catch)
  CONSULTAR_MARCAS: '/api/Polizas/consultar_marcas_externos',
  CONSULTAR_MODELOS: '/api/Polizas/consultar_modelos_externos',

  // Cotización
  GET_COTIZACION: '/api/Polizas/get_cotizacion',

  // Emisión
  GET_NRO_POLIZA: '/api/Polizas/get_nropoliza',
  CREAR_POLIZA: '/api/Polizas/crear_poliza_auto_cc_externos',

  // DEPRECATED: These only return policy numbers, not PDFs
  GET_CARATULA_TEST: '/api/Polizas/get_nropoliza',
  GET_CARATULA_PROD: '/api/Polizas/get_nropoliza_emitir',
} as const;

export const EMISOR_PLAN_ENDPOINTS_CATALOG = {
  // These may or may not be exposed — tried with GET, fail gracefully
  MARCAS: '/api/marcas',
  MODELOS: '/api/modelos',
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
