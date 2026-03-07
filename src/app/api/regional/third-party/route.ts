/**
 * API Endpoint: Planes de Daños a Terceros REGIONAL en Tiempo Real
 * GET /api/regional/third-party
 *
 * Fetches RC plans from REGIONAL API (/regional/auto/planesRc)
 * which returns COBERTURAS and BENEFICIOS per plan.
 *
 * Plans mapping:
 * - CODPLAN 30 = "SOAT BASICO" → Plan Básico ($145)
 * - CODPLAN 31 = "SOAT PLUS"   → Plan Premium ($162)
 */

import { NextResponse } from 'next/server';
import { regionalGet } from '@/lib/regional/http-client';
import { REGIONAL_RC_ENDPOINTS } from '@/lib/regional/config';

// ── Cache (2 hours) + in-flight dedup ──
let cache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 2 * 60 * 60 * 1000;
let inflightPromise: Promise<any> | null = null;

// Fallback prices from REGIONAL documentation
const FALLBACK_BASIC_PRICE = 145.00;
const FALLBACK_PREMIUM_PRICE = 162.00;

// Target plan codes
const PLAN_BASICO_CODE = '30';
const PLAN_PLUS_CODE = '31';

// ── Hardcoded coverages & benefits (planesRc endpoint is unreliable) ──
const REGIONAL_BASIC_COVERAGES = [
  { code: 'LC', name: 'Lesiones Corporales', limit: '$5,000.00 / $10,000.00', prima: 0 },
  { code: 'DPA', name: 'Daños a la Propiedad Ajena', limit: '$5,000.00', prima: 0 },
];
const REGIONAL_PREMIUM_COVERAGES = [
  { code: 'LC', name: 'Lesiones Corporales', limit: '$10,000.00 / $20,000.00', prima: 0 },
  { code: 'DPA', name: 'Daños a la Propiedad Ajena', limit: '$10,000.00', prima: 0 },
  { code: 'GM', name: 'Gastos Médicos', limit: '$500.00 / $2,500.00', prima: 0 },
];
const REGIONAL_BASIC_BENEFITS: string[] = [
  'Coordinación de envío de ambulancia por accidente de tránsito',
  'Inspección "in situ"',
  'Transmisión de mensajes urgentes',
];
const REGIONAL_PREMIUM_BENEFITS: string[] = [
  'Asistencia legal en accidentes de tránsito',
  'Coordinación de envío de ambulancia por accidente de tránsito',
  'Asistencia vial: cambio de llanta, envío de combustible, pase de corriente (hasta B/.150, máx. 3 eventos/año)',
  'Cerrajería vial (hasta B/.150, máx. 3 eventos/año)',
  'Grúa por accidente o desperfectos mecánicos (hasta B/.150, máx. 3 eventos/año)',
  'Transmisión de mensajes urgentes',
  'Inspección "in situ"',
  'Depósito y custodia de vehículos',
];

/**
 * Fetch all RC plans from REGIONAL API (includes COBERTURAS + BENEFICIOS)
 */
async function fetchPlanesRC(): Promise<any[]> {
  console.log('[REGIONAL Third Party] Fetching planesRc...');
  const res = await regionalGet<any>(REGIONAL_RC_ENDPOINTS.PLANES);

  if (!res.success) {
    console.warn('[REGIONAL Third Party] planesRc failed:', res.error);
    return [];
  }

  let data = res.data || res.raw;

  // If data is a string (bare JSON like "PLANES":[...]), try wrapping in {} and re-parsing
  if (typeof data === 'string') {
    const str = (data as string).trim();
    try {
      data = JSON.parse(str.startsWith('{') ? str : `{${str}}`);
    } catch {
      // Try extracting array from string
      const match = str.match(/\[[\s\S]*\]/);
      if (match) {
        try { return JSON.parse(match[0]); } catch { /* ignore */ }
      }
      return [];
    }
  }

  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    // Response may be { items: [...] } or { PLANES: [...] } etc.
    for (const key of Object.keys(data as Record<string, unknown>)) {
      if (Array.isArray((data as any)[key])) return (data as any)[key];
    }
  }
  return [];
}

/**
 * Normalize COBERTURAS from REGIONAL API format to our CoverageItem format.
 * REGIONAL returns duplicate codes — one with LIMITE (the coverage limit) and
 * one with MT_PRIMA > 0 (the premium). We merge them.
 */
