/**
 * API Endpoint: ANCON Policy Print (Carátula PDF)
 * GET /api/ancon/print?poliza=XXXX-XXXXX-XX
 * GET /api/ancon/print?no_cotizacion=XXX-XXXXXXX  (direct cotización PDF)
 *
 * Flow:
 *   1. Try ImpresionPoliza — returns PDF link when ANCON finishes generating it (async)
 *   2. If "no disponible", fall back to ImpresionCotizacion — available immediately
 */

import { NextRequest, NextResponse } from 'next/server';
import { imprimirPoliza, imprimirCotizacion } from '@/lib/ancon/emission.service';

async function proxyOrReturnPdf(
  link: string,
  filename: string
): Promise<NextResponse> {
  if (link.startsWith('http')) {
    const pdfRes = await fetch(link);
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
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  }
  return NextResponse.json({ success: true, enlace_poliza: link });
}

export async function GET(request: NextRequest) {
  const poliza = request.nextUrl.searchParams.get('poliza');
  const noCotizacion = request.nextUrl.searchParams.get('no_cotizacion');

  if (!poliza && !noCotizacion) {
    return NextResponse.json(
      { success: false, error: 'Falta parámetro poliza o no_cotizacion' },
      { status: 400 }
    );
  }

  try {
    // Direct cotización print (no policy number needed)
    if (noCotizacion && !poliza) {
      console.log(`[ANCON Print] Cotización PDF: ${noCotizacion}`);
      const cotResult = await imprimirCotizacion(noCotizacion);
      if (!cotResult.success || !cotResult.data?.enlace_cotizacion) {
        return NextResponse.json(
          { success: false, error: cotResult.error || 'PDF de cotización no disponible' },
          { status: 404 }
        );
      }
      return proxyOrReturnPdf(
        cotResult.data.enlace_cotizacion,
        `cotizacion_ancon_${noCotizacion}.pdf`
      );
    }

    // Try policy PDF first
    console.log(`[ANCON Print] Póliza PDF: ${poliza}`);
    const polizaResult = await imprimirPoliza(poliza!);

    if (polizaResult.success && polizaResult.data?.enlace_poliza) {
      console.log(`[ANCON Print] Póliza PDF OK: ${polizaResult.data.enlace_poliza}`);
      return proxyOrReturnPdf(
        polizaResult.data.enlace_poliza,
        `poliza_ancon_${poliza}.pdf`
      );
    }

    // Fallback: cotización PDF (ANCON generates policy PDF async — may not be ready)
    if (noCotizacion) {
      console.log(`[ANCON Print] Póliza no disponible — fallback cotización: ${noCotizacion}`);
      const cotResult = await imprimirCotizacion(noCotizacion);
      if (cotResult.success && cotResult.data?.enlace_cotizacion) {
        return proxyOrReturnPdf(
          cotResult.data.enlace_cotizacion,
          `cotizacion_ancon_${noCotizacion}.pdf`
        );
      }
    }

    return NextResponse.json(
      { success: false, error: polizaResult.error || 'PDF no disponible aún — intente más tarde' },
      { status: 404 }
    );

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[ANCON Print] Error:', msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
