/**
 * Emission Service for La Regional de Seguros
 * Handles RC (DT) and CC policy emission, plan de pago, and PDF printing
 */

import https from 'node:https';
import http from 'node:http';
import { URL as NodeURL } from 'node:url';
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
  console.log('[REGIONAL CC Emission] Full body:', JSON.stringify(body));

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
// NOTE: This endpoint returns RAW PDF binary (not JSON).
// We use node:https directly (NOT global fetch) because:
//   1. Regional PROD server uses a self-signed TLS cert — undici (Node.js built-in
//      fetch) does NOT respect NODE_TLS_REJECT_UNAUTHORIZED at runtime.
//   2. We need raw Buffer output (not a UTF-8 string) for binary PDF data.

function nodeHttpsBinaryRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string,
  timeoutMs: number
): Promise<{ status: number; buf: Buffer }> {
  return new Promise((resolve, reject) => {
    const parsed = new NodeURL(url);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;

    const bodyBuf = Buffer.from(body, 'utf8');
    const options: https.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers: { ...headers, 'Content-Length': bodyBuf.length.toString() },
      rejectUnauthorized: false,   // Regional PROD uses self-signed cert
    };

    const req = lib.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, buf: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Regional imprimirPoliza timeout after ${timeoutMs}ms`));
    });
    req.on('error', reject);
    req.write(bodyBuf);
    req.end();
  });
}

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

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: auth,
    codInter: creds.codInter,
    codProv: creds.codInter,   // CC endpoints require codProv (same value as codInter)
    token: creds.tokenCC,
  };

  try {
    console.log('[REGIONAL Imprimir] POST', url);
    const { status, buf } = await nodeHttpsBinaryRequest(
      url,
      'POST',
      headers,
      JSON.stringify({ poliza: cleanPoliza }),
      30000
    );

    console.log('[REGIONAL Imprimir] Status:', status, '— bytes:', buf.length);

    if (status < 200 || status >= 300) {
      const errText = buf.toString('utf8').slice(0, 300);
      console.error('[REGIONAL Imprimir] HTTP error:', status, errText);
      return { success: false, message: `HTTP ${status}: ${errText.slice(0, 200)}` };
    }

    // Check if response is a PDF (starts with %PDF)
    if (buf.length > 4 && buf.slice(0, 5).toString('ascii') === '%PDF-') {
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
    console.error('[REGIONAL Imprimir] Request error:', errMsg);
    return { success: false, message: errMsg };
  }
}
