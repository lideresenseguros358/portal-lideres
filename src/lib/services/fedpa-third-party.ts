/**
 * Servicio de Daños a Terceros FEDPA - Datos en Tiempo Real
 * Reemplaza los datos estáticos con llamadas a la API de FEDPA
 */

import { fedpaApi } from './fedpa-api';

export interface ThirdPartyPlanData {
  planId: number;
  planName: string;
  planType: 'basic' | 'premium';
  coverages: {
    bodilyInjury: string;
    propertyDamage: string;
    medicalExpenses: string;
    accidentalDeathDriver: string;
    accidentalDeathPassengers: string;
    funeralExpenses: string;
    accidentAssistance: string;
    ambulance: string;
    roadAssistance: string;
    towing: string;
    legalAssistance: string;
  };
  annualPremium: number;
  installments: {
    available: boolean;
    description?: string;
    amount?: number;
    payments?: number;
  };
  benefits: string[];
}

export interface ThirdPartyQuoteResult {
  success: boolean;
  plans: ThirdPartyPlanData[];
  error?: string;
}

/**
 * Obtener planes de daños a terceros disponibles en tiempo real
 */
export async function obtenerPlanesDanosTerceros(): Promise<ThirdPartyQuoteResult> {
  try {
    console.log('[FEDPA Third Party] Obteniendo planes en tiempo real...');

    // 1. Obtener planes disponibles de la API
    const planes = await fedpaApi.consultarPlanes();
    
    // 2. Filtrar solo planes de daños a terceros
    const planesTerceros = planes.filter(plan => 
      plan.NOMBREPLAN && 
      (plan.NOMBREPLAN.toUpperCase().includes('TERCEROS') || 
       plan.NOMBREPLAN.toUpperCase().includes('DAT') ||
       plan.USO === '10' || // Uso particular
       plan.USO === '20')   // Uso comercial
    );

    if (planesTerceros.length === 0) {
      console.warn('[FEDPA Third Party] No se encontraron planes de terceros');
      return {
        success: false,
        plans: [],
        error: 'No hay planes de daños a terceros disponibles',
      };
    }

    // 3. Obtener límites de cobertura
    const limites = await fedpaApi.consultarLimites();

    // 4. Para cada plan, obtener sus beneficios
    const planesConDatos: ThirdPartyPlanData[] = [];

    for (const plan of planesTerceros) {
      try {
        const beneficios = await fedpaApi.consultarBeneficios(plan.PLAN);
        
        // Determinar tipo de plan (básico o premium) basado en el nombre o uso
        const esPremium = plan.NOMBREPLAN.toUpperCase().includes('PREMIUM') ||
                         plan.NOMBREPLAN.toUpperCase().includes('COMERCIAL') ||
                         plan.USO === '20';

        // Mapear límites a coberturas legibles
        const coberturas = mapearCoberturasDesdeAPI(limites, beneficios);

        planesConDatos.push({
          planId: plan.PLAN,
          planName: plan.NOMBREPLAN,
          planType: esPremium ? 'premium' : 'basic',
          coverages: coberturas,
          annualPremium: 0, // Se calculará con cotización
          installments: {
            available: esPremium, // Premium suele tener cuotas
            description: esPremium ? 'Hasta 2 cuotas disponibles' : 'Pago anual',
            amount: 0,
            payments: esPremium ? 2 : 1,
          },
          benefits: beneficios.map(b => b.BENEFICIOS),
        });
      } catch (error) {
        console.error(`[FEDPA Third Party] Error obteniendo beneficios del plan ${plan.PLAN}:`, error);
      }
    }

    console.log('[FEDPA Third Party] Planes obtenidos:', planesConDatos.length);

    return {
      success: true,
      plans: planesConDatos,
    };
  } catch (error) {
    console.error('[FEDPA Third Party] Error obteniendo planes:', error);
    return {
      success: false,
      plans: [],
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Cotizar un plan específico de daños a terceros
 */
export async function cotizarPlanTerceros(
  planId: number,
  datosVehiculo: {
    ano: string;
    uso: string;
    cantidadPasajeros: string;
    marca: string;
    modelo: string;
  },
  datosCliente: {
    nombre: string;
    apellido: string;
    cedula: string;
    telefono: string;
    email: string;
  }
): Promise<{ success: boolean; prima?: number; error?: string }> {
  try {
    console.log('[FEDPA Third Party] Cotizando plan:', planId);

    const resultado = await fedpaApi.cotizar({
      Ano: datosVehiculo.ano,
      Uso: datosVehiculo.uso,
      CantidadPasajeros: datosVehiculo.cantidadPasajeros,
      SumaAsegurada: '0', // Daños a terceros siempre 0
      CodLimiteLesiones: '1',
      CodLimitePropiedad: '1',
      CodLimiteGastosMedico: '1',
      EndosoIncluido: 'N',
      CodPlan: planId.toString(),
      CodMarca: datosVehiculo.marca,
      CodModelo: datosVehiculo.modelo,
      Nombre: datosCliente.nombre,
      Apellido: datosCliente.apellido,
      Cedula: datosCliente.cedula,
      Telefono: datosCliente.telefono,
      Email: datosCliente.email,
      Usuario: '',
      Clave: '',
    });

    if (resultado.Cotizacion) {
      return {
        success: true,
        prima: resultado.Cotizacion.PrimaTotal,
      };
    }

    return {
      success: false,
      error: 'No se pudo obtener la cotización',
    };
  } catch (error) {
    console.error('[FEDPA Third Party] Error cotizando:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Mapear límites de la API a estructura de coberturas legible
 */
function mapearCoberturasDesdeAPI(limites: any[], beneficios: any[]): ThirdPartyPlanData['coverages'] {
  // Buscar límites específicos por código de cobertura
  const limiteLesiones = limites.find(l => l.CODCOBERTURA === 1);
  const limitePropiedad = limites.find(l => l.CODCOBERTURA === 2);
  const limiteGastosMedicos = limites.find(l => l.CODCOBERTURA === 3);

  // Analizar beneficios para determinar coberturas adicionales
  const beneficiosTexto = beneficios.map(b => b.BENEFICIOS.toUpperCase()).join(' ');
  
  const tieneAsistenciaVial = beneficiosTexto.includes('ASISTENCIA VIAL') || 
                              beneficiosTexto.includes('ROAD') ||
                              beneficiosTexto.includes('GRÚA');
  
  const tieneAsistenciaLegal = beneficiosTexto.includes('LEGAL') ||
                               beneficiosTexto.includes('JURÍDICA');
  
  const tieneMuerteAccidental = beneficiosTexto.includes('MUERTE ACCIDENTAL') ||
                                beneficiosTexto.includes('DEATH');
  
  const tieneGastosFunerarios = beneficiosTexto.includes('FUNERARIO') ||
                                beneficiosTexto.includes('FUNERAL');

  return {
    bodilyInjury: limiteLesiones?.LIMITE || '5,000 / 10,000',
    propertyDamage: limitePropiedad?.LIMITE || '5,000',
    medicalExpenses: limiteGastosMedicos?.LIMITE || '500 / 2,500',
    accidentalDeathDriver: tieneMuerteAccidental ? '5,000' : 'no',
    accidentalDeathPassengers: tieneMuerteAccidental ? '5,000' : 'no',
    funeralExpenses: tieneGastosFunerarios ? '1,500' : 'no',
    accidentAssistance: 'sí', // Siempre incluido
    ambulance: 'sí', // Siempre incluido
    roadAssistance: tieneAsistenciaVial ? 'sí' : 'no',
    towing: tieneAsistenciaVial ? 'Por accidente o avería' : 'no',
    legalAssistance: tieneAsistenciaLegal ? 'sí' : 'no',
  };
}

/**
 * Cache de planes para evitar llamadas repetidas a la API
 */
let planesCache: { data: ThirdPartyPlanData[]; timestamp: number } | null = null;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hora

/**
 * Obtener planes con cache
 */
export async function obtenerPlanesDanosTercerosConCache(): Promise<ThirdPartyQuoteResult> {
  const ahora = Date.now();
  
  if (planesCache && (ahora - planesCache.timestamp) < CACHE_DURATION) {
    console.log('[FEDPA Third Party] Usando planes desde cache');
    return {
      success: true,
      plans: planesCache.data,
    };
  }

  const resultado = await obtenerPlanesDanosTerceros();
  
  if (resultado.success && resultado.plans.length > 0) {
    planesCache = {
      data: resultado.plans,
      timestamp: ahora,
    };
  }

  return resultado;
}
