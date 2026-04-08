/**
 * Emission Service for Aseguradora ANCON
 * Handles policy emission, document upload, inspection linking, and carátula printing
 */

import { anconCall, anconCallWithToken, getAnconToken } from './http-client';
import {
  ANCON_EMISSION_METHODS,
  ANCON_QUOTE_METHODS,
  ANCON_RAMO,
  ANCON_REST_URL,
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
  codSubramo?: string,
  sharedToken?: string
): Promise<AnconSoapResponse<AnconGenerarDocumentoResponse>> {
  const creds = getAnconCredentials();
  const params = {
    cod_compania: creds.codCompania,
    cod_sucursal: creds.codSucursal,
    ano,
    cod_ramo: codRamo || ANCON_RAMO.AUTOMOVIL.codigo,
    cod_subramo: codSubramo || ANCON_RAMO.AUTOMOVIL.subramo,
  };

  const result = sharedToken
    ? await anconCallWithToken<AnconGenerarDocumentoResponse>(ANCON_EMISSION_METHODS.GENERAR_NODOCUMENTO, params, sharedToken)
    : await anconCall<AnconGenerarDocumentoResponse>(ANCON_EMISSION_METHODS.GENERAR_NODOCUMENTO, params);

  if (!result.success) {
    return { success: false, error: result.error || 'Error generando número de documento' };
  }

  // Response could be array or object
  const data = result.data as unknown;
  console.log(`[ANCON Emission] GenerarNoDocumento raw:`, JSON.stringify(data).substring(0, 500));
  let noDoc: string | undefined;

  if (Array.isArray(data)) {
    noDoc = (data[0] as Record<string, string>)?.no_documento;
  } else if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    noDoc = obj.no_documento as string | undefined;
    // Some responses wrap in a named key
    if (!noDoc) {
      for (const val of Object.values(obj)) {
        if (Array.isArray(val) && val.length > 0) {
          noDoc = (val[0] as Record<string, string>)?.no_documento;
          if (noDoc) break;
        }
      }
    }
  } else if (typeof data === 'string') {
    // Might be a plain string with the document number
    const match = data.match(/\d{3}-\d+-\d+/);
    if (match) noDoc = match[0];
  }

  if (!noDoc) {
    return { success: false, error: 'No se obtuvo número de documento', raw: data };
  }

  console.log(`[ANCON Emission] Generated document number: ${noDoc}`);
  return { success: true, data: { no_documento: noDoc } };
}

// ═══ Emit Policy ═══

