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

/**
 * Inject a single print toolbar into cached ANCON HTML.
 * Called when the full HTML is available from the DB cache.
 * ONE button only — no redundancy.
 */
function enhanceHtml(html: string, poliza: string): string {
  const sp = poliza.replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const toolbar = `<div id="_ptb" style="position:fixed;top:0;left:0;right:0;z-index:99999;background:#1e1e1e;border-bottom:1px solid #3a3a3a;height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.5);">
  <div style="display:flex;align-items:center;gap:12px;">
    <span style="background:#010139;color:#8AAA19;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:4px 9px;border-radius:3px;">L\u00edderes</span>
    <span style="color:#ccc;font-size:13px;font-weight:600;">Car\u00e1tula \u00b7 P\u00f3liza ${sp}</span>
  </div>
  <button onclick="window.print()" style="display:inline-flex;align-items:center;gap:7px;background:#8AAA19;color:#fff;border:none;padding:8px 18px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;" onmouseover="this.style.background='#7a9a10'" onmouseout="this.style.background='#8AAA19'">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    Guardar como PDF
  </button>
</div>`;

  const css = `<style id="_pss">
@page{size:letter;margin:.4in}
@media print{
  #_ptb{display:none!important}
  html,body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;width:100%;padding-top:0!important}
  .pagebreak,.page-break{page-break-after:always;break-after:page}
}
@media screen{body{padding-top:56px!important;max-width:960px;margin:0 auto}}
</style>`;

  let result = html;
  const hc = result.indexOf('</head>');
  if (hc !== -1) result = result.slice(0, hc) + css + result.slice(hc);
  else result = css + result;

  const bm = result.search(/<body[^>]*>/i);
  if (bm !== -1) {
    const end = result.indexOf('>', bm) + 1;
    result = result.slice(0, end) + toolbar + result.slice(end);
  } else {
    result = toolbar + result;
  }
  return result;
}

/**
 * Build a branded loading page that immediately navigates to the ANCON URL.
 * ANCON blocks iframes, so the most seamless approach is a direct navigation —
 * the user sees a brief branded transition, then lands on the actual document.
 * Ctrl+P / ⌘P saves the document as PDF from the browser.
 */
function buildViewerPage(anconUrl: string, poliza: string): string {
  const sp = poliza.replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const jsUrl = JSON.stringify(anconUrl);

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cargando car\u00e1tula\u2026</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:#010139;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif}
.wrap{text-align:center;color:#fff;padding:24px}
.brand{font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#8AAA19;margin-bottom:32px}
.spinner{width:40px;height:40px;border:3px solid rgba(255,255,255,.15);border-top-color:#8AAA19;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 24px}
@keyframes spin{to{transform:rotate(360deg)}}
.msg{font-size:16px;font-weight:600;margin-bottom:8px}
.sub{font-size:13px;color:rgba(255,255,255,.55);margin-bottom:28px}
.fallback{font-size:12px;color:rgba(255,255,255,.4)}
.fallback a{color:#8AAA19;text-decoration:none;font-weight:600}
.fallback a:hover{text-decoration:underline}
</style>
</head>
<body>
<div class="wrap">
  <div class="brand">L\u00edderes en Seguros</div>
  <div class="spinner"></div>
  <div class="msg">Cargando car\u00e1tula de p\u00f3liza\u2026</div>
  <div class="sub">P\u00f3liza N\u00b0 ${sp} &nbsp;\u00b7&nbsp; ANCON Seguros</div>
  <div class="fallback">Si no carga autom\u00e1ticamente: <a href="" id="fl">abrir aqu\u00ed</a></div>
</div>
<script>
var u=${jsUrl};
document.getElementById('fl').href=u;
window.location.replace(u);
</script>
</body>
</html>`;
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

        console.warn(`[API ANCON Carátula] ${requestId} Response too small (${html.length} bytes) — serving iframe viewer.`);
      } else {
        console.warn(`[API ANCON Carátula] ${requestId} HTML fetch returned ${htmlRes.status} — serving iframe viewer`);
      }

      // Fallback: ANCON page requires browser session/JS to render.
      // Serve our own viewer page that embeds the ANCON URL in a full-screen iframe
      // with a "Guardar como PDF" toolbar. The browser renders the iframe natively.
      if (returnHtml) {
        const viewerHtml = buildViewerPage(pdfEnlace, poliza);
        return new NextResponse(viewerHtml, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
        });
      }
      return NextResponse.json({ success: true, enlace_poliza: pdfEnlace, tipo: 'iframe-viewer', requestId });
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
