/**
 * Catalogs Service for La Regional de Seguros
 * Fetches and caches catalog data (marcas, modelos, endosos, colores, etc.)
 */

import { regionalGet } from './http-client';
import { REGIONAL_CATALOG_ENDPOINTS, REGIONAL_RC_ENDPOINTS, CACHE_TTL } from './config';
import type {
  RegionalMarca,
  RegionalModelo,
  RegionalEndoso,
  RegionalColor,
  RegionalGenero,
  RegionalEstadoCivil,
  RegionalPais,
  RegionalProvincia,
  RegionalDistrito,
  RegionalCorregimiento,
  RegionalUrbanizacion,
  RegionalPlanRC,
} from './types';

// ═══ In-memory cache ═══
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache: Record<string, CacheEntry<unknown>> = {};

function getCached<T>(key: string): T | null {
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL.CATALOGS) {
    delete cache[key];
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache[key] = { data, timestamp: Date.now() };
}

// ═══ Catalog Fetchers ═══

export async function getMarcas(): Promise<RegionalMarca[]> {
  const cached = getCached<RegionalMarca[]>('marcas');
  if (cached) return cached;

  const res = await regionalGet<RegionalMarca[]>(REGIONAL_CATALOG_ENDPOINTS.MARCAS);
  let raw: any[] = [];
  if (res.success && Array.isArray(res.data)) {
    raw = res.data;
  } else {
    raw = extractArray(res.data || res.raw) as any[];
  }
  // Normalize: Regional API may return different field names across environments
  // codmarca variants: codmarca | cod_marca | CodMarca | codMarca | id_marca | idmarca
  const normalized: RegionalMarca[] = raw.map((m: any) => ({
    codmarca: m.codmarca ?? m.cod_marca ?? m.CodMarca ?? m.codMarca ?? m.id_marca ?? m.idmarca,
    descripcion: m.descripcion || m.descmarca || m.DescMarca || m.desc_marca || m.nombre || m.Nombre || '',
  }));
  if (normalized.length > 0) {
    setCache('marcas', normalized);
  }
  return normalized;
}

export async function getModelos(codMarca: number): Promise<RegionalModelo[]> {
  const cacheKey = `modelos_${codMarca}`;
  const cached = getCached<RegionalModelo[]>(cacheKey);
  if (cached) return cached;

  const res = await regionalGet<RegionalModelo[]>(
    `${REGIONAL_CATALOG_ENDPOINTS.MODELOS}/${codMarca}`
  );
  let raw: any[] = [];
  if (res.success && Array.isArray(res.data)) {
    raw = res.data;
  } else {
    raw = extractArray(res.data || res.raw) as any[];
  }
  // Normalize: Regional API may return different field names across environments
  // codmodelo variants: codmodelo | cod_modelo | CodModelo | codModelo | id_modelo
  const normalized: RegionalModelo[] = raw.map((m: any) => ({
    codmodelo: m.codmodelo ?? m.cod_modelo ?? m.CodModelo ?? m.codModelo ?? m.id_modelo ?? m.idmodelo,
    descripcion: m.descripcion || m.descmodelo || m.DescModelo || m.desc_modelo || m.nombre || m.Nombre || '',
    codmarca: m.codmarca ?? m.cod_marca ?? m.CodMarca ?? m.codMarca,
  }));
  if (normalized.length > 0) {
    setCache(cacheKey, normalized);
  }
  return normalized;
}

export async function getEndosos(): Promise<RegionalEndoso[]> {
  const cached = getCached<RegionalEndoso[]>('endosos');
  if (cached) return cached;

  const res = await regionalGet<RegionalEndoso[]>(REGIONAL_CATALOG_ENDPOINTS.ENDOSOS);
  if (res.success && Array.isArray(res.data)) {
    setCache('endosos', res.data);
    return res.data;
  }
  const arr = extractArray(res.data || res.raw);
  if (arr.length > 0) {
    setCache('endosos', arr);
  }
  return arr as RegionalEndoso[];
}

export async function getColores(): Promise<RegionalColor[]> {
  const cached = getCached<RegionalColor[]>('colores');
  if (cached) return cached;

  const res = await regionalGet<RegionalColor[]>(REGIONAL_CATALOG_ENDPOINTS.COLORES);
  if (res.success && Array.isArray(res.data)) {
    setCache('colores', res.data);
    return res.data;
  }
  const arr = extractArray(res.data || res.raw);
  if (arr.length > 0) {
    setCache('colores', arr);
  }
  return arr as RegionalColor[];
}

