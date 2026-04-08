/**
 * Mapeo de Marcas y Modelos IS → REGIONAL
 * 
 * Internacional de Seguros (IS) y La Regional de Seguros usan catálogos
 * numéricos DIFERENTES para marcas y modelos de vehículos.
 * 
 * Este módulo resuelve la traducción:
 *   IS codMarca/codModelo  →  REGIONAL codmarca/codmodelo
 * 
 * Estrategia (igual que fedpa-vehicle-mapper.ts):
 * 1. Mapeo estático para marcas comunes (IS code → Regional code)
 * 2. Fallback dinámico: buscar por nombre en el catálogo Regional via API
 * 3. Cache en memoria para evitar llamadas repetidas
 * 
 * USO:
 *   const { codMarca, codModelo } = await resolveRegionalVehicleCodes({
 *     isMarcaCodigo: 156,
 *     isModeloCodigo: 1434,
 *     marcaNombre: 'TOYOTA',
 *     modeloNombre: 'FORTUNER',
 *   });
 */

import { getMarcas, getModelos } from '@/lib/regional/catalogs.service';
import type { RegionalMarca, RegionalModelo } from '@/lib/regional/types';

/**
 * Cache layers for Regional catalog data:
 *   L1: In-memory per process instance     (~0ms)
 *   L2: Supabase insurer_vehicle_catalogs  (~50ms, shared across serverless instances)
 *   L3: Regional REST API                  (~200ms per call, source of truth)
 */

const CATALOG_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// ═══════════════════════════════════════════════════════════════
// STATIC MAPPING: IS marca code → Regional marca code
// Empty: Regional brand codes differ completely from IS codes and
// have no predictable relationship — always resolved dynamically.
// ═══════════════════════════════════════════════════════════════

const IS_TO_REGIONAL_MARCA: Record<number, number> = {};

// ═══════════════════════════════════════════════════════════════
// L1: In-memory cache
// ═══════════════════════════════════════════════════════════════

let _memMarcas: RegionalMarca[] | null = null;
let _memMarcasAt = 0;
const _memModelos = new Map<number, { data: RegionalModelo[]; ts: number }>();

// ═══════════════════════════════════════════════════════════════
// L2: Supabase helpers
// ═══════════════════════════════════════════════════════════════

async function supabaseReadMarcas(): Promise<RegionalMarca[] | null> {
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase/admin');
    const sb = getSupabaseAdmin();
    const { data } = await (sb as any)
      .from('insurer_vehicle_catalogs')
      .select('catalog_data, expires_at')
      .eq('insurer', 'REGIONAL')
      .eq('catalog_key', 'marcas')
      .single();

    if (!data) return null;
    if (new Date((data as any).expires_at).getTime() <= Date.now() + 5 * 60 * 1000) return null;

    const marcas = (data as any).catalog_data as RegionalMarca[];
    _memMarcas = marcas;
    _memMarcasAt = Date.now();
    console.log(`[REGIONAL Vehicle Mapper] ✅ marcas from Supabase L2 (${marcas.length} entries)`);
    return marcas;
  } catch {
    return null;
  }
}

function supabaseSaveMarcas(marcas: RegionalMarca[]): void {
  (async () => {
    try {
      const { getSupabaseAdmin } = await import('@/lib/supabase/admin');
      const sb = getSupabaseAdmin();
      await (sb as any).from('insurer_vehicle_catalogs').upsert(
        {
          insurer: 'REGIONAL',
          catalog_key: 'marcas',
          catalog_data: marcas,
          fetched_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + CATALOG_TTL_MS).toISOString(),
        },
        { onConflict: 'insurer,catalog_key' },
      );
      console.log('[REGIONAL Vehicle Mapper] Saved marcas to Supabase L2');
    } catch (e: any) {
      console.warn('[REGIONAL Vehicle Mapper] Supabase save failed (marcas):', e?.message);
    }
  })();
}

async function supabaseReadModelos(codMarca: number): Promise<RegionalModelo[] | null> {
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase/admin');
    const sb = getSupabaseAdmin();
    const { data } = await (sb as any)
      .from('insurer_vehicle_catalogs')
      .select('catalog_data, expires_at')
      .eq('insurer', 'REGIONAL')
      .eq('catalog_key', `modelos_${codMarca}`)
      .single();

    if (!data) return null;
    if (new Date((data as any).expires_at).getTime() <= Date.now() + 5 * 60 * 1000) return null;

    const modelos = (data as any).catalog_data as RegionalModelo[];
    _memModelos.set(codMarca, { data: modelos, ts: Date.now() });
    console.log(`[REGIONAL Vehicle Mapper] ✅ modelos_${codMarca} from Supabase L2 (${modelos.length} entries)`);
    return modelos;
  } catch {
    return null;
  }
}

