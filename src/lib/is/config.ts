/**
 * Configuración de Internacional de Seguros (IS)
 * Credenciales y URLs por ambiente
 */

export const IS_CONFIG = {
  development: {
    baseUrl: 'https://www.iseguros.com/APIRestIsTester',
    bearerToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1lIjoiTFNFR1dTIiwiaHR0cDovL3NjaGVtYXMubWljcm9zb2Z0LmNvbS93cy8yMDA4LzA2L2lkZW50aXR5L2NsYWltcy9yb2xlIjoiMzIiLCJpc3MiOiJodHRwczovL3d3dy5pc2VndXJvcy5jb20iLCJhdWQiOiJhcGlWaWRhU2FsdXNDb3JlU0lTRSJ9.HomXGjaD5od8Ob34IUqdjGhy6GpR9iEO9AmUcFPI1PI',
  },
  production: {
    baseUrl: 'https://www.iseguros.com/APIRestIs',
    bearerToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1lIjoiTFNFR1dTIiwiaHR0cDovL3NjaGVtYXMubWljcm9zb2Z0LmNvbS93cy8yMDA4LzA2L2lkZW50aXR5L2NsYWltcy9yb2xlIjoiMTUiLCJleHAiOjE3OTI2MTE0ODIsImlzcyI6Imh0dHBzOi8vd3d3LmlzZWd1cm9zLmNvbSIsImF1ZCI6ImFwaVZpZGFTYWx1c0NvcmVTSVNFIn0.5eeDKsW_ygQBW1AygpuPGMHnxuvR151VK1ZpCmKesjo',
  },
} as const;

export type ISEnvironment = keyof typeof IS_CONFIG;

export const INSURER_SLUG = 'INTERNACIONAL';
export const CORREDOR_FIJO = 'oficina';

// Endpoints
export const IS_ENDPOINTS = {
  // Autenticación
  TOKEN: '/api/tokens',
  
  // Catálogos Auto
  MARCAS: '/api/cotizaemisorauto/getmarcas',
  MODELOS: '/api/cotizaemisorauto/getmodelos',
  TIPO_PLANES: '/api/cotizaemisorauto/gettipoplanes',
  GRUPO_TARIFA: '/api/cotizaemisorauto/getgrupotarifa',
  PLANES: '/api/cotizaemisorauto/getplanes',
  TIPO_DOCUMENTOS: '/api/catalogos/tipodocumentos',
  
  // Cotización Auto
  GENERAR_COTIZACION: '/api/cotizaemisorauto/getgenerarcotizacion',
  COBERTURAS_COTIZACION: '/api/cotizaemisorauto/getcoberturascotizacion',
  
  // Emisión Auto
  EMISION: '/api/cotizaemisorauto/getemision',
  
  // Pago (a confirmar con IS)
  PAYMENT: '/api/payment/process', // Placeholder - confirmar con IS
} as const;

// Retry config
export const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 2000,
  backoffMultiplier: 2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

// Validaciones
export const VALIDATION_RULES = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[0-9]{7,15}$/,
  cedula: /^[0-9\-]+$/,
  year: {
    min: 1980,
    max: new Date().getFullYear() + 1,
  },
  sumaAsegurada: {
    min: 0,
    max: 1000000,
  },
};

// Mapeo de estados
export const TRAMITE_ESTADOS = {
  BORRADOR: 'Borrador',
  COTIZADO: 'Cotizado',
  EN_REVISION: 'En Revisión',
  EMITIDO: 'Emitido',
  ERROR: 'Error',
  CANCELADO: 'Cancelado',
} as const;

// Mapeo de estados de pago
export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
} as const;

// Tipos de cobertura
export const TIPOS_COBERTURA = {
  DANOS_TERCEROS: 'Daños a terceros',
  COBERTURA_COMPLETA: 'Cobertura completa',
} as const;

// Ramos
export const RAMOS = {
  AUTO: 'Auto',
  INCENDIO: 'Incendio',
  CONTENIDO: 'Contenido',
} as const;

// Cache TTL
export const CACHE_TTL = {
  CATALOGS: 24 * 60 * 60 * 1000, // 24 horas
  TOKEN: 30 * 60 * 1000, // 30 minutos (renovar antes de expirar)
} as const;
