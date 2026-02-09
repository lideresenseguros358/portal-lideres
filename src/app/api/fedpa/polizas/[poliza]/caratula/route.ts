/**
 * Endpoint: Descargar Carátula PDF de Póliza FEDPA
 * GET /api/fedpa/polizas/{poliza}/caratula
 * 
 * Intenta obtener el PDF desde FEDPA Swagger.
 * Si no existe endpoint en FEDPA, devuelve error CARATULA_ENDPOINT_NOT_FOUND_IN_SWAGGER.
 */

import { NextRequest, NextResponse } from 'next/server';
import { obtenerClienteAutenticado } from '@/lib/fedpa/auth.service';
import type { FedpaEnvironment } from '@/lib/fedpa/config';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ poliza: string }> }
) {
  const requestId = `car-${Date.now().toString(36)}`;
  
  try {
    const { poliza } = await params;
    const { searchParams } = new URL(request.url);
    const environment = (searchParams.get('environment') || 'PROD') as FedpaEnvironment;
    
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
    
    // Intentar endpoint de carátula en FEDPA
    // Posibles rutas según Swagger: /api/caratula/{nroPoliza}, /api/poliza/caratula/{nroPoliza}
    const possibleEndpoints = [
      `/api/caratula/${poliza}`,
      `/api/poliza/caratula/${poliza}`,
      `/api/polizas/caratula/${poliza}`,
      `/api/emitirpoliza/caratula/${poliza}`,
    ];
    
    for (const endpoint of possibleEndpoints) {
      try {
        console.log(`[API FEDPA Carátula] ${requestId} Probando endpoint: ${endpoint}`);
        
        const response = await clientResult.client.getRaw(endpoint);
        
        if (response && response.ok) {
          const contentType = response.headers.get('content-type') || '';
          
          if (contentType.includes('application/pdf')) {
            console.log(`[API FEDPA Carátula] ${requestId} PDF encontrado en ${endpoint}`);
            
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
        }
      } catch {
        // Endpoint no existe, probar siguiente
        continue;
      }
    }
    
    // Ningún endpoint devolvió PDF
    console.warn(`[API FEDPA Carátula] ${requestId} No se encontró endpoint de carátula en FEDPA Swagger`);
    
    return NextResponse.json(
      {
        success: false,
        code: 'CARATULA_ENDPOINT_NOT_FOUND_IN_SWAGGER',
        error: `No se encontró endpoint de carátula PDF en FEDPA para la póliza ${poliza}. Contacte a FEDPA para verificar disponibilidad.`,
        poliza,
        requestId,
        hint: 'Este endpoint puede no estar disponible en la versión actual de la API FEDPA.',
      },
      { status: 404 }
    );
  } catch (error: any) {
    console.error(`[API FEDPA Carátula] ${requestId} Error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error obteniendo carátula', requestId },
      { status: 500 }
    );
  }
}
