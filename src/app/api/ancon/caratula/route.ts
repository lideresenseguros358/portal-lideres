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

/** Inject letter-size print CSS + download toolbar into cached ANCON HTML */
function enhanceHtml(html: string, poliza: string): string {
  const toolbar = `<div id="portal-toolbar" style="position:fixed;top:0;left:0;right:0;background:#010139;color:#fff;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;z-index:99999;box-shadow:0 2px 8px rgba(0,0,0,.4);font-family:Arial,sans-serif;font-size:14px;">
  <div><strong>Car\u00e1tula de P\u00f3liza</strong><span style="margin-left:12px;opacity:.75;font-size:13px;">N\u00b0 ${poliza}</span></div>
  <button onclick="window.print()" style="background:#8AAA19;color:#fff;border:none;padding:8px 18px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;letter-spacing:.3px;">&#128196; Guardar como PDF</button>
</div>`;

  const css = `
<style id="portal-print-override">
/* Portal: force letter-size paper, full-color printing */
@page { size: letter; margin: 0.4in; }
@media print {
  #portal-toolbar { display: none !important; }
  html, body {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    width: 100%;
    padding-top: 0 !important;
  }
  .pagebreak, .page-break { page-break-after: always; break-after: page; }
}
@media screen {
  body { max-width: 900px; margin: 0 auto; padding: 12px; padding-top: 56px !important; }
}
</style>`;

  // Inject toolbar + CSS before </head>; fall back to prepending
  const inject = css + '\n</head>\n<body>\n' + toolbar;
  const headBodyIdx = html.search(/<\/head>\s*<body[^>]*>/i);
  if (headBodyIdx !== -1) {
    // Replace </head><body...> boundary to insert toolbar right after <body>
    return html.slice(0, headBodyIdx) + css + html.slice(headBodyIdx).replace(/<body([^>]*)>/i, `<body$1>${toolbar}`);
  }
  const headClose = html.indexOf('</head>');
  if (headClose !== -1) {
    const afterHead = html.slice(headClose);
    return html.slice(0, headClose) + css + afterHead.replace(/<body([^>]*)>/i, `<body$1>${toolbar}`);
  }
  return toolbar + css + html;
}

/**
 * Build a full viewer page that embeds the ANCON URL in an iframe.
 * Used when our server can't fetch the HTML directly (JS-rendered page).
 * The browser renders the iframe; we add a print/download toolbar.
 */
function buildViewerPage(anconUrl: string, poliza: string): string {
  const escaped = anconUrl.replace(/"/g, '&quot;');
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Car\u00e1tula de P\u00f3liza \u2013 ${poliza}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;background:#f0f0f0}
    #toolbar{position:fixed;top:0;left:0;right:0;height:48px;background:#010139;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 20px;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,.4)}
    #toolbar h1{font-size:14px;font-weight:700}
    #toolbar span{font-size:12px;opacity:.75;margin-left:10px}
    #btn-save{background:#8AAA19;color:#fff;border:none;padding:8px 18px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer}
    #btn-save:hover{background:#7a9a0f}
    #frame-wrap{position:fixed;top:48px;left:0;right:0;bottom:0}
    iframe{width:100%;height:100%;border:none;background:#fff}
    #fallback{display:none;position:absolute;inset:0;background:#fff;align-items:center;justify-content:center;flex-direction:column;gap:16px;text-align:center;padding:40px}
    #fallback p{color:#444;font-size:15px}
    #fallback a{background:#010139;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px}
    @media print{#toolbar{display:none}#frame-wrap{top:0}}
  </style>
</head>
<body>
  <div id="toolbar">
    <div><h1 style="display:inline">Car\u00e1tula de P\u00f3liza</h1><span>N\u00b0 ${poliza}</span></div>
    <button id="btn-save" onclick="printFrame()">&#128196; Guardar como PDF</button>
  </div>
  <div id="frame-wrap">
    <iframe id="pf" src="${escaped}" title="Car\u00e1tula ANCON"></iframe>
    <div id="fallback">
      <p>No se pudo mostrar la car\u00e1tula en el visor integrado.</p>
      <a href="${escaped}" target="_blank">Abrir car\u00e1tula en ANCON &#8599;</a>
    </div>
  </div>
  <script>
    var iframe = document.getElementById('pf');
    var timer = setTimeout(function(){
      try{
        var d=iframe.contentDocument||iframe.contentWindow.document;
        if(!d||d.body.innerHTML.trim().length<100) showFallback();
      }catch(e){/* cross-origin: assume loaded */}
    }, 8000);

    iframe.onload = function(){
      clearTimeout(timer);
      try{
        var d=iframe.contentDocument||iframe.contentWindow.document;
        if(!d||d.body.innerHTML.trim().length<100) showFallback();
      }catch(e){/* cross-origin iframe loaded OK */}
    };
    iframe.onerror = showFallback;

    function showFallback(){
      iframe.style.display='none';
      var f=document.getElementById('fallback');
      f.style.display='flex';
    }
    function printFrame(){
      try{
        iframe.contentWindow.print();
      }catch(e){
        // Cross-origin: can't print iframe — open in new tab for printing
        window.open('${escaped}','_blank');
      }
    }
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
