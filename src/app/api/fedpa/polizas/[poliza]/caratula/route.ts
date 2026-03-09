/**
 * Endpoint: Descargar Carátula PDF de Póliza FEDPA
 * POST /api/fedpa/polizas/{poliza}/caratula
 * 
 * FedPa EmisorPlan (2024) endpoint: POST /api/caratulaPoliza
 * Requires the same payload as /api/emitirpoliza (InformacionEmisionPoliza schema).
 * Returns PDF binary.
 */

import { NextRequest, NextResponse } from 'next/server';
import { obtenerClienteAutenticado } from '@/lib/fedpa/auth.service';
import type { FedpaEnvironment } from '@/lib/fedpa/config';

const CARATULA_ENDPOINT = '/api/caratulaPoliza';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ poliza: string }> }
) {
  const requestId = `car-${Date.now().toString(36)}`;
  
  try {
    const { poliza } = await params;
    const body = await request.json();
    const environment = (body.environment || 'PROD') as FedpaEnvironment;
    
    if (!poliza) {
      return NextResponse.json(
        { success: false, error: 'Número de póliza requerido', requestId },
        { status: 400 }
      );
    }
    
    console.log(`[API FEDPA Carátula] ${requestId} Solicitando carátula para póliza: ${poliza}`);
    
    // Obtener cliente autenticado
    const clientResult = await obtenerClienteAutenticado(environment);
    if (!clientResult.success || !clientResult.client) {
      const status = clientResult.needsReset ? 503 : 424;
      return NextResponse.json(
        {
          success: false,
          error: clientResult.error || 'No se pudo autenticar',
          code: clientResult.needsReset ? 'NEEDS_FEDPA_TOKEN_RESET' : 'TOKEN_NOT_AVAILABLE',
          requestId,
        },
        { status }
      );
    }
    
    // POST /api/caratulaPoliza with the emission payload
    const { environment: _env, ...emissionData } = body;
    
    console.log(`[API FEDPA Carátula] ${requestId} POST ${CARATULA_ENDPOINT} con payload de emisión`);
    
    const response = await clientResult.client.postRaw(CARATULA_ENDPOINT, emissionData);
    
    const contentType = response.headers.get('content-type') || '';
    
    if (response.ok && contentType.includes('application/pdf')) {
      console.log(`[API FEDPA Carátula] ${requestId} ✅ PDF recibido (${response.headers.get('content-length') || '?'} bytes)`);
      
      const pdfBuffer = await response.arrayBuffer();
      
      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="caratula_${poliza}.pdf"`,
          'X-Request-Id': requestId,
        },
      });
    }
    
    // If not PDF, read body ONCE as text, then try to parse as JSON
    let errorMsg = `HTTP ${response.status}`;
    try {
      const textBody = await response.text();
      try {
        const errorData = JSON.parse(textBody);
        errorMsg = errorData.msg || errorData.message || errorData.error || errorMsg;
        console.error(`[API FEDPA Carátula] ${requestId} Error JSON:`, errorData);
      } catch {
        errorMsg = textBody.substring(0, 200) || errorMsg;
        console.error(`[API FEDPA Carátula] ${requestId} Error texto:`, errorMsg);
      }
    } catch (bodyErr: any) {
      console.error(`[API FEDPA Carátula] ${requestId} Could not read error body:`, bodyErr.message);
    }
    
    return NextResponse.json(
      {
        success: false,
        error: `Error obteniendo carátula: ${errorMsg}`,
        poliza,
        requestId,
      },
      { status: response.status || 400 }
    );
  } catch (error: any) {
    console.error(`[API FEDPA Carátula] ${requestId} Error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error obteniendo carátula', requestId },
      { status: 500 }
    );
  }
}

// Keep GET for backward compatibility — redirects to info message
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ poliza: string }> }
) {
  const { poliza } = await params;
  return NextResponse.json(
    {
      success: false,
      error: 'Use POST with the emission payload to get the carátula PDF. GET is not supported by FedPa.',
      poliza,
      hint: 'POST /api/fedpa/polizas/{poliza}/caratula with the same body used for emission.',
    },
    { status: 405 }
  );
}
