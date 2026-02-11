/**
 * API Endpoint: Planes de Daños a Terceros IS en Tiempo Real
 * GET /api/is/third-party
 *
 * Follows the same pattern as cobertura completa (/cotizadores/comparar):
 * - ONE generarCotizacion call per plan (sequential to avoid rate limits)
 * - Uses PTOTAL from generarCotizacion as the REAL price
 * - Gets coverages via getlistacoberturas with correct field names
 * - Aggressive caching (2h) + in-flight dedup to prevent double-fetch
 *
 * Plans:
 * - Plan Básico (SOAT): codPlanCobertura=306 (SOBAT 5/10)
 * - Plan Intermedio (Premium): codPlanCobertura=307 (DAT 10/20)
 */

import { NextResponse } from 'next/server';
import { generarCotizacionAuto, obtenerCoberturasCotizacion } from '@/lib/is/quotes.service';

// ── Cache (2 hours) + in-flight dedup ──
let cache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours
let inflightPromise: Promise<any> | null = null;

// Reference vehicle (Toyota, PARTICULAR group — same as min-price route)
const REF_VEHICLE = {
  codTipoDoc: 1,
  nroDoc: '8-000-0000',
  nroNit: '8-000-0000',
  nombre: 'COTIZACION',
  apellido: 'WEB',
  telefono: '60000000',
  correo: 'cotizacion@web.com',
  codMarca: 156,       // Toyota
  codModelo: 2563,     // Toyota model
  anioAuto: String(new Date().getFullYear()),
  sumaAseg: '0',       // DT = 0
  codPlanCoberturaAdic: 0,
  codGrupoTarifa: 20,  // PARTICULAR
};

// IS plan codes for DT
const PLAN_SOAT = 306;       // SOBAT 5/10 (Básico)
const PLAN_INTERMEDIO = 307;  // DAT 10/20 (Intermedio)

// Fallback prices from real API responses (logs: Prima: 154 / 183)
const FALLBACK_BASIC_PRICE = 154.00;
const FALLBACK_PREMIUM_PRICE = 183.00;

interface CoverageItem {
  code: string;
  name: string;
  limit: string;
  prima: number;
}

/**
 * Fetch a single plan: generarCotizacion → getlistacoberturas
 * Uses PTOTAL from generarCotizacion as the real price (same as CC flow).
 * Coverage field names: COD_AMPARO, COBERTURA, LIMITES, PRIMA1
 */
async function fetchPlan(
  codPlanCobertura: number,
  env: 'development' | 'production' = 'development'
): Promise<{ primaTotal: number; coverages: CoverageItem[]; idCotizacion: string } | null> {
  try {
    console.log(`[IS Third Party] Cotizando plan ${codPlanCobertura}...`);
    const cotizResult = await generarCotizacionAuto(
      { ...REF_VEHICLE, codPlanCobertura, codProvincia: 8, fecNacimiento: '01/01/1990' },
      env
    );

    if (!cotizResult.success || !cotizResult.idCotizacion) {
      console.warn(`[IS Third Party] Cotización falló plan ${codPlanCobertura}:`, cotizResult.error);
      return null;
    }

    // PTOTAL is the REAL discounted price from IS (same approach as CC flow)
    const primaTotal = cotizResult.primaTotal ?? 0;
    console.log(`[IS Third Party] Plan ${codPlanCobertura}: PTOTAL=${primaTotal}, idCot=${cotizResult.idCotizacion}`);

    // Get coverages for display
    const cobResult = await obtenerCoberturasCotizacion(
      cotizResult.idCotizacion,
      1,
      env
    );

    const coverages: CoverageItem[] = [];
    if (cobResult.success && cobResult.data?.Table?.length) {
      // Correct field names: COD_AMPARO, COBERTURA, LIMITES, PRIMA1
      for (const cob of cobResult.data.Table) {
        coverages.push({
          code: String(cob.COD_AMPARO ?? ''),
          name: cob.COBERTURA ?? '',
          limit: cob.LIMITES ?? '',
          prima: parseFloat(cob.PRIMA1) || 0,
        });
      }
    }

    // If PTOTAL is 0 or missing, fall back to sum of PRIMA1
    const finalPrima = primaTotal > 0
      ? primaTotal
      : coverages.reduce((sum, c) => sum + c.prima, 0);

    return { primaTotal: finalPrima, coverages, idCotizacion: cotizResult.idCotizacion };
  } catch (error) {
    console.error(`[IS Third Party] Error plan ${codPlanCobertura}:`, error);
    return null;
  }
}

/** Core fetch logic — called once, deduped */
async function fetchAllPlans() {
  console.log('[API IS Third Party] Fetching plans from IS API...');

  // Sequential calls to avoid rate limiting / timeouts (IS API is slow)
  const basicResult = await fetchPlan(PLAN_SOAT, 'development');
  const premiumResult = await fetchPlan(PLAN_INTERMEDIO, 'development');

  const result = {
    success: true,
    source: 'IS API (generarcotizacion + getlistacoberturas)',
    timestamp: new Date().toISOString(),
    plans: [
      {
        planType: 'basic',
        name: 'Plan Básico (SOAT)',
        codPlanCobertura: PLAN_SOAT,
        annualPremium: basicResult
          ? Math.round(basicResult.primaTotal * 100) / 100
          : FALLBACK_BASIC_PRICE,
        coverageList: basicResult?.coverages || [],
        fromApi: !!basicResult,
        installments: { available: false, description: 'Solo al contado' },
      },
      {
        planType: 'premium',
        name: 'Plan Intermedio',
        codPlanCobertura: PLAN_INTERMEDIO,
        annualPremium: premiumResult
          ? Math.round(premiumResult.primaTotal * 100) / 100
          : FALLBACK_PREMIUM_PRICE,
        coverageList: premiumResult?.coverages || [],
        fromApi: !!premiumResult,
        installments: { available: false, description: 'Solo al contado' },
      },
    ],
  };

  // Cache for 2 hours
  cache = { data: result, timestamp: Date.now() };
  console.log(`[API IS Third Party] ✅ Básico: $${result.plans[0]?.annualPremium} | Intermedio: $${result.plans[1]?.annualPremium}`);

  return result;
}

export async function GET() {
  try {
    // 1. Return cache if fresh
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      console.log('[API IS Third Party] Usando cache');
      return NextResponse.json(cache.data);
    }

    // 2. Dedup: if another request is already fetching, wait for it
    if (inflightPromise) {
      console.log('[API IS Third Party] Esperando request en vuelo...');
      const data = await inflightPromise;
      return NextResponse.json(data);
    }

    // 3. Fetch and dedup
    inflightPromise = fetchAllPlans().finally(() => { inflightPromise = null; });
    const data = await inflightPromise;
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[API IS Third Party] Error:', error);
    // Return fallback so UI doesn't break
    return NextResponse.json({
      success: true,
      source: 'fallback',
      timestamp: new Date().toISOString(),
      plans: [
        {
          planType: 'basic',
          name: 'Plan Básico (SOAT)',
          codPlanCobertura: PLAN_SOAT,
          annualPremium: FALLBACK_BASIC_PRICE,
          coverageList: [],
          fromApi: false,
          installments: { available: false, description: 'Solo al contado' },
        },
        {
          planType: 'premium',
          name: 'Plan Intermedio',
          codPlanCobertura: PLAN_INTERMEDIO,
          annualPremium: FALLBACK_PREMIUM_PRICE,
          coverageList: [],
          fromApi: false,
          installments: { available: false, description: 'Solo al contado' },
        },
      ],
    });
  }
}
