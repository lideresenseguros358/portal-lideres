/**
 * Endpoint: Obtener Planes FEDPA
 * GET /api/fedpa/planes
 */

import { NextRequest, NextResponse } from 'next/server';
import { obtenerPlanes, filtrarPlanesPorTipo } from '@/lib/fedpa/planes.service';
import type { FedpaEnvironment } from '@/lib/fedpa/config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const environment = searchParams.get('environment') || 'PROD';
    const tipo = searchParams.get('tipo'); // 'DAÑOS A TERCEROS' | 'COBERTURA COMPLETA'
    
    const env = environment as FedpaEnvironment;
    const result = await obtenerPlanes(env);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
    
    let planes = result.data || [];
    
    // Filtrar por tipo si se especifica
    if (tipo && planes.length > 0) {
      planes = filtrarPlanesPorTipo(planes, tipo as any);
    }
    
    return NextResponse.json({
      success: true,
      data: planes,
      count: planes.length,
    });
  } catch (error: any) {
    console.error('[API FEDPA Planes] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error obteniendo planes' },
      { status: 500 }
    );
  }
}
