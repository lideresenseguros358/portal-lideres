/**
 * Servicio de catálogos IS
 * Maneja cache en BD y memoria
 */

import { ISEnvironment, IS_ENDPOINTS, CACHE_TTL } from './config';
import { isGet } from './http-client';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { Database } from '@/lib/database.types';
import type { ISMarca, ISModelo, ISTipoPlan, ISGrupoTarifa, ISPlan, ISTipoDocumento, ISCatalogs } from './catalogs.types';

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
 * Obtener marcas de vehículos desde BD LOCAL (instantáneo)
 * NO llama a API externa - solo lee de catálogo local
 */
export async function getMarcas(env: ISEnvironment = 'development'): Promise<Marca[]> {
  const cacheKey = `marcas_${env}`;
  
  // 1. Cache en memoria (instantáneo < 5ms)
  const memoryCached = memoryCache.get(cacheKey);
  if (memoryCached) {
    console.log('[IS Catalogs] ⚡ Memoria: marcas');
    return memoryCached.data;
  }
  
  // 2. Leer de BD local (rápido ~50ms) - NUNCA llama a API
  const supabase = getSupabaseAdmin();
  const { data: dbCache, error } = await supabase
    .from('is_catalogs')
    .select('catalog_data')
    .eq('catalog_type', 'marcas')
    .eq('environment', env)
    .single();
  
  if (dbCache && !error) {
    const marcas = dbCache.catalog_data as unknown as Marca[];
    memoryCache.set(cacheKey, { data: marcas, timestamp: Date.now() });
    console.log(`[IS Catalogs] ⚡ BD local: ${marcas.length} marcas`);
    return marcas;
  }
  
  // 3. Si no hay datos locales, retornar vacío
  console.error('[IS Catalogs] ❌ No hay datos locales de marcas. Ejecutar script de carga inicial.');
  return [];
}

/**
 * Obtener modelos de vehículos desde BD LOCAL (instantáneo)
 * NO llama a API externa - solo lee de catálogo local
 */
export async function getModelos(env: ISEnvironment = 'development'): Promise<Modelo[]> {
  const cacheKey = `modelos_${env}`;
  
  // 1. Cache en memoria (instantáneo < 5ms)
  const memoryCached = memoryCache.get(cacheKey);
  if (memoryCached) {
    console.log('[IS Catalogs] ⚡ Memoria: modelos');
    return memoryCached.data;
  }
  
  // 2. Leer de BD local (rápido ~100ms) - NUNCA llama a API
  const supabase = getSupabaseAdmin();
  const { data: dbCache, error } = await supabase
    .from('is_catalogs')
    .select('catalog_data')
    .eq('catalog_type', 'modelos')
    .eq('environment', env)
    .single();
  
  if (dbCache && !error) {
    const modelos = dbCache.catalog_data as unknown as Modelo[];
    memoryCache.set(cacheKey, { data: modelos, timestamp: Date.now() });
    console.log(`[IS Catalogs] ⚡ BD local: ${modelos.length} modelos`);
    return modelos;
  }
  
  // 3. Si no hay datos locales, retornar vacío
  console.error('[IS Catalogs] ❌ No hay datos locales de modelos. Ejecutar script de carga inicial.');
  return [];
}

/**
 * Obtener modelos filtrados por marca (OPTIMIZADO)
 * Usa cache si está disponible, sino carga todos una vez
 */
