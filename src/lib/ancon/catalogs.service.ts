/**
 * Catalog Service for Aseguradora ANCON
 * Handles marca/modelo lookups and other catalogs
 *
 * Cache layers for getListaMarcaModelos (10k+ SOAP entries):
 *   L1: In-memory per process instance     (~0ms)
 *   L2: Supabase insurer_vehicle_catalogs  (~50ms, shared across serverless instances)
 *   L3: ANCON SOAP API (ListaMarcaModelos) (~500-2000ms, source of truth)
 */

import { anconCall } from './http-client';
import { ANCON_CATALOG_METHODS, CACHE_TTL } from './config';
import type { AnconMarcaModelo, AnconAcreedor, AnconSoapResponse } from './types';

const CATALOG_TTL_MS = CACHE_TTL.CATALOGS; // 24h

// ═══════════════════════════════════════════════════════════════
// L1: In-memory cache (per process instance)
// ═══════════════════════════════════════════════════════════════

const memCache = new Map<string, { data: unknown; expiresAt: number }>();

function memGet<T>(key: string): T | null {
  const entry = memCache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data as T;
  memCache.delete(key);
  return null;
}

function memSet(key: string, data: unknown, ttl = CATALOG_TTL_MS): void {
  memCache.set(key, { data, expiresAt: Date.now() + ttl });
}

// ═══════════════════════════════════════════════════════════════
// L2: Supabase cache (shared across serverless instances)
// ═══════════════════════════════════════════════════════════════

async function supabaseRead(catalogKey: string): Promise<AnconMarcaModelo[] | null> {
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase/admin');
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from('insurer_vehicle_catalogs')
      .select('catalog_data, expires_at')
      .eq('insurer', 'ANCON')
      .eq('catalog_key', catalogKey)
      .single();

    if (!data) return null;
    if (new Date(data.expires_at).getTime() <= Date.now() + 5 * 60 * 1000) return null; // expires in <5min

    const catalog = data.catalog_data as AnconMarcaModelo[];
    // Warm L1 as well
    memSet(catalogKey, catalog);
    console.log(`[ANCON Catalogs] ✅ ${catalogKey} from Supabase L2 (${catalog.length} entries)`);
    return catalog;
  } catch {
    return null;
  }
}

function supabaseSave(catalogKey: string, data: AnconMarcaModelo[]): void {
  // Fire-and-forget — never blocks the main flow
  (async () => {
    try {
      const { getSupabaseAdmin } = await import('@/lib/supabase/admin');
      const sb = getSupabaseAdmin();
      await sb.from('insurer_vehicle_catalogs').upsert(
        {
          insurer: 'ANCON',
          catalog_key: catalogKey,
          catalog_data: data,
          fetched_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + CATALOG_TTL_MS).toISOString(),
        },
        { onConflict: 'insurer,catalog_key' },
      );
      console.log(`[ANCON Catalogs] Saved ${catalogKey} to Supabase L2`);
    } catch (e: any) {
      console.warn(`[ANCON Catalogs] Supabase save failed for ${catalogKey}:`, e?.message);
    }
  })();
}

// ═══════════════════════════════════════════════════════════════
// Marca / Modelos (main catalog — L1 → L2 → L3)
// ═══════════════════════════════════════════════════════════════

export async function getListaMarcaModelos(): Promise<AnconSoapResponse<AnconMarcaModelo[]>> {
  const KEY = 'marcaModelos';

  // L1: memory
  const mem = memGet<AnconMarcaModelo[]>(KEY);
  if (mem) {
    console.log('[ANCON Catalogs] MarcaModelos from L1 memory cache');
    return { success: true, data: mem };
  }

  // L2: Supabase
  const sb = await supabaseRead(KEY);
  if (sb) return { success: true, data: sb };

  // L3: ANCON SOAP API
  console.log('[ANCON Catalogs] Fetching MarcaModelos from ANCON SOAP API (L3)…');
  const result = await anconCall<AnconMarcaModelo[]>(ANCON_CATALOG_METHODS.LISTA_MARCA_MODELOS);

  if (result.success && Array.isArray(result.data)) {
    memSet(KEY, result.data);
    supabaseSave(KEY, result.data); // async, non-blocking
    console.log(`[ANCON Catalogs] MarcaModelos loaded from SOAP: ${result.data.length} entries`);
    return { success: true, data: result.data };
  }

  return { success: false, error: result.error || 'Error loading marca/modelos' };
}

