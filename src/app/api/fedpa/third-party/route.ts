/**
 * API Endpoint: Planes de Daños a Terceros FEDPA en Tiempo Real
 * GET /api/fedpa/third-party
 */

import { NextRequest, NextResponse } from 'next/server';
import { obtenerPlanesDanosTercerosConCache } from '@/lib/services/fedpa-third-party';

export async function GET(request: NextRequest) {
  try {
    console.log('[API FEDPA Third Party] Obteniendo planes...');

    const resultado = await obtenerPlanesDanosTercerosConCache();

    if (!resultado.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: resultado.error || 'Error obteniendo planes' 
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      plans: resultado.plans,
      count: resultado.plans.length,
      source: 'FEDPA API',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API FEDPA Third Party] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Error interno del servidor' 
      },
      { status: 500 }
    );
  }
}
