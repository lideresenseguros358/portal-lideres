/**
 * Mapeo de Marcas y Modelos IS → FEDPA
 *
 * FEDPA usa dos formatos distintos según la API:
 *   EmisorExterno (CC):   CodMarca = "TOY", CodModelo = "FORTUNER" (texto libre)
 *   EmisorPlan (terceros): Marca = texto (nombre/abreviación de marca)
 *
 * Estrategia de resolución (de más precisa a más genérica):
 *   1. Mapeo estático: IS brand code → FEDPA 3-char code (cubre ~50 marcas conocidas)
 *   2. Catálogo FEDPA dinámico: consulta /api/Polizas/consultar_marcas_externos (si está disponible)
 *   3. Fallback por nombre: derivar código desde nombre de marca (primeras 3 letras con excepciones)
 *
 * Cache en memoria (TTL 24h) para evitar llamadas repetidas a FEDPA.
 */

import { FEDPA_CONFIG, EMISOR_EXTERNO_ENDPOINTS } from '@/lib/fedpa/config';

// ═══════════════════════════════════════════════════════════════
// STATIC MAPPING: IS brand code → FEDPA 3-char abbreviation
// Source: verified against Panama auto market + IS production catalog
// ═══════════════════════════════════════════════════════════════

export const IS_TO_FEDPA_MARCA: Record<number, string> = {
  // Japanese
  156: 'TOY',  // TOYOTA
  86: 'KIA',   // KIA
  74: 'HYU',   // HYUNDAI
  69: 'HON',   // HONDA
  113: 'NIS',  // NISSAN
  99: 'MAZ',   // MAZDA
  107: 'MIT',  // MITSUBISHI
  148: 'SUZ',  // SUZUKI
  77: 'ISU',   // ISUZU
  146: 'SUB',  // SUBARU
  92: 'LEX',   // LEXUS
  250: 'ACU',  // ACURA
  506: 'INF',  // INFINITI

  // American
  20: 'CHE',   // CHEVROLET
  50: 'FOR',   // FORD
  38: 'DOD',   // DODGE
  855: 'RAM',  // RAM
  80: 'JEP',   // JEEP
  49: 'FIA',   // FIAT (Stellantis)
  429: 'SMA',  // SMART
  839: 'TES',  // TESLA

  // European
  172: 'VOL',  // VOLKSWAGEN
  5: 'AUD',    // AUDI
  8: 'BMW',    // BMW
  215: 'MIN',  // MINI
  1012: 'MER', // MERCEDES BENZ
  174: 'VOV',  // VOLVO
  91: 'LRO',   // LAND ROVER
  79: 'JAG',   // JAGUAR
  124: 'POR',  // PORSCHE
  129: 'REN',  // RENAULT
  119: 'PEU',  // PEUGEOT

  // Chinese / Asian
  217: 'GEE',  // GEELY
  225: 'JAC',  // JAC
  233: 'CHR',  // CHERY
  214: 'GRW',  // GREAT WALL
  570: 'HAV',  // HAVAL
  418: 'MG',   // MG (SAIC)
  417: 'BYD',  // BYD
};

// ═══════════════════════════════════════════════════════════════
// FEDPA BRAND CATALOG (dynamic, fetched once per server instance)
// ═══════════════════════════════════════════════════════════════

interface FedpaBrandEntry {
  code: string;       // FEDPA brand code (e.g. "TOY")
  nombre: string;     // Brand name (e.g. "TOYOTA")
}

let _fedpaBrandCache: FedpaBrandEntry[] | null = null;
let _fedpaBrandCacheAt = 0;
const BRAND_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch FEDPA brand catalog from EmisorExterno API.
 * FEDPA may not expose this endpoint — we try and fail silently if missing.
 * Returns null if unavailable.
 */