export async function getModelosByMarca(
  vcodmarca: string,
  env: ISEnvironment = 'development'
): Promise<Modelo[]> {
  const cacheKey = `modelos_${env}`;
  
  // 1. Intentar desde cache en memoria primero (instantáneo)
  const memoryCached = memoryCache.get(cacheKey);
  if (memoryCached && Date.now() - memoryCached.timestamp < CACHE_TTL.CATALOGS) {
    const filtered = memoryCached.data.filter((m: Modelo) => m.vcodmarca === String(vcodmarca));
    console.log(`[IS Catalogs] ⚡ Cache hit (memoria): ${filtered.length} modelos para marca ${vcodmarca}`);
    return filtered;
  }
  
  // 2. Intentar desde BD (más rápido que API)
  const supabase = getSupabaseAdmin();
  const { data: dbCache } = await supabase
    .from('is_catalogs')
    .select('catalog_data, updated_at')
    .eq('catalog_type', 'modelos')
    .eq('environment', env)
    .single();
  
  if (dbCache) {
    const age = Date.now() - new Date(dbCache.updated_at).getTime();
    if (age < CACHE_TTL.CATALOGS) {
      const allModelos = dbCache.catalog_data as unknown as Modelo[];
      const filtered = allModelos.filter(m => m.vcodmarca === String(vcodmarca));
      
      // Guardar en memoria para próximas llamadas
      memoryCache.set(cacheKey, { data: allModelos, timestamp: Date.now() });
      
      console.log(`[IS Catalogs] ⚡ Cache hit (BD): ${filtered.length} modelos para marca ${vcodmarca}`);
      return filtered;
    }
  }
  
  // 3. Si no hay cache válido, cargar todos (solo primera vez o cache expirado)
  console.log(`[IS Catalogs] 📥 Cache miss - cargando todos los modelos (esto solo pasa una vez al día)...`);
  const allModelos = await getModelos(env);
  
  // Filtrar por marca
  const filtered = allModelos.filter(m => m.vcodmarca === String(vcodmarca));
  console.log(`[IS Catalogs] ✅ Modelos filtrados: ${filtered.length} de ${allModelos.length} para marca ${vcodmarca}`);
  
  return filtered;
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
 * Obtener planes de cobertura para un tipo de plan
 * Swagger: GET /api/cotizaemisorauto/getplanes/{vCodTipoPlan}
 * ⚠️ El path param es OBLIGATORIO — sin él retorna 404
 */
export async function getPlanes(
  vCodTipoPlan: string = '1',
  env: ISEnvironment = 'development'
): Promise<Plan[]> {
  const endpoint = `${IS_ENDPOINTS.PLANES}/${vCodTipoPlan}`;
  const cacheKey = `planes_${vCodTipoPlan}_${env}`;
  
  // Verificar memoria
  const memoryCached = memoryCache.get(cacheKey);
  if (memoryCached && Date.now() - memoryCached.timestamp < CACHE_TTL.CATALOGS) {
    console.log(`[IS Catalogs] ⚡ Cache hit (memoria): planes tipo ${vCodTipoPlan}`);
    return memoryCached.data;
  }
  
  // Fetch
  const response = await isGet<Plan[]>(endpoint, env);
  
  if (!response.success || !response.data) {
    console.error(`[IS Catalogs] Error fetching planes tipo ${vCodTipoPlan}:`, response.error);
    return [];
  }
  
  // Cache en memoria
  memoryCache.set(cacheKey, { data: response.data, timestamp: Date.now() });
  
  return response.data;
}

/**
 * Obtener planes adicionales
 * Swagger: GET /api/cotizaemisorauto/getplanesadicionales/{vCodTipoPlan?}
 */
export async function getPlanesAdicionales(
  vCodTipoPlan?: string,
  env: ISEnvironment = 'development'
): Promise<any[]> {
  const endpoint = vCodTipoPlan 
    ? `${IS_ENDPOINTS.PLANES_ADICIONALES}/${vCodTipoPlan}`
    : IS_ENDPOINTS.PLANES_ADICIONALES;
  const cacheKey = `planes_adicionales_${vCodTipoPlan || 'all'}_${env}`;
  
  const memoryCached = memoryCache.get(cacheKey);
  if (memoryCached && Date.now() - memoryCached.timestamp < CACHE_TTL.CATALOGS) {
    console.log(`[IS Catalogs] ⚡ Cache hit (memoria): planes adicionales`);
    return memoryCached.data;
  }
  
  const response = await isGet<any[]>(endpoint, env);
  
  if (!response.success || !response.data) {
    console.error('[IS Catalogs] Error fetching planes adicionales:', response.error);
    return [];
  }
  
  memoryCache.set(cacheKey, { data: response.data, timestamp: Date.now() });
  return response.data;
}

/**
 * Obtener precios de planes de terceros
 * Swagger: GET /api/cotizaemisorauto/getpreciosplanesterceros/{vCodPlan}
 */
export async function getPreciosPlanTerceros(
  vCodPlan: string,
  env: ISEnvironment = 'development'
): Promise<any[]> {
  const endpoint = `${IS_ENDPOINTS.PRECIOS_PLANES_TERCEROS}/${vCodPlan}`;
  const cacheKey = `precios_plan_${vCodPlan}_${env}`;
  
  const memoryCached = memoryCache.get(cacheKey);
  if (memoryCached && Date.now() - memoryCached.timestamp < CACHE_TTL.CATALOGS) {
    return memoryCached.data;
  }
  
  const response = await isGet<any[]>(endpoint, env);
  
  if (!response.success || !response.data) {
    console.error('[IS Catalogs] Error fetching precios plan terceros:', response.error);
    return [];
  }
  
  memoryCache.set(cacheKey, { data: response.data, timestamp: Date.now() });
  return response.data;
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
    getPlanes('1', env), // CC Particular
    getPlanes('3', env), // DAT Particular
  ]);
  
  console.log('[IS Catalogs] Pre-carga completada');
}

