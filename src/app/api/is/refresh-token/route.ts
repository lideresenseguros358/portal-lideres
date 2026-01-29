/**
 * Endpoint para renovar token diario de IS
 * GET /api/is/refresh-token?env=development|production
 * 
 * ⚠️ NOTA: Este endpoint ahora usa token-manager.ts
 * Se mantiene para compatibilidad y debugging manual
 */

import { NextRequest, NextResponse } from 'next/server';
import { invalidateToken, getDailyTokenWithRetry } from '@/lib/is/token-manager';
import { ISEnvironment } from '@/lib/is/config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const env = (searchParams.get('env') as ISEnvironment) || 'development';
    
    console.log(`[Token API] Renovando token diario para ${env}...`);
    
    // Invalidar cache actual
    invalidateToken(env);
    
    // Obtener nuevo token
    const newToken = await getDailyTokenWithRetry(env);
    
    if (!newToken) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo obtener token diario',
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Token renovado exitosamente',
      environment: env,
      tokenPreview: newToken.substring(0, 30) + '...',
    });
    
  } catch (error: any) {
    console.error('[Token API] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