export async function emitirPoliza(
  input: AnconEmisionInput,
  sharedToken?: string
): Promise<AnconSoapResponse<AnconEmisionResponse>> {
  console.log(`[ANCON Emission] Emitting policy: ${input.poliza}, cotización: ${input.no_cotizacion}`);

  const params = input as unknown as Record<string, string>;
  const result = sharedToken
    ? await anconCallWithToken<unknown>(ANCON_EMISSION_METHODS.EMISION_SERVER, params, sharedToken)
    : await anconCall<unknown>(ANCON_EMISSION_METHODS.EMISION_SERVER, params);

  if (!result.success) {
    return { success: false, error: result.error || 'Error emitiendo póliza' };
  }

  const raw = result.data;

  // Success: { "": [{ "p1": "0", "p2": "Exito" }] }
  // Error: { "Respuesta": [{ "Respuesta": "error message" }] }
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>;

    // Check for error response — can be array or string
    if (obj.Respuesta) {
      let errMsg: string | undefined;
      if (typeof obj.Respuesta === 'string') {
        errMsg = obj.Respuesta;
      } else if (Array.isArray(obj.Respuesta)) {
        errMsg = (obj.Respuesta[0] as Record<string, string>)?.Respuesta;
      }
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
  noPoliza: string,
  sharedToken?: string
): Promise<AnconSoapResponse<AnconImpresionPolizaResponse>> {
  console.log(`[ANCON Print] Requesting ImpresionPoliza for: ${noPoliza}`);

  const params = { no_poliza: noPoliza };
  const result = sharedToken
    ? await anconCallWithToken<unknown>(ANCON_EMISSION_METHODS.IMPRESION_POLIZA, params, sharedToken)
    : await anconCall<unknown>(ANCON_EMISSION_METHODS.IMPRESION_POLIZA, params);

  if (!result.success) {
    console.error(`[ANCON Print] SOAP call failed: ${result.error}`);
    return { success: false, error: result.error || 'Error imprimiendo póliza' };
  }

  const raw = result.data;
  // Log the full raw response so we can inspect it in Vercel logs
  console.log(`[ANCON Print] Raw response:`, JSON.stringify(raw).substring(0, 500));

  // ANCON may return the data in several forms — try all known structures:
  //   1. Array: [{ enlace_poliza: "..." }]
  //   2. Object: { enlace_poliza: "..." }
  //   3. Nested: { ImpresionPoliza: [{ enlace_poliza: "..." }] }
  //   4. Base64 PDF: enlace_poliza starts with "JVBERi0x" (%PDF-)
  let enlace: string | undefined;

  if (Array.isArray(raw)) {
    const first = raw[0] as Record<string, string>;
    enlace = first?.enlace_poliza ?? first?.enlace ?? first?.url ?? first?.link;
  } else if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    // Direct field
    enlace = obj.enlace_poliza as string | undefined;
    // Nested under method name
    if (!enlace) {
      const nested = Object.values(obj).find(v => Array.isArray(v)) as Array<Record<string, string>> | undefined;
      if (nested?.[0]) enlace = nested[0].enlace_poliza ?? nested[0].enlace ?? nested[0].url;
    }
  } else if (typeof raw === 'string') {
    // Might be a plain URL or base64 string returned directly
    enlace = raw as string;
  }

  if (!enlace || enlace.toLowerCase().includes('no disponible') || enlace.toLowerCase().includes('error')) {
    console.error(`[ANCON Print] No valid link found. enlace="${enlace}" raw=${JSON.stringify(raw).substring(0, 300)}`);
    return {
      success: false,
      error: enlace || 'Carátula no disponible — ANCON no retornó enlace',
      raw,
    };
  }

  // If ANCON returned base64 PDF data instead of a URL, wrap it as a data URI
  const isBase64Pdf = enlace.startsWith('JVBERi0x') || enlace.startsWith('%PDF') || (enlace.length > 200 && !enlace.startsWith('http'));
  if (isBase64Pdf) {
    console.log(`[ANCON Print] Response is base64 PDF (${enlace.length} chars) — wrapping as data URI`);
    enlace = `data:application/pdf;base64,${enlace.replace(/^data:application\/pdf;base64,/, '')}`;
  }

  console.log(`[ANCON Print] PDF link resolved: ${enlace.substring(0, 80)}...`);
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

// ═══ Inspection: List inspections for corredor ═══

export async function listadoInspeccion(sharedToken?: string): Promise<AnconSoapResponse<{ inspecciones: Array<Record<string, string>> }>> {
  const creds = getAnconCredentials();
  const params = { cod_agente: creds.codAgente };
  const result = sharedToken
    ? await anconCallWithToken<unknown>(ANCON_EMISSION_METHODS.LISTADO_INSPECCION, params, sharedToken)
    : await anconCall<unknown>(ANCON_EMISSION_METHODS.LISTADO_INSPECCION, params);

  if (!result.success) {
    return { success: false, error: result.error || 'Error obteniendo inspecciones' };
  }

  const raw = result.data;
  if (raw === null || raw === 'null') {
    return { success: true, data: { inspecciones: [] } };
  }

  const items = Array.isArray(raw) ? raw : [];
  console.log(`[ANCON Inspection] Found ${items.length} inspection(s)`);
  return { success: true, data: { inspecciones: items as Array<Record<string, string>> } };
}

// ═══ Inspection: Link inspection to cotización ═══

export async function enlazarInspeccion(
  inspeccionId: string,
  noCotizacion: string,
  sharedToken?: string
): Promise<AnconSoapResponse<{ message: string }>> {
  console.log(`[ANCON Inspection] Linking inspection ${inspeccionId} to cotización ${noCotizacion}`);

  const params = { inspeccion: inspeccionId, cotizacion: noCotizacion };
  const result = sharedToken
    ? await anconCallWithToken<unknown>(ANCON_EMISSION_METHODS.ENLAZAR_INSPECCION, params, sharedToken)
    : await anconCall<unknown>(ANCON_EMISSION_METHODS.ENLAZAR_INSPECCION, params);

  if (!result.success) {
    return { success: false, error: result.error || 'Error enlazando inspección' };
  }

  const raw = result.data;
  const message = typeof raw === 'string' ? raw : JSON.stringify(raw);

  // Check for known error patterns
  if (message.includes('no coincide') || message.includes('Verificar')) {
    return { success: false, error: message };
  }

  console.log(`[ANCON Inspection] Link result: ${message}`);
  return { success: true, data: { message } };
}

// ═══ REST API: Login for JWT token ═══

export async function getAnconRestToken(): Promise<string | null> {
  try {
    const creds = getAnconCredentials();
    const res = await fetch(`${ANCON_REST_URL}/api/Entidad/get_login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `Usuario=${creds.usuario}&Clave=${creds.password}`,
    });
    const data = await res.json();
    return data.jwtToken || null;
  } catch (e) {
    console.error('[ANCON REST] Login error:', e);
    return null;
  }
}

// ═══ REST API: Upload document file ═══

export async function uploadDocumentREST(
  nombreArchivo: string,  // Hash from SubirDocumentos — used as the uploaded file's name
  nroRegistro: string,    // Policy number from GenerarNodocumento
  file: Buffer | Blob,
  fileName: string,
  mimeType: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const creds = getAnconCredentials();

    const form = new FormData();
    form.append('Usuario', creds.usuario);
    form.append('Clave', creds.password);
    form.append('Tipo', '1');
    form.append('NroRegistro', nroRegistro);

    // Detect MIME type from magic bytes when not provided — ANCÓN needs a valid Content-Type
    // to identify file format. Empty type defaults to application/octet-stream which ANCÓN rejects.
    let effectiveMimeType = mimeType;
    if (!effectiveMimeType && !(file instanceof Blob) && file.length > 4) {
      if (file[0] === 0xFF && file[1] === 0xD8 && file[2] === 0xFF) {
        effectiveMimeType = 'image/jpeg';
      } else if (file[0] === 0x89 && file[1] === 0x50 && file[2] === 0x4E && file[3] === 0x47) {
        effectiveMimeType = 'image/png';
      } else if (file.slice(0, 4).toString('ascii') === '%PDF') {
        effectiveMimeType = 'application/pdf';
      }
    }
    const finalMimeType = effectiveMimeType || 'application/octet-stream';

    // Safe Buffer → Blob conversion using explicit byte range to avoid pool buffer contamination
    // file is guaranteed to be Buffer here (Blob case handled above)
    const blob = file instanceof Blob
      ? file
      : new Blob([new Uint8Array(
          (file as Buffer).buffer,
          (file as Buffer).byteOffset,
          (file as Buffer).byteLength,
        ) as unknown as BlobPart], { type: finalMimeType });

    // Append file extension to the ANCÓN hash filename so the server can identify the format.
    // Some ANCÓN versions use the extension to validate the file type on ingest.
    const ext = finalMimeType.includes('pdf') ? '.pdf'
      : finalMimeType.includes('jpeg') || finalMimeType.includes('jpg') ? '.jpg'
      : finalMimeType.includes('png') ? '.png'
      : '';
    const uploadName = /\.\w{2,5}$/.test(nombreArchivo) ? nombreArchivo : `${nombreArchivo}${ext}`;
    form.append('files', blob, uploadName);
    console.log(`[ANCON REST Upload] Uploading ${uploadName} — type=${finalMimeType}, size=${blob.size}b`);

    const res = await fetch(`${ANCON_REST_URL}/api/Polizas/post_add_documentos_polizas_emision`, {
      method: 'POST',
      body: form,
    });

    const text = await res.text();
    console.log(`[ANCON REST Upload] ${nombreArchivo}: ${text.substring(0, 200)}`);

    try {
      const json = JSON.parse(text);
      const result = Array.isArray(json) ? json[0] : json;
      if (result?.Success === 1) {
        return { success: true, message: result.Mensaje || 'Uploaded' };
      }
      return { success: false, message: result?.Mensaje || text.substring(0, 200) };
    } catch {
      return { success: false, message: text.substring(0, 200) };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[ANCON REST Upload] Error: ${msg}`);
    return { success: false, message: msg };
  }
}

// ═══ Upload all required documents for a cotización ═══
//
// ANCON Natural docs (id_archivo) — confirmed by ANCON 2026-04-08:
//   1 = Solicitud de seguros       (requerida=1) ← generated PDF from portal
//   2 = Conoce a tu cliente        (requerida=1) ← also mapped to solicitud PDF
//   3 = Cédula del contratante     (requerida=1)
//   4 = Cédula del asegurado       (requerida=1) ← same person as contratante for Natural
//   5 = Licencia del asegurado     (requerida=1)
//   6 = Licencia conductor habitual (requerida=0) ← optional
//   7 = Registro vehicular          (requerida=0) ← optional

export async function uploadInspectionAndDocuments(
  tipoPersona: string,
  polizaNumber: string,     // Policy number from GenerarNodocumento — required by REST endpoint
  files: Record<string, { buffer: Buffer; name: string; type: string }>,
  solicitudBuffer?: Buffer  // Pre-generated Solicitud de Seguros PDF (doc id=1)
): Promise<{ success: boolean; uploaded: number; failed: number; errors: string[] }> {
  const docsResult = await getRequiredDocuments(tipoPersona);
  if (!docsResult.success || !docsResult.data?.listado?.length) {
    return { success: false, uploaded: 0, failed: 0, errors: ['No se pudo obtener lista de documentos'] };
  }

  const docList = docsResult.data.listado;
  let uploaded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const doc of docList) {
    const id = doc.id_archivo;
    let fileData: { buffer: Buffer; name: string; type: string } | undefined;

    if ((id === '1' || id === '2') && solicitudBuffer) {
      // Doc 1: Solicitud de Seguros — generated PDF
      // Doc 2: Conoce a tu cliente — requerida=1, mapped to the same solicitud PDF
      const docName = id === '2' ? 'conoce_a_tu_cliente.pdf' : 'solicitud_ancon.pdf';
      fileData = { buffer: solicitudBuffer, name: docName, type: 'application/pdf' };
    } else if (id === '3' || id === '4') {
      // Cédula contratante (3) and cédula asegurado (4) — same person for Natural
      fileData = files['cedulaFile'] || files['cedula'];
    } else if (id === '5') {
      // Licencia del asegurado
      fileData = files['licenciaFile'] || files['licencia'];
    } else if (id === '7') {
      // Registro vehicular
      fileData = files['registroVehicularFile'] || files['registroVehicular'];
    }

    if (!fileData) {
      if (doc.requerida === '1') {
        console.warn(`[ANCON Upload] Doc requerido ${id} (${doc.nombre}) — sin archivo`);
      }
      continue;
    }

    const result = await uploadDocumentREST(
      doc.nombre_archivo,
      polizaNumber,
      fileData.buffer,
      fileData.name,
      fileData.type
    );

    if (result.success) {
      uploaded++;
      console.log(`[ANCON Upload] ✅ doc ${id} (${doc.nombre}) subido`);
    } else {
      failed++;
      errors.push(`doc ${id} ${doc.nombre}: ${result.message}`);
      console.warn(`[ANCON Upload] ❌ doc ${id} (${doc.nombre}): ${result.message}`);
    }
  }

  return { success: failed === 0 || uploaded > 0, uploaded, failed, errors };
}
