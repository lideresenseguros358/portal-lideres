/**
 * Servicio de catálogos IS
 * Maneja cache en BD y memoria
 */

import { ISEnvironment, IS_ENDPOINTS, CACHE_TTL } from './config';
import { isGet } from './http-client';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { Database } from '@/lib/database.types';

type Json = Database['public']['Tables']['is_catalogs']['Row']['catalog_data'];

export interface Marca {
  vcodmarca: string;
  vdescripcion: string;
}

export interface Modelo {
  vcodmodelo: string;
  vdescripcion: string;
  vcodmarca: string;
}

export interface TipoDocumento {
  vcodtipodoc: string;
  vdescripcion: string;
}

export interface TipoPlan {
  vCodTipoPlan: string;
  vDescripcion: string;
}

export interface GrupoTarifa {
  vcodgrupotarifa: string;
  vdescripcion: string;
}

export interface Plan {
  vcodplancobertura: string;
  vdescripcion: string;
}

// Cache en memoria
const memoryCache: Map<string, { data: any; timestamp: number }> = new Map();

/**
 * Obtener catálogo con cache
 */
async function getCatalog<T>(
  catalogType: string,
  endpoint: string,
  env: ISEnvironment
): Promise<T[] | null> {
  const cacheKey = `${catalogType}_${env}`;
  
  // 1. Verificar cache en memoria
  const memoryCached = memoryCache.get(cacheKey);
  if (memoryCached && Date.now() - memoryCached.timestamp < CACHE_TTL.CATALOGS) {
    console.log(`[IS Catalogs] Cache hit (memory): ${catalogType}`);
    return memoryCached.data;
  }
  
  // 2. Verificar cache en BD
  const supabase = getSupabaseAdmin();
  const { data: dbCache, error: dbError } = await supabase
    .from('is_catalogs')
    .select('catalog_data, updated_at')
    .eq('catalog_type', catalogType)
    .eq('environment', env)
    .single();
  
  if (dbCache && !dbError) {
    const age = Date.now() - new Date(dbCache.updated_at).getTime();
    if (age < CACHE_TTL.CATALOGS) {
      console.log(`[IS Catalogs] Cache hit (DB): ${catalogType}`);
      const data = dbCache.catalog_data as T[];
      
      // Actualizar memoria
      memoryCache.set(cacheKey, { data, timestamp: Date.now() });
      
      return data;
    }
  }
  
  // 3. Fetch desde IS
  console.log(`[IS Catalogs] Fetching from API: ${catalogType}`);
  const response = await isGet<T[]>(endpoint, env);
  
  if (!response.success || !response.data) {
    console.error(`[IS Catalogs] Error fetching ${catalogType}:`, response.error);
    return null;
  }
  
  const data = response.data;
  
  // 4. Guardar en BD
  await supabase
    .from('is_catalogs')
    .upsert({
      catalog_type: catalogType,
      catalog_data: data as unknown as Json,
      environment: env,
    }, {
      onConflict: 'catalog_type,environment',
    });
  
  // 5. Guardar en memoria
  memoryCache.set(cacheKey, { data, timestamp: Date.now() });
  
  return data;
}

/**
 * Obtener marcas de vehículos
 */
export async function getMarcas(env: ISEnvironment = 'development'): Promise<Marca[]> {
  const data = await getCatalog<Marca>('marcas', IS_ENDPOINTS.MARCAS, env);
  return data || [];
}

/**
 * Obtener modelos de vehículos
 */
export async function getModelos(env: ISEnvironment = 'development'): Promise<Modelo[]> {
  const data = await getCatalog<Modelo>('modelos', IS_ENDPOINTS.MODELOS, env);
  return data || [];
}

/**
 * Obtener modelos filtrados por marca
 */
export async function getModelosByMarca(
  vcodmarca: string,
  env: ISEnvironment = 'development'
): Promise<Modelo[]> {
  const allModelos = await getModelos(env);
  return allModelos.filter(m => m.vcodmarca === vcodmarca);
}

/**
 * Obtener tipos de documento
 */
export async function getTipoDocumentos(env: ISEnvironment = 'development'): Promise<TipoDocumento[]> {
  const data = await getCatalog<TipoDocumento>('tipo_documentos', IS_ENDPOINTS.TIPO_DOCUMENTOS, env);
  return data || [];
}

/**
 * Obtener tipos de planes
 */
export async function getTipoPlanes(env: ISEnvironment = 'development'): Promise<TipoPlan[]> {
  const data = await getCatalog<TipoPlan>('tipo_planes', IS_ENDPOINTS.TIPO_PLANES, env);
  return data || [];
}

/**
 * Obtener grupos de tarifa
 */
export async function getGruposTarifa(
  vCodTipoPlan: string,
  env: ISEnvironment = 'development'
): Promise<GrupoTarifa[]> {
  const endpoint = `${IS_ENDPOINTS.GRUPO_TARIFA}/${vCodTipoPlan}`;
  const cacheKey = `grupos_tarifa_${vCodTipoPlan}_${env}`;
  
  // Verificar memoria
  const memoryCached = memoryCache.get(cacheKey);
  if (memoryCached && Date.now() - memoryCached.timestamp < CACHE_TTL.CATALOGS) {
    return memoryCached.data;
  }
  
  // Fetch
  const response = await isGet<GrupoTarifa[]>(endpoint, env);
  
  if (!response.success || !response.data) {
    console.error('[IS Catalogs] Error fetching grupos tarifa:', response.error);
    return [];
  }
  
  // Cache en memoria
  memoryCache.set(cacheKey, { data: response.data, timestamp: Date.now() });
  
  return response.data;
}

/**
 * Obtener planes de cobertura
 */
export async function getPlanes(env: ISEnvironment = 'development'): Promise<Plan[]> {
  const data = await getCatalog<Plan>('planes', IS_ENDPOINTS.PLANES, env);
  return data || [];
}

/**
 * Invalidar cache (útil para forzar refresh)
 */
export async function invalidateCache(catalogType?: string, env?: ISEnvironment): Promise<void> {
  if (!catalogType) {
    // Invalidar todo
    memoryCache.clear();
    console.log('[IS Catalogs] Cache invalidado completamente');
  } else {
    const key = env ? `${catalogType}_${env}` : catalogType;
    memoryCache.delete(key);
    console.log(`[IS Catalogs] Cache invalidado: ${key}`);
  }
}

/**
 * Pre-cargar todos los catálogos (útil al iniciar app)
 */
export async function preloadCatalogs(env: ISEnvironment = 'development'): Promise<void> {
  console.log('[IS Catalogs] Pre-cargando catálogos...');
  
  await Promise.allSettled([
    getMarcas(env),
    getModelos(env),
    getTipoDocumentos(env),
    getTipoPlanes(env),
    getPlanes(env),
  ]);
  
  console.log('[IS Catalogs] Pre-carga completada');
}