/**
 * Obtener TODOS los catálogos IS de una vez
 * Retorna estructura compatible con tipos oficiales de IS
 */
export async function obtenerTodosCatalogos(
  env: ISEnvironment = 'development'
): Promise<{ success: boolean; data?: ISCatalogs; error?: string }> {
  console.log('[IS Catálogos] Obteniendo todos los catálogos...');
  
  try {
    // Fetch paralelo de todos los catálogos
    const [marcasRes, modelosRes, tipoPlanesRes, tipoDocsRes] = await Promise.allSettled([
      isGet<{ Table: ISMarca[] }>(IS_ENDPOINTS.MARCAS, env),
      isGet<{ Table: ISModelo[] }>(IS_ENDPOINTS.MODELOS + '/1/10000', env),
      isGet<{ Table: ISTipoPlan[] }>(IS_ENDPOINTS.TIPO_PLANES, env),
      isGet<{ Table: ISTipoDocumento[] }>(IS_ENDPOINTS.TIPO_DOCUMENTOS, env),
    ]);
    
    // Extraer datos de las respuestas
    const marcas = marcasRes.status === 'fulfilled' && marcasRes.value.success && marcasRes.value.data?.Table ? marcasRes.value.data.Table : [];
    const modelos = modelosRes.status === 'fulfilled' && modelosRes.value.success && modelosRes.value.data?.Table ? modelosRes.value.data.Table : [];
    const tipoPlanes = tipoPlanesRes.status === 'fulfilled' && tipoPlanesRes.value.success && tipoPlanesRes.value.data?.Table ? tipoPlanesRes.value.data.Table : [];
    const tipoDocumentos = tipoDocsRes.status === 'fulfilled' && tipoDocsRes.value.success && tipoDocsRes.value.data?.Table ? tipoDocsRes.value.data.Table : [];
    
    // Obtener planes para cada tipo de plan
    const planesPromises = tipoPlanes.map(tp => 
      isGet<{ Table: ISPlan[] }>(`${IS_ENDPOINTS.PLANES}/${tp.DATO}`, env)
    );
    const planesResults = await Promise.allSettled(planesPromises);
    const planes: ISPlan[] = [];
    planesResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value.success && result.value.data?.Table) {
        planes.push(...result.value.data.Table);
      }
    });
    
    // Obtener grupos de tarifa para cada tipo de plan
    const gruposTarifaPromises = tipoPlanes.map(tp =>
      isGet<{ Table: ISGrupoTarifa[] }>(`${IS_ENDPOINTS.GRUPO_TARIFA}/${tp.DATO}`, env)
    );
    const gruposTarifaResults = await Promise.allSettled(gruposTarifaPromises);
    const gruposTarifa: ISGrupoTarifa[] = [];
    gruposTarifaResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value.success && result.value.data?.Table) {
        gruposTarifa.push(...result.value.data.Table);
      }
    });
    
    const catalogs: ISCatalogs = {
      marcas,
      modelos,
      tipoPlanes,
      gruposTarifa,
      planes,
      tipoDocumentos,
      lastUpdated: new Date().toISOString()
    };
    
    console.log('[IS Catálogos] Catálogos obtenidos exitosamente:');
    console.log('  - Marcas:', catalogs.marcas.length);
    console.log('  - Modelos:', catalogs.modelos.length);
    console.log('  - Tipo Planes:', catalogs.tipoPlanes.length);
    console.log('  - Grupos Tarifa:', catalogs.gruposTarifa.length);
    console.log('  - Planes:', catalogs.planes.length);
    console.log('  - Tipo Documentos:', catalogs.tipoDocumentos.length);
    
    return { success: true, data: catalogs };
  } catch (error) {
    console.error('[IS Catálogos] Error obteniendo catálogos:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error obteniendo catálogos'
    };
  }
}

/**
 * Buscar marca por código
 */
export function buscarMarca(marcas: ISMarca[], codigo: number): ISMarca | null {
  return marcas.find(m => m.COD_MARCA === codigo) || null;
}

/**
 * Buscar modelo por código
 */
export function buscarModelo(modelos: ISModelo[], codigo: number): ISModelo | null {
  return modelos.find(m => m.COD_MODELO === codigo) || null;
}

/**
 * Filtrar modelos por marca
 */
export function filtrarModelosPorMarca(modelos: ISModelo[], codigoMarca: number): ISModelo[] {
  return modelos.filter(m => m.COD_MARCA === codigoMarca);
}