function supabaseSaveModelos(codMarca: number, modelos: RegionalModelo[]): void {
  (async () => {
    try {
      const { getSupabaseAdmin } = await import('@/lib/supabase/admin');
      const sb = getSupabaseAdmin();
      await (sb as any).from('insurer_vehicle_catalogs').upsert(
        {
          insurer: 'REGIONAL',
          catalog_key: `modelos_${codMarca}`,
          catalog_data: modelos,
          fetched_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + CATALOG_TTL_MS).toISOString(),
        },
        { onConflict: 'insurer,catalog_key' },
      );
    } catch (e: any) {
      console.warn(`[REGIONAL Vehicle Mapper] Supabase save failed (modelos_${codMarca}):`, e?.message);
    }
  })();
}

// ═══════════════════════════════════════════════════════════════
// L1 → L2 → L3 fetchers
// ═══════════════════════════════════════════════════════════════

async function getRegionalMarcasCached(): Promise<RegionalMarca[]> {
  // L1
  if (_memMarcas && Date.now() - _memMarcasAt < CATALOG_TTL_MS) return _memMarcas;

  // L2
  const sb = await supabaseReadMarcas();
  if (sb) return sb;

  // L3
  const stale = _memMarcas;
  try {
    console.log('[REGIONAL Vehicle Mapper] Fetching marcas from Regional API (L3)…');
    const fresh = await getMarcas();
    _memMarcas = fresh;
    _memMarcasAt = Date.now();
    supabaseSaveMarcas(fresh); // async, non-blocking
    const sample = fresh.slice(0, 3).map(m => ({ codmarca: m.codmarca, descripcion: m.descripcion }));
    console.log(`[REGIONAL Vehicle Mapper] Loaded ${fresh.length} marcas. Sample:`, JSON.stringify(sample));
    return fresh;
  } catch (err: any) {
    console.error('[REGIONAL Vehicle Mapper] Error fetching marcas:', err);
    if (stale && stale.length > 0) {
      console.warn('[REGIONAL Vehicle Mapper] Using stale marcas (L1) due to API error');
      return stale;
    }
    throw new Error(`No se pudo conectar al catálogo de marcas de La Regional (${err.message || 'error de conexión'}). Intente nuevamente en unos minutos.`);
  }
}

async function getRegionalModelosCached(codMarcaRegional: number): Promise<RegionalModelo[]> {
  // L1
  const mem = _memModelos.get(codMarcaRegional);
  if (mem && Date.now() - mem.ts < CATALOG_TTL_MS) return mem.data;

  // L2
  const sb = await supabaseReadModelos(codMarcaRegional);
  if (sb) return sb;

  // L3
  const stale = mem?.data;
  try {
    console.log(`[REGIONAL Vehicle Mapper] Fetching modelos for marca ${codMarcaRegional} from Regional API (L3)…`);
    const modelos = await getModelos(codMarcaRegional);
    _memModelos.set(codMarcaRegional, { data: modelos, ts: Date.now() });
    supabaseSaveModelos(codMarcaRegional, modelos); // async, non-blocking
    console.log(`[REGIONAL Vehicle Mapper] Loaded ${modelos.length} modelos for marca ${codMarcaRegional}`);
    return modelos;
  } catch (err: any) {
    console.error(`[REGIONAL Vehicle Mapper] Error fetching modelos for marca ${codMarcaRegional}:`, err);
    if (stale && stale.length > 0) {
      console.warn(`[REGIONAL Vehicle Mapper] Using stale modelos (L1) for marca ${codMarcaRegional} due to API error`);
      return stale;
    }
    throw new Error(`No se pudo conectar al catálogo de modelos de La Regional (${err.message || 'error de conexión'}). Intente nuevamente en unos minutos.`);
  }
}

// ═══════════════════════════════════════════════════════════════
// FUZZY NAME MATCHING
// ═══════════════════════════════════════════════════════════════

/**
 * Normalize a brand/model name for comparison.
 * Removes accents, extra spaces, hyphens, and converts to uppercase.
 */
