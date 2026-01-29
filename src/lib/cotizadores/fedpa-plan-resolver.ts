/**
 * FEDPA Plan Resolver
 * Identifica planes Básico (Full Extras) vs Premium (Porcelana)
 * basándose en beneficios del catálogo
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

/**
 * Obtiene planes Básico y Premium de FEDPA
 * Cachea resultados para evitar múltiples llamadas
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

  try {
    console.log('[FEDPA Plans] Obteniendo planes del catálogo...');
    
    // Obtener lista de planes de Cobertura Completa
    const planesResponse = await fetch(`/api/fedpa/planes?environment=${environment}&tipo=COBERTURA%20COMPLETA`);
    if (!planesResponse.ok) {
      console.error('[FEDPA Plans] Error obteniendo planes');
      return { basico: null, premium: null };
    }
    
    const planesData = await planesResponse.json();
    const planes = planesData.data || [];
    
    if (planes.length === 0) {
      console.error('[FEDPA Plans] No hay planes disponibles');
      return { basico: null, premium: null };
    }
    
    console.log('[FEDPA Plans] Planes disponibles:', planes.length);
    
    // Buscar planes por beneficios/endosos
    let basicoPlan: FedpaPlanInfo | null = null;
    let premiumPlan: FedpaPlanInfo | null = null;
    
    for (const plan of planes) {
      const planId = plan.plan?.toString();
      const nombre = plan.nombreplan || '';
      
      // Obtener beneficios del plan
      try {
        const beneficiosResponse = await fetch(`/api/fedpa/planes/beneficios?plan=${planId}&environment=${environment}`);
        if (beneficiosResponse.ok) {
          const beneficiosData = await beneficiosResponse.json();
          const beneficios = beneficiosData.data || [];
          
          // Buscar en texto de beneficios
          const textoCompleto = beneficios.map((b: any) => 
            `${b.beneficio || ''} ${b.descripcion || ''}`.toLowerCase()
          ).join(' ');
          
          // Detectar tipo por keywords
          if (textoCompleto.includes('porcelana') || textoCompleto.includes('premium')) {
            premiumPlan = {
              planId,
              nombre,
              tipo: 'premium',
              endoso: 'Porcelana',
            };
            console.log('[FEDPA Plans] ✅ Premium encontrado:', planId, nombre);
          } else if (textoCompleto.includes('full extras') || textoCompleto.includes('extras')) {
            basicoPlan = {
              planId,
              nombre,
              tipo: 'basico',
              endoso: 'Full Extras',
            };
            console.log('[FEDPA Plans] ✅ Básico encontrado:', planId, nombre);
          }
        }
      } catch (error) {
        console.error(`[FEDPA Plans] Error obteniendo beneficios del plan ${planId}:`, error);
      }
    }
    
    // Fallback: si no encontramos por beneficios, usar los primeros 2 planes disponibles
    if (!basicoPlan || !premiumPlan) {
      console.warn('[FEDPA Plans] No se detectaron planes por beneficios, usando fallback...');
      
      // Ordenar planes y asignar
      const planesOrdenados = planes.sort((a: any, b: any) => 
        (a.plan || 0) - (b.plan || 0)
      );
      
      if (!basicoPlan && planesOrdenados[0]) {
        basicoPlan = {
          planId: planesOrdenados[0].plan?.toString() || '411',
          nombre: planesOrdenados[0].nombreplan || 'Plan Básico',
          tipo: 'basico',
          endoso: 'Full Extras',
        };
      }
      
      if (!premiumPlan && planesOrdenados[1]) {
        premiumPlan = {
          planId: planesOrdenados[1].plan?.toString() || '412',
          nombre: planesOrdenados[1].nombreplan || 'Plan Premium',
          tipo: 'premium',
          endoso: 'Porcelana',
        };
      }
    }
    
    // Guardar en cache
    planesCache = {
      basico: basicoPlan,
      premium: premiumPlan,
      timestamp: Date.now(),
    };
    
    console.log('[FEDPA Plans] Planes identificados:', {
      basico: basicoPlan?.planId,
      premium: premiumPlan?.planId,
    });
    
    return { basico: basicoPlan, premium: premiumPlan };
  } catch (error) {
    console.error('[FEDPA Plans] Error fatal:', error);
    return { basico: null, premium: null };
  }
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
