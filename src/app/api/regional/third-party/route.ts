/**
 * API Endpoint: Planes de Daños a Terceros REGIONAL en Tiempo Real
 * GET /api/regional/third-party
 *
 * Fetches RC plans from REGIONAL API (/regional/auto/planesRc)
 * and quotes each plan via GET /regional/auto/cotizar/
 *
 * Plans mapping:
 * - Básico → SOAT Básico ($145)
 * - Premium → SOAT Plus ($162)
 *
 * Prices come from the API, NOT hardcoded.
 */

import { NextResponse } from 'next/server';
import { regionalGet } from '@/lib/regional/http-client';
import { REGIONAL_RC_ENDPOINTS, getRegionalCredentials } from '@/lib/regional/config';

// ── Cache (2 hours) + in-flight dedup ──
let cache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 2 * 60 * 60 * 1000;
let inflightPromise: Promise<any> | null = null;

// Fallback prices from REGIONAL documentation
const FALLBACK_BASIC_PRICE = 145.00;
const FALLBACK_PREMIUM_PRICE = 162.00;

interface PlanRC {
  codplan: string;
  descripcion: string;
  prima?: number;
  [key: string]: unknown;
}

/**
 * Fetch RC plans from REGIONAL API
 */
async function fetchPlanesRC(): Promise<PlanRC[]> {
  console.log('[REGIONAL Third Party] Fetching planesRc...');
  const res = await regionalGet<any>(REGIONAL_RC_ENDPOINTS.PLANES);

  if (!res.success) {
    console.warn('[REGIONAL Third Party] planesRc failed:', res.error);
    return [];
  }

  const data = res.data;
  // Response may be { items: [...] } or direct array
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && Array.isArray((data as any).items)) {
    return (data as any).items;
  }
  // Try to extract array from any key
  if (data && typeof data === 'object') {
    for (const key of Object.keys(data as Record<string, unknown>)) {
      if (Array.isArray((data as any)[key])) return (data as any)[key];
    }
  }
  return [];
}

/**
 * Quote a specific RC plan via GET /regional/auto/cotizar/
 */
async function cotizarPlanRC(
  endosoCode: string
): Promise<{ prima: number; numcot?: number; coberturas?: any[] } | null> {
  const creds = getRegionalCredentials('development');

  const params: Record<string, string> = {
    cToken: creds.token,
    cCodInter: creds.codInter,
    nEdad: '35',
    cSexo: 'M',
    cEdocivil: 'S',
    cMarca: '74',      // Reference brand (Hyundai-like code)
    cModelo: '1',       // Reference model
    nAnio: String(new Date().getFullYear()),
    nMontoVeh: '0',     // RC = 0
    nLesiones: '5000*10000',
    nDanios: '5000',
    cEndoso: endosoCode,
    cTipocobert: 'RC',
  };

  console.log(`[REGIONAL Third Party] Cotizando RC endoso=${endosoCode}...`);
  const res = await regionalGet<any>(REGIONAL_RC_ENDPOINTS.COTIZAR, params);

  if (!res.success) {
    console.warn(`[REGIONAL Third Party] RC quote failed endoso=${endosoCode}:`, res.error);
    return null;
  }

  const data = res.data || res.raw;
  console.log(`[REGIONAL Third Party] RC quote response endoso=${endosoCode}:`, JSON.stringify(data).slice(0, 500));

  if (!data || typeof data !== 'object') return null;

  const obj = data as Record<string, unknown>;
  const numcot = obj.numcot as number | undefined;
  const prima = (obj.primaTotal || obj.prima || obj.primatotal) as number | undefined;
  const coberturas = (obj.coberturas || obj.items) as any[] | undefined;

  if (prima && prima > 0) {
    return { prima, numcot, coberturas };
  }

  // Try to find prima in nested structure
  if (Array.isArray(coberturas) && coberturas.length > 0) {
    const total = coberturas.reduce((sum: number, c: any) => sum + (parseFloat(c.prima) || 0), 0);
    if (total > 0) return { prima: total, numcot, coberturas };
  }

  return null;
}

/**
 * Fetch endosos list to map names to codes
 */
async function fetchEndosos(): Promise<Map<string, string>> {
  const res = await regionalGet<any>('/regional/ws/endosos');
  const map = new Map<string, string>();

  let items: any[] = [];
  if (res.success) {
    const data = res.data;
    if (Array.isArray(data)) items = data;
    else if (data && typeof data === 'object' && Array.isArray((data as any).items)) {
      items = (data as any).items;
    }
  }

  for (const e of items) {
    const code = String(e.codendoso || e.codigo || e.cod || '');
    const desc = String(e.descripcion || e.descrip || e.nombre || '').toUpperCase();
    if (code) map.set(desc, code);
  }

  console.log('[REGIONAL Third Party] Endosos map:', Object.fromEntries(map));
  return map;
}