function normalizeName(name: string | undefined | null): string {
  if (!name) return '';
  return String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .toUpperCase()
    .replace(/[*#()[\]{}/\\]/g, '') // Remove special chars (e.g. IS "*Cam" suffix)
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find best match for a brand name in Regional's catalog.
 * Tries: exact match → startsWith → includes → first-word match
 */
function findBestMarcaMatch(
  nombre: string,
  marcas: RegionalMarca[]
): RegionalMarca | null {
  const target = normalizeName(nombre);
  if (!target) return null;

  // Filter out catalog entries with missing descripcion
  const valid = marcas.filter(m => m.descripcion);

  // 1. Exact match
  const exact = valid.find(m => normalizeName(m.descripcion) === target);
  if (exact) return exact;

  // 2. Regional description starts with target
  const startsWith = valid.find(m => normalizeName(m.descripcion).startsWith(target));
  if (startsWith) return startsWith;

  // 3. Target starts with Regional description
  const reverseStartsWith = valid.find(m => target.startsWith(normalizeName(m.descripcion)));
  if (reverseStartsWith) return reverseStartsWith;

  // 4. Contains
  const contains = valid.find(m => normalizeName(m.descripcion).includes(target));
  if (contains) return contains;

  // 5. First word match (handles "MERCEDES BENZ" → "MERCEDES-BENZ", etc.)
  const targetFirstWord = target.split(' ')[0];
  if (targetFirstWord && targetFirstWord.length >= 3) {
    const firstWord = valid.find(m => normalizeName(m.descripcion).split(' ')[0] === targetFirstWord);
    if (firstWord) return firstWord;
  }

  return null;
}

/**
 * Find best match for a model name in Regional's catalog.
 * Same strategy: exact → startsWith → includes → token-based → prefix-drop
 */
function findBestModeloMatch(
  nombre: string,
  modelos: RegionalModelo[]
): RegionalModelo | null {
  const target = normalizeName(nombre);
  if (!target) return null;

  // Filter out catalog entries with missing descripcion
  const valid = modelos.filter(m => m.descripcion);

  // 1. Exact match
  const exact = valid.find(m => normalizeName(m.descripcion) === target);
  if (exact) return exact;

  // 2. Regional description starts with target
  const startsWith = valid.find(m => normalizeName(m.descripcion).startsWith(target));
  if (startsWith) return startsWith;

  // 3. Target starts with Regional description
  const reverseStartsWith = valid.find(m => target.startsWith(normalizeName(m.descripcion)));
  if (reverseStartsWith) return reverseStartsWith;

  // 4. Contains
  const contains = valid.find(m => normalizeName(m.descripcion).includes(target));
  if (contains) return contains;

  // 5. Token-based: every significant token of IS model appears in the Regional model name
  const tokens = target.split(' ').filter(t => t.length >= 2);
  if (tokens.length >= 2) {
    const tokenMatch = valid.find(m => {
      const norm = normalizeName(m.descripcion);
      return tokens.every(tok => norm.includes(tok));
    });
    if (tokenMatch) return tokenMatch;
  }

  // 6. Progressive prefix: drop trailing tokens (handles "*Cam", option suffixes)
  if (tokens.length >= 2) {
    for (let drop = 1; drop < tokens.length - 1; drop++) {
      const prefix = tokens.slice(0, tokens.length - drop).join(' ');
      const prefixMatch = valid.find(
        m => normalizeName(m.descripcion) === prefix ||
             normalizeName(m.descripcion).startsWith(prefix)
      );
      if (prefixMatch) return prefixMatch;
    }
  }

  // 7. First word match (handles "COROLLA XLI" → "COROLLA", etc.)
  const targetFirstWord = target.split(' ')[0];
  if (targetFirstWord && targetFirstWord.length >= 3) {
    const firstWord = valid.find(m => normalizeName(m.descripcion).split(' ')[0] === targetFirstWord);
    if (firstWord) return firstWord;
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

export interface ResolveVehicleCodesInput {
  isMarcaCodigo: number;
  isModeloCodigo: number;
  marcaNombre: string;   // Brand name from IS catalog (e.g. "TOYOTA")
  modeloNombre: string;  // Model name from IS catalog (e.g. "FORTUNER")
}

export interface ResolveVehicleCodesResult {
  codMarca: number;
  codModelo: number;
  marcaRegionalNombre: string;
  modeloRegionalNombre: string;
  matchMethod: 'static' | 'dynamic_exact' | 'dynamic_fuzzy' | 'fallback_first';
  warning?: string;
}

/**
 * Resolve IS vehicle codes to Regional vehicle codes.
 * 
 * Strategy:
 * 1. Check static mapping for marca
 * 2. If not found, query Regional catalog and match by name
 * 3. Once marca is resolved, fetch models for that marca and match by name
 * 4. If model not found, use first available model as fallback
 */
export async function resolveRegionalVehicleCodes(
  input: ResolveVehicleCodesInput
): Promise<ResolveVehicleCodesResult> {
  const { isMarcaCodigo, isModeloCodigo, marcaNombre, modeloNombre } = input;

  console.log(`[REGIONAL Vehicle Mapper] Resolving IS marca=${isMarcaCodigo} (${marcaNombre}), modelo=${isModeloCodigo} (${modeloNombre})`);

  // ── Step 1: Resolve Marca ──
  let codMarcaRegional: number | null = null;
  let marcaRegionalNombre = '';
  let matchMethod: ResolveVehicleCodesResult['matchMethod'] = 'dynamic_fuzzy';

  // 1a. Static mapping
  if (IS_TO_REGIONAL_MARCA[isMarcaCodigo]) {
    codMarcaRegional = IS_TO_REGIONAL_MARCA[isMarcaCodigo];
    matchMethod = 'static';
    console.log(`[REGIONAL Vehicle Mapper] Static marca match: IS ${isMarcaCodigo} → Regional ${codMarcaRegional}`);
  }

  // 1b. Dynamic lookup by name
  if (!codMarcaRegional && marcaNombre) {
    const marcas = await getRegionalMarcasCached();
    const match = findBestMarcaMatch(marcaNombre, marcas);
    if (match) {
      codMarcaRegional = match.codmarca;
      marcaRegionalNombre = match.descripcion;
      matchMethod = normalizeName(match.descripcion) === normalizeName(marcaNombre)
        ? 'dynamic_exact'
        : 'dynamic_fuzzy';
      console.log(`[REGIONAL Vehicle Mapper] Dynamic marca match: "${marcaNombre}" → ${match.codmarca} ("${match.descripcion}") [${matchMethod}]`);
    }
  }

  // 1c. If still no match, throw — NEVER send raw IS codes to Regional
  if (!codMarcaRegional) {
    const msg = `No se encontró marca "${marcaNombre}" (IS code ${isMarcaCodigo}) en catálogo de La Regional. Verifique el nombre de la marca.`;
    console.error(`[REGIONAL Vehicle Mapper] ❌ ${msg}`);
    throw new Error(msg);
  }

  // ── Step 2: Resolve Modelo ──
  let codModeloRegional: number | null = null;
  let modeloRegionalNombre = '';

  if (modeloNombre) {
    const modelos = await getRegionalModelosCached(codMarcaRegional);
    const match = findBestModeloMatch(modeloNombre, modelos);
    if (match) {
      codModeloRegional = match.codmodelo;
      modeloRegionalNombre = match.descripcion;
      console.log(`[REGIONAL Vehicle Mapper] Dynamic modelo match: "${modeloNombre}" → ${match.codmodelo} ("${match.descripcion}")`);
    } else {
      // Fallback: use first model available for this brand
      if (modelos.length > 0) {
        codModeloRegional = modelos[0]!.codmodelo;
        modeloRegionalNombre = modelos[0]!.descripcion;
        matchMethod = 'fallback_first';
        console.warn(`[REGIONAL Vehicle Mapper] ⚠️ No modelo match for "${modeloNombre}" in marca ${codMarcaRegional}. Using first: ${codModeloRegional} ("${modeloRegionalNombre}")`);
      }
    }
  }

  if (!codModeloRegional) {
    const msg = `No se encontró modelo "${modeloNombre}" (IS code ${isModeloCodigo}) en catálogo de La Regional para marca ${marcaRegionalNombre || marcaNombre} (${codMarcaRegional}). Verifique el nombre del modelo.`;
    console.error(`[REGIONAL Vehicle Mapper] ❌ ${msg}`);
    throw new Error(msg);
  }

  return {
    codMarca: codMarcaRegional,
    codModelo: codModeloRegional,
    marcaRegionalNombre: marcaRegionalNombre || marcaNombre,
    modeloRegionalNombre,
    matchMethod,
  };
}

/**
 * Convenience function: only resolve marca (for RC quotes that don't need model)
 */
export async function resolveRegionalMarcaCode(
  isMarcaCodigo: number,
  marcaNombre: string
): Promise<{ codMarca: number; descripcion: string; matched: boolean }> {
  // Static first
  if (IS_TO_REGIONAL_MARCA[isMarcaCodigo]) {
    return { codMarca: IS_TO_REGIONAL_MARCA[isMarcaCodigo], descripcion: marcaNombre, matched: true };
  }

  // Dynamic
  if (marcaNombre) {
    const marcas = await getRegionalMarcasCached();
    const match = findBestMarcaMatch(marcaNombre, marcas);
    if (match) {
      return { codMarca: match.codmarca, descripcion: match.descripcion, matched: true };
    }
  }

  // Fallback
  return { codMarca: isMarcaCodigo, descripcion: marcaNombre, matched: false };
}
