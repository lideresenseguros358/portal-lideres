/**
 * Endpoint: Obtener Límites FEDPA
 * GET /api/fedpa/limites
 */

import { NextRequest, NextResponse } from 'next/server';
import { obtenerLimites, obtenerUsos } from '@/lib/fedpa/catalogs.service';
import type { FedpaEnvironment } from '@/lib/fedpa/config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const environment = searchParams.get('environment') || 'PROD';
    const tipo = searchParams.get('tipo'); // 'limites' | 'usos'
    
    const env = environment as FedpaEnvironment;
    
    let result;
    
    if (tipo === 'usos') {
      result = await obtenerUsos(env);
    } else {
      result = await obtenerLimites(env);
    }
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: result.data || [],
      count: result.data?.length || 0,
    });
  } catch (error: any) {
    console.error('[API FEDPA Límites] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error obteniendo límites' },
      { status: 500 }
    );
  }
}