/** Core fetch logic */
async function fetchAllPlans() {
  console.log('[API REGIONAL Third Party] Fetching plans from REGIONAL API...');

  // 1. Get endosos to find the correct codes for BASICO and PLUS
  const endososMap = await fetchEndosos();
  const endosoBasico = endososMap.get('BASICO') || '1';
  const endosoPlus = endososMap.get('PLUS') || '2';

  console.log(`[REGIONAL Third Party] Endoso codes: BASICO=${endosoBasico}, PLUS=${endosoPlus}`);

  // 2. Get RC plans list
  const planes = await fetchPlanesRC();
  console.log(`[REGIONAL Third Party] RC plans found: ${planes.length}`, planes.map(p => `${p.codplan}:${p.descripcion}`));

  // 3. Quote both plans (BASICO endoso for Básico, PLUS endoso for Premium)
  const [basicResult, premiumResult] = await Promise.all([
    cotizarPlanRC(endosoBasico),
    cotizarPlanRC(endosoPlus),
  ]);

  // 4. Map plan descriptions from planes list
  const basicPlanInfo = planes.find(p =>
    (p.descripcion || '').toUpperCase().includes('BASICO') ||
    (p.descripcion || '').toUpperCase().includes('SOAT BAS')
  );
  const premiumPlanInfo = planes.find(p =>
    (p.descripcion || '').toUpperCase().includes('PLUS') ||
    (p.descripcion || '').toUpperCase().includes('SOAT PLUS')
  );

  const result = {
    success: true,
    source: 'REGIONAL API (planesRc + cotizar)',
    timestamp: new Date().toISOString(),
    plans: [
      {
        planType: 'basic',
        name: 'Plan Básico',
        apiName: basicPlanInfo?.descripcion || 'Soat Basico',
        codplan: basicPlanInfo?.codplan || '',
        endosoCode: endosoBasico,
        annualPremium: basicResult
          ? Math.round(basicResult.prima * 100) / 100
          : FALLBACK_BASIC_PRICE,
        fromApi: !!basicResult,
        numcot: basicResult?.numcot || null,
        coberturas: basicResult?.coberturas || [],
        installments: { available: false, description: 'Solo al contado' },
      },
      {
        planType: 'premium',
        name: 'Plan Premium',
        apiName: premiumPlanInfo?.descripcion || 'Soat Plus',
        codplan: premiumPlanInfo?.codplan || '',
        endosoCode: endosoPlus,
        annualPremium: premiumResult
          ? Math.round(premiumResult.prima * 100) / 100
          : FALLBACK_PREMIUM_PRICE,
        fromApi: !!premiumResult,
        numcot: premiumResult?.numcot || null,
        coberturas: premiumResult?.coberturas || [],
        installments: { available: false, description: 'Solo al contado' },
      },
    ],
    endososMap: Object.fromEntries(endososMap),
    planesRC: planes,
  };

  // Cache for 2 hours
  cache = { data: result, timestamp: Date.now() };
  console.log(
    `[API REGIONAL Third Party] ✅ Básico: $${result.plans[0]?.annualPremium} | Premium: $${result.plans[1]?.annualPremium}`
  );

  return result;
}

export async function GET() {
  try {
    // 1. Return cache if fresh
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      console.log('[API REGIONAL Third Party] Usando cache');
      return NextResponse.json(cache.data);
    }

    // 2. Dedup
    if (inflightPromise) {
      console.log('[API REGIONAL Third Party] Esperando request en vuelo...');
      const data = await inflightPromise;
      return NextResponse.json(data);
    }

    // 3. Fetch and dedup
    inflightPromise = fetchAllPlans().finally(() => {
      inflightPromise = null;
    });
    const data = await inflightPromise;
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[API REGIONAL Third Party] Error:', error);
    return NextResponse.json({
      success: true,
      source: 'fallback',
      timestamp: new Date().toISOString(),
      plans: [
        {
          planType: 'basic',
          name: 'Plan Básico',
          apiName: 'Soat Basico',
          annualPremium: FALLBACK_BASIC_PRICE,
          fromApi: false,
          coberturas: [],
          installments: { available: false, description: 'Solo al contado' },
        },
        {
          planType: 'premium',
          name: 'Plan Premium',
          apiName: 'Soat Plus',
          annualPremium: FALLBACK_PREMIUM_PRICE,
          fromApi: false,
          coberturas: [],
          installments: { available: false, description: 'Solo al contado' },
        },
      ],
    });
  }
}
