/**
 * FEDPA Plan Resolver
 * 
 * IMPORTANTE: En FEDPA, Básico vs Premium NO son planes diferentes.
 * Ambos usan el MISMO plan ID (ej: 411 para C.C. PARTICULAR).
 * La diferencia es el parámetro EndosoIncluido en la cotización:
 *   - EndosoIncluido = 'N' → Básico (Full Extras)
 *   - EndosoIncluido = 'S' → Premium (Endoso Porcelana)
 * 
 * Este resolver simplemente encuentra el plan CC PARTICULAR del catálogo
 * y lo devuelve para ambos tipos, con el endoso correcto.
 */

export interface FedpaPlanInfo {
  planId: string;
  nombre: string;
  tipo: 'basico' | 'premium';
  endoso: string;
}

let planesCache: {
  basico: FedpaPlanInfo | null;
  premium: FedpaPlanInfo | null;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 1000 * 60 * 30; // 30 minutos

// Plan CC PARTICULAR por defecto (de la documentación FEDPA)
const DEFAULT_CC_PLAN_ID = '411';
const DEFAULT_CC_PLAN_NAME = 'C.C. PARTICULAR - SOLO PARA WEB SERVICES';

/**
 * CC plans by suma asegurada range (Emisor Externo 2021)
 * These are the web-services-specific plans that FedPa uses for CC.
 * The plan is determined by the vehicle's insured value.
 */
const CC_PLAN_RANGES: { planId: string; nombre: string; min: number; max: number }[] = [
  { planId: '461', nombre: 'CC 3,000 A 19,999.99 - SOLO WEB SERVICES', min: 3000, max: 19999.99 },
  { planId: '462', nombre: 'CC 20,000 A 60,000 - SOLO WEB SERVICES', min: 20000, max: 60000 },
  { planId: '463', nombre: 'CC 60,001 A 150,000 - SOLO WEB SERVICES', min: 60001, max: 150000 },
];

/**
 * Resolve CC plan code based on suma asegurada (vehicle value)
 */
export function resolverPlanCCPorValor(sumaAsegurada: number): { planId: string; nombre: string } {
  const match = CC_PLAN_RANGES.find(r => sumaAsegurada >= r.min && sumaAsegurada <= r.max);
  if (match) {
    console.log(`[FEDPA CC] Valor $${sumaAsegurada} → Plan ${match.planId} (${match.nombre})`);
    return { planId: match.planId, nombre: match.nombre };
  }
  // Fallback: use generic plan 411 for values outside defined ranges
  console.log(`[FEDPA CC] Valor $${sumaAsegurada} fuera de rango, usando plan genérico 411`);
  return { planId: DEFAULT_CC_PLAN_ID, nombre: DEFAULT_CC_PLAN_NAME };
}

/**
 * Obtiene planes Básico y Premium de FEDPA
 * Ambos usan el mismo plan ID - la diferencia es EndosoIncluido (S/N)
 */
export async function obtenerPlanesFedpa(environment: 'DEV' | 'PROD' = 'DEV'): Promise<{
  basico: FedpaPlanInfo | null;
  premium: FedpaPlanInfo | null;
}> {
  // Verificar cache
  if (planesCache && Date.now() - planesCache.timestamp < CACHE_DURATION) {
    console.log('[FEDPA Plans] Usando cache');
    return {
      basico: planesCache.basico,
      premium: planesCache.premium,
    };
  }

  // Use default plan 411 (generic CC PARTICULAR) — the actual range-based plan
  // (461/462/463) is resolved at cotización time via resolverPlanCCPorValor()
  let ccPlanId = DEFAULT_CC_PLAN_ID;
  let ccPlanName = DEFAULT_CC_PLAN_NAME;
  console.log(`[FEDPA Plans] CC PARTICULAR: plan ${ccPlanId} (range-based plans resolved at cotización time)`);

  // Mismo plan para ambos - la diferencia es EndosoIncluido en la cotización
  const result = {
    basico: {
      planId: ccPlanId,
      nombre: ccPlanName,
      tipo: 'basico' as const,
      endoso: 'Full Extras',  // EndosoIncluido = 'N'
    },
    premium: {
      planId: ccPlanId,
      nombre: ccPlanName,
      tipo: 'premium' as const,
      endoso: 'Endoso Porcelana',  // EndosoIncluido = 'S'
    },
  };

  // Guardar en cache
  planesCache = { ...result, timestamp: Date.now() };

  console.log('[FEDPA Plans] ✅ Plan resuelto:', {
    planId: ccPlanId,
    basico: 'EndosoIncluido=N (Full Extras)',
    premium: 'EndosoIncluido=S (Endoso Porcelana)',
  });

  return result;
}

/**
 * Obtiene el plan correcto según el tipo solicitado
 */
export async function obtenerPlanPorTipo(
  tipo: 'basico' | 'premium',
  environment: 'DEV' | 'PROD' = 'DEV'
): Promise<FedpaPlanInfo | null> {
  const planes = await obtenerPlanesFedpa(environment);
  return planes[tipo];
}
