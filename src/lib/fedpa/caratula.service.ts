/**
 * Servicio de Carátula FEDPA — Descarga PDF de póliza emitida
 * 
 * Usa la API Broker Integration (2026) con Basic Auth.
 * Documentación: /public/API FEDPA/CARATULA/
 * 
 * Endpoint:
 *   GET https://api.segfedpa.com:8085/BrokerIntegration/Polizas/caratula
 *       ?ramo=04&subramo=07&poliza=772&secuencia=0
 * 
 * Auth: Authorization: Basic base64(usuario:clave)
 * Response 200: application/pdf (binary)
 * Response 400: { success, msg }
 */

import { FEDPA_CONFIG, FedpaEnvironment, BROKER_INTEGRATION_ENDPOINTS } from './config';

export interface CaratulaRequest {
  ramo: string;
  subramo: string;
  poliza: string;
  secuencia: string;
}

export interface CaratulaResponse {
  success: boolean;
  pdfBuffer?: Uint8Array;
  error?: string;
  httpStatus?: number;
}

/**
 * Parse a FEDPA policy number like "04-07-772-0" into its components.
 * Returns { ramo, subramo, poliza, secuencia } or null if format is invalid.
 */
export function parsePolizaNumber(nroPoliza: string): CaratulaRequest | null {
  if (!nroPoliza) return null;
  const parts = nroPoliza.split('-');
  if (parts.length < 3) return null;
  const ramo = parts[0] ?? '';
  const subramo = parts[1] ?? '';
  const poliza = parts[2] ?? '';
  const secuencia = parts[3] ?? '0';
  if (!ramo || !subramo || !poliza) return null;
  return { ramo, subramo, poliza, secuencia };
}

/**
 * Obtener carátula (PDF) de una póliza emitida via Broker Integration API
 */
export async function obtenerCaratula(
  request: CaratulaRequest,
  env: FedpaEnvironment = 'PROD'
): Promise<CaratulaResponse> {
  const config = FEDPA_CONFIG[env];

  if (!config.usuario || !config.clave) {
    return { success: false, error: 'Credenciales FEDPA no configuradas' };
  }

  // Build URL with query params
  const baseUrl = config.brokerIntegrationUrl;
  const endpoint = BROKER_INTEGRATION_ENDPOINTS.CARATULA;
  const queryParams = new URLSearchParams({
    ramo: request.ramo,
    subramo: request.subramo,
    poliza: request.poliza,
    secuencia: request.secuencia,
  });
  const url = `${baseUrl}${endpoint}?${queryParams.toString()}`;

  // Basic Auth header
  const basicAuth = Buffer.from(`${config.usuario}:${config.clave}`).toString('base64');

  console.log('[FEDPA Carátula] Solicitando carátula via Broker Integration...', {
    env,
    url,
    ramo: request.ramo,
    subramo: request.subramo,
    poliza: request.poliza,
    secuencia: request.secuencia,
  });

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': '*/*',
        'Authorization': `Basic ${basicAuth}`,
      },
    });

    const contentType = response.headers.get('content-type') || '';

    console.log('[FEDPA Carátula] Response:', {
      status: response.status,
      contentType,
      contentLength: response.headers.get('content-length'),
    });

    // Success: PDF binary
    if (response.ok && (contentType.includes('application/pdf') || contentType.includes('octet-stream'))) {
      const arrayBuf = await response.arrayBuffer();
      const buffer = new Uint8Array(arrayBuf);
      console.log('[FEDPA Carátula] PDF recibido:', buffer.byteLength, 'bytes');
      return {
        success: true,
        pdfBuffer: buffer,
        httpStatus: response.status,
      };
    }

    // Error or unexpected response
    let errorMsg = `HTTP ${response.status}`;
    try {
      const data = await response.json();
      errorMsg = data?.mensaje || data?.msg || data?.message || data?.error || errorMsg;
      console.error('[FEDPA Carátula] Error JSON:', data);
    } catch {
      const text = await response.text();
      errorMsg = text.substring(0, 500) || errorMsg;
      console.error('[FEDPA Carátula] Error text:', text.substring(0, 500));
    }

    return {
      success: false,
      error: errorMsg,
      httpStatus: response.status,
    };
  } catch (error: any) {
    console.error('[FEDPA Carátula] Exception:', error);
    return {
      success: false,
      error: error.message || 'Error obteniendo carátula',
    };
  }
}
