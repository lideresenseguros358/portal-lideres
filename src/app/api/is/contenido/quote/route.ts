/**
 * API Endpoint: Generar cotización Contenido
 * POST /api/is/contenido/quote
 * 
 * ⚠️ PREPARADO PARA CONECTAR - Esperando API real de INTERNACIONAL
 */

import { NextRequest, NextResponse } from 'next/server';
import { cotizarContenido } from '@/lib/is/optiseguro.service';
import { ISEnvironment } from '@/lib/is/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      // Cliente
      vcodtipodoc,
      vnrodoc,
      vnombre,
      vapellido,
      vtelefono,
      vcorreo,
      // Inmueble
      direccion,
      tipo_inmueble,
      suma_asegurada,
      descripcion_contenido,
      // Config
      environment = 'development',
    } = body;
    
    // Validaciones básicas
    if (!vnrodoc || !vnombre || !vapellido) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos del cliente' },
        { status: 400 }
      );
    }
    
    if (!direccion || !suma_asegurada) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos del inmueble' },
        { status: 400 }
      );
    }
    
    // Generar cotización
    const result = await cotizarContenido(
      {
        vcodtipodoc: parseInt(vcodtipodoc as string) || 1,
        vnrodoc,
        vnombre,
        vapellido,
        vtelefono,
        vcorreo,
        direccion,
        tipo_inmueble: tipo_inmueble || 'casa',
        suma_asegurada: parseFloat(suma_asegurada),
        descripcion_contenido,
      },
      environment as ISEnvironment
    );
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Error al generar cotización' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      idCotizacion: result.idCotizacion,
      primaTotal: result.primaTotal,
    });
    
  } catch (error: any) {
    console.error('[API IS Contenido Quote] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}
