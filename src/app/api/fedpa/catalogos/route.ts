/**
 * API Route: Catálogos FEDPA
 * GET /api/fedpa/catalogos
 * Obtiene todos los catálogos de FEDPA (limites, planes, beneficios, usos)
 */

import { NextRequest, NextResponse } from 'next/server';
import { obtenerTodosCatalogos } from '@/lib/fedpa/catalogs.service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    console.log('[API FEDPA Catálogos] Petición recibida');

    const { searchParams } = new URL(request.url);
    const env = (searchParams.get('env') as 'DEV' | 'PROD') || 'PROD';

    const result = await obtenerTodosCatalogos(env);

    if (!result.success) {
      console.error('[API FEDPA Catálogos] Error:', result.error);
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || 'Error obteniendo catálogos' 
        },
        { status: 500 }
      );
    }

    console.log('[API FEDPA Catálogos] Catálogos obtenidos exitosamente');
    
    return NextResponse.json({
      success: true,
      data: result.data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[API FEDPA Catálogos] Error no manejado:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error interno del servidor' 
      },
      { status: 500 }
    );
  }
}
