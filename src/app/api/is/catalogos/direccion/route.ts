/**
 * GET /api/is/catalogos/direccion?tipo=provincias&codpais=1
 * GET /api/is/catalogos/direccion?tipo=distritos&codpais=1&codprovincia=8
 * GET /api/is/catalogos/direccion?tipo=corregimientos&codpais=1&codprovincia=8&coddistrito=1&nomdistrito=PANAMA
 * GET /api/is/catalogos/direccion?tipo=urbanizaciones&page=1&size=5000
 *
 * Cascading address catalog fetcher for IS emission.
 * Uses IS API as primary source; falls back to static catalogs when
 * the API fails or returns empty results (does not affect ANCON/Regional/FEDPA).
 */

import { NextRequest, NextResponse } from 'next/server';
import { isGet } from '@/lib/is/http-client';
import { IS_ENDPOINTS, type ISEnvironment, getISDefaultEnv } from '@/lib/is/config';
import { URBANIZACIONES_FALLBACK } from '@/lib/is/urbanizaciones-fallback';
import { PROVINCIAS_FALLBACK } from '@/lib/is/provincias-fallback';
import { DISTRITOS_POR_PROVINCIA } from '@/lib/is/distritos-fallback';
import { CORREGIMIENTOS_POR_NOMBRE } from '@/lib/is/corregimientos-fallback';

