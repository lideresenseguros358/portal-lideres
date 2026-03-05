/**
 * Emission Service for La Regional de Seguros
 * Handles RC (DT) and CC policy emission, plan de pago, and PDF printing
 */

import { regionalPost, regionalPut } from './http-client';
import { REGIONAL_RC_ENDPOINTS, REGIONAL_CC_ENDPOINTS } from './config';
import type {
  RegionalRCEmissionBody,
  RegionalRCEmissionResponse,
  RegionalCCEmissionBody,
  RegionalCCEmissionResponse,
  RegionalPlanPagoBody,
  RegionalPlanPagoResponse,
  RegionalImprimirBody,
  RegionalImprimirResponse,
} from './types';

// ═══ RC (DT) Emission ═══

export async function emitirPolizaRC(
  body: RegionalRCEmissionBody
): Promise<RegionalRCEmissionResponse> {
  console.log('[REGIONAL RC Emission] Emitting RC policy, plan:', body.plan);

  const res = await regionalPost<RegionalRCEmissionResponse>(
    REGIONAL_RC_ENDPOINTS.EMITIR,
    body
  );

  if (!res.success) {
    return {
      success: false,
      message: res.error || 'Error emitiendo póliza RC',
    };
  }

  const data = (res.data || res.raw) as Record<string, unknown>;
  console.log('[REGIONAL RC Emission] Response:', JSON.stringify(data).slice(0, 500));

  // Normalize response
  if (data.success === false) {
    return {
      success: false,
      message: (data.message || data.mensaje || 'Emisión fallida') as string,
    };
  }

  const poliza = (data.poliza || data.numpoliza || data.nroPoliza) as string | undefined;
  const numcot = (data.numcot || data.numCot) as number | undefined;

  return {
    success: true,
    poliza,
    numcot,
    ...data,
  };
}

// ═══ CC (Cobertura Completa) Emission ═══

export async function emitirPolizaCC(
  body: RegionalCCEmissionBody
): Promise<RegionalCCEmissionResponse> {
  console.log('[REGIONAL CC Emission] Emitting CC policy, numcot:', body.numcot);

  const res = await regionalPost<RegionalCCEmissionResponse>(
    REGIONAL_CC_ENDPOINTS.EMITIR,
    body
  );

  if (!res.success) {
    return {
      success: false,
      message: res.error || 'Error emitiendo póliza CC',
    };
  }

  const data = (res.data || res.raw) as Record<string, unknown>;
  console.log('[REGIONAL CC Emission] Response:', JSON.stringify(data).slice(0, 500));

  if (data.success === false) {
    return {
      success: false,
      message: (data.message || data.mensaje || 'Emisión fallida') as string,
    };
  }

  const poliza = (data.poliza || data.numpoliza || data.nroPoliza) as string | undefined;

  return {
    success: true,
    poliza,
    numcot: body.numcot,
    ...data,
  };
}

// ═══ Plan de Pago ═══

export async function actualizarPlanPago(
  body: RegionalPlanPagoBody
): Promise<RegionalPlanPagoResponse> {
  console.log('[REGIONAL Plan Pago] Updating plan pago, numcot:', body.numcot, 'cuotas:', body.cuotas);

  const res = await regionalPut<RegionalPlanPagoResponse>(
    REGIONAL_CC_ENDPOINTS.PLAN_PAGO,
    body
  );

  if (!res.success) {
    return {
      success: false,
      message: res.error || 'Error actualizando plan de pago',
    };
  }

  const data = (res.data || res.raw) as Record<string, unknown>;
  console.log('[REGIONAL Plan Pago] Response:', JSON.stringify(data).slice(0, 500));

  return {
    success: true,
    ...data,
  };
}

// ═══ Imprimir Póliza ═══

export async function imprimirPoliza(
  poliza: string
): Promise<RegionalImprimirResponse> {
  console.log('[REGIONAL Imprimir] Printing policy:', poliza);

  const body: RegionalImprimirBody = { poliza };

  const res = await regionalPost<RegionalImprimirResponse>(
    REGIONAL_CC_ENDPOINTS.IMPRIMIR,
    body
  );

  if (!res.success) {
    return {
      success: false,
      message: res.error || 'Error imprimiendo póliza',
    };
  }

  const data = (res.data || res.raw) as Record<string, unknown>;
  console.log('[REGIONAL Imprimir] Response received, has data:', !!data);

  return {
    success: true,
    pdf: (data.pdf || data.documento || data.base64) as string | undefined,
    ...data,
  };
}
