/**
 * API Endpoint: Generar cotización Auto
 * POST /api/is/auto/quote
 */

import { NextRequest, NextResponse } from 'next/server';
import { generarCotizacionAuto } from '@/lib/is/quotes.service';
import { ISEnvironment } from '@/lib/is/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { environment = 'development', ...formData } = body;
    
    console.log('[IS Quotes] Generando cotización...', {
      marca: formData.vcodmarca,
      modelo: formData.vcodmodelo,
      valor: formData.vsumaaseg
    });
    
    // Validaciones básicas - usar datos directos sin normalización
    if (!formData.vnrodoc || !formData.vnombre || !formData.vapellido || !formData.vcorreo) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos del cliente' },
        { status: 400 }
      );
    }
    
    if (!formData.vcodmarca || !formData.vcodmodelo || !formData.vanioauto) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos del vehículo' },
        { status: 400 }
      );
    }
    
    if (!formData.vcodplancobertura || !formData.vcodgrupotarifa) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos de cobertura' },
        { status: 400 }
      );
    }
    
    // Generar cotización usando datos directos de IS (sin normalización a FEDPA)
    const result = await generarCotizacionAuto(
      {
        vcodtipodoc: formData.vcodtipodoc || 1, // 1=CC por defecto
        vnrodoc: formData.vnrodoc,
        vnombre: formData.vnombre,
        vapellido: formData.vapellido,
        vtelefono: formData.vtelefono,
        vcorreo: formData.vcorreo,
        vcodmarca: formData.vcodmarca,
        vcodmodelo: formData.vcodmodelo,
        vanioauto: formData.vanioauto,
        vsumaaseg: formData.vsumaaseg || 0,
        vcodplancobertura: formData.vcodplancobertura,
        vcodgrupotarifa: formData.vcodgrupotarifa,
      },
      environment as ISEnvironment
    );
    
    if (!result.success || !result.idCotizacion) {
      return NextResponse.json(
        { success: false, error: result.error || 'Error al generar cotización' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      idCotizacion: result.idCotizacion,
    });
    
  } catch (error: any) {
    console.error('[API IS Auto Quote] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}
