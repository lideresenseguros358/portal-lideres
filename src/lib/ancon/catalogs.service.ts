/**
 * Catalog Service for Aseguradora ANCON
 * Handles marca/modelo lookups and other catalogs
 */

import { anconCall } from './http-client';
import { ANCON_CATALOG_METHODS, CACHE_TTL } from './config';
import type { AnconMarcaModelo, AnconAcreedor, AnconSoapResponse } from './types';

// ═══ In-memory cache ═══
const cache = new Map<string, { data: unknown; expiresAt: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiresAt) {
    return entry.data as T;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown, ttl = CACHE_TTL.CATALOGS): void {
  cache.set(key, { data, expiresAt: Date.now() + ttl });
}

// ═══ Marca / Modelos ═══

export async function getListaMarcaModelos(): Promise<AnconSoapResponse<AnconMarcaModelo[]>> {
  const cached = getCached<AnconMarcaModelo[]>('marcaModelos');
  if (cached) {
    console.log('[ANCON Catalogs] MarcaModelos from cache');
    return { success: true, data: cached };
  }

  const result = await anconCall<AnconMarcaModelo[]>(ANCON_CATALOG_METHODS.LISTA_MARCA_MODELOS);

  if (result.success && Array.isArray(result.data)) {
    setCache('marcaModelos', result.data);
    console.log(`[ANCON Catalogs] MarcaModelos loaded: ${result.data.length} entries`);
    return { success: true, data: result.data };
  }

  return { success: false, error: result.error || 'Error loading marca/modelos' };
}

/**
 * Find ANCON marca code from IS brand name
 */
export async function resolveAnconMarca(brandName: string): Promise<string | null> {
  const result = await getListaMarcaModelos();
  if (!result.success || !result.data) return null;

  const normalized = brandName.toUpperCase().trim();
  const match = result.data.find(
    (m) => m.nombre_marca.toUpperCase().trim() === normalized
  );
  return match?.codigo_marca || null;
}

/**
 * Find ANCON modelo code from IS model name + marca code
 */
export async function resolveAnconModelo(
  marcaCodigo: string,
  modelName: string
): Promise<string | null> {
  const result = await getListaMarcaModelos();
  if (!result.success || !result.data) return null;

  const normalized = modelName.toUpperCase().trim();
  const match = result.data.find(
    (m) =>
      m.codigo_marca === marcaCodigo &&
      m.nombre_modelo.toUpperCase().trim() === normalized
  );
  return match?.codigo_modelo || null;
}

/**
 * Resolve both marca and modelo from names (for IS → ANCON normalization)
 */
export async function resolveAnconVehicleCodes(
  marcaNombre: string,
  modeloNombre: string
): Promise<{ codMarca: string; codModelo: string; matchMethod: string } | null> {
  const result = await getListaMarcaModelos();
  if (!result.success || !result.data) return null;

  const normMarca = marcaNombre.toUpperCase().trim();
  const normModelo = modeloNombre.toUpperCase().trim();

  // Exact match
  let match = result.data.find(
    (m) =>
      m.nombre_marca.toUpperCase().trim() === normMarca &&
      m.nombre_modelo.toUpperCase().trim() === normModelo
  );
  if (match) {
    return { codMarca: match.codigo_marca, codModelo: match.codigo_modelo, matchMethod: 'exact' };
  }

  // Fuzzy: marca exact, model contains
  match = result.data.find(
    (m) =>
      m.nombre_marca.toUpperCase().trim() === normMarca &&
      m.nombre_modelo.toUpperCase().includes(normModelo)
  );
  if (match) {
    return { codMarca: match.codigo_marca, codModelo: match.codigo_modelo, matchMethod: 'fuzzy-contains' };
  }

  // Fuzzy: marca exact, model starts with
  match = result.data.find(
    (m) =>
      m.nombre_marca.toUpperCase().trim() === normMarca &&
      (m.nombre_modelo.toUpperCase().startsWith(normModelo) ||
        normModelo.startsWith(m.nombre_modelo.toUpperCase().trim()))
  );
  if (match) {
    return { codMarca: match.codigo_marca, codModelo: match.codigo_modelo, matchMethod: 'fuzzy-startswith' };
  }

  console.warn(`[ANCON Catalogs] No match for ${marcaNombre}/${modeloNombre}`);
  return null;
}

// ═══ Acreedores ═══

export async function getAcreedores(): Promise<AnconSoapResponse<AnconAcreedor[]>> {
  const cached = getCached<AnconAcreedor[]>('acreedores');
  if (cached) return { success: true, data: cached };

  const result = await anconCall<AnconAcreedor[]>(ANCON_CATALOG_METHODS.GENERAR_ACREEDORES);

  if (result.success && Array.isArray(result.data)) {
    setCache('acreedores', result.data);
    return { success: true, data: result.data };
  }

  return { success: false, error: result.error || 'Error loading acreedores' };
}

// ═══ Generic catalog loaders ═══

export async function getCatalog(
  method: string,
  params: Record<string, string> = {}
): Promise<AnconSoapResponse<Array<Record<string, string>>>> {
  const cacheKey = `catalog_${method}_${JSON.stringify(params)}`;
  const cached = getCached<Array<Record<string, string>>>(cacheKey);
  if (cached) return { success: true, data: cached };

  const result = await anconCall<Array<Record<string, string>>>(method, params);

  if (result.success && Array.isArray(result.data)) {
    setCache(cacheKey, result.data);
    return { success: true, data: result.data };
  }

  return { success: false, error: result.error || `Error loading catalog ${method}` };
}
