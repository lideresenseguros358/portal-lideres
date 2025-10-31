/**
 * Endpoint: Generar/Renovar Token FEDPA
 * POST /api/fedpa/auth/token
 */

import { NextRequest, NextResponse } from 'next/server';
import { generarToken, renovarToken, obtenerToken } from '@/lib/fedpa/auth.service';
import type { FedpaEnvironment } from '@/lib/fedpa/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action = 'get', environment = 'PROD' } = body;
    
    const env = environment as FedpaEnvironment;
    
    let result;
    
    switch (action) {
      case 'generate':
        result = await generarToken(env);
        break;
      case 'renew':
        result = await renovarToken(env);
        break;
      case 'get':
      default:
        result = await obtenerToken(env);
        break;
    }
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      token: result.token,
      message: `Token ${action === 'renew' ? 'renovado' : 'obtenido'} exitosamente`,
    });
  } catch (error: any) {
    console.error('[API FEDPA Auth] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error generando token' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const environment = searchParams.get('environment') || 'PROD';
    
    const env = environment as FedpaEnvironment;
    const result = await obtenerToken(env);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      token: result.token,
    });
  } catch (error: any) {
    console.error('[API FEDPA Auth] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error obteniendo token' },
      { status: 500 }
    );
  }
}
