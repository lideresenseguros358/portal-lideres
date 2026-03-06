/**
 * Endpoint: Obtener Carátula PDF de Póliza FEDPA
 * POST /api/fedpa/caratula
 * 
 * Body: { codCotizacion: string, environment?: "DEV" | "PROD" }
 * Returns: PDF binary (application/pdf) or JSON error
 */

import { NextRequest, NextResponse } from 'next/server';
import { obtenerCaratula } from '@/lib/fedpa/caratula.service';
import type { FedpaEnvironment } from '@/lib/fedpa/config';

export async function POST(request: NextRequest) {
  const requestId = `car-${Date.now().toString(36)}`;

  try {
    const body = await request.json();
    const { codCotizacion, environment = 'PROD' } = body;

    if (!codCotizacion) {
      return NextResponse.json(
        { success: false, error: 'codCotizacion es requerido', requestId },
        { status: 400 }
      );
    }

    const env = environment as FedpaEnvironment;
    const result = await obtenerCaratula({ codCotizacion: String(codCotizacion) }, env);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, data: result.data, requestId },
        { status: 400 }
      );
    }

    // If we got a base64 PDF, return it as binary
    if (result.pdfBase64) {
      const pdfBuffer = Buffer.from(result.pdfBase64, 'base64');
      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="poliza-fedpa-${codCotizacion}.pdf"`,
          'Content-Length': String(pdfBuffer.length),
        },
      });
    }

    // If we got a URL, redirect or return it
    if (result.pdfUrl) {
      return NextResponse.json({
        success: true,
        pdfUrl: result.pdfUrl,
        requestId,
      });
    }

    // Return raw data for the frontend to handle
    return NextResponse.json({
      success: true,
      data: result.data,
      requestId,
      message: 'Carátula solicitada. Revise los datos de respuesta.',
    });
  } catch (error: any) {
    console.error(`[API FEDPA Carátula] ${requestId} Error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error obteniendo carátula', requestId },
      { status: 500 }
    );
  }
}
