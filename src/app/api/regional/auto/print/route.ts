/**
 * API Endpoint: Imprimir Póliza REGIONAL (carátula PDF/HTML)
 * POST /api/regional/auto/print  — from frontend (JSON body)
 * GET  /api/regional/auto/print?poliza=XXX — from email links
 *
 * Returns: PDF binary, enhanced HTML viewer, or JSON error.
 * Regional's imprimirPoliza endpoint returns ~333KB rendered HTML.
 */

import { NextRequest, NextResponse } from 'next/server';

/** Inject Acrobat-style print toolbar + print CSS into Regional HTML */
function enhanceHtml(html: string, poliza: string): string {
  const sp = poliza.replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const toolbar = `<div id="_rtb" style="position:fixed;top:0;left:0;right:0;z-index:99999;background:#1e1e1e;border-bottom:1px solid #3a3a3a;height:50px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.5);">
  <div style="display:flex;align-items:center;gap:12px;">
    <span style="background:#010139;color:#8AAA19;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:4px 9px;border-radius:3px;">Regional</span>
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

  const css = `<style id="_rss">
@page{size:letter;margin:.4in}
@media print{
  #_rtb{display:none!important}
  html,body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;width:100%;padding-top:0!important}
  .pagebreak,.page-break{page-break-after:always;break-after:page}
}
@media screen{
  body{padding-top:58px!important;max-width:960px;margin:0 auto}
}
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
import { imprimirPoliza } from '@/lib/regional/emission.service';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

// ── GET: For email download links ──
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const poliza = searchParams.get('poliza');
  const type = (searchParams.get('type') || 'cc') as 'rc' | 'cc';

  if (!poliza) {
    return NextResponse.json(
      { success: false, error: 'poliza es requerido' },
      { status: 400 }
    );
  }

  return handlePrint(poliza, type);
}

// ── POST: For frontend fetch calls ──
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { poliza, type } = body;

    if (!poliza) {
      return NextResponse.json(
        { success: false, error: 'poliza es requerido' },
        { status: 400 }
      );
    }

    return handlePrint(String(poliza), (type || 'cc') as 'rc' | 'cc');
  } catch (error: any) {
    console.error('[API REGIONAL Print] POST parse error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error imprimiendo póliza' },
      { status: 500 }
    );
  }
}

// ── Shared handler ──
async function handlePrint(poliza: string, tokenType: 'rc' | 'cc' = 'cc') {
  const requestId = `rprint-${Date.now().toString(36)}`;

  try {
    console.log(`[API REGIONAL Print] ${requestId} Printing poliza: ${poliza} (type: ${tokenType})`);

    // ── Check Supabase Storage first (captured during emission) ──
    try {
      const supabaseAdmin = getSupabaseAdmin();
      const cleanPoliza = poliza.replace(/-0$/, '').replace(/\//g, '-');
      const folderPath = `regional-policies/${cleanPoliza}`;
      const { data: files } = await supabaseAdmin.storage.from('expediente').list(folderPath);
      const stored = files?.find(f => f.name.startsWith('caratula'));
      if (stored) {
        const filePath = `${folderPath}/${stored.name}`;
        const { data: urlData } = supabaseAdmin.storage.from('expediente').getPublicUrl(filePath);
        const storedUrl = urlData?.publicUrl;
        if (storedUrl) {
          console.log(`[API REGIONAL Print] ${requestId} ✅ Serving from Supabase storage: ${filePath}`);
          // Redirect for both GET and POST — browser follows and opens the document
          return NextResponse.redirect(storedUrl, 302);
        }
      }
    } catch (storageErr: any) {
      console.warn(`[API REGIONAL Print] ${requestId} Storage lookup failed (non-fatal):`, storageErr.message);
    }

    const result = await imprimirPoliza(poliza, tokenType);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message || 'Error imprimiendo póliza', requestId },
        { status: 400 }
      );
    }

    // If we got a base64 PDF, return it as binary
    if (result.pdf) {
      const pdfBuffer = Buffer.from(result.pdf, 'base64');
      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="poliza-regional-${poliza}.pdf"`,
          'Content-Length': String(pdfBuffer.length),
        },
      });
    }

    // If we got an HTML document, enhance with print toolbar and return
    if (result.html) {
      const enhanced = enhanceHtml(result.html, poliza);
      return new NextResponse(enhanced, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }

    // No document data — return info
    return NextResponse.json({
      success: true,
      requestId,
      message: 'Póliza solicitada pero no se recibió documento.',
    });
  } catch (error: any) {
    console.error(`[API REGIONAL Print] ${requestId} Error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error imprimiendo póliza', requestId },
      { status: 500 }
    );
  }
}
