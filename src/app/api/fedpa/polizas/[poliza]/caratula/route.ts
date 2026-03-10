/**
 * Endpoint: Descargar Carátula PDF de Póliza FEDPA
 * GET /api/fedpa/polizas/{poliza}/caratula
 * POST /api/fedpa/polizas/{poliza}/caratula
 * 
 * Uses Broker Integration API (2026):
 *   GET https://api.segfedpa.com:8085/BrokerIntegration/Polizas/caratula
 *       ?ramo=04&subramo=07&poliza=772&secuencia=0
 * 
 * The {poliza} path param is the full policy number (e.g. "04-07-772-0")
 * which gets parsed into ramo/subramo/poliza/secuencia.
 */

import { NextRequest, NextResponse } from 'next/server';
import { obtenerCaratula, parsePolizaNumber } from '@/lib/fedpa/caratula.service';
import type { FedpaEnvironment } from '@/lib/fedpa/config';

async function handleCaratula(poliza: string, env: FedpaEnvironment, requestId: string) {
  const parsed = parsePolizaNumber(poliza);
  if (!parsed) {
    return NextResponse.json(
      {
        success: false,
        error: `Formato de póliza inválido: "${poliza}". Se espera "ramo-subramo-poliza-secuencia"`,
        requestId,
      },
      { status: 400 }
    );
  }

  console.log(`[API FEDPA Carátula] ${requestId} Solicitando carátula para póliza: ${poliza}`);

  const result = await obtenerCaratula(parsed, env);

  if (result.success && result.pdfBuffer) {
    console.log(`[API FEDPA Carátula] ${requestId} ✅ PDF recibido (${result.pdfBuffer.byteLength} bytes)`);
    return new NextResponse(result.pdfBuffer.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="caratula_${poliza}.pdf"`,
        'Content-Length': String(result.pdfBuffer.byteLength),
        'X-Request-Id': requestId,
      },
    });
  }

  console.error(`[API FEDPA Carátula] ${requestId} ❌ Error:`, result.error);
  return NextResponse.json(
    {
      success: false,
      error: result.error || 'Error obteniendo carátula',
      poliza,
      httpStatus: result.httpStatus,
      requestId,
    },
    { status: result.httpStatus || 500 }
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ poliza: string }> }
) {
  const requestId = `car-${Date.now().toString(36)}`;
  try {
    const { poliza } = await params;
    const body = await request.json().catch(() => ({}));
    const env = (body.environment || 'PROD') as FedpaEnvironment;
    return handleCaratula(poliza, env, requestId);
  } catch (error: any) {
    console.error(`[API FEDPA Carátula] ${requestId} Error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error obteniendo carátula', requestId },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ poliza: string }> }
) {
  const requestId = `car-${Date.now().toString(36)}`;
  try {
    const { poliza } = await params;
    const { searchParams } = new URL(request.url);
    const env = (searchParams.get('env') || 'PROD') as FedpaEnvironment;
    return handleCaratula(poliza, env, requestId);
  } catch (error: any) {
    console.error(`[API FEDPA Carátula] ${requestId} Error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error obteniendo carátula', requestId },
      { status: 500 }
    );
  }
}
