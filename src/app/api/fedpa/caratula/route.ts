/**
 * Endpoint: Obtener Carátula PDF de Póliza FEDPA
 * POST /api/fedpa/caratula  — from frontend (JSON body)
 * GET  /api/fedpa/caratula?codCotizacion=XXX&env=PROD — from email links
 * 
 * Returns: PDF binary (application/pdf) or JSON error
 */

import { NextRequest, NextResponse } from 'next/server';
import { obtenerCaratula } from '@/lib/fedpa/caratula.service';
import type { FedpaEnvironment } from '@/lib/fedpa/config';

// ── GET: For email download links ──
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const codCotizacion = searchParams.get('codCotizacion');
  const env = (searchParams.get('env') || 'PROD') as FedpaEnvironment;

  if (!codCotizacion) {
    return NextResponse.json(
      { success: false, error: 'codCotizacion es requerido' },
      { status: 400 }
    );
  }

  return handleCaratula(codCotizacion, env);
}

// ── POST: For frontend fetch calls ──
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { codCotizacion, environment = 'PROD' } = body;

    if (!codCotizacion) {
      return NextResponse.json(
        { success: false, error: 'codCotizacion es requerido' },
        { status: 400 }
      );
    }

    return handleCaratula(String(codCotizacion), environment as FedpaEnvironment);
  } catch (error: any) {
    console.error('[API FEDPA Carátula] POST parse error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error obteniendo carátula' },
      { status: 500 }
    );
  }
}

// ── Shared handler ──
async function handleCaratula(codCotizacion: string, env: FedpaEnvironment) {
  const requestId = `car-${Date.now().toString(36)}`;

  try {
    const result = await obtenerCaratula({ codCotizacion }, env);

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
