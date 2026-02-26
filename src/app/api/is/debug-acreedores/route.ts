/**
 * TEMPORAL: Debug endpoint para extraer catálogo de acreedores de IS
 * Eliminar después de obtener los datos
 * 
 * GET /api/is/debug-acreedores
 * 
 * Tries multiple token strategies and probes all possible acreedor endpoints
 */

import { NextResponse } from 'next/server';
import { getISBaseUrl, getISPrimaryToken } from '@/lib/is/config';
import type { ISEnvironment } from '@/lib/is/config';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function tryWithToken(token: string, baseUrl: string, path: string): Promise<any> {
  const url = `${baseUrl}${path}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  });
  const text = await r.text();
  if (!r.ok || text.includes('Acceso denegado') || text.includes('unauthorized')) {
    return { ok: false, status: r.status, preview: text.substring(0, 150) };
  }
  try {
    return { ok: true, status: r.status, data: JSON.parse(text) };
  } catch {
    return { ok: true, status: r.status, data: text.substring(0, 500) };
  }
}

async function getTokens(baseUrl: string, primaryToken: string): Promise<string[]> {
  const tokens: string[] = [];

  // Strategy 1: POST /tokens → get daily token
  for (const method of ['POST', 'GET'] as const) {
    try {
      const r = await fetch(`${baseUrl}/tokens`, {
        method,
        headers: { Authorization: `Bearer ${primaryToken}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(12000),
      });
      const text = await r.text();
      const clean = text.trim().replace(/^"|"$/g, '');
      if (clean.startsWith('eyJ') && clean.split('.').length === 3 && clean !== primaryToken) {
        tokens.push(clean);
      }
    } catch {}
  }

  // Strategy 2: GET /tokens/diario
  try {
    const r = await fetch(`${baseUrl}/tokens/diario`, {
      headers: { Authorization: `Bearer ${primaryToken}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
    });
    const text = await r.text();
    const clean = text.trim().replace(/^"|"$/g, '');
    if (clean.startsWith('eyJ') && clean.split('.').length === 3 && clean !== primaryToken) {
      tokens.push(clean);
    }
  } catch {}

  // Strategy 3: GET /tokens/auto
  try {
    const r = await fetch(`${baseUrl}/tokens/auto`, {
      headers: { Authorization: `Bearer ${primaryToken}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
    });
    const text = await r.text();
    const clean = text.trim().replace(/^"|"$/g, '');
    if (clean.startsWith('eyJ') && clean.split('.').length === 3 && clean !== primaryToken) {
      tokens.push(clean);
    }
  } catch {}

  // Always include primary as last resort
  tokens.push(primaryToken);

  // Dedupe
  return [...new Set(tokens)];
}

export async function GET() {
  const env: ISEnvironment = 'development';
  let baseUrl: string;
  let primaryToken: string;

  try {
    baseUrl = getISBaseUrl(env).replace(/\/+$/, '');
    primaryToken = getISPrimaryToken(env);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  // Step 1: Get all possible tokens
  const tokens = await getTokens(baseUrl, primaryToken);

  // Step 2: For each token, probe acreedor-related endpoints
  const acreedorEndpoints = [
    '/catalogos/tipoconducto',
    '/catalogos/conducto',
    '/catalogos/conducto/1',
    '/catalogos/conducto/2',
    '/catalogos/conducto/3',
    '/catalogos/acreedores',
    '/catalogos/bancos',
    '/catalogos/entidadesfinancieras',
    '/cotizaemisorauto/gettipoconducto',
    '/cotizaemisorauto/getconducto',
    '/cotizaemisorauto/getconducto/1',
    '/cotizaemisorauto/getconducto/2',
    '/cotizaemisorauto/getconductores',
    '/cotizaemisorauto/getacreedores',
    '/cotizaemisorauto/getbancos',
    '/cotizaemisorauto/getentidadesfinancieras',
  ];

  const allResults: Record<string, any> = {};

  for (let ti = 0; ti < tokens.length; ti++) {
    const token = tokens[ti];
    const tokenLabel = ti === tokens.length - 1 ? 'primary' : `daily_${ti}`;
    
    // Quick test: does this token work at all?
    const test = await tryWithToken(token, baseUrl, '/catalogos/tipodocumentos');
    allResults[`_token_${tokenLabel}_test`] = test.ok ? 'WORKS' : `FAIL (${test.status})`;
    
    if (!test.ok) continue; // Skip this token

    for (const ep of acreedorEndpoints) {
      const result = await tryWithToken(token, baseUrl, ep);
      allResults[`${tokenLabel}:${ep}`] = result;
      if (result.ok) {
        // Found something! Mark it prominently
        allResults[`FOUND_${ep}`] = result.data;
      }
    }
    
    // If we found working data, no need to try other tokens
    if (Object.keys(allResults).some(k => k.startsWith('FOUND_'))) break;
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    environment: env,
    tokensFound: tokens.length,
    results: allResults,
  });
}
