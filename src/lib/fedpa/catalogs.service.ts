/**
 * Servicio de Catálogos FEDPA
 * Emisor Externo (2021) - Límites, Usos, Planes CC
 */

import { createFedpaClient } from './http-client';
import { EMISOR_EXTERNO_ENDPOINTS, FEDPA_CONFIG, FedpaEnvironment } from './config';
import type { LimitesResponse, UsosResponse, PlanesAsignadosResponse } from './types';

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
