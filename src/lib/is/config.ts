/**
 * Configuración para Internacional de Seguros
 * ⚠️ SEGURIDAD: Todas las credenciales vienen de variables de entorno
 */

export type ISEnvironment = 'development' | 'production';

/**
 * Obtener base URL según ambiente desde ENV vars
 * ⚠️ Debe ser URL ABSOLUTA (https://...)
 */
export function getISBaseUrl(env: ISEnvironment): string {
  const baseUrl = env === 'production'
    ? process.env.IS_BASE_URL_PROD
    : process.env.IS_BASE_URL_DEV;

  if (!baseUrl) {
    throw new Error(
      `Variable de entorno no configurada: ${
        env === 'production' ? 'IS_BASE_URL_PROD' : 'IS_BASE_URL_DEV'
      }`
    );
  }

  return baseUrl;
}

/**
 * Obtener token principal desde ENV vars (para obtener token diario)
 * ⚠️ NO usar directamente en requests - usar token diario desde token-manager
 */
export function getISPrimaryToken(env: ISEnvironment): string {
  const token = env === 'production'
    ? process.env.KEY_PRODUCCION_IS
    : process.env.KEY_DESARROLLO_IS;

  if (!token) {
    throw new Error(
      `Variable de entorno no configurada: ${
        env === 'production' ? 'KEY_PRODUCCION_IS' : 'KEY_DESARROLLO_IS'
      }`
    );
  }

  return token;
}

export const INSURER_SLUG = 'INTERNACIONAL';
export const CORREDOR_FIJO = 'oficina';

// Endpoints
// ⚠️ IMPORTANTE: Los paths NO incluyen /api porque ya está en la base URL
export const IS_ENDPOINTS = {
  // Autenticación
  TOKEN: '/tokens',
  
  // Catálogos Auto
  MARCAS: '/cotizaemisorauto/marcas',
  MODELOS: '/cotizaemisorauto/modelos',
  TIPO_PLANES: '/cotizaemisorauto/tipoplanes',
  GRUPO_TARIFA: '/cotizaemisorauto/grupotarifa',
  PLANES: '/cotizaemisorauto/planes',
  TIPO_DOCUMENTOS: '/catalogos/tipodocumentos',
  
  // Cotización Auto
  GENERAR_COTIZACION: '/cotizaemisorauto/generarcotizacion',
  COBERTURAS_COTIZACION: '/cotizaemisorauto/coberturascotizacion',
  
  // Emisión Auto
  EMISION: '/cotizaemisorauto/emision',
  
  // Pago (a confirmar con IS)
  PAYMENT: '/payment/process', // Placeholder - confirmar con IS
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
