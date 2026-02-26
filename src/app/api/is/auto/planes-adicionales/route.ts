/**
 * API Endpoint: Obtener planes adicionales (endosos) de IS
 * GET /api/is/auto/planes-adicionales?tipoPlan=14&env=development
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPlanesAdicionales } from '@/lib/is/catalogs.service';
import { ISEnvironment } from '@/lib/is/config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tipoPlan = searchParams.get('tipoPlan') || undefined;
    const env = (searchParams.get('env') || 'development') as ISEnvironment;

    console.log('[IS Planes Adicionales] Consultando...', { tipoPlan, env });

    const planes = await getPlanesAdicionales(tipoPlan, env);

    console.log('[IS Planes Adicionales] Resultado:', JSON.stringify(planes).substring(0, 1000));

    return NextResponse.json({
      success: true,
      data: planes,
      count: Array.isArray(planes) ? planes.length : 0,
    });
  } catch (error: any) {
    console.error('[IS Planes Adicionales] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
