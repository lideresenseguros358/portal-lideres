/**
 * Configuración para La Regional de Seguros
 * ⚠️ SEGURIDAD: Credenciales desde variables de entorno
 *
 * Usa REGIONAL_ENV para elegir entre "development" y "production".
 * Variables con sufijo _DESA / _PROD (ej: REGIONAL_TOKEN_DESA, REGIONAL_TOKEN_PROD).
 */

export type RegionalEnvironment = 'development' | 'production';

/**
 * Resuelve el ambiente efectivo:
 *  1. REGIONAL_ENV explícito → respeta
 *  2. NODE_ENV === 'production' → 'production'
 *  3. Fallback → 'development'
 */
export function getRegionalEnv(): RegionalEnvironment {
  const explicit = process.env.REGIONAL_ENV;
  if (explicit === 'production' || explicit === 'development') return explicit;
  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

// Base URLs — defaults for DESA (PROD URL must come from env)
const DEFAULT_DESA_URL = 'https://desa.laregionaldeseguros.com:10443/desaw';

export function getRegionalBaseUrl(env?: RegionalEnvironment): string {
  const resolved = env ?? getRegionalEnv();
  const raw = resolved === 'production'
    ? (process.env.REGIONAL_BASE_URL_PROD || process.env.REGIONAL_BASE_URL || DEFAULT_DESA_URL)
    : (process.env.REGIONAL_BASE_URL_DESA || process.env.REGIONAL_BASE_URL || DEFAULT_DESA_URL);
  return raw.trim().replace(/\/$/, ''); // strip trailing whitespace/newlines and trailing slash
}

// Credentials — read suffixed vars, fall back to unsuffixed legacy vars
export function getRegionalCredentials(env?: RegionalEnvironment) {
  const resolved = env ?? getRegionalEnv();
  const suffix = resolved === 'production' ? 'PROD' : 'DESA';

  const trim = (v: string | undefined) => (v || '').trim();
  const token = trim(process.env[`REGIONAL_TOKEN_${suffix}`] || process.env.REGIONAL_TOKEN);
  return {
    username: trim(process.env[`REGIONAL_USERNAME_${suffix}`] || process.env.REGIONAL_USERNAME),
    password: trim(process.env[`REGIONAL_PASSWORD_${suffix}`] || process.env.REGIONAL_PASSWORD),
    codInter: trim(process.env[`REGIONAL_COD_INTER_${suffix}`] || process.env.REGIONAL_COD_INTER),
    token,
    // CC endpoint uses header-based token auth; PROD "llaves cotizar" token is rejected there.
    // Separate CC token falls back to the main token when not set.
    tokenCC: trim(process.env[`REGIONAL_TOKEN_CC_${suffix}`]) || token,
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
  IMPRIMIR: '/regional/auto/imprimirPoliza',   // POST — docs: /regional/auto/imprimirPoliza
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
