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
    body,
    { useTokenCC: true }
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
    body,
    { useTokenCC: true }
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
// NOTE: This endpoint returns RAW PDF binary (not JSON), so we bypass
// the generic regionalPost helper and call the API directly.

export async function imprimirPoliza(
  poliza: string
): Promise<RegionalImprimirResponse> {
  // Strip trailing "-0" suffix that CC emission sometimes appends —
  // the imprimirPoliza endpoint only recognises the base policy number.
  const cleanPoliza = poliza.replace(/-0$/, '');
  console.log('[REGIONAL Imprimir] Printing policy:', cleanPoliza, poliza !== cleanPoliza ? `(stripped from ${poliza})` : '');

  const { getRegionalBaseUrl, getRegionalCredentials, getRegionalEnv } = await import('./config');
  const env = getRegionalEnv();
  const creds = getRegionalCredentials(env);
  const baseUrl = getRegionalBaseUrl(env);
  const url = `${baseUrl}${REGIONAL_CC_ENDPOINTS.IMPRIMIR}`;
  const auth = `Basic ${Buffer.from(`${creds.username}:${creds.password}`).toString('base64')}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    const prevTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: auth,
        codInter: creds.codInter,
        token: creds.tokenCC,
      },
      body: JSON.stringify({ poliza: cleanPoliza }),
      signal: controller.signal,
    }).finally(() => {
      if (prevTls === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      else process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevTls;
    });

    clearTimeout(timer);
    console.log('[REGIONAL Imprimir] Status:', res.status);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[REGIONAL Imprimir] HTTP error:', res.status, errText.slice(0, 300));
      return { success: false, message: `HTTP ${res.status}: ${errText.slice(0, 200)}` };
    }

    const buf = Buffer.from(await res.arrayBuffer());

    // Check if response is a PDF (starts with %PDF)
    if (buf.length > 4 && buf.toString('utf8', 0, 5) === '%PDF-') {
      console.log('[REGIONAL Imprimir] ✅ PDF received:', buf.length, 'bytes');
      return {
        success: true,
        pdf: buf.toString('base64'),
      };
    }

    // Not a PDF — try to parse as JSON error message
    const text = buf.toString('utf8');
    try {
      const json = JSON.parse(text) as Record<string, unknown>;
      const msg = (json.mensaje || json.message || 'Respuesta no contiene PDF') as string;
      console.warn('[REGIONAL Imprimir] JSON response (no PDF):', msg);
      return { success: false, message: msg };
    } catch {
      console.warn('[REGIONAL Imprimir] Non-PDF, non-JSON response:', text.slice(0, 200));
      return { success: false, message: text.slice(0, 200) || 'Respuesta vacía del servidor' };
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[REGIONAL Imprimir] Fetch error:', errMsg);
    return { success: false, message: errMsg };
  }
}
