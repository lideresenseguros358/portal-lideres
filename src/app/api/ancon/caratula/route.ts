/**
 * API Endpoint: Carátula ANCON (Policy PDF)
 * POST /api/ancon/caratula  — from frontend
 * GET  /api/ancon/caratula?poliza=XXX — from email links
 *
 * ANCON returns a URL (enlace_poliza) to the PDF, not a binary.
 * This endpoint fetches the PDF and streams it to the client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { imprimirPoliza } from '@/lib/ancon/emission.service';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const poliza = searchParams.get('poliza');

  if (!poliza) {
    return NextResponse.json(
      { success: false, error: 'poliza es requerido' },
      { status: 400 }
    );
  }

  return handleCaratula(poliza);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { poliza } = body;

    if (!poliza) {
      return NextResponse.json(
        { success: false, error: 'poliza es requerido' },
        { status: 400 }
      );
    }

    return handleCaratula(String(poliza));
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[API ANCON Carátula] Parse error:', msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}

async function handleCaratula(poliza: string) {
  const requestId = `ancon-car-${Date.now().toString(36)}`;

  try {
    console.log(`[API ANCON Carátula] ${requestId} Fetching for poliza: ${poliza}`);
    const result = await imprimirPoliza(poliza);

    if (!result.success || !result.data?.enlace_poliza) {
      console.error(`[API ANCON Carátula] ${requestId} imprimirPoliza failed:`, result.error, 'raw:', JSON.stringify(result.raw).substring(0, 300));
      return NextResponse.json(
        { success: false, error: result.error || 'No se pudo obtener la carátula', raw: result.raw, requestId },
        { status: 400 }
      );
    }

    const pdfEnlace = result.data.enlace_poliza;
    console.log(`[API ANCON Carátula] ${requestId} enlace_poliza: ${pdfEnlace.substring(0, 80)}`);

    // Case A: base64 data URI — decode and return directly, no HTTP fetch needed
    if (pdfEnlace.startsWith('data:application/pdf;base64,')) {
      const b64 = pdfEnlace.replace('data:application/pdf;base64,', '');
      const pdfBuffer = Buffer.from(b64, 'base64');
      console.log(`[API ANCON Carátula] ${requestId} Serving base64 PDF (${pdfBuffer.length} bytes)`);
      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="poliza-ancon-${poliza}.pdf"`,
          'Content-Length': String(pdfBuffer.length),
        },
      });
    }

    // Case B: HTTP URL — fetch from ANCON and proxy
    const pdfRes = await fetch(pdfEnlace, { signal: AbortSignal.timeout(15000) });
    console.log(`[API ANCON Carátula] ${requestId} Fetch from ANCON: HTTP ${pdfRes.status} content-type=${pdfRes.headers.get('content-type')}`);

    if (!pdfRes.ok) {
      return NextResponse.json(
        { success: false, error: `Error descargando PDF de ANCON: HTTP ${pdfRes.status}`, requestId },
        { status: 502 }
      );
    }

    const pdfBuffer = await pdfRes.arrayBuffer();
    const contentType = pdfRes.headers.get('content-type') || 'application/pdf';

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="poliza-ancon-${poliza}.pdf"`,
        'Content-Length': String(pdfBuffer.byteLength),
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[API ANCON Carátula] ${requestId} Error:`, msg);
    return NextResponse.json(
      { success: false, error: msg, requestId },
      { status: 500 }
    );
  }
}
