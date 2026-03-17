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
      return NextResponse.json(
        { success: false, error: result.error || 'No se pudo obtener la carátula', requestId },
        { status: 400 }
      );
    }

    const pdfUrl = result.data.enlace_poliza;
    console.log(`[API ANCON Carátula] ${requestId} PDF URL: ${pdfUrl}`);

    // Fetch the actual PDF from ANCON's server
    const pdfRes = await fetch(pdfUrl, { signal: AbortSignal.timeout(15000) });

    if (!pdfRes.ok) {
      return NextResponse.json(
        { success: false, error: `Error descargando PDF: HTTP ${pdfRes.status}`, requestId },
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
