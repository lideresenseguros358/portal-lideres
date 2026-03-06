/**
 * API Endpoint: Imprimir Póliza REGIONAL (carátula PDF)
 * POST /api/regional/auto/print  — from frontend (JSON body)
 * GET  /api/regional/auto/print?poliza=XXX — from email links
 *
 * Returns: PDF binary (application/pdf) or JSON error
 */

import { NextRequest, NextResponse } from 'next/server';
import { imprimirPoliza } from '@/lib/regional/emission.service';

// ── GET: For email download links ──
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const poliza = searchParams.get('poliza');

  if (!poliza) {
    return NextResponse.json(
      { success: false, error: 'poliza es requerido' },
      { status: 400 }
    );
  }

  return handlePrint(poliza);
}

// ── POST: For frontend fetch calls ──
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

    return handlePrint(String(poliza));
  } catch (error: any) {
    console.error('[API REGIONAL Print] POST parse error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error imprimiendo póliza' },
      { status: 500 }
    );
  }
}

// ── Shared handler ──
async function handlePrint(poliza: string) {
  const requestId = `rprint-${Date.now().toString(36)}`;

  try {
    console.log(`[API REGIONAL Print] ${requestId} Printing poliza: ${poliza}`);
    const result = await imprimirPoliza(poliza);

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

    // No PDF data — return info
    return NextResponse.json({
      success: true,
      requestId,
      message: 'Póliza solicitada pero no se recibió PDF.',
    });
  } catch (error: any) {
    console.error(`[API REGIONAL Print] ${requestId} Error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error imprimiendo póliza', requestId },
      { status: 500 }
    );
  }
}
