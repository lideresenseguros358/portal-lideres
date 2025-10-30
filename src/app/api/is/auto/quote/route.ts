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
    
    const {
      // Cliente
      vcodtipodoc,
      vnrodoc,
      vnombre,
      vapellido,
      vtelefono,
      vcorreo,
      // Vehículo
      vcodmarca,
      vcodmodelo,
      vanioauto,
      // Cobertura
      vsumaaseg,
      vcodplancobertura,
      vcodgrupotarifa,
      // Config
      environment = 'development',
    } = body;
    
    // Validaciones
    if (!vnrodoc || !vnombre || !vapellido || !vcorreo) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos del cliente' },
        { status: 400 }
      );
    }
    
    if (!vcodmarca || !vcodmodelo || !vanioauto) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos del vehículo' },
        { status: 400 }
      );
    }
    
    if (!vcodplancobertura || !vcodgrupotarifa) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos de cobertura' },
        { status: 400 }
      );
    }
    
    // Generar cotización
    const result = await generarCotizacionAuto(
      {
        vcodtipodoc: vcodtipodoc || 'CED',
        vnrodoc,
        vnombre,
        vapellido,
        vtelefono,
        vcorreo,
        vcodmarca,
        vcodmodelo,
        vanioauto: parseInt(vanioauto),
        vsumaaseg: parseFloat(vsumaaseg) || 0,
        vcodplancobertura,
        vcodgrupotarifa,
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
