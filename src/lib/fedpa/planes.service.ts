/**
 * Servicio de Planes y Beneficios FEDPA
 * Primario: EmisorPlan (2024) con Bearer token
 * Fallback: Emisor Externo (2021) con Usuario/Clave en query params
 */

import { FEDPA_CONFIG, EMISOR_EXTERNO_ENDPOINTS, EMISOR_PLAN_ENDPOINTS, FedpaEnvironment } from './config';
import { createFedpaClient } from './http-client';
import type { PlanesResponse, BeneficiosResponse } from './types';

// ============================================
// FALLBACK: Emisor Externo (2021) - NO requiere token
// Usa Usuario/Clave como query params
// ============================================

async function obtenerPlanesEmisorExterno(env: FedpaEnvironment): Promise<PlanesResponse> {
  console.log('[FEDPA Planes] 🔄 Usando fallback Emisor Externo (2021)...');
  const config = FEDPA_CONFIG[env];
  const client = createFedpaClient('emisorExterno', env);
  
  const response = await client.get(EMISOR_EXTERNO_ENDPOINTS.CONSULTAR_PLANES_CC, {
    Usuario: config.usuario,
    Clave: config.clave,
  });
  
  if (!response.success) {
    console.error('[FEDPA Planes Externo] Error:', response.error);
    return {
      success: false,
      error: typeof response.error === 'string' ? response.error : 'Error obteniendo planes (Emisor Externo)',
    };
  }
  
  // Emisor Externo devuelve: [{ PLAN: 411, NOMBREPLAN: "C.C. PARTICULAR", USO: "10" }, ...]
  // Transformar al formato de EmisorPlan para compatibilidad
  const rawPlanes = Array.isArray(response.data) ? response.data : [];
  const planes = rawPlanes.map((p: any) => ({
    plan: p.PLAN,
    tipoplan: p.NOMBREPLAN?.includes('C.C.') || p.NOMBREPLAN?.includes('COBERTURA COMPLETA') 
      ? 'COBERTURA COMPLETA' : 'DANOS A TERCEROS',
    descripcion: p.NOMBREPLAN,
    nombreplan: p.NOMBREPLAN,
    ramo: '04',
    subramo: '07',
    prima: 0,
    impuesto1: 0,
    impuesto2: 0,
    primaconimpuesto: 0,
    sincronizado: true,
    coberturas: [] as any[],
    usos: [{ uso: p.USO, descripcion: p.NOMBREPLAN }],
  }));
  
  console.log('[FEDPA Planes Externo] ✅ Planes obtenidos:', planes.length);
  
  return {
    success: true,
    data: planes,
  };
}

async function obtenerBeneficiosEmisorExterno(planId: number, env: FedpaEnvironment): Promise<BeneficiosResponse> {
  console.log('[FEDPA Planes] 🔄 Usando fallback Emisor Externo (2021) para beneficios...');
  const config = FEDPA_CONFIG[env];
  const client = createFedpaClient('emisorExterno', env);
  
  const response = await client.get(EMISOR_EXTERNO_ENDPOINTS.CONSULTAR_BENEFICIOS, {
    Usuario: config.usuario,
    Clave: config.clave,
    plan: planId.toString(),
  });
  
  if (!response.success) {
    console.error('[FEDPA Planes Externo] Error beneficios:', response.error);
    return {
      success: false,
      error: typeof response.error === 'string' ? response.error : 'Error obteniendo beneficios (Emisor Externo)',
    };
  }
  
  // Log raw response to understand field names
  const rawData = Array.isArray(response.data) ? response.data : [];
  if (rawData.length > 0) {
    console.log('[FEDPA Planes Externo] Beneficios raw keys:', Object.keys(rawData[0]));
    console.log('[FEDPA Planes Externo] Primer beneficio raw:', JSON.stringify(rawData[0]));
  }
  
  // Filtrar beneficios por plan (API devuelve todos los planes juntos)
  const beneficios = rawData
    .filter((b: any) => !b.PLAN || b.PLAN === planId)
    .map((b: any) => ({
      beneficio: b.BENEFICIOS || b.BENEFICIO || b.DESCRIPCION || b.descripcion || b.beneficio || b.nombre || '',
    }))
    .filter((b: any) => b.beneficio.trim() !== '');
  
  console.log('[FEDPA Planes Externo] ✅ Beneficios obtenidos:', beneficios.length);
  
  return {
    success: true,
    plan: planId,
    data: beneficios,
  };
}

// ============================================
// PRIMARIO: EmisorPlan (2024) - Requiere Bearer token
// Devuelve prima, impuestos, coberturas y usos
// ============================================

async function obtenerPlanesEmisorPlan(env: FedpaEnvironment): Promise<PlanesResponse> {
  console.log('[FEDPA Planes] Intentando EmisorPlan (2024) con Bearer token...');
  const { obtenerClienteAutenticado } = await import('./auth.service');
  const clientResult = await obtenerClienteAutenticado(env);
  if (!clientResult.success || !clientResult.client) {
    console.warn('[FEDPA Planes EmisorPlan] No se pudo autenticar:', clientResult.error);
    return { success: false, error: clientResult.error || 'No se pudo autenticar' };
  }

  const response = await clientResult.client.get(EMISOR_PLAN_ENDPOINTS.PLANES);
  if (!response.success) {
    console.error('[FEDPA Planes EmisorPlan] Error:', response.error);
    return {
      success: false,
      error: typeof response.error === 'string' ? response.error : 'Error obteniendo planes (EmisorPlan)',
    };
  }

  const rawPlanes = Array.isArray(response.data) ? response.data : [];
  console.log('[FEDPA Planes EmisorPlan] ✅ Planes obtenidos:', rawPlanes.length);
  if (rawPlanes.length > 0) {
    console.log('[FEDPA Planes EmisorPlan] Ejemplo plan:', JSON.stringify(rawPlanes[0]).substring(0, 300));
  }

  return { success: true, data: rawPlanes };
}

// ============================================
// OBTENER PLANES
// Primario: EmisorPlan (2024) con token — devuelve prima, impuestos, coberturas
// Fallback: Emisor Externo (2021) sin token — solo plan IDs y nombres
// ============================================

/**
 * Obtener lista de planes disponibles con coberturas y usos
 * Intenta EmisorPlan primero, cae a Emisor Externo si falla
 */
export async function obtenerPlanes(
  env: FedpaEnvironment = 'PROD'
): Promise<PlanesResponse> {
  // Intentar EmisorPlan primero (más datos)
  const emisorPlanResult = await obtenerPlanesEmisorPlan(env);
  if (emisorPlanResult.success && emisorPlanResult.data && emisorPlanResult.data.length > 0) {
    return emisorPlanResult;
  }
  // Fallback a Emisor Externo
  console.log('[FEDPA Planes] Fallback a Emisor Externo...');
  return obtenerPlanesEmisorExterno(env);
}

// ============================================
// OBTENER BENEFICIOS DEL PLAN
// Usa Emisor Externo (2021) directamente - NO requiere token
// ============================================

/**
 * Obtener beneficios de un plan específico
 * Usa Emisor Externo (2021) que autentica con Usuario/Clave en query params
 */
export async function obtenerBeneficios(
  planId: number,
  env: FedpaEnvironment = 'PROD'
): Promise<BeneficiosResponse> {
  console.log('[FEDPA Planes] Obteniendo beneficios del plan:', planId);
  return obtenerBeneficiosEmisorExterno(planId, env);
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
