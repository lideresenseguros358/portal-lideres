/**
 * API Endpoint: Get ANCON Productos (product codes)
 * GET /api/ancon/productos?type=all&ramo=002
 *
 * Returns list of products from ListaProductos SOAP API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProductos } from '@/lib/ancon/catalogs.service';

export const revalidate = 3600; // 1 hour

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ramo = searchParams.get('ramo') || '002'; // Default to AUTOMOVIL

    const result = await getProductos();

    if (!result.success || !result.data) {
      return NextResponse.json(
        { success: false, error: result.error || 'Error loading productos' },
        { status: 500 }
      );
    }

    // Filter by ramo if requested (ramo 002 = AUTOMOVIL)
    const filtered = ramo
      ? result.data.filter(p => p.codigo_ramo === ramo)
      : result.data;

    return NextResponse.json({
      success: true,
      data: filtered.map(p => ({
        codigo_producto: p.codigo_producto,
        nombre_producto: p.nombre_producto,
        codigo_ramo: p.codigo_ramo,
        nombre_ramo: p.nombre_ramo,
        codigo_subramo: p.codigo_subramo,
        nombre_subramo: p.nombre_subramo,
      })),
      count: filtered.length,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[API ANCON Productos] Error:', msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