// In-memory cache for address catalogs (24h TTL — these rarely change)
const addressCache = new Map<string, { data: any; exp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

/** Normaliza un array raw del API IS a { DATO, TEXTO }.
 *  Intenta múltiples variantes de nombre de campo por si el API cambia. */
function normalizeDistritos(rawData: any[]): { DATO: number; TEXTO: string }[] {
  return rawData
    .map((r: any) => {
      const dato = r.codigoDistrito ?? r.codDistrito ?? r.codigo ?? r.id;
      const texto = r.nombreDistrito ?? r.nomDistrito ?? r.nombre ?? r.descripcion ?? '';
      return { DATO: dato != null ? Number(dato) : NaN, TEXTO: String(texto).trim() };
    })
    .filter(r => !isNaN(r.DATO) && r.TEXTO.length > 0 && r.TEXTO !== 'NO' && r.TEXTO !== 'NO USA');
}

function normalizeCorregimientos(rawData: any[]): { DATO: number; TEXTO: string }[] {
  return rawData
    .map((r: any) => {
      const dato = r.codigoCorregimiento ?? r.codCorregimiento ?? r.codigo ?? r.id;
      const texto = r.nombreCorregimiento ?? r.nomCorregimiento ?? r.nombre ?? r.descripcion ?? '';
      return { DATO: dato != null ? Number(dato) : NaN, TEXTO: String(texto).trim() };
    })
    .filter(r => !isNaN(r.DATO) && r.TEXTO.length > 0);
}

/** Devuelve fallback de corregimientos por nombre de distrito (case-insensitive).
 *  Funciona independientemente de qué código uso el API IS para el distrito. */
function getCorregimientosFallback(
  codProvincia: number,
  nomDistrito: string,
): { DATO: number; TEXTO: string }[] | null {
  const byProv = CORREGIMIENTOS_POR_NOMBRE[codProvincia];
  if (!byProv) return null;

  const key = nomDistrito.toUpperCase().trim();
  // Exact match first
  if (byProv[key]) return byProv[key];
  // Partial match (handles accents mismatches like "ANTÓN" vs "ANTON")
  const found = Object.keys(byProv).find(k =>
    k.normalize('NFD').replace(/[\u0300-\u036f]/g, '') ===
    key.normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
  );
  return found ? (byProv[found] ?? null) : null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo');
    const env = (searchParams.get('env') || getISDefaultEnv()) as ISEnvironment;

    let endpoint = '';

    switch (tipo) {
      case 'provincias': {
        const sorted = [...PROVINCIAS_FALLBACK].sort((a, b) => a.TEXTO.localeCompare(b.TEXTO, 'es'));
        return NextResponse.json({ success: true, data: sorted, source: 'fallback' });
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
        const sorted = [...URBANIZACIONES_FALLBACK].sort((a, b) => a.TEXTO.localeCompare(b.TEXTO, 'es'));
        return NextResponse.json({ success: true, data: sorted, source: 'fallback' });
      }
      default:
        return NextResponse.json(
          { error: 'tipo inválido. Usar: provincias, distritos, corregimientos, urbanizaciones' },
          { status: 400 },
        );
    }

    // Check in-memory cache first
    const cacheKey = `${env}:${endpoint}`;
    const cached = addressCache.get(cacheKey);
    if (cached && cached.exp > Date.now()) {
      return NextResponse.json({ success: true, data: cached.data, source: 'cache' });
    }

    console.log(`[IS Catálogos Dirección] tipo=${tipo} endpoint=${endpoint}`);
    const response = await isGet<{ Table: any[] }>(endpoint, env);

    // ── Handle IS API failure ─────────────────────────────────────────────
    if (!response.success) {
      if (tipo === 'distritos') {
        const codprovincia = parseInt(searchParams.get('codprovincia') || '0');
        const fallback = DISTRITOS_POR_PROVINCIA[codprovincia];
        if (fallback?.length) {
          const sorted = [...fallback].sort((a, b) => a.TEXTO.localeCompare(b.TEXTO, 'es'));
          return NextResponse.json({ success: true, data: sorted, source: 'fallback' });
        }
      }
      if (tipo === 'corregimientos') {
        const codprovincia = parseInt(searchParams.get('codprovincia') || '0');
        const nomDistrito = searchParams.get('nomdistrito') || '';
        const fallback = getCorregimientosFallback(codprovincia, nomDistrito);
        if (fallback?.length) {
          const sorted = [...fallback].sort((a, b) => a.TEXTO.localeCompare(b.TEXTO, 'es'));
          return NextResponse.json({ success: true, data: sorted, source: 'fallback' });
        }
      }
      return NextResponse.json({ error: response.error || 'Error consultando catálogo' }, { status: 500 });
    }

    const rawData: any[] = (response.data?.Table || response.data || []) as any[];

    // ── Normalize IS API response ─────────────────────────────────────────
    let normalized: { DATO: number; TEXTO: string }[] = [];
    switch (tipo) {
      case 'distritos':
        normalized = normalizeDistritos(rawData);
        break;
      case 'corregimientos':
        normalized = normalizeCorregimientos(rawData);
        break;
      default:
        normalized = rawData;
    }

    // ── If IS API returned empty, use static fallback ─────────────────────
    if (normalized.length === 0) {
      if (tipo === 'distritos') {
        const codprovincia = parseInt(searchParams.get('codprovincia') || '0');
        const fallback = DISTRITOS_POR_PROVINCIA[codprovincia];
        if (fallback?.length) {
          const sorted = [...fallback].sort((a, b) => a.TEXTO.localeCompare(b.TEXTO, 'es'));
          return NextResponse.json({ success: true, data: sorted, source: 'fallback' });
        }
      }
      if (tipo === 'corregimientos') {
        const codprovincia = parseInt(searchParams.get('codprovincia') || '0');
        const nomDistrito = searchParams.get('nomdistrito') || '';
        const fallback = getCorregimientosFallback(codprovincia, nomDistrito);
        if (fallback?.length) {
          const sorted = [...fallback].sort((a, b) => a.TEXTO.localeCompare(b.TEXTO, 'es'));
          return NextResponse.json({ success: true, data: sorted, source: 'fallback' });
        }
      }
    }

    normalized.sort((a, b) => a.TEXTO.localeCompare(b.TEXTO, 'es'));
    addressCache.set(cacheKey, { data: normalized, exp: Date.now() + CACHE_TTL });

    return NextResponse.json({ success: true, data: normalized });

  } catch (error: any) {
    console.error('[IS Catálogos Dirección] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
