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
import { URBANIZACIONES_FALLBACK } from '@/lib/is/urbanizaciones-fallback';

// In-memory cache for address catalogs (24h TTL — these rarely change)
const addressCache = new Map<string, { data: any; exp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

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
        // IS tester API siempre retorna 401 para urbanizaciones.
        // Usar fallback local directamente para evitar ciclos de token innecesarios.
        return NextResponse.json({ success: true, data: URBANIZACIONES_FALLBACK, source: 'fallback' });
      }
      default:
        return NextResponse.json({ error: 'tipo inválido. Usar: provincias, distritos, corregimientos, urbanizaciones' }, { status: 400 });
    }

    // Check in-memory cache first
    const cacheKey = `${env}:${endpoint}`;
    const cached = addressCache.get(cacheKey);
    if (cached && cached.exp > Date.now()) {
      console.log(`[IS Catálogos Dirección] ⚡ Cache hit: tipo=${tipo}`);
      return NextResponse.json({ success: true, data: cached.data, source: 'cache' });
    }

    console.log(`[IS Catálogos Dirección] tipo=${tipo} endpoint=${endpoint}`);
    const response = await isGet<{ Table: any[] }>(endpoint, env);

    if (!response.success) {
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
      default:
        normalized = rawData;
    }

    // Store in cache for subsequent requests
    addressCache.set(cacheKey, { data: normalized, exp: Date.now() + CACHE_TTL });

    return NextResponse.json({
      success: true,
      data: normalized,
    });

  } catch (error: any) {
    console.error('[IS Catálogos Dirección] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
