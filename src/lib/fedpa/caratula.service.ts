/**
 * Servicio de Carátula FEDPA — Descarga PDF de póliza emitida
 * 
 * Usa la API Emisor Externo (EmisorFedpa.Api) con Basic Auth.
 * 
 * Endpoints:
 *   TEST: POST /api/Polizas/get_nropoliza
 *   PROD: POST /api/Polizas/get_nropoliza_emitir
 * 
 * Body: { "usuario": "...", "clave": "...", "codCotizacion": "..." }
 * Auth: Authorization: Basic (usuario:clave base64)
 */

import { FEDPA_CONFIG, FedpaEnvironment, EMISOR_EXTERNO_ENDPOINTS } from './config';

export interface CaratulaRequest {
  codCotizacion: string;
}

export interface CaratulaResponse {
  success: boolean;
  data?: any;
  pdfBase64?: string;
  pdfUrl?: string;
  error?: string;
}

/**
 * Obtener carátula (PDF) de una póliza emitida
 */
export async function obtenerCaratula(
  request: CaratulaRequest,
  env: FedpaEnvironment = 'PROD'
): Promise<CaratulaResponse> {
  const config = FEDPA_CONFIG[env];

  if (!config.usuario || !config.clave) {
    return { success: false, error: 'Credenciales FEDPA no configuradas' };
  }

  // Seleccionar endpoint según ambiente
  const endpoint = env === 'PROD'
    ? EMISOR_EXTERNO_ENDPOINTS.GET_CARATULA_PROD
    : EMISOR_EXTERNO_ENDPOINTS.GET_CARATULA_TEST;

  const url = `${config.emisorExternoUrl}${endpoint}`;

  // Basic Auth header
  const basicAuth = Buffer.from(`${config.usuario}:${config.clave}`).toString('base64');

  const body = {
    usuario: config.usuario,
    clave: config.clave,
    codCotizacion: request.codCotizacion,
  };

  console.log('[FEDPA Carátula] Solicitando carátula...', {
    env,
    endpoint,
    codCotizacion: request.codCotizacion,
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: JSON.stringify(body),
    });

    // Check if response is PDF (binary)
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/pdf') || contentType.includes('octet-stream')) {
      // Response is a PDF binary — convert to base64
      const buffer = await response.arrayBuffer();
      const pdfBase64 = Buffer.from(buffer).toString('base64');
      console.log('[FEDPA Carátula] PDF recibido:', {
        size: buffer.byteLength,
        contentType,
      });
      return {
        success: true,
        pdfBase64,
      };
    }

    // Otherwise parse as JSON
    const data = await response.json();

    if (!response.ok) {
      console.error('[FEDPA Carátula] Error HTTP:', response.status, data);
      return {
        success: false,
        error: data?.message || data?.msg || data?.error || `HTTP ${response.status}`,
        data,
      };
    }

    console.log('[FEDPA Carátula] Respuesta JSON:', JSON.stringify(data).substring(0, 500));

    // Response might contain PDF as base64 string, URL, or embedded data
    // Try to extract PDF from common response shapes
    const pdfBase64 = data?.pdf || data?.PDF || data?.pdfBase64 || data?.archivo || data?.Archivo || null;
    const pdfUrl = data?.url || data?.URL || data?.pdfUrl || data?.urlPdf || null;

    if (pdfBase64) {
      return { success: true, pdfBase64, data };
    }

    if (pdfUrl) {
      return { success: true, pdfUrl, data };
    }

    // If we got a successful response but can't find the PDF, return the raw data
    // The caller can decide what to do
    return {
      success: true,
      data,
    };
  } catch (error: any) {
    console.error('[FEDPA Carátula] Error:', error);
    return {
      success: false,
      error: error.message || 'Error obteniendo carátula',
    };
  }
}
