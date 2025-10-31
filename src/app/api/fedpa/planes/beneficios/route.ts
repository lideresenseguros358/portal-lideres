/**
 * Endpoint: Obtener Beneficios de un Plan FEDPA
 * GET /api/fedpa/planes/beneficios?plan=XXX
 */

import { NextRequest, NextResponse } from 'next/server';
import { obtenerBeneficios } from '@/lib/fedpa/planes.service';
import type { FedpaEnvironment } from '@/lib/fedpa/config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('plan');
    const environment = searchParams.get('environment') || 'PROD';
    
    if (!planId) {
      return NextResponse.json(
        { success: false, error: 'El parámetro plan es requerido' },
        { status: 400 }
      );
    }
    
    const env = environment as FedpaEnvironment;
    const result = await obtenerBeneficios(parseInt(planId), env);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      plan: result.plan,
      data: result.data || [],
      count: result.data?.length || 0,
    });
  } catch (error: any) {
    console.error('[API FEDPA Beneficios] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error obteniendo beneficios' },
      { status: 500 }
    );
  }
}
