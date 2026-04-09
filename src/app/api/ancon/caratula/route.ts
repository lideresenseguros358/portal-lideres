/**
 * API Endpoint: Carátula ANCON (Policy document)
 * GET  /api/ancon/caratula?poliza=XXX — from window.open / email links
 * POST /api/ancon/caratula            — programmatic (returns JSON with URL)
 *
 * ANCON returns a URL to an HTML page (print_pol.php), not a PDF binary.
 * We proxy and enhance the HTML with print CSS, then cache the raw HTML in
 * the ancon_caratulas DB table on first access (the expediente storage bucket
 * only accepts PDF/image MIME types). Subsequent requests are served from DB.
 *
 * Print CSS is injected to enforce letter-size paper and include all pages.
 */

import { NextRequest, NextResponse } from 'next/server';
import { imprimirPoliza } from '@/lib/ancon/emission.service';
import { findAnconCaratula, saveAnconCaratula } from '@/lib/storage/expediente-server';

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

    // ── Check DB cache first (ancon_caratulas table) ──
    try {
      const cachedHtml = await findAnconCaratula(poliza);
      if (cachedHtml) {
        console.log(`[API ANCON Carátula] ${requestId} ✅ Found in DB cache (${cachedHtml.length} bytes)`);
        const enhanced = enhanceHtml(cachedHtml, poliza);
        if (returnHtml) {
          return new NextResponse(enhanced, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
          });
        }
        const proxyUrl = `/api/ancon/caratula?poliza=${encodeURIComponent(poliza)}`;
        return NextResponse.json({ success: true, enlace_poliza: proxyUrl, tipo: 'cached', requestId });
      }
    } catch (cacheErr: unknown) {
      console.warn(`[API ANCON Carátula] ${requestId} DB cache lookup failed (non-fatal):`, (cacheErr as Error).message);
    }

    // ── Cache miss: fetch enlace_poliza from ANCON ──
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
      // HTML carátula — fetch with browser-like headers so the PHP server returns full content
      console.log(`[API ANCON Carátula] ${requestId} HTML carátula — fetching...`);
      const htmlRes = await fetch(pdfEnlace, {
        signal: AbortSignal.timeout(20000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'es-PA,es;q=0.9,en-US;q=0.8',
          'Cache-Control': 'no-cache',
        },
      });

      if (htmlRes.ok) {
        const html = await htmlRes.text();
        console.log(`[API ANCON Carátula] ${requestId} Fetched HTML: ${html.length} bytes`);

        // If response is too small it's a session/error page — redirect to ANCON URL directly
        if (html.length >= 2000) {
          const enhanced = enhanceHtml(html, poliza);

          // Save raw HTML to expediente (non-fatal)
          try {
            const saveResult = await saveAnconCaratula(poliza, html);
            if (saveResult.ok) {
              console.log(`[API ANCON Carátula] ${requestId} ✅ Saved to expediente`);
            } else {
              console.warn(`[API ANCON Carátula] ${requestId} Expediente save warning: ${saveResult.error}`);
            }
          } catch (saveErr: unknown) {
            console.warn(`[API ANCON Carátula] ${requestId} Expediente save failed (non-fatal):`, (saveErr as Error).message);
          }

          if (returnHtml) {
            return new NextResponse(enhanced, {
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
            });
          }
          const proxyUrl = `/api/ancon/caratula?poliza=${encodeURIComponent(poliza)}`;
          return NextResponse.json({ success: true, enlace_poliza: proxyUrl, tipo: 'html', requestId });
        }

        console.warn(`[API ANCON Carátula] ${requestId} Response too small (${html.length} bytes) — likely a session/error page. Redirecting to ANCON URL.`);
      } else {
        console.warn(`[API ANCON Carátula] ${requestId} HTML fetch returned ${htmlRes.status} — redirecting`);
      }

      // Fallback: redirect browser directly to ANCON URL (rendered fully client-side)
      if (returnHtml) return NextResponse.redirect(pdfEnlace, 302);
      return NextResponse.json({ success: true, enlace_poliza: pdfEnlace, tipo: 'html-redirect', requestId });
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
