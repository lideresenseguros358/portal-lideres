/**
 * API: Reset FEDPA Token Cache
 * POST /api/fedpa/auth/reset
 * Limpia el cache de tokens para forzar regeneración
 */

import { NextResponse } from 'next/server';
import { limpiarCacheTokens, generarToken } from '@/lib/fedpa/auth.service';
import type { FedpaEnvironment } from '@/lib/fedpa/config';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const env = (body.environment || 'DEV') as FedpaEnvironment;

    // Limpiar cache local
    limpiarCacheTokens();
    console.log('[FEDPA Auth Reset] Cache limpiado. Intentando generar nuevo token...');

    // Intentar generar nuevo token
    const result = await generarToken(env);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Token regenerado exitosamente',
        hasToken: true,
      });
    }

    return NextResponse.json({
      success: false,
      message: result.error || 'No se pudo regenerar el token. FEDPA puede tener un token activo que expirará en ~50 min.',
      hint: 'Si el problema persiste, espere unos minutos e intente de nuevo.',
    }, { status: 503 });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
