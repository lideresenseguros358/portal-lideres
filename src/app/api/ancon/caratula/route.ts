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

  // GET callers (window.open, email links) get a redirect when HTML
  return handleCaratula(poliza, true);
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

    // POST callers get JSON with the URL (for programmatic use)
    return handleCaratula(String(poliza), false);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[API ANCON Carátula] Parse error:', msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}

async function handleCaratula(poliza: string, redirectIfHtml = false) {
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

    // Case B: HTTP URL — probe content-type first, then proxy or redirect
    const headRes = await fetch(pdfEnlace, { method: 'HEAD', signal: AbortSignal.timeout(10000) }).catch(() => null);
    const probeContentType = headRes?.headers.get('content-type') || '';
    console.log(`[API ANCON Carátula] ${requestId} HEAD probe: HTTP ${headRes?.status} content-type=${probeContentType}`);

    // ANCON returns HTML for print_pol.php
    if (probeContentType.includes('text/html') || !probeContentType.includes('pdf')) {
      console.log(`[API ANCON Carátula] ${requestId} HTML carátula detected — ${redirectIfHtml ? 'redirecting' : 'returning URL'}`);
      if (redirectIfHtml) {
        return NextResponse.redirect(pdfEnlace, 302);
      }
      return NextResponse.json({
        success: true,
        enlace_poliza: pdfEnlace,
        tipo: 'html',
        requestId,
      });
    }

    const pdfRes = await fetch(pdfEnlace, { signal: AbortSignal.timeout(15000) });
    console.log(`[API ANCON Carátula] ${requestId} Fetch from ANCON: HTTP ${pdfRes.status} content-type=${pdfRes.headers.get('content-type')}`);

    if (!pdfRes.ok) {
      return NextResponse.json(
        { success: false, error: `Error descargando PDF de ANCON: HTTP ${pdfRes.status}`, requestId },
        { status: 502 }
      );
    }

    const pdfBuffer = await pdfRes.arrayBuffer();

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
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
