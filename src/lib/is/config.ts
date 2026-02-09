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

// Endpoints — VERIFICADOS contra Swagger spec (swagger.json) Feb 2026
// ⚠️ IMPORTANTE: Los paths NO incluyen /api porque ya está en la base URL
export const IS_ENDPOINTS = {
  // Autenticación (POST /tokens genera, GET /tokens/diario recupera, GET /tokens/auto para auto)
  TOKEN: '/tokens',
  TOKEN_DIARIO: '/tokens/diario',
  TOKEN_AUTO: '/tokens/auto',
  
  // Catálogos Auto — Swagger: RestCotizaEmisorAuto
  MARCAS: '/cotizaemisorauto/getmarcas',
  MODELOS: '/cotizaemisorauto/getmodelos',                    // /{pagenumber}/{rowsperpage}
  TIPO_PLANES: '/cotizaemisorauto/gettipoplanes',
  GRUPO_TARIFA: '/cotizaemisorauto/getgrupotarifa',           // /{vCodTipoPlan}
  PLANES: '/cotizaemisorauto/getplanes',                      // /{vCodTipoPlan}
  TIPO_DOCUMENTOS: '/catalogos/tipodocumentos',
  PRECIOS_PLANES_TERCEROS: '/cotizaemisorauto/getpreciosplanesterceros', // /{vCodPlan}
  PLANES_ADICIONALES: '/cotizaemisorauto/getplanesadicionales',          // /{vCodTipoPlan?}
  
  // Cotización Auto — Swagger: POST con JSON body (CotizadorRequest)
  // ⚠️ NO es GET con path params. Es POST /generarcotizacion con body JSON.
  GENERAR_COTIZACION: '/cotizaemisorauto/generarcotizacion',
  
  // Coberturas — Swagger: GET /getlistacoberturas/{idpv}
  // ⚠️ NO es getcoberturascotizacion. Es getlistacoberturas.
  COBERTURAS_COTIZACION: '/cotizaemisorauto/getlistacoberturas',
  
  // Emisión Auto — Swagger: POST con JSON body (EmisorRequest)
  EMISION: '/cotizaemisorauto/getemision',
  
  // Pago (a confirmar con IS)
  PAYMENT: '/payment/process', // Placeholder - confirmar con IS
} as const;

// Retry config — backoff con jitter para evitar thundering herd
export const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelays: [800, 2000, 5000], // ms — exponencial con jitter
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  // Legacy (used by existing code)
  initialDelayMs: 2000,
  backoffMultiplier: 2,
};

// User-Agent consistente para evitar WAF flags
export const IS_USER_AGENT = 'LideresPortal/1.0 (+https://portal.lideresenseguros.com)';

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
