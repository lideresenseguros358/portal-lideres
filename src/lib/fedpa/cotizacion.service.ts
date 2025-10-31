/**
 * Servicio de Cotización FEDPA
 * Emisor Externo (2021)
 */

import { createFedpaClient } from './http-client';
import { FEDPA_CONFIG, FedpaEnvironment, EMISOR_EXTERNO_ENDPOINTS } from './config';
import type { CotizacionRequest, CotizacionResponse } from './types';
import { normalizeText } from './utils';

// ============================================
// GENERAR COTIZACIÓN
// ============================================

/**
 * Generar cotización detallada (Emisor Externo)
 */
export async function generarCotizacion(
  request: CotizacionRequest,
  env: FedpaEnvironment = 'PROD'
): Promise<CotizacionResponse> {
  console.log('[FEDPA Cotización] Generando cotización...', {
    plan: request.CodPlan,
    marca: request.CodMarca,
    modelo: request.CodModelo,
  });
  
  const config = FEDPA_CONFIG[env];
  const client = createFedpaClient('emisorExterno', env);
  
  // Normalizar datos antes de enviar
  const normalizedRequest = {
    ...request,
    CodMarca: normalizeText(request.CodMarca),
    CodModelo: normalizeText(request.CodModelo),
    Nombre: normalizeText(request.Nombre),
    Apellido: normalizeText(request.Apellido),
    Usuario: config.usuario,
    Clave: config.clave,
  };
  
  const response = await client.post(
    EMISOR_EXTERNO_ENDPOINTS.GET_COTIZACION,
    normalizedRequest
  );
  
  if (!response.success) {
    console.error('[FEDPA Cotización] Error:', response.error);
    return {
      success: false,
      error: typeof response.error === 'string' ? response.error : 'Error generando cotización',
    };
  }
  
  // Parsear respuesta según estructura de FEDPA
  const data = (response.data || {}) as any;
  const coberturas = data.coberturas || [];
  
  // Calcular totales
  const primaBase = data.primaBase || 0;
  const totalImpuesto1 = data.totalImpuesto1 || data.impuesto1 || 0;
  const totalImpuesto2 = data.totalImpuesto2 || data.impuesto2 || 0;
  const primaTotal = data.primaTotal || data.total || 0;
  
  // Verificar sincronización
  const sumaCoberturas = coberturas.reduce((sum: number, cob: any) => {
    return sum + (cob.primaConImpuesto || cob.prima || 0);
  }, 0);
  const sincronizado = Math.abs(primaTotal - sumaCoberturas) < 0.01;
  
  console.log('[FEDPA Cotización] Cotización generada:', {
    idCotizacion: data.idCotizacion || data.id,
    primaTotal,
    coberturas: coberturas.length,
    sincronizado,
  });
  
  return {
    success: true,
    idCotizacion: data.idCotizacion || data.id || `COT-${Date.now()}`,
    coberturas,
    primaBase,
    totalImpuesto1,
    totalImpuesto2,
    primaTotal,
    sincronizado,
  };
}

// ============================================
// HELPERS
// ============================================

/**
 * Calcular desglose de cotización
 */
export function calcularDesglose(coberturas: any[]): {
  primaBase: number;
  impuesto1: number;
  impuesto2: number;
  total: number;
} {
  let primaBase = 0;
  let impuesto1 = 0;
  let impuesto2 = 0;
  
  coberturas.forEach(cob => {
    const prima = cob.prima || 0;
    const imp1 = cob.impuesto1 || prima * 0.05;
    const imp2 = cob.impuesto2 || prima * 0.01;
    
    primaBase += prima;
    impuesto1 += imp1;
    impuesto2 += imp2;
  });
  
  return {
    primaBase: Number(primaBase.toFixed(2)),
    impuesto1: Number(impuesto1.toFixed(2)),
    impuesto2: Number(impuesto2.toFixed(2)),
    total: Number((primaBase + impuesto1 + impuesto2).toFixed(2)),
  };
}
