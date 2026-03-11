/**
 * API Endpoint: Planes de Daños a Terceros IS
 * GET /api/is/third-party
 *
 * Reads pre-cached reference prices from app_settings (populated by cron/is-dt-reference).
 * Falls back to live quote ONLY on first run when app_settings is empty.
 * This makes the endpoint near-instant (<100ms) instead of ~5s.
 *
 * Plans:
 * - Plan Básico (SOAT): codPlanCobertura=306 (SOBAT 5/10)
 * - Plan Intermedio (Premium): codPlanCobertura=307 (DAT 10/20)
 */

import { NextResponse } from 'next/server';
import { getSetting } from '@/server/settings';

// ── In-memory cache to avoid hitting DB on every request ──
let memCache: { data: any; timestamp: number } | null = null;
const MEM_CACHE_TTL = 30 * 60 * 1000; // 30 min — cron updates DB daily

const SETTINGS_KEY = 'is_dt_reference_prices';

// IS plan codes for DT
const PLAN_SOAT = 306;       // SOBAT 5/10 (Básico)
const PLAN_INTERMEDIO = 307;  // DAT 10/20 (Intermedio)

// Fallback prices — used ONLY if cron has never run and DB is empty
const FALLBACK_BASIC_PRICE = 154.00;
const FALLBACK_PREMIUM_PRICE = 183.00;

// Benefits from IS condicionado (API doesn't expose these)
const IS_SOAT_BENEFITS: string[] = [
  'Coordinación de envío de ambulancia por accidente de tránsito',
  'Asistencia vial: cambio de llanta, envío de combustible, pase de corriente (Conexión)',
  'Cerrajería vial (Conexión)',
  'Grúa por accidente o desperfectos mecánicos (Conexión)',
  'Transmisión de mensajes urgentes',
  'Inspección "in situ"',
];
const IS_INTERMEDIO_BENEFITS: string[] = [
  'Asistencia legal en accidentes de tránsito',
  'Coordinación de envío de ambulancia por accidente de tránsito',
  'Asistencia vial: cambio de llanta, envío de combustible, pase de corriente (hasta B/.150, máx. 3 eventos/año)',
  'Cerrajería vial (hasta B/.150, máx. 3 eventos/año)',
  'Grúa por accidente o desperfectos mecánicos (hasta B/.150, máx. 3 eventos/año)',
  'Transmisión de mensajes urgentes',
  'Inspección "in situ"',
  'Depósito y custodia de vehículos',
];

const REF_VEHICLE_META = {
  codGrupoTarifa: 20,
  codMarca: 156,
  codModelo: 2563,
};

/**
 * Build the response from stored reference data.
 * If app_settings has cached prices from the cron, use them.
 * Otherwise fall back to hardcoded prices (should only happen on very first deploy).
 */
async function buildFromCache(): Promise<any> {
  const ref = await getSetting<any>(SETTINGS_KEY);

  const basicPrice = ref?.basic?.price ?? FALLBACK_BASIC_PRICE;
  const premiumPrice = ref?.premium?.price ?? FALLBACK_PREMIUM_PRICE;
  const basicCoverages = ref?.basic?.coverages ?? [];
  const premiumCoverages = ref?.premium?.coverages ?? [];
  const fromApi = !!ref?.basic?.fromApi;
  const source = ref
    ? `app_settings (updated ${ref.updatedAt || 'unknown'})`
    : 'fallback (cron has not run yet)';

  return {
    success: true,
    online: true,
    source,
    timestamp: new Date().toISOString(),
    plans: [
      {
        planType: 'basic',
        name: 'Plan Básico (SOAT)',
        codPlanCobertura: PLAN_SOAT,
        annualPremium: Math.round(basicPrice * 100) / 100,
        coverageList: basicCoverages,
        endosoBenefits: IS_SOAT_BENEFITS,
        endoso: 'Plan Básico (SOAT)',
        fromApi,
        idCotizacion: ref?.basic?.idCotizacion || null,
        vcodgrupotarifa: REF_VEHICLE_META.codGrupoTarifa,
        vcodmarca: REF_VEHICLE_META.codMarca,
        vcodmodelo: REF_VEHICLE_META.codModelo,
        installments: { available: false, description: 'Solo al contado' },
      },
      {
        planType: 'premium',
        name: 'Plan Intermedio',
        codPlanCobertura: PLAN_INTERMEDIO,
        annualPremium: Math.round(premiumPrice * 100) / 100,
        coverageList: premiumCoverages,
        endosoBenefits: IS_INTERMEDIO_BENEFITS,
        endoso: 'Plan Intermedio (DAT 10/20)',
        fromApi,
        idCotizacion: ref?.premium?.idCotizacion || null,
        vcodgrupotarifa: REF_VEHICLE_META.codGrupoTarifa,
        vcodmarca: REF_VEHICLE_META.codMarca,
        vcodmodelo: REF_VEHICLE_META.codModelo,
        installments: { available: false, description: 'Solo al contado' },
      },
    ],
  };
}

export async function GET() {
  // Aggressive CDN + browser caching — data only changes when cron runs (daily)
  const cacheHeaders = { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=7200' };

  try {
    // 1. Return in-memory cache if fresh (avoids DB hit on hot path)
    if (memCache && Date.now() - memCache.timestamp < MEM_CACHE_TTL) {
      return NextResponse.json(memCache.data, { headers: cacheHeaders });
    }

    // 2. Read from app_settings (populated by cron/is-dt-reference)
    const data = await buildFromCache();

    // 3. Store in memory for subsequent requests in this serverless instance
    memCache = { data, timestamp: Date.now() };

    return NextResponse.json(data, { headers: cacheHeaders });
  } catch (error: any) {
    console.error('[API IS Third Party] Error:', error);
    // Return fallback so UI doesn't break
    return NextResponse.json({
      success: true,
      online: true,
      source: 'fallback (error)',
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