// ═══════════════════════════════════════════════════════════════
// Name normalization helpers (shared by all resolvers)
// ═══════════════════════════════════════════════════════════════

/**
 * Normalize a name for comparison: strip accents, special chars (* # ( ) [ ] etc.),
 * collapse hyphens/underscores to spaces, uppercase.
 * IS model names sometimes carry suffixes like "*Cam" or "(4x4)" absent from ANCON.
 */
function normalizeForMatch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .toUpperCase()
    .replace(/[*#()[\]{}/\\]/g, '')  // Remove special chars
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split a normalized name into significant tokens (length ≥ 2). */
function getTokens(normalized: string): string[] {
  return normalized.split(' ').filter((t) => t.length >= 2);
}

// ═══════════════════════════════════════════════════════════════
// Resolvers (all call getListaMarcaModelos → benefit from cache layers)
// ═══════════════════════════════════════════════════════════════

/**
 * Find ANCON marca code from an IS brand name.
 * Uses normalizeForMatch so accents/case/special chars don't prevent a match.
 */
export async function resolveAnconMarca(brandName: string): Promise<string | null> {
  const result = await getListaMarcaModelos();
  if (!result.success || !result.data) return null;

  const target = normalizeForMatch(brandName);

  // 1. Exact (normalized)
  let match = result.data.find((m) => normalizeForMatch(m.nombre_marca) === target);
  if (match) return match.codigo_marca;

  // 2. StartsWith either way
  match = result.data.find(
    (m) =>
      normalizeForMatch(m.nombre_marca).startsWith(target) ||
      target.startsWith(normalizeForMatch(m.nombre_marca)),
  );
  return match?.codigo_marca || null;
}

/**
 * Find ANCON modelo code from an IS model name + ANCON marca code.
 * Uses the same fuzzy matching strategy as resolveAnconVehicleCodes.
 */
export async function resolveAnconModelo(
  marcaCodigo: string,
  modelName: string,
): Promise<string | null> {
  const result = await getListaMarcaModelos();
  if (!result.success || !result.data) return null;

  const target = normalizeForMatch(modelName);
  const byMarca = result.data.filter((m) => m.codigo_marca === marcaCodigo);

  // 1. Exact
  let match = byMarca.find((m) => normalizeForMatch(m.nombre_modelo) === target);
  if (match) return match.codigo_modelo;

  // 2. Contains / startsWith
  match = byMarca.find(
    (m) =>
      normalizeForMatch(m.nombre_modelo).includes(target) ||
      target.startsWith(normalizeForMatch(m.nombre_modelo)),
  );
  if (match) return match.codigo_modelo;

  // 3. Token-based
  const tokens = getTokens(target);
  if (tokens.length >= 2) {
    match = byMarca.find((m) => {
      const norm = normalizeForMatch(m.nombre_modelo);
      return tokens.every((tok) => norm.includes(tok));
    });
    if (match) return match.codigo_modelo;
  }

  return null;
}

/**
 * Resolve both marca and modelo ANCON codes from IS brand/model names.
 *
 * Matching strategies (most precise → most lenient):
 *   1. Exact (normalized)
 *   2. IS model ⊆ ANCON name (contains)
 *   3. Prefix match either direction (handles *Cam, (4x4) suffixes)
 *   4. Token-based (all IS tokens present in ANCON name)
 *   5. Progressive prefix-drop (drop trailing tokens one by one)
 */
export async function resolveAnconVehicleCodes(
  marcaNombre: string,
  modeloNombre: string,
): Promise<{ codMarca: string; codModelo: string; matchMethod: string } | null> {
  const result = await getListaMarcaModelos();
  if (!result.success || !result.data) return null;

  const normMarca = normalizeForMatch(marcaNombre);
  const normModelo = normalizeForMatch(modeloNombre);

  const marcaMatches = (m: AnconMarcaModelo) =>
    normalizeForMatch(m.nombre_marca) === normMarca;

  // 1. Exact
  let match = result.data.find(
    (m) => marcaMatches(m) && normalizeForMatch(m.nombre_modelo) === normModelo,
  );
  if (match) {
    return { codMarca: match.codigo_marca, codModelo: match.codigo_modelo, matchMethod: 'exact' };
  }

  // 2. IS model ⊆ ANCON name
  match = result.data.find(
    (m) => marcaMatches(m) && normalizeForMatch(m.nombre_modelo).includes(normModelo),
  );
  if (match) {
    return { codMarca: match.codigo_marca, codModelo: match.codigo_modelo, matchMethod: 'fuzzy-contains' };
  }

  // 3. Prefix match either direction
  match = result.data.find(
    (m) =>
      marcaMatches(m) &&
      (normalizeForMatch(m.nombre_modelo).startsWith(normModelo) ||
        normModelo.startsWith(normalizeForMatch(m.nombre_modelo))),
  );
  if (match) {
    return { codMarca: match.codigo_marca, codModelo: match.codigo_modelo, matchMethod: 'fuzzy-startswith' };
  }

  // 4. Token-based
  const isTokens = getTokens(normModelo);
  if (isTokens.length >= 2) {
    match = result.data.find((m) => {
      if (!marcaMatches(m)) return false;
      const anconNorm = normalizeForMatch(m.nombre_modelo);
      return isTokens.every((tok) => anconNorm.includes(tok));
    });
    if (match) {
      return { codMarca: match.codigo_marca, codModelo: match.codigo_modelo, matchMethod: 'fuzzy-tokens' };
    }
  }

  // 5. Progressive prefix-drop
  if (isTokens.length >= 2) {
    for (let drop = 1; drop < isTokens.length - 1; drop++) {
      const prefix = isTokens.slice(0, isTokens.length - drop).join(' ');
      match = result.data.find(
        (m) =>
          marcaMatches(m) &&
          (normalizeForMatch(m.nombre_modelo) === prefix ||
            normalizeForMatch(m.nombre_modelo).startsWith(prefix)),
      );
      if (match) {
        return {
          codMarca: match.codigo_marca,
          codModelo: match.codigo_modelo,
          matchMethod: `fuzzy-prefix-drop${drop}`,
        };
      }
    }
  }

  console.warn(`[ANCON Catalogs] No match for ${marcaNombre}/${modeloNombre}`);
  return null;
}

// ═══════════════════════════════════════════════════════════════
// Acreedores
// ═══════════════════════════════════════════════════════════════

export async function getAcreedores(): Promise<AnconSoapResponse<AnconAcreedor[]>> {
  const mem = memGet<AnconAcreedor[]>('acreedores');
  if (mem) return { success: true, data: mem };

  const result = await anconCall<AnconAcreedor[]>(ANCON_CATALOG_METHODS.GENERAR_ACREEDORES);

  if (result.success && Array.isArray(result.data)) {
    memSet('acreedores', result.data);
    return { success: true, data: result.data };
  }

  return { success: false, error: result.error || 'Error loading acreedores' };
}

// ═══════════════════════════════════════════════════════════════
// Generic catalog loader (for non-vehicle ANCON catalogs)
// ═══════════════════════════════════════════════════════════════

export async function getCatalog(
  method: string,
  params: Record<string, string> = {},
): Promise<AnconSoapResponse<Array<Record<string, string>>>> {
  const cacheKey = `catalog_${method}_${JSON.stringify(params)}`;
  const mem = memGet<Array<Record<string, string>>>(cacheKey);
  if (mem) return { success: true, data: mem };

  const result = await anconCall<Array<Record<string, string>>>(method, params);

  if (result.success && Array.isArray(result.data)) {
    memSet(cacheKey, result.data);
    return { success: true, data: result.data };
  }

  return { success: false, error: result.error || `Error loading catalog ${method}` };
}
