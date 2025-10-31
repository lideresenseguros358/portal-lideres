/**
 * Endpoint: Obtener Número de Póliza FEDPA
 * GET /api/fedpa/poliza
 */

import { NextRequest, NextResponse } from 'next/server';
import { obtenerNumeroPoliza } from '@/lib/fedpa/emision.service';
import type { FedpaEnvironment } from '@/lib/fedpa/config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const environment = searchParams.get('environment') || 'PROD';
    
    const env = environment as FedpaEnvironment;
    const result = await obtenerNumeroPoliza(env);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      nroPoliza: result.nroPoliza,
      message: 'Número de póliza obtenido exitosamente',
    });
  } catch (error: any) {
    console.error('[API FEDPA Póliza] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error obteniendo número de póliza' },
      { status: 500 }
    );
  }
}