async function fetchFedpaBrandCatalog(): Promise<FedpaBrandEntry[] | null> {
  const now = Date.now();
  if (_fedpaBrandCache && now - _fedpaBrandCacheAt < BRAND_CACHE_TTL) {
    return _fedpaBrandCache;
  }

  const config = FEDPA_CONFIG['PROD'];
  const baseUrl = config.emisorExternoUrl.replace(/\/+$/, '');
  const creds = {
    Usuario: config.usuario,
    Clave: config.clave,
  };

  // Try possible FEDPA catalog endpoints
  const candidates = [
    `${baseUrl}${EMISOR_EXTERNO_ENDPOINTS.CONSULTAR_MARCAS}`,
    `${baseUrl}/api/Polizas/consultar_marcas`,
    `${baseUrl}/api/marcas`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds),
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) continue;

      const data = await res.json();
      const arr: any[] = Array.isArray(data) ? data : data?.data || [];
      if (arr.length === 0) continue;

      const brands: FedpaBrandEntry[] = arr
        .map((item: any) => ({
          code: String(
            item.CODMARCA || item.COD_MARCA || item.COD || item.codigo || item.code || ''
          ).trim().toUpperCase(),
          nombre: String(
            item.DESCRIPCION || item.NOMBRE || item.nombre || item.description || item.MARCA || ''
          ).trim().toUpperCase(),
        }))
        .filter((b) => b.code && b.nombre);

      if (brands.length > 0) {
        _fedpaBrandCache = brands;
        _fedpaBrandCacheAt = now;
        console.log(`[FEDPA Vehicle Mapper] Brand catalog loaded from ${url}: ${brands.length} entries`);
        return brands;
      }
    } catch {
      // Endpoint doesn't exist or timed out — try next
    }
  }

  console.warn('[FEDPA Vehicle Mapper] Brand catalog endpoint not available — using static mapping only');
  _fedpaBrandCache = []; // Cache empty result to avoid repeated failed fetches
  _fedpaBrandCacheAt = now;
  return null;
}

// ═══════════════════════════════════════════════════════════════
// NAME NORMALIZATION & MATCHING
// ═══════════════════════════════════════════════════════════════

