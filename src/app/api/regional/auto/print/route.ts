/**
 * API Endpoint: Imprimir Póliza REGIONAL (carátula PDF)
 * POST /api/regional/auto/print  — from frontend (JSON body)
 * GET  /api/regional/auto/print?poliza=XXX — from email links
 *
 * Returns: PDF binary (application/pdf) or JSON error
 */

import { NextRequest, NextResponse } from 'next/server';
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

    // If we got an HTML document, return it for browser rendering/printing
    if (result.html) {
      return new NextResponse(result.html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `inline; filename="poliza-regional-${poliza}.html"`,
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
