/**
 * Servicio de Catálogos FEDPA
 * Emisor Externo (2021) - Límites, Usos, Planes CC
 */

import { createFedpaClient } from './http-client';
import { EMISOR_EXTERNO_ENDPOINTS, FEDPA_CONFIG, FedpaEnvironment } from './config';
import type { LimitesResponse, UsosResponse, PlanesAsignadosResponse } from './types';
import type { FedpaLimite, FedpaPlan, FedpaBeneficio, FedpaUso, FedpaCatalogs } from './catalogs.types';

// ============================================
// OBTENER LÍMITES
// ============================================

/**
 * Consultar límites disponibles (Emisor Externo)
 */
export async function obtenerLimites(
  env: FedpaEnvironment = 'PROD'
): Promise<LimitesResponse> {
  console.log('[FEDPA Catálogos] Obteniendo límites...');
  
  const config = FEDPA_CONFIG[env];
  const client = createFedpaClient('emisorExterno', env);
  
  const response = await client.get(EMISOR_EXTERNO_ENDPOINTS.CONSULTAR_LIMITES);
  
  if (!response.success) {
    console.error('[FEDPA Catálogos] Error obteniendo límites:', response.error);
    const errorMsg = typeof response.error === 'string' 
      ? response.error 
      : response.error?.message || 'Error obteniendo límites';
    return {
      success: false,
      error: errorMsg,
    };
  }
  
  // La respuesta puede ser directamente el array o { data: [...] }
  const limites = Array.isArray(response.data) ? response.data : (response.data as any)?.data || [];
  
  console.log('[FEDPA Catálogos] Límites obtenidos:', limites.length);
  
  return {
    success: true,
    data: limites,
  };
}

// ============================================
// OBTENER USOS
// ============================================

/**
 * Consultar usos de vehículos (Emisor Externo)
 */
export async function obtenerUsos(
  env: FedpaEnvironment = 'PROD'
): Promise<UsosResponse> {
  console.log('[FEDPA Catálogos] Obteniendo usos...');
  
  const config = FEDPA_CONFIG[env];
  const client = createFedpaClient('emisorExterno', env);
  
  const response = await client.get(EMISOR_EXTERNO_ENDPOINTS.CONSULTAR_USOS);
  
  if (!response.success) {
    console.error('[FEDPA Catálogos] Error obteniendo usos:', response.error);
    const errorMsg = typeof response.error === 'string' 
      ? response.error 
      : response.error?.message || 'Error obteniendo usos';
    return {
      success: false,
      error: errorMsg,
    };
  }
  
  const usos = Array.isArray(response.data) ? response.data : (response.data as any)?.data || [];
  
  console.log('[FEDPA Catálogos] Usos obtenidos:', usos.length);
  
  return {
    success: true,
    data: usos,
  };
}

// ============================================
// OBTENER PLANES COBERTURA COMPLETA
// ============================================

/**
 * Consultar planes de cobertura completa asignados (Emisor Externo)
 */
export async function obtenerPlanesCC(
  env: FedpaEnvironment = 'PROD'
): Promise<PlanesAsignadosResponse> {
  console.log('[FEDPA Catálogos] Obteniendo planes CC...');
  
  const config = FEDPA_CONFIG[env];
  const client = createFedpaClient('emisorExterno', env);
  
  const response = await client.get(EMISOR_EXTERNO_ENDPOINTS.CONSULTAR_PLANES_CC);
  
  if (!response.success) {
    console.error('[FEDPA Catálogos] Error obteniendo planes CC:', response.error);
    const errorMsg = typeof response.error === 'string' 
      ? response.error 
      : response.error?.message || 'Error obteniendo planes CC';
    return {
      success: false,
      error: errorMsg,
    };
  }
  
  const planes = Array.isArray(response.data) ? response.data : (response.data as any)?.data || [];
  
  console.log('[FEDPA Catálogos] Planes CC obtenidos:', planes.length);
  
  return {
    success: true,
    data: planes,
  };
}

// ============================================
// OBTENER BENEFICIOS EXTERNOS
// ============================================

/**
 * Consultar beneficios de planes (Emisor Externo)
 */
