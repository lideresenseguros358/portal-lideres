/**
 * API Endpoint: ANCON Policy Print (Carátula PDF)
 * GET /api/ancon/print?poliza=XXXX-XXXXX-XX
 *
 * Calls ImpresionPoliza — ANCON generates the carátula PDF asynchronously after emission.
 * Process for downloading carátula pending confirmation from ANCON.
 */

import { NextRequest, NextResponse } from 'next/server';
import { imprimirPoliza } from '@/lib/ancon/emission.service';

export async function GET(request: NextRequest) {
  const poliza = request.nextUrl.searchParams.get('poliza');

  if (!poliza) {
    return NextResponse.json(
      { success: false, error: 'Falta parámetro poliza' },
      { status: 400 }
    );
  }

  try {
    console.log(`[ANCON Print] Requesting PDF for: ${poliza}`);
    const result = await imprimirPoliza(poliza);

    if (!result.success || !result.data?.enlace_poliza) {
      return NextResponse.json(
        { success: false, error: result.error || 'Carátula no disponible aún — consultar proceso oficial ANCON' },
        { status: 404 }
      );
    }

    const pdfLink = result.data.enlace_poliza;

    if (pdfLink.startsWith('http')) {
      const pdfRes = await fetch(pdfLink);
      if (!pdfRes.ok) {
        return NextResponse.json(
          { success: false, error: `Error descargando PDF: ${pdfRes.status}` },
          { status: 502 }
        );
      }
      const pdfBuffer = await pdfRes.arrayBuffer();
      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="poliza_ancon_${poliza}.pdf"`,
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }

    return NextResponse.json({ success: true, enlace_poliza: pdfLink });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[ANCON Print] Error:', msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
