/**
 * Emission Service for Aseguradora ANCON
 * Handles policy emission, document upload, and carátula printing
 */

import { anconCall, getAnconToken } from './http-client';
import {
  ANCON_EMISSION_METHODS,
  ANCON_QUOTE_METHODS,
  ANCON_RAMO,
  getAnconCredentials,
} from './config';
import type {
  AnconEmisionInput,
  AnconEmisionResponse,
  AnconGenerarDocumentoResponse,
  AnconImpresionPolizaResponse,
  AnconImpresionCotizacionResponse,
  AnconSubirDocumentosResponse,
  AnconSoapResponse,
} from './types';

// ═══ Generate Policy Number ═══

export async function generarNoDocumento(
  ano: string,
  codRamo?: string,
  codSubramo?: string
): Promise<AnconSoapResponse<AnconGenerarDocumentoResponse>> {
  const creds = getAnconCredentials();
  const token = await getAnconToken();

  const result = await anconCall<AnconGenerarDocumentoResponse>(
    ANCON_EMISSION_METHODS.GENERAR_NODOCUMENTO,
    {
      cod_compania: creds.codCompania,
      cod_sucursal: creds.codSucursal,
      ano,
      cod_ramo: codRamo || ANCON_RAMO.AUTOMOVIL.codigo,
      cod_subramo: codSubramo || ANCON_RAMO.AUTOMOVIL.subramo,
      token,
    }
  );

  if (!result.success) {
    return { success: false, error: result.error || 'Error generando número de documento' };
  }

  // Response could be array or object
  const data = result.data as unknown;
  let noDoc: string | undefined;

  if (Array.isArray(data)) {
    noDoc = (data[0] as Record<string, string>)?.no_documento;
  } else if (data && typeof data === 'object') {
    noDoc = (data as Record<string, string>).no_documento;
  }

  if (!noDoc) {
    return { success: false, error: 'No se obtuvo número de documento', raw: data };
  }

  console.log(`[ANCON Emission] Generated document number: ${noDoc}`);
  return { success: true, data: { no_documento: noDoc } };
}

// ═══ Emit Policy ═══

export async function emitirPoliza(
  input: AnconEmisionInput
): Promise<AnconSoapResponse<AnconEmisionResponse>> {
  console.log(`[ANCON Emission] Emitting policy: ${input.poliza}, cotización: ${input.no_cotizacion}`);

  const result = await anconCall<unknown>(
    ANCON_EMISSION_METHODS.EMISION_SERVER,
    input as unknown as Record<string, string>
  );

  if (!result.success) {
    return { success: false, error: result.error || 'Error emitiendo póliza' };
  }

  const raw = result.data;

  // Success: { "": [{ "p1": "0", "p2": "Exito" }] }
  // Error: { "Respuesta": [{ "Respuesta": "error message" }] }
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>;

    // Check for error response
    if (obj.Respuesta && Array.isArray(obj.Respuesta)) {
      const errMsg = (obj.Respuesta[0] as Record<string, string>)?.Respuesta;
      if (errMsg) {
        return {
          success: false,
          data: { success: false, message: errMsg },
          error: errMsg,
        };
      }
    }

    // Check for success response (key is empty string "")
    const successArr = obj[''] as Array<Record<string, string>> | undefined;
    if (successArr && Array.isArray(successArr)) {
      const entry = successArr[0];
      if (entry?.p1 === '0') {
        return {
          success: true,
          data: {
            success: true,
            p1: entry.p1,
            p2: entry.p2 || 'Exito',
          },
        };
      } else {
        return {
          success: false,
          data: { success: false, p1: entry?.p1, p2: entry?.p2, message: entry?.p2 },
          error: entry?.p2 || 'Emisión fallida',
        };
      }
    }

    // Try other patterns
    for (const [, val] of Object.entries(obj)) {
      if (Array.isArray(val) && val.length > 0) {
        const entry = val[0] as Record<string, string>;
        if (entry.p1 === '0') {
          return { success: true, data: { success: true, p1: '0', p2: entry.p2 || 'Exito' } };
        }
      }
    }
  }

  console.warn('[ANCON Emission] Unexpected response format:', JSON.stringify(raw).substring(0, 300));
  return { success: true, data: { success: true, message: 'Emisión procesada' }, raw };
}

// ═══ Document Upload (get required docs list) ═══

export async function getRequiredDocuments(
  tipoPersona: string
): Promise<AnconSoapResponse<AnconSubirDocumentosResponse>> {
  const result = await anconCall<unknown>(
    ANCON_EMISSION_METHODS.SUBIR_DOCUMENTOS,
    { tipo: tipoPersona }
  );

  if (!result.success) {
    return { success: false, error: result.error || 'Error obteniendo lista de documentos' };
  }

  const raw = result.data as Record<string, unknown>;
  const listado = raw?.listado || raw;

  return {
    success: true,
    data: { listado: Array.isArray(listado) ? listado : [] } as AnconSubirDocumentosResponse,
  };
}

// ═══ Print Policy (Carátula) ═══

export async function imprimirPoliza(
  noPoliza: string
): Promise<AnconSoapResponse<AnconImpresionPolizaResponse>> {
  console.log(`[ANCON Print] Printing policy: ${noPoliza}`);

  const result = await anconCall<unknown>(
    ANCON_EMISSION_METHODS.IMPRESION_POLIZA,
    { no_poliza: noPoliza }
  );

  if (!result.success) {
    return { success: false, error: result.error || 'Error imprimiendo póliza' };
  }

  const raw = result.data;
  let enlace: string | undefined;

  if (Array.isArray(raw)) {
    enlace = (raw[0] as Record<string, string>)?.enlace_poliza;
  } else if (raw && typeof raw === 'object') {
    enlace = (raw as Record<string, string>).enlace_poliza;
  }

  if (!enlace || enlace.includes('no disponible')) {
    return {
      success: false,
      error: enlace || 'Póliza no disponible',
      raw,
    };
  }

  console.log(`[ANCON Print] PDF link: ${enlace}`);
  return { success: true, data: { enlace_poliza: enlace } };
}

// ═══ Print Cotización ═══

export async function imprimirCotizacion(
  noCotizacion: string
): Promise<AnconSoapResponse<AnconImpresionCotizacionResponse>> {
  console.log(`[ANCON Print] Printing cotización: ${noCotizacion}`);

  const result = await anconCall<unknown>(
    ANCON_QUOTE_METHODS.IMPRESION_COTIZACION,
    { no_cotizacion: noCotizacion }
  );

  if (!result.success) {
    return { success: false, error: result.error || 'Error imprimiendo cotización' };
  }

  const raw = result.data;
  let enlace: string | undefined;

  if (Array.isArray(raw)) {
    enlace = (raw[0] as Record<string, string>)?.enlace_cotizacion;
  } else if (raw && typeof raw === 'object') {
    enlace = (raw as Record<string, string>).enlace_cotizacion;
  }

  if (!enlace || enlace.includes('no disponible')) {
    return { success: false, error: enlace || 'Cotización no disponible', raw };
  }

  return { success: true, data: { enlace_cotizacion: enlace } };
}