export async function getGeneros(): Promise<RegionalGenero[]> {
  const cached = getCached<RegionalGenero[]>('generos');
  if (cached) return cached;

  const res = await regionalGet<RegionalGenero[]>(REGIONAL_CATALOG_ENDPOINTS.GENERO);
  if (res.success && Array.isArray(res.data)) {
    setCache('generos', res.data);
    return res.data;
  }
  const arr = extractArray(res.data || res.raw);
  if (arr.length > 0) {
    setCache('generos', arr);
  }
  return arr as RegionalGenero[];
}

export async function getEstadosCiviles(): Promise<RegionalEstadoCivil[]> {
  const cached = getCached<RegionalEstadoCivil[]>('estadosCiviles');
  if (cached) return cached;

  const res = await regionalGet<RegionalEstadoCivil[]>(REGIONAL_CATALOG_ENDPOINTS.ESTADO_CIVIL);
  if (res.success && Array.isArray(res.data)) {
    setCache('estadosCiviles', res.data);
    return res.data;
  }
  const arr = extractArray(res.data || res.raw);
  if (arr.length > 0) {
    setCache('estadosCiviles', arr);
  }
  return arr as RegionalEstadoCivil[];
}

export async function getPlanesRC(): Promise<RegionalPlanRC[]> {
  const cached = getCached<RegionalPlanRC[]>('planesRC');
  if (cached) return cached;

  const res = await regionalGet<RegionalPlanRC[]>(REGIONAL_RC_ENDPOINTS.PLANES);
  if (res.success && Array.isArray(res.data)) {
    setCache('planesRC', res.data);
    return res.data;
  }
  const arr = extractArray(res.data || res.raw);
  if (arr.length > 0) {
    setCache('planesRC', arr);
  }
  return arr as RegionalPlanRC[];
}

// ═══ Direcciones ═══

export async function getPaises(): Promise<RegionalPais[]> {
  const cached = getCached<RegionalPais[]>('paises');
  if (cached) return cached;

  const res = await regionalGet<RegionalPais[]>(REGIONAL_CATALOG_ENDPOINTS.PAISES);
  const arr = res.success && Array.isArray(res.data) ? res.data : extractArray(res.data || res.raw);
  if (arr.length > 0) setCache('paises', arr);
  return arr as RegionalPais[];
}

export async function getProvincias(): Promise<RegionalProvincia[]> {
  const cached = getCached<RegionalProvincia[]>('provincias');
  if (cached) return cached;

  const res = await regionalGet<RegionalProvincia[]>(REGIONAL_CATALOG_ENDPOINTS.PROVINCIAS);
  const arr = res.success && Array.isArray(res.data) ? res.data : extractArray(res.data || res.raw);
  if (arr.length > 0) setCache('provincias', arr);
  return arr as RegionalProvincia[];
}

export async function getDistritos(): Promise<RegionalDistrito[]> {
  const cached = getCached<RegionalDistrito[]>('distritos');
  if (cached) return cached;

  const res = await regionalGet<RegionalDistrito[]>(REGIONAL_CATALOG_ENDPOINTS.DISTRITOS);
  const arr = res.success && Array.isArray(res.data) ? res.data : extractArray(res.data || res.raw);
  if (arr.length > 0) setCache('distritos', arr);
  return arr as RegionalDistrito[];
}

export async function getCorregimientos(): Promise<RegionalCorregimiento[]> {
  const cached = getCached<RegionalCorregimiento[]>('corregimientos');
  if (cached) return cached;

  const res = await regionalGet<RegionalCorregimiento[]>(REGIONAL_CATALOG_ENDPOINTS.CORREGIMIENTOS);
  const arr = res.success && Array.isArray(res.data) ? res.data : extractArray(res.data || res.raw);
  if (arr.length > 0) setCache('corregimientos', arr);
  return arr as RegionalCorregimiento[];
}

export async function getUrbanizaciones(): Promise<RegionalUrbanizacion[]> {
  const cached = getCached<RegionalUrbanizacion[]>('urbanizaciones');
  if (cached) return cached;

  const res = await regionalGet<RegionalUrbanizacion[]>(REGIONAL_CATALOG_ENDPOINTS.URBANIZACIONES);
  const arr = res.success && Array.isArray(res.data) ? res.data : extractArray(res.data || res.raw);
  if (arr.length > 0) setCache('urbanizaciones', arr);
  return arr as RegionalUrbanizacion[];
}

// ═══ Helpers ═══

function extractArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    // Regional API may wrap arrays in an object
    const obj = data as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[];
    }
    // If it's a single object with expected fields, wrap it
    if ('codmarca' in obj || 'codmodelo' in obj || 'codendoso' in obj) {
      return [data];
    }
  }
  return [];
}
