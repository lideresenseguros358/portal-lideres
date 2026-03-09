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

// ═══════════════════════════════════════════════════════════════
// STATIC MAPPING: IS marca code → Regional marca code
// Populated from known catalog correspondences.
// If a brand is missing here, the dynamic lookup will handle it.
// ═══════════════════════════════════════════════════════════════

const IS_TO_REGIONAL_MARCA: Record<number, number> = {
  // Estas correspondencias se actualizan conforme se confirman con el catálogo Regional.
  // La clave es el codMarca de IS, el valor es el codmarca de Regional.
  // Si no está aquí, se busca por nombre dinámicamente.
};

// ═══════════════════════════════════════════════════════════════
// In-memory cache for Regional catalogs (server-side, per-instance)
// ═══════════════════════════════════════════════════════════════

let cachedMarcas: RegionalMarca[] | null = null;
let cachedMarcasTimestamp = 0;
const cachedModelos: Map<number, { data: RegionalModelo[]; timestamp: number }> = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

async function getRegionalMarcasCached(): Promise<RegionalMarca[]> {
  if (cachedMarcas && Date.now() - cachedMarcasTimestamp < CACHE_TTL) {
    return cachedMarcas;
  }
  try {
    cachedMarcas = await getMarcas();
    cachedMarcasTimestamp = Date.now();
    // Diagnostic: log first 3 entries to verify field names
    const sample = cachedMarcas.slice(0, 3).map(m => ({ codmarca: m.codmarca, descripcion: m.descripcion, keys: Object.keys(m) }));
    const withoutDesc = cachedMarcas.filter(m => !m.descripcion).length;
    console.log(`[REGIONAL Vehicle Mapper] Cached ${cachedMarcas.length} marcas (${withoutDesc} without descripcion). Sample:`, JSON.stringify(sample));
    return cachedMarcas;
  } catch (err) {
    console.error('[REGIONAL Vehicle Mapper] Error fetching marcas:', err);
    return cachedMarcas || [];
  }
}

async function getRegionalModelosCached(codMarcaRegional: number): Promise<RegionalModelo[]> {
  const cached = cachedModelos.get(codMarcaRegional);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  try {
    const modelos = await getModelos(codMarcaRegional);
    cachedModelos.set(codMarcaRegional, { data: modelos, timestamp: Date.now() });
    const sampleM = modelos.slice(0, 3).map(m => ({ codmodelo: m.codmodelo, descripcion: m.descripcion, keys: Object.keys(m) }));
    const withoutDescM = modelos.filter(m => !m.descripcion).length;
    console.log(`[REGIONAL Vehicle Mapper] Cached ${modelos.length} modelos for marca ${codMarcaRegional} (${withoutDescM} without descripcion). Sample:`, JSON.stringify(sampleM));
    return modelos;
  } catch (err) {
    console.error(`[REGIONAL Vehicle Mapper] Error fetching modelos for marca ${codMarcaRegional}:`, err);
    return cached?.data || [];
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
 * Same strategy: exact → startsWith → includes
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

  // 5. First word match (handles "COROLLA XLI" → "COROLLA", etc.)
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
