/**
 * API Endpoint: Carátula ANCON (Policy document)
 * GET  /api/ancon/caratula?poliza=XXX — from window.open / email links
 * POST /api/ancon/caratula            — programmatic (returns JSON with URL)
 *
 * ANCON returns a URL to an HTML page (print_pol.php), not a PDF binary.
 * We proxy and enhance the HTML directly — no Supabase storage needed since
 * the expediente bucket rejects text/* MIME types.
 *
 * Print CSS is injected to enforce letter-size paper and include all pages.
 */

import { NextRequest, NextResponse } from 'next/server';
import { imprimirPoliza } from '@/lib/ancon/emission.service';

export const maxDuration = 30;

/** Inject letter-size print CSS and auto-print trigger into ANCON HTML */
function enhanceHtml(html: string, poliza: string): string {
  const css = `
<style id="portal-print-override">
/* Portal: force letter-size paper, full-color printing */
@page {
  size: letter;
  margin: 0.4in;
}
@media print {
  html, body {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    width: 100%;
  }
  /* Prevent blank pages from empty elements */
  .pagebreak, .page-break { page-break-after: always; break-after: page; }
}
/* Screen: constrain to readable width */
@media screen {
  body { max-width: 850px; margin: 0 auto; padding: 12px; }
}
</style>`;

  // Inject before </head>; fall back to prepending if no <head>
  const headClose = html.indexOf('</head>');
  if (headClose !== -1) {
    return html.slice(0, headClose) + css + html.slice(headClose);
  }
  const htmlOpen = html.search(/<html[^>]*>/i);
  if (htmlOpen !== -1) {
    const afterHtml = html.indexOf('>', htmlOpen) + 1;
    return html.slice(0, afterHtml) + `<head>${css}</head>` + html.slice(afterHtml);
  }
  return css + html;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const poliza = searchParams.get('poliza');

  if (!poliza) {
    return NextResponse.json(
      { success: false, error: 'poliza es requerido' },
      { status: 400 }
    );
  }

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

async function handleCaratula(poliza: string, returnHtml: boolean) {
  const requestId = `ancon-car-${Date.now().toString(36)}`;

  try {
    console.log(`[API ANCON Carátula] ${requestId} Fetching for poliza: ${poliza}`);

    // Fetch enlace_poliza from ANCON
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

    // Case A: base64 PDF data URI — decode and return directly
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

    // Case B: HTTP URL — detect content type, then fetch and proxy
    const headRes = await fetch(pdfEnlace, { method: 'HEAD', signal: AbortSignal.timeout(10000) }).catch(() => null);
    const probeContentType = headRes?.headers.get('content-type') || '';
    console.log(`[API ANCON Carátula] ${requestId} HEAD probe: HTTP ${headRes?.status} content-type=${probeContentType}`);

    if (probeContentType.includes('text/html') || !probeContentType.includes('pdf')) {
      // HTML carátula — fetch, enhance with print CSS, and serve directly
      console.log(`[API ANCON Carátula] ${requestId} HTML carátula — fetching...`);
      const htmlRes = await fetch(pdfEnlace, { signal: AbortSignal.timeout(20000) });

      if (!htmlRes.ok) {
        // Fallback: redirect to ANCON URL directly
        console.warn(`[API ANCON Carátula] ${requestId} HTML fetch returned ${htmlRes.status} — redirecting`);
        if (returnHtml) return NextResponse.redirect(pdfEnlace, 302);
        return NextResponse.json({ success: true, enlace_poliza: pdfEnlace, tipo: 'html', requestId });
      }

      const html = await htmlRes.text();
      const enhanced = enhanceHtml(html, poliza);
      console.log(`[API ANCON Carátula] ${requestId} ✅ Serving enhanced HTML (${enhanced.length} bytes)`);

      if (returnHtml) {
        return new NextResponse(enhanced, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        });
      }
      // POST callers: return the proxy URL so the client can open it
      const proxyUrl = `/api/ancon/caratula?poliza=${encodeURIComponent(poliza)}`;
      return NextResponse.json({ success: true, enlace_poliza: proxyUrl, tipo: 'html', requestId });
    }

    // Case C: actual PDF binary
    const pdfRes = await fetch(pdfEnlace, { signal: AbortSignal.timeout(15000) });
    console.log(`[API ANCON Carátula] ${requestId} PDF fetch: HTTP ${pdfRes.status} content-type=${pdfRes.headers.get('content-type')}`);

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
