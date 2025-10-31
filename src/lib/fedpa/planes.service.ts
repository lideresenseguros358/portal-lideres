/**
 * Servicio de Planes y Beneficios FEDPA
 * EmisorPlan (2024)
 */

import { obtenerClienteAutenticado } from './auth.service';
import { EMISOR_PLAN_ENDPOINTS, FedpaEnvironment } from './config';
import type { PlanesResponse, BeneficiosResponse } from './types';

// ============================================
// OBTENER PLANES
// ============================================

/**
 * Obtener lista de planes disponibles con coberturas y usos
 */
export async function obtenerPlanes(
  env: FedpaEnvironment = 'PROD'
): Promise<PlanesResponse> {
  console.log('[FEDPA Planes] Obteniendo planes...');
  
  const clientResult = await obtenerClienteAutenticado(env);
  if (!clientResult.success || !clientResult.client) {
    return {
      success: false,
      error: clientResult.error || 'No se pudo autenticar',
    };
  }
  
  const response = await clientResult.client.get<any>(EMISOR_PLAN_ENDPOINTS.PLANES);
  
  if (!response.success) {
    console.error('[FEDPA Planes] Error:', response.error);
    return {
      success: false,
      error: response.error || 'Error obteniendo planes',
    };
  }
  
  console.log('[FEDPA Planes] Planes obtenidos:', response.data?.length || 0);
  
  return {
    success: true,
    data: response.data || [],
  };
}

// ============================================
// OBTENER BENEFICIOS DEL PLAN
// ============================================

/**
 * Obtener beneficios de un plan específico
 */
export async function obtenerBeneficios(
  planId: number,
  env: FedpaEnvironment = 'PROD'
): Promise<BeneficiosResponse> {
  console.log('[FEDPA Planes] Obteniendo beneficios del plan:', planId);
  
  const clientResult = await obtenerClienteAutenticado(env);
  if (!clientResult.success || !clientResult.client) {
    return {
      success: false,
      error: clientResult.error || 'No se pudo autenticar',
    };
  }
  
  const response = await clientResult.client.get<any>(
    EMISOR_PLAN_ENDPOINTS.BENEFICIOS,
    { plan: planId }
  );
  
  if (!response.success) {
    console.error('[FEDPA Planes] Error:', response.error);
    return {
      success: false,
      error: response.error || 'Error obteniendo beneficios',
    };
  }
  
  console.log('[FEDPA Planes] Beneficios obtenidos:', response.data?.data?.length || 0);
  
  return {
    success: true,
    plan: response.data?.plan || planId,
    data: response.data?.data || [],
  };
}

// ============================================
// FILTRAR PLANES
// ============================================

/**
 * Filtrar planes por tipo
 */
export function filtrarPlanesPorTipo(
  planes: any[],
  tipo: 'DAÑOS A TERCEROS' | 'COBERTURA COMPLETA'
): any[] {
  return planes.filter(plan => 
    plan.tipoplan?.toUpperCase().includes(tipo.toUpperCase())
  );
}

/**
 * Buscar plan por ID
 */
export function buscarPlanPorId(planes: any[], planId: number): any | null {
  return planes.find(plan => plan.plan === planId) || null;
}
