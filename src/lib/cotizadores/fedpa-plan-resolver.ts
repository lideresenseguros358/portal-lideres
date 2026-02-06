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

  // Buscar el plan CC PARTICULAR en el catálogo
  let ccPlanId = DEFAULT_CC_PLAN_ID;
  let ccPlanName = DEFAULT_CC_PLAN_NAME;

  try {
    const planesResponse = await fetch(`/api/fedpa/planes?environment=${environment}&tipo=COBERTURA%20COMPLETA`);
    if (planesResponse.ok) {
      const planesData = await planesResponse.json();
      const planes = planesData.data || [];
      
      // Buscar CC PARTICULAR (plan principal para web services)
      const ccParticular = planes.find((p: any) => 
        p.descripcion?.toUpperCase().includes('PARTICULAR') ||
        p.nombreplan?.toUpperCase().includes('PARTICULAR')
      );
      
      if (ccParticular) {
        ccPlanId = ccParticular.plan?.toString() || DEFAULT_CC_PLAN_ID;
        ccPlanName = ccParticular.descripcion || ccParticular.nombreplan || DEFAULT_CC_PLAN_NAME;
      }
      
      console.log(`[FEDPA Plans] CC PARTICULAR encontrado: plan ${ccPlanId} (${ccPlanName})`);
    }
  } catch (error) {
    console.warn('[FEDPA Plans] Error obteniendo catálogo, usando default plan 411');
  }

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
