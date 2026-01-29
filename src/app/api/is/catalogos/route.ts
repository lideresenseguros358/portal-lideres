/**
 * API Route: Catálogos IS (Internacional de Seguros)
 * GET /api/is/catalogos
 * Obtiene todos los catálogos desde IS usando GET
 */

import { NextRequest, NextResponse } from 'next/server';
import { obtenerTodosCatalogos } from '@/lib/is/catalogs.service';
import type { ISEnvironment } from '@/lib/is/config';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    console.log('[API IS Catálogos] Petición recibida');

    const { searchParams } = new URL(request.url);
    const env = (searchParams.get('env') as ISEnvironment) || 'development';

    const result = await obtenerTodosCatalogos(env);

    if (!result.success) {
      console.error('[API IS Catálogos] Error:', result.error);
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || 'Error obteniendo catálogos' 
        },
        { status: 500 }
      );
    }

    console.log('[API IS Catálogos] Catálogos obtenidos exitosamente');
    
    return NextResponse.json({
      success: true,
      data: result.data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[API IS Catálogos] Error no manejado:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error interno del servidor' 
      },
      { status: 500 }
    );
  }
}
