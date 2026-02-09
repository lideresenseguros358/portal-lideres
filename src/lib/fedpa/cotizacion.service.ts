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
    console.error('[FEDPA Cotización] Response data:', JSON.stringify(response.data, null, 2));
    console.error('[FEDPA Cotización] Request enviado:', JSON.stringify(normalizedRequest, null, 2));
    return {
      success: false,
      error: typeof response.error === 'string' ? response.error : 'Error generando cotización',
    };
  }
  
  // Parsear respuesta según estructura de FEDPA
  // response.data ES el array de coberturas directamente
  const coberturas = Array.isArray(response.data) ? response.data : [];
  
  // Extraer datos de la primera cobertura (todas tienen los mismos totales)
  const primeraCob = coberturas[0] || {};
  console.log('[FEDPA Cotización] Primera cobertura keys:', Object.keys(primeraCob));
  console.log('[FEDPA Cotización] COTIZACION field:', primeraCob.COTIZACION, '| IdCotizacion:', primeraCob.IdCotizacion, '| IDCOTIZACION:', primeraCob.IDCOTIZACION);
  const idCotizacion = (primeraCob.COTIZACION || primeraCob.IdCotizacion || primeraCob.IDCOTIZACION || primeraCob.cotizacion)?.toString();
  const primaTotal = primeraCob.TOTAL_PRIMA_IMPUESTO || primeraCob.TOTAL_PRIMA || 0;
  
  // Calcular prima base e impuestos sumando todas las coberturas
  let primaBase = 0;
  let totalImpuesto1 = 0;
  let totalImpuesto2 = 0;
  
  coberturas.forEach((cob: any) => {
    primaBase += cob.PRIMA || 0;
    totalImpuesto1 += (cob.PRIMA_IMPUESTO || 0) - (cob.PRIMA || 0);
  });
  
  // Calcular impuesto2 (diferencia entre total prima con impuesto y prima base + impuesto1)
  totalImpuesto2 = primaTotal - primaBase - totalImpuesto1;
  
  return {
    success: true,
    idCotizacion: idCotizacion || `COT-${Date.now()}`,
    coberturas,
    primaBase,
    totalImpuesto1,
    totalImpuesto2,
    primaTotal,
    sincronizado: true, // FEDPA siempre sincronizado
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
