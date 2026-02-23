/**
 * GET /api/is/catalogos/direccion?tipo=provincias&codpais=1
 * GET /api/is/catalogos/direccion?tipo=distritos&codpais=1&codprovincia=8
 * GET /api/is/catalogos/direccion?tipo=corregimientos&codpais=1&codprovincia=8&coddistrito=1
 * GET /api/is/catalogos/direccion?tipo=urbanizaciones&page=1&size=5000
 * 
 * Cascading address catalog fetcher for IS emission
 */

import { NextRequest, NextResponse } from 'next/server';
import { isGet } from '@/lib/is/http-client';
import { IS_ENDPOINTS, type ISEnvironment } from '@/lib/is/config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo');
    const env = (searchParams.get('env') || 'development') as ISEnvironment;

    let endpoint = '';

    switch (tipo) {
      case 'provincias': {
        const codpais = searchParams.get('codpais') || '1';
        endpoint = `${IS_ENDPOINTS.PROVINCIAS}/${codpais}`;
        break;
      }
      case 'distritos': {
        const codpais = searchParams.get('codpais') || '1';
        const codprovincia = searchParams.get('codprovincia');
        if (!codprovincia) {
          return NextResponse.json({ error: 'codprovincia requerido' }, { status: 400 });
        }
        endpoint = `${IS_ENDPOINTS.DISTRITOS}/${codpais}/${codprovincia}`;
        break;
      }
      case 'corregimientos': {
        const codpais = searchParams.get('codpais') || '1';
        const codprovincia = searchParams.get('codprovincia');
        const coddistrito = searchParams.get('coddistrito');
        if (!codprovincia || !coddistrito) {
          return NextResponse.json({ error: 'codprovincia y coddistrito requeridos' }, { status: 400 });
        }
        endpoint = `${IS_ENDPOINTS.CORREGIMIENTOS}/${codpais}/${codprovincia}/${coddistrito}`;
        break;
      }
      case 'urbanizaciones': {
        const page = searchParams.get('page') || '1';
        const size = searchParams.get('size') || '5000';
        endpoint = `${IS_ENDPOINTS.URBANIZACIONES}/${page}/${size}`;
        break;
      }
      default:
        return NextResponse.json({ error: 'tipo inválido. Usar: provincias, distritos, corregimientos, urbanizaciones' }, { status: 400 });
    }

    const response = await isGet<{ Table: any[] }>(endpoint, env);

    if (!response.success) {
      // Urbanizaciones es opcional — si falla (ej: 401 persistente), retornar array vacío en vez de 500
      if (tipo === 'urbanizaciones') {
        console.warn('[IS Catálogos Dirección] Urbanizaciones no disponible (IS retornó error). Retornando lista vacía.');
        return NextResponse.json({ success: true, data: [], warning: 'Catálogo de urbanizaciones no disponible temporalmente' });
      }
      return NextResponse.json({ error: response.error || 'Error consultando catálogo' }, { status: 500 });
    }

    const rawData: any[] = (response.data?.Table || response.data || []) as any[];

    // Normalizar a formato consistente { DATO: number, TEXTO: string }
    // IS retorna campos diferentes por tipo de catálogo
    let normalized: { DATO: number; TEXTO: string }[] = [];
    switch (tipo) {
      case 'provincias':
        normalized = rawData.map((r: any) => ({ DATO: r.codigoProvincia, TEXTO: r.nombreProvincia }));
        break;
      case 'distritos':
        normalized = rawData
          .filter((r: any) => r.nombreDistrito && r.nombreDistrito !== 'NO' && r.nombreDistrito !== 'NO USA')
          .map((r: any) => ({ DATO: r.codigoDistrito, TEXTO: r.nombreDistrito }));
        break;
      case 'corregimientos':
        normalized = rawData.map((r: any) => ({ DATO: r.codigoCorregimiento, TEXTO: r.nombreCorregimiento }));
        break;
      case 'urbanizaciones':
        normalized = rawData.map((r: any) => ({ DATO: r.codigoUrbanizacion || r.DATO || 0, TEXTO: r.nombreUrbanizacion || r.TEXTO || '' }));
        break;
      default:
        normalized = rawData;
    }

    return NextResponse.json({
      success: true,
      data: normalized,
    });

  } catch (error: any) {
    console.error('[IS Catálogos Dirección] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