function normalizeName(s: string): string {
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[*#()[\]{}/\\]/g, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findBestBrandMatch(
  nombre: string,
  catalog: FedpaBrandEntry[]
): FedpaBrandEntry | null {
  const target = normalizeName(nombre);
  if (!target || catalog.length === 0) return null;

  // 1. Exact
  const exact = catalog.find((b) => normalizeName(b.nombre) === target);
  if (exact) return exact;

  // 2. Catalog name starts with target
  const starts = catalog.find((b) => normalizeName(b.nombre).startsWith(target));
  if (starts) return starts;

  // 3. Target starts with catalog name
  const rev = catalog.find((b) => target.startsWith(normalizeName(b.nombre)));
  if (rev) return rev;

  // 4. Contains
  const contains = catalog.find((b) => normalizeName(b.nombre).includes(target));
  if (contains) return contains;

  // 5. First word match
  const targetWord = target.split(' ')[0];
  if (targetWord && targetWord.length >= 3) {
    const word = catalog.find((b) => normalizeName(b.nombre).split(' ')[0] === targetWord);
    if (word) return word;
  }

  return null;
}

/**
 * Derive a FEDPA-style 3-char brand abbreviation from a brand name.
 * Handles common multi-word brands with known abbreviations.
 */
function deriveBrandCode(nombreMarca: string): string {
  const norm = normalizeName(nombreMarca);

  // Common multi-word brands whose first 3 chars would be misleading
  const overrides: Record<string, string> = {
    'GREAT WALL': 'GRW',
    'LAND ROVER': 'LRO',
    'MERCEDES BENZ': 'MER',
    'MERCEDES-BENZ': 'MER',
    'ALFA ROMEO': 'ALF',
    'ASTON MARTIN': 'AST',
    'ROLLS ROYCE': 'ROL',
  };

  if (overrides[norm]) return overrides[norm];

  // Single brand / first 3 chars
  const word = norm.split(' ')[0] ?? '';
  if (word.length >= 3) return word.substring(0, 3);
  return word.padEnd(3, 'X');
}

// ═══════════════════════════════════════════════════════════════
// PER-BRAND CACHE: avoids repeated FEDPA catalog calls for the same brand
// ═══════════════════════════════════════════════════════════════

const _brandCodeCache = new Map<string, { code: string; method: string; cachedAt: number }>();

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

/**
 * Resolve FEDPA brand code from IS brand info.
 *
 * This is the async, dynamic version — used in emission routes.
 * Order:
 *   1. Static IS code → FEDPA 3-char map
 *   2. Dynamic FEDPA catalog lookup by brand name
 *   3. Derived from brand name (first 3 chars with exceptions)
 */
export async function resolveFedpaMarca(
  isCodigoMarca: number,
  nombreMarca: string
): Promise<{ code: string; matchMethod: string }> {
  // 1. Static mapping (fastest)
  if (IS_TO_FEDPA_MARCA[isCodigoMarca]) {
    return { code: IS_TO_FEDPA_MARCA[isCodigoMarca], matchMethod: 'static' };
  }

  // Check per-brand cache
  const cacheKey = `${isCodigoMarca}:${nombreMarca}`;
  const cached = _brandCodeCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < BRAND_CACHE_TTL) {
    return { code: cached.code, matchMethod: cached.method };
  }

  // 2. Dynamic catalog lookup
  const catalog = await fetchFedpaBrandCatalog();
  if (catalog && catalog.length > 0) {
    const match = findBestBrandMatch(nombreMarca, catalog);
    if (match) {
      const result = { code: match.code, matchMethod: 'dynamic' };
      _brandCodeCache.set(cacheKey, { code: match.code, method: 'dynamic', cachedAt: Date.now() });
      console.log(`[FEDPA Vehicle Mapper] Dynamic brand match: "${nombreMarca}" (IS ${isCodigoMarca}) → ${match.code}`);
      return result;
    }
  }

  // 3. Derive from name
  const code = deriveBrandCode(nombreMarca);
  const result = { code, matchMethod: 'derived' };
  _brandCodeCache.set(cacheKey, { code, method: 'derived', cachedAt: Date.now() });
  console.warn(`[FEDPA Vehicle Mapper] Brand not in catalog, derived: "${nombreMarca}" (IS ${isCodigoMarca}) → ${code}`);
  return result;
}

/**
 * Normalizar nombre de modelo para FEDPA.
 * FEDPA acepta nombres de modelo como strings libres.
 * Strips special chars (IS uses "*Cam", "(4x4)" suffixes not in FEDPA catalog).
 */
export function normalizarModeloFedpa(nombreModelo: string): string {
  if (!nombreModelo || nombreModelo.trim() === '') {
    return 'AUTO';
  }

  // Strip IS variant suffixes before any other processing.
  // IS model names include variant indicators after a '*': "COOLRAY *Cam", "RAV4 *SE", etc.
  // FEDPA's AUT_MODELO catalog only stores the base model name, not variants.
  const stripped = nombreModelo.includes('*')
    ? nombreModelo.substring(0, nombreModelo.indexOf('*')).trim()
    : nombreModelo;

  return stripped
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .trim()
    .toUpperCase()
    .replace(/[*#()[\]{}/\\]/g, '') // Remove any remaining special chars
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 30); // FEDPA character limit
}

/**
 * Synchronous brand resolver — for backward compatibility with normalizeQuoteData.
 * Uses only the static map + derive fallback (no async FEDPA catalog call).
 * For full dynamic resolution, use resolveFedpaMarca() instead.
 */
export function getFedpaMarcaFromIS(codigoIS: number, nombreMarca?: string): string {
  if (IS_TO_FEDPA_MARCA[codigoIS]) {
    return IS_TO_FEDPA_MARCA[codigoIS];
  }
  if (nombreMarca && nombreMarca.trim()) {
    return deriveBrandCode(nombreMarca);
  }
  return 'OTH';
}

/**
 * Invalidate brand cache (useful after FEDPA updates their catalog)
 */
export function invalidateFedpaBrandCache(): void {
  _fedpaBrandCache = null;
  _fedpaBrandCacheAt = 0;
  _brandCodeCache.clear();
}