function normalizeCoberturas(rawCobs: any[]): { code: string; name: string; limit: string; prima: number }[] {
  if (!Array.isArray(rawCobs) || rawCobs.length === 0) return [];

  // Group by CODCOBERT, merge LIMITE and MT_PRIMA
  const map = new Map<string, { code: string; name: string; limit: string; prima: number }>();

  for (const c of rawCobs) {
    const code = String(c.CODCOBERT || '');
    const name = String(c.DESCCOBERT || '');
    const limite = c.LIMITE != null ? Number(c.LIMITE) : null;
    const prima = Number(c.MT_PRIMA) || 0;

    if (!map.has(code)) {
      map.set(code, { code, name, limit: '', prima: 0 });
    }
    const entry = map.get(code)!;
    if (limite != null && limite > 0) {
      entry.limit = '$' + limite.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (prima > 0) {
      entry.prima = prima;
    }
  }

  return Array.from(map.values());
}

/**
 * Normalize BENEFICIOS — filter out "NA" items (not applicable for this plan)
 */
function normalizeBeneficios(rawBens: any[]): string[] {
  if (!Array.isArray(rawBens) || rawBens.length === 0) return [];

  return rawBens
    .filter((b: any) => {
      const desc = String(b.DESCBENE || '').trim().toUpperCase();
      return desc !== 'NA' && desc !== '' && desc !== 'N/A';
    })
    .map((b: any) => {
      const name = String(b.NOMBENE || '').trim();
      const desc = String(b.DESCBENE || '').trim();
      if (desc && desc.toUpperCase() !== 'SI') {
        return `${name}: ${desc}`;
      }
      return name;
    });
}

/** Core fetch logic */
async function fetchAllPlans() {
  console.log('[API REGIONAL Third Party] Fetching plans from REGIONAL API...');

  const planes = await fetchPlanesRC();
  console.log(`[REGIONAL Third Party] RC plans found: ${planes.length}`);

  // Find SOAT BASICO (30) and SOAT PLUS (31)
  const basicPlan = planes.find((p: any) => String(p.CODPLAN) === PLAN_BASICO_CODE);
  const premiumPlan = planes.find((p: any) => String(p.CODPLAN) === PLAN_PLUS_CODE);

  // Fallback: search by description
  const basicFallback = !basicPlan ? planes.find((p: any) =>
    (p.DESCPLAN || '').toUpperCase().includes('BASICO')
  ) : null;
  const premiumFallback = !premiumPlan ? planes.find((p: any) =>
    (p.DESCPLAN || '').toUpperCase().includes('PLUS')
  ) : null;

  const basic = basicPlan || basicFallback;
  const premium = premiumPlan || premiumFallback;

  const buildPlanResponse = (plan: any | null, planType: string, fallbackPrice: number, fallbackName: string) => {
    const fallbackCoverages = planType === 'basic' ? REGIONAL_BASIC_COVERAGES : REGIONAL_PREMIUM_COVERAGES;
    const fallbackBenefits = planType === 'basic' ? REGIONAL_BASIC_BENEFITS : REGIONAL_PREMIUM_BENEFITS;

    if (!plan) {
      return {
        planType,
        name: planType === 'basic' ? 'Plan Básico' : 'Plan Premium',
        apiName: fallbackName,
        codplan: planType === 'basic' ? PLAN_BASICO_CODE : PLAN_PLUS_CODE,
        annualPremium: fallbackPrice,
        fromApi: false,
        coverageList: fallbackCoverages,
        endosoBenefits: fallbackBenefits,
        endoso: planType === 'basic' ? 'Endoso Básico' : 'Endoso Plus',
        installments: { available: false, description: 'Solo al contado' },
      };
    }

    const apiCoverages = normalizeCoberturas(plan.COBERTURAS || []);
    const apiBenefits = normalizeBeneficios(plan.BENEFICIOS || []);

    return {
      planType,
      name: planType === 'basic' ? 'Plan Básico' : 'Plan Premium',
      apiName: plan.DESCPLAN || fallbackName,
      codplan: String(plan.CODPLAN || ''),
      annualPremium: Number(plan.MT_PRIMA) || fallbackPrice,
      fromApi: true,
      coverageList: apiCoverages.length > 0 ? apiCoverages : fallbackCoverages,
      endosoBenefits: apiBenefits.length > 0 ? apiBenefits : fallbackBenefits,
      endoso: planType === 'basic' ? 'Endoso Básico' : 'Endoso Plus',
      installments: { available: false, description: 'Solo al contado' },
    };
  };

  const result = {
    success: true,
    source: 'REGIONAL API (planesRc)',
    timestamp: new Date().toISOString(),
    plans: [
      buildPlanResponse(basic, 'basic', FALLBACK_BASIC_PRICE, 'Soat Basico'),
      buildPlanResponse(premium, 'premium', FALLBACK_PREMIUM_PRICE, 'Soat Plus'),
    ],
  };

  cache = { data: result, timestamp: Date.now() };
  console.log(
    `[API REGIONAL Third Party] ✅ Básico: $${result.plans[0]?.annualPremium} (${result.plans[0]?.coverageList?.length} cob, ${result.plans[0]?.endosoBenefits?.length} ben) | Premium: $${result.plans[1]?.annualPremium} (${result.plans[1]?.coverageList?.length} cob, ${result.plans[1]?.endosoBenefits?.length} ben)`
  );

  return result;
}

export async function GET() {
  const cacheHeaders = { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=7200' };

  try {
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      console.log('[API REGIONAL Third Party] Usando cache');
      return NextResponse.json(cache.data, { headers: cacheHeaders });
    }

    if (inflightPromise) {
      console.log('[API REGIONAL Third Party] Esperando request en vuelo...');
      const data = await inflightPromise;
      return NextResponse.json(data, { headers: cacheHeaders });
    }

    inflightPromise = fetchAllPlans().finally(() => {
      inflightPromise = null;
    });
    const data = await inflightPromise;
    return NextResponse.json(data, { headers: cacheHeaders });
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
          annualPremium: FALLBACK_BASIC_PRICE,
          fromApi: false,
          coverageList: [],
          endosoBenefits: [],
          installments: { available: false, description: 'Solo al contado' },
        },
        {
          planType: 'premium',
          name: 'Plan Premium',
          annualPremium: FALLBACK_PREMIUM_PRICE,
          fromApi: false,
          coverageList: [],
          endosoBenefits: [],
          installments: { available: false, description: 'Solo al contado' },
        },
      ],
    });
  }
}
