/**
 * Endpoint: Obtener Planes FEDPA
 * GET /api/fedpa/planes
 */

import { NextRequest, NextResponse } from 'next/server';
import { obtenerPlanes, filtrarPlanesPorTipo } from '@/lib/fedpa/planes.service';
import type { FedpaEnvironment } from '@/lib/fedpa/config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const environment = searchParams.get('environment') || 'PROD';
    const tipo = searchParams.get('tipo'); // 'DAÑOS A TERCEROS' | 'COBERTURA COMPLETA'
    
    const env = environment as FedpaEnvironment;
    
    console.log('[API FEDPA Planes] Obteniendo planes (environment:', env, ', tipo solicitado:', tipo || 'todos', ')');
    
    const result = await obtenerPlanes(env);
    
    if (!result.success) {
      console.error('[API FEDPA Planes] Error obteniendo planes:', result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
    
    let planes = result.data || [];
    console.log('[API FEDPA Planes] Planes recibidos:', planes.length);
    
    // Filtrar por tipo si se especifica (filtrado del lado del cliente)
    if (tipo && planes.length > 0) {
      const tipoUpper = tipo.toUpperCase();
      // Normalizar: "COBERTURA COMPLETA" puede aparecer como "COBERTURA COMPLETA" o similar
      planes = planes.filter((plan: any) => {
        const planTipo = (plan.tipoplan || '').toUpperCase();
        // Match exacto o parcial
        return planTipo.includes(tipoUpper) || tipoUpper.includes(planTipo);
      });
      console.log('[API FEDPA Planes] Planes filtrados por tipo:', planes.length);
    }
    
    return NextResponse.json({
      success: true,
      data: planes,
      count: planes.length,
    });
  } catch (error: any) {
    console.error('[API FEDPA Planes] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error obteniendo planes' },
      { status: 500 }
    );
  }
}
