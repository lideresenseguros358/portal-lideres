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
 * Inject Acrobat-style print toolbar + print CSS into cached ANCON HTML.
 * Called when the full HTML is available from the DB cache.
 */
function enhanceHtml(html: string, poliza: string): string {
  const sp = poliza.replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const toolbar = `<div id="_ptb" style="position:fixed;top:0;left:0;right:0;z-index:99999;background:#1e1e1e;border-bottom:1px solid #3a3a3a;height:50px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.5);">
  <div style="display:flex;align-items:center;gap:12px;">
    <span style="background:#010139;color:#8AAA19;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:4px 9px;border-radius:3px;">L\u00edderes</span>
    <span style="color:#ccc;font-size:13px;font-weight:600;">Car\u00e1tula de P\u00f3liza</span>
    <span style="color:#666;font-size:12px;">&#x2022; N\u00b0&nbsp;${sp}</span>
  </div>
  <div style="display:flex;align-items:center;gap:8px;">
    <button onclick="window.print()" style="display:inline-flex;align-items:center;gap:6px;background:transparent;color:#ccc;border:1px solid #555;padding:7px 14px;border-radius:5px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;" onmouseover="this.style.background='#333'" onmouseout="this.style.background='transparent'">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
      Imprimir
    </button>
    <button onclick="window.print()" style="display:inline-flex;align-items:center;gap:6px;background:#8AAA19;color:#fff;border:none;padding:7px 16px;border-radius:5px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;" onmouseover="this.style.background='#7a9a10'" onmouseout="this.style.background='#8AAA19'">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Guardar como PDF
    </button>
  </div>
</div>`;

  const css = `<style id="_pss">
@page{size:letter;margin:.4in}
@media print{
  #_ptb{display:none!important}
  html,body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;width:100%;padding-top:0!important}
  .pagebreak,.page-break{page-break-after:always;break-after:page}
}
@media screen{
  body{padding-top:58px!important;max-width:960px;margin:0 auto}
}
</style>`;

  // Inject CSS before </head>, toolbar right after opening <body>
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
 * Build an Acrobat-inspired launcher page for when the ANCON HTML can't be
 * fetched server-side (JS-rendered / session-gated / IP-blocked).
 * ANCON blocks iframes (X-Frame-Options), so we open the URL in a new tab.
 */
function buildViewerPage(anconUrl: string, poliza: string): string {
  const sp = poliza.replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const fn = poliza.replace(/\//g,'-').replace(/[^a-zA-Z0-9-]/g,'_');
  const jsUrl = JSON.stringify(anconUrl); // safe JSON string for inline script

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Car\u00e1tula \u2013 P\u00f3liza ${sp}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#525659;height:100vh;display:flex;flex-direction:column;overflow:hidden;color:#fff}

/* ── TOP TOOLBAR ── */
.bar{background:#1e1e1e;border-bottom:1px solid #3a3a3a;height:50px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;flex-shrink:0;box-shadow:0 2px 6px rgba(0,0,0,.5)}
.bar-l{display:flex;align-items:center;gap:12px}
.logo{background:#010139;color:#8AAA19;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:4px 9px;border-radius:3px;white-space:nowrap}
.bar-title{color:#ccc;font-size:13px;font-weight:600}
.bar-r{display:flex;align-items:center;gap:8px}
.btn{display:inline-flex;align-items:center;gap:6px;border-radius:5px;cursor:pointer;font-size:12px;font-weight:600;padding:7px 14px;border:none;font-family:inherit;transition:background .15s,color .15s;white-space:nowrap}
.btn-ghost{background:transparent;color:#bbb;border:1px solid #505050}
.btn-ghost:hover{background:#2e2e2e;color:#fff}
.btn-green{background:#8AAA19;color:#fff}
.btn-green:hover{background:#7a9a10}

/* ── FILENAME BAR ── */
.fbar{background:#2a2a2a;border-bottom:1px solid #3a3a3a;height:28px;display:flex;align-items:center;padding:0 18px;gap:8px;font-size:11.5px;color:#888;flex-shrink:0}
.fbar-badge{margin-left:auto;background:#333;color:#777;font-size:10px;padding:2px 9px;border-radius:10px;white-space:nowrap}

/* ── MAIN CONTENT ── */
.main{flex:1;overflow:auto;display:flex;align-items:center;justify-content:center;padding:28px 16px}

/* ── DOCUMENT CARD ── */
.card{background:#fff;color:#333;box-shadow:0 8px 48px rgba(0,0,0,.6);border-radius:3px;width:100%;max-width:540px;padding:44px 40px;text-align:center}

/* document SVG icon */
.doc-svg{margin:0 auto 24px;width:72px;height:90px;display:block}

.card-h{font-size:22px;font-weight:700;color:#010139;letter-spacing:-.3px;margin-bottom:5px}
.card-p{font-size:16px;font-weight:600;color:#444;margin-bottom:4px}
.card-s{font-size:13px;color:#999;margin-bottom:34px}

.main-btn{width:100%;background:#010139;color:#fff;border:none;padding:15px 24px;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;transition:background .15s;margin-bottom:10px;font-family:inherit}
.main-btn:hover{background:#020270}
.main-btn:active{transform:scale(.99)}

.sec-btn{width:100%;background:#f4f4f4;color:#555;border:1px solid #ddd;padding:11px 24px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;transition:background .15s;margin-bottom:28px;font-family:inherit}
.sec-btn:hover{background:#eaeaea}

hr{border:none;border-top:1px solid #eee;margin-bottom:22px}

.hint{font-size:12px;color:#999;line-height:1.85}
.hint strong{color:#555;font-weight:600}
kbd{background:#f2f2f2;border:1px solid #d0d0d0;border-bottom-width:2px;border-radius:3px;padding:1px 5px;font-family:monospace;font-size:11px;color:#333}

.badge{display:inline-flex;align-items:center;gap:5px;background:#f7f7f7;border:1px solid #ebebeb;border-radius:20px;padding:5px 13px;font-size:11px;color:#888;margin-top:20px}

@media(max-width:480px){.card{padding:30px 18px}.card-h{font-size:19px}.bar-title{display:none}}
</style>
</head>
<body>

<div class="bar">
  <div class="bar-l">
    <span class="logo">L\u00edderes</span>
    <span class="bar-title">Visor de Car\u00e1tula de P\u00f3liza</span>
  </div>
  <div class="bar-r">
    <button class="btn btn-ghost" onclick="doOpen()">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Descargar
    </button>
    <button class="btn btn-green" onclick="doOpen()">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      Ver P\u00f3liza
    </button>
  </div>
</div>

<div class="fbar">
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="#8AAA19" opacity=".7"/><polyline points="14 2 14 8 20 8" stroke="#fff" stroke-width="1.5" fill="none"/></svg>
  <span style="color:#aaa">caratula_poliza_${fn}.html</span>
  <span class="fbar-badge">ANCON Seguros</span>
</div>

<div class="main">
  <div class="card">

    <svg class="doc-svg" viewBox="0 0 72 90" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="72" height="90" rx="3" fill="#f5f5f5" stroke="#e0e0e0"/>
      <path d="M44 0H4C1.8 0 0 1.8 0 4v82c0 2.2 1.8 4 4 4h64c2.2 0 4-1.8 4-4V28L44 0Z" fill="#f9f9f9" stroke="#e0e0e0"/>
      <path d="M44 0v24c0 2.2 1.8 4 4 4h24L44 0Z" fill="#dde0e4"/>
      <rect x="9" y="38" width="54" height="5" rx="2.5" fill="#010139" opacity=".12"/>
      <rect x="9" y="49" width="44" height="3" rx="1.5" fill="#010139" opacity=".08"/>
      <rect x="9" y="57" width="50" height="3" rx="1.5" fill="#010139" opacity=".08"/>
      <rect x="9" y="65" width="36" height="3" rx="1.5" fill="#010139" opacity=".08"/>
      <rect x="9" y="10" width="28" height="16" rx="2" fill="#8AAA19" opacity=".22"/>
      <text x="12" y="21" font-family="Arial" font-size="6.5" fill="#5a7a00" font-weight="800">P\u00d3LIZA</text>
      <circle cx="52" cy="18" r="9" fill="#010139" opacity=".07"/>
    </svg>

    <div class="card-h">Car\u00e1tula de P\u00f3liza</div>
    <div class="card-p">N\u00b0 ${sp}</div>
    <div class="card-s">ANCON Seguros &nbsp;\u00b7&nbsp; Documento oficial de seguro</div>

    <button class="main-btn" onclick="doOpen()">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      Ver &amp; Descargar Car\u00e1tula
    </button>

    <button class="sec-btn" onclick="doOpen()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
      Imprimir / Guardar como PDF
    </button>

    <hr>

    <div class="hint">
      <strong>Para guardar como PDF:</strong> haga clic en el bot\u00f3n de arriba,<br>
      luego en la pesta\u00f1a que se abre presione<br>
      <kbd>Ctrl</kbd>&thinsp;+&thinsp;<kbd>P</kbd>&nbsp;(Windows)&nbsp;&nbsp;/&nbsp;&nbsp;<kbd>\u2318</kbd>&thinsp;+&thinsp;<kbd>P</kbd>&nbsp;(Mac)<br>
      y seleccione <strong>Guardar como PDF</strong>
    </div>

    <div>
      <span class="badge">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#8AAA19" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        P\u00f3liza emitida y registrada en ANCON Seguros
      </span>
    </div>

  </div>
</div>

<script>
var _u=${jsUrl};
function doOpen(){window.open(_u,'_blank')}
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
