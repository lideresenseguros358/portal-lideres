/**
 * Configuración para La Regional de Seguros
 * ⚠️ SEGURIDAD: Credenciales desde variables de entorno
 */

export type RegionalEnvironment = 'development' | 'production';

// Base URLs
const BASE_URLS: Record<RegionalEnvironment, string> = {
  development: 'https://desa.laregionaldeseguros.com:10443/desaw',
  production: process.env.REGIONAL_BASE_URL_PROD || 'https://desa.laregionaldeseguros.com:10443/desaw',
};

export function getRegionalBaseUrl(env: RegionalEnvironment): string {
  return process.env.REGIONAL_BASE_URL || BASE_URLS[env];
}

// Credentials
export function getRegionalCredentials(env: RegionalEnvironment) {
  return {
    username: process.env.REGIONAL_USERNAME || 'LIDERES_EN_SEGUROS_99',
    password: process.env.REGIONAL_PASSWORD || 'F?V3pTl*_cPL',
    codInter: process.env.REGIONAL_COD_INTER || '99',
    token: process.env.REGIONAL_TOKEN || '6NWEDYFWVCQoaqzppdjswFKPAPGQQPBnxMBTzhzDGTFRG8R4THEDS--X+*ieO',
  };
}

export const INSURER_SLUG = 'REGIONAL';

// ═══ Endpoints ═══

// Catálogos (GET, Basic Auth)
export const REGIONAL_CATALOG_ENDPOINTS = {
  MARCAS: '/regional/ws/marcaVeh',
  MODELOS: '/regional/ws/modeloVeh',          // /{codMarca}
  ENDOSOS: '/regional/ws/endosos',
  COLORES: '/regional/ws/colorVeh',
  ESTADO_CIVIL: '/regional/ws/edoCivil',
  GENERO: '/regional/ws/genero',
  // Direcciones
  PAISES: '/regional/dir/paises',
  PROVINCIAS: '/regional/dir/provincias',
  DISTRITOS: '/regional/dir/distritos',
  CORREGIMIENTOS: '/regional/dir/corregimientos',
  URBANIZACIONES: '/regional/dir/urbanizacion',
} as const;

// RC (Daños a Terceros) — GET cotizar, POST emitir, GET planes
export const REGIONAL_RC_ENDPOINTS = {
  COTIZAR: '/regional/auto/cotizar/',          // GET with query params
  EMITIR: '/regional/auto/emitirPolizaRc',     // POST
  PLANES: '/regional/auto/planesRc',           // GET
} as const;

// CC (Cobertura Completa) — POST cotización, POST emitir, POST imprimir, PUT planPago
export const REGIONAL_CC_ENDPOINTS = {
  COTIZACION: '/regional/auto/cotizacion',     // POST
  EMITIR: '/regional/auto/emitirPoliza',       // POST
  IMPRIMIR: '/regional/util/imprimirPoliza',   // POST
  PLAN_PAGO: '/regional/auto/planPago',        // PUT
} as const;

// Retry config
export const RETRY_CONFIG = {
  maxRetries: 2,
  baseDelays: [1000, 3000],
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

// Cache TTL
export const CACHE_TTL = {
  CATALOGS: 24 * 60 * 60 * 1000, // 24 horas
};

// Mapeo de endosos (nombre → código) — se llenará desde API
export const ENDOSO_MAP: Record<string, string> = {
  'BASICO': '1',
  'PLUS': '2',
  'PLATINUM': '3',
  'KM BASICO': '4',
  'KM PLUS': '5',
  'KM PLATINUM': '6',
};
