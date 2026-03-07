/**
 * Endpoint: Obtener Carátula PDF de Póliza FEDPA
 * 
 * Uses EmisorPlan (2024) POST /api/caratulaPoliza — requires the SAME
 * payload that was sent to /api/emitirpoliza. Returns binary PDF.
 * 
 * POST /api/fedpa/caratula  — from frontend (sends emission payload)
 * GET  /api/fedpa/caratula?poliza=XXX — from email links (uses server-side cached payload)
 * 
 * Returns: PDF binary (application/pdf) or JSON error
 */

import { NextRequest, NextResponse } from 'next/server';
import { obtenerClienteAutenticado } from '@/lib/fedpa/auth.service';
import { EMISOR_PLAN_ENDPOINTS } from '@/lib/fedpa/config';
import type { FedpaEnvironment } from '@/lib/fedpa/config';

export const maxDuration = 30;

// ── Server-side cache for emission payloads (keyed by poliza number) ──
// Used by GET handler for email links where we can't send a POST body
const payloadCache = new Map<string, { payload: any; timestamp: number }>();
const PAYLOAD_CACHE_TTL = 72 * 60 * 60 * 1000; // 72 hours

function cachePayload(poliza: string, payload: any) {
  payloadCache.set(poliza, { payload, timestamp: Date.now() });
  // Prune old entries
  for (const [key, val] of payloadCache.entries()) {
    if (Date.now() - val.timestamp > PAYLOAD_CACHE_TTL) payloadCache.delete(key);
  }
}

function getCachedPayload(poliza: string): any | null {
  const entry = payloadCache.get(poliza);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > PAYLOAD_CACHE_TTL) {
    payloadCache.delete(poliza);
    return null;
  }
  return entry.payload;
}

// ── POST: Frontend calls with emission payload ──
export async function POST(request: NextRequest) {
  const requestId = `car-${Date.now().toString(36)}`;

  try {
    const body = await request.json();
    const { environment = 'PROD', poliza, ...emissionPayload } = body;
    const env = environment as FedpaEnvironment;

    // Must have the emission payload fields
    if (!emissionPayload.Plan && !emissionPayload.idDoc && !emissionPayload.PrimerNombre) {
      return NextResponse.json(
        { success: false, error: 'Se requiere el payload de emisión (mismo que se envió a /api/emitirpoliza)', requestId },
        { status: 400 }
      );
    }

    // Cache the payload for later GET requests (email links)
    if (poliza) {
      cachePayload(String(poliza), emissionPayload);
    }

    return fetchCaratulaPdf(emissionPayload, env, poliza || 'unknown', requestId);
  } catch (error: any) {
    console.error(`[API FEDPA Carátula] ${requestId} POST error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error obteniendo carátula', requestId },
      { status: 500 }
    );
  }
}

// ── GET: Email download links ──
export async function GET(request: NextRequest) {
  const requestId = `car-${Date.now().toString(36)}`;
  const { searchParams } = new URL(request.url);
  const poliza = searchParams.get('poliza');
  const env = (searchParams.get('env') || 'PROD') as FedpaEnvironment;

  if (!poliza) {
    return NextResponse.json(
      { success: false, error: 'Parámetro "poliza" es requerido', requestId },
      { status: 400 }
    );
  }

  // Try to find cached emission payload for this policy
  const cachedPayload = getCachedPayload(poliza);
  if (!cachedPayload) {
    // No cached payload — show friendly message
    return new NextResponse(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Descargar Póliza FEDPA</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:40px">
        <h2>Póliza FEDPA: ${poliza}</h2>
        <p>El enlace de descarga directa ha expirado.</p>
        <p>Para descargar su carátula, ingrese al <a href="https://portal.lideresenseguros.com/cotizadores/confirmacion">portal</a> o contacte a su corredor.</p>
      </body></html>`,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }

  return fetchCaratulaPdf(cachedPayload, env, poliza, requestId);
}

// ── Core: Call EmisorPlan /api/caratulaPoliza with emission payload ──
async function fetchCaratulaPdf(
  emissionPayload: any,
  env: FedpaEnvironment,
  poliza: string,
  requestId: string,
) {
  try {
    console.log(`[API FEDPA Carátula] ${requestId} Solicitando carátula para póliza ${poliza} via EmisorPlan`);

    const clientResult = await obtenerClienteAutenticado(env);
    if (!clientResult.success || !clientResult.client) {
      const status = clientResult.needsReset ? 503 : 424;
      return NextResponse.json(
        {
          success: false,
          error: clientResult.error || 'No se pudo autenticar con FEDPA',
          code: clientResult.needsReset ? 'NEEDS_FEDPA_TOKEN_RESET' : 'TOKEN_NOT_AVAILABLE',
          requestId,
        },
        { status }
      );
    }

    // POST /api/caratulaPoliza with the emission payload
    const response = await clientResult.client.postRaw(
      EMISOR_PLAN_ENDPOINTS.CARATULA_POLIZA,
      emissionPayload
    );

    const contentType = response.headers.get('content-type') || '';

    if (response.ok && contentType.includes('application/pdf')) {
      console.log(`[API FEDPA Carátula] ${requestId} ✅ PDF recibido (${response.headers.get('content-length') || '?'} bytes)`);
      const pdfBuffer = await response.arrayBuffer();

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="poliza-fedpa-${poliza}.pdf"`,
          'Content-Length': String(pdfBuffer.byteLength),
          'X-Request-Id': requestId,
        },
      });
    }

    // Not a PDF — try to parse as JSON error
    let errorMsg = `HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      errorMsg = errorData.msg || errorData.message || errorData.error || errorMsg;
      console.error(`[API FEDPA Carátula] ${requestId} Error JSON:`, errorData);
    } catch {
      const textBody = await response.text();
      errorMsg = textBody.substring(0, 300) || errorMsg;
      console.error(`[API FEDPA Carátula] ${requestId} Error text:`, errorMsg);
    }

    return NextResponse.json(
      { success: false, error: `Error obteniendo carátula: ${errorMsg}`, poliza, requestId },
      { status: response.status || 400 }
    );
  } catch (error: any) {
    console.error(`[API FEDPA Carátula] ${requestId} Error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error obteniendo carátula', requestId },
      { status: 500 }
    );
  }
}