export async function obtenerBeneficiosExternos(
  env: FedpaEnvironment = 'PROD'
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  console.log('[FEDPA Catálogos] Obteniendo beneficios externos...');
  
  const config = FEDPA_CONFIG[env];
  const client = createFedpaClient('emisorExterno', env);
  
  const response = await client.get(EMISOR_EXTERNO_ENDPOINTS.CONSULTAR_BENEFICIOS);
  
  if (!response.success) {
    console.error('[FEDPA Catálogos] Error obteniendo beneficios:', response.error);
    const errorMsg = typeof response.error === 'string' 
      ? response.error 
      : response.error?.message || 'Error obteniendo beneficios';
    return {
      success: false,
      error: errorMsg,
    };
  }
  
  const beneficios = Array.isArray(response.data) ? response.data : (response.data as any)?.data || [];
  
  console.log('[FEDPA Catálogos] Beneficios obtenidos:', beneficios.length);
  
  return {
    success: true,
    data: beneficios,
  };
}

// ============================================
// HELPERS
// ============================================

/**
 * Buscar límite por código
 */
export function buscarLimite(
  limites: any[],
  codCobertura: number,
  idLimite: number
): any | null {
  return limites.find(l => 
    l.CODCOBERTURA === codCobertura && l.IDLIMITE === idLimite
  ) || null;
}

/**
 * Filtrar límites por cobertura
 */
export function filtrarLimitesPorCobertura(
  limites: any[],
  codCobertura: number
): any[] {
  return limites.filter(l => l.CODCOBERTURA === codCobertura);
}

/**
 * Buscar uso por código
 */
export function buscarUso(usos: any[], codigoUso: string): any | null {
  return usos.find(u => u.USO === codigoUso) || null;
}

// ============================================
// OBTENER TODOS LOS CATÁLOGOS
// ============================================

/**
 * Obtener todos los catálogos de FEDPA de una sola vez
 * Útil para cachear en el cliente
 */
export async function obtenerTodosCatalogos(
  env: FedpaEnvironment = 'PROD'
): Promise<{ success: boolean; data?: FedpaCatalogs; error?: string }> {
  console.log('[FEDPA Catálogos] Obteniendo todos los catálogos...');
  
  try {
    const [limitesRes, planesRes, beneficiosRes, usosRes] = await Promise.all([
      obtenerLimites(env),
      obtenerPlanesCC(env),
      obtenerBeneficiosExternos(env),
      obtenerUsos(env)
    ]);
    
    if (!limitesRes.success) {
      return { success: false, error: limitesRes.error };
    }
    if (!planesRes.success) {
      return { success: false, error: planesRes.error };
    }
    if (!beneficiosRes.success) {
      return { success: false, error: beneficiosRes.error };
    }
    if (!usosRes.success) {
      return { success: false, error: usosRes.error };
    }
    
    const catalogs: FedpaCatalogs = {
      limites: (limitesRes.data || []) as FedpaLimite[],
      planes: (planesRes.data || []) as FedpaPlan[],
      beneficios: (beneficiosRes.data || []) as FedpaBeneficio[],
      usos: (usosRes.data || []) as FedpaUso[],
      lastUpdated: new Date().toISOString()
    };
    
    console.log('[FEDPA Catálogos] Todos los catálogos obtenidos exitosamente');
    console.log('  - Límites:', catalogs.limites.length);
    console.log('  - Planes:', catalogs.planes.length);
    console.log('  - Beneficios:', catalogs.beneficios.length);
    console.log('  - Usos:', catalogs.usos.length);
    
    return { success: true, data: catalogs };
  } catch (error) {
    console.error('[FEDPA Catálogos] Error obteniendo catálogos:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error obteniendo catálogos'
    };
  }
}

/**
 * Buscar plan por ID
 */
export function buscarPlan(planes: FedpaPlan[], planId: number): FedpaPlan | null {
  return planes.find(p => p.PLAN === planId) || null;
}

/**
 * Obtener beneficios de un plan específico
 */
export function obtenerBeneficiosPlan(beneficios: FedpaBeneficio[], planId: number): string[] {
  return beneficios
    .filter(b => b.PLAN === planId)
    .map(b => b.BENEFICIOS);
}

/**
 * Filtrar planes por uso
 */
export function filtrarPlanesPorUso(planes: FedpaPlan[], codigoUso: string): FedpaPlan[] {
  return planes.filter(p => p.USO === codigoUso);
}
