/**
 * Endpoint: Obtener Carátula PDF de Póliza FEDPA
 * 
 * Uses Broker Integration API (2026):
 *   GET https://api.segfedpa.com:8085/BrokerIntegration/Polizas/caratula
 *       ?ramo=04&subramo=07&poliza=772&secuencia=0
 *   Auth: Basic base64(usuario:clave)
 *   Response: application/pdf (200) or { success, msg } (400)
 * 
 * POST /api/fedpa/caratula  — from frontend { poliza: "04-07-772-0" }
 * GET  /api/fedpa/caratula?poliza=04-07-772-0 — from email links
 * 
 * Returns: PDF binary (application/pdf) or JSON error
 */

import { NextRequest, NextResponse } from 'next/server';
import { obtenerCaratula, parsePolizaNumber } from '@/lib/fedpa/caratula.service';
import type { FedpaEnvironment } from '@/lib/fedpa/config';

export const maxDuration = 30;

// ── POST: Frontend calls with poliza number ──
export async function POST(request: NextRequest) {
  const requestId = `car-${Date.now().toString(36)}`;

  try {
    const body = await request.json();
    const poliza = body.poliza || body.nroPoliza || '';
    const env = (body.environment || 'PROD') as FedpaEnvironment;

    if (!poliza) {
      return NextResponse.json(
        { success: false, error: 'Se requiere el número de póliza (ej: "04-07-772-0")', requestId },
        { status: 400 }
      );
    }

    return fetchCaratula(String(poliza), env, requestId);
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
      { success: false, error: 'Parámetro "poliza" es requerido (ej: ?poliza=04-07-772-0)', requestId },
      { status: 400 }
    );
  }

  return fetchCaratula(poliza, env, requestId);
}

// ── Core: Call Broker Integration GET /Polizas/caratula ──
async function fetchCaratula(
  nroPoliza: string,
  env: FedpaEnvironment,
  requestId: string,
) {
  try {
    // Parse "04-07-772-0" → { ramo: "04", subramo: "07", poliza: "772", secuencia: "0" }
    const parsed = parsePolizaNumber(nroPoliza);
    if (!parsed) {
      return NextResponse.json(
        {
          success: false,
          error: `Formato de póliza inválido: "${nroPoliza}". Se espera formato "ramo-subramo-poliza-secuencia" (ej: "04-07-772-0")`,
          requestId,
        },
        { status: 400 }
      );
    }

    console.log(`[API FEDPA Carátula] ${requestId} Solicitando carátula via Broker Integration:`, {
      nroPoliza,
      ...parsed,
      env,
    });

    const result = await obtenerCaratula(parsed, env);

    if (result.success && result.pdfBuffer) {
      console.log(`[API FEDPA Carátula] ${requestId} ✅ PDF recibido (${result.pdfBuffer.byteLength} bytes)`);

      return new NextResponse(result.pdfBuffer.buffer as ArrayBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="poliza-fedpa-${nroPoliza}.pdf"`,
          'Content-Length': String(result.pdfBuffer.byteLength),
          'X-Request-Id': requestId,
        },
      });
    }

    // Error
    console.error(`[API FEDPA Carátula] ${requestId} ❌ Error:`, result.error);
    return NextResponse.json(
      {
        success: false,
        error: result.error || 'Error obteniendo carátula',
        poliza: nroPoliza,
        httpStatus: result.httpStatus,
        requestId,
      },
      { status: result.httpStatus || 500 }
    );
  } catch (error: any) {
    console.error(`[API FEDPA Carátula] ${requestId} Exception:`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error obteniendo carátula', requestId },
      { status: 500 }
    );
  }
}
