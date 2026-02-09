/**
 * API Endpoint: Planes de Daños a Terceros FEDPA en Tiempo Real
 * GET /api/fedpa/third-party
 * 
 * Hace DOS cotizaciones con plan 426 (D.T. Particulares):
 * - Opción A (Básico): B=5,000 + sin gastos médicos + endoso FAB
 * - Opción C (Premium): B=10,000 + gastos médicos + endoso FAV
 * 
 * Retorna coberturas con límites y primas individuales desde la API.
 */

import { NextRequest, NextResponse } from 'next/server';

const FEDPA_API = 'https://wscanales.segfedpa.com/EmisorFedpa.Api/api';
const USUARIO = process.env.USUARIO_FEDPA || 'SLIDERES';
const CLAVE = process.env.CLAVE_FEDPA || 'lider836';

// Cache en memoria (1 hora)
let cache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000;

// Parámetros base compartidos
const BASE_PARAMS = {
  Ano: new Date().getFullYear(),
  Uso: '10',
  CantidadPasajeros: 5,
  SumaAsegurada: '0',
  CodLimiteLesiones: '5', // 5,000/10,000
  CodPlan: '426',
  CodMarca: '5',
  CodModelo: '10',
  Nombre: 'COTIZACION',
  Apellido: 'WEB',
  Cedula: '0-0-0',
  Telefono: '00000000',
  Email: 'cotizacion@web.com',
  Usuario: USUARIO,
  Clave: CLAVE,
};

// Coberturas incluidas en cada opción
const OPCION_A_COVERAGES = ['A', 'B', 'FAB', 'H-1', 'K6'];
const OPCION_C_COVERAGES = ['A', 'B', 'C', 'FAV', 'H-1', 'K6'];

async function fetchCotizacion(params: Record<string, any>) {
  const res = await fetch(`${FEDPA_API}/Polizas/get_cotizacion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`FEDPA API error: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error('Sin datos de cotización');
  return data;
}

function buildCoverageList(
  allCoverages: any[],
  includedCodes: string[]
) {
  return allCoverages
    .filter((c: any) => includedCodes.includes(c.COBERTURA))
    .map((c: any) => ({
      code: c.COBERTURA,
      name: c.DESCCOBERTURA,
      limit: c.LIMITE,
      prima: c.PRIMA_IMPUESTO,
      primaBase: c.PRIMA,
    }));
}

export async function GET(request: NextRequest) {
  try {
    console.log('[API FEDPA Third Party] Obteniendo planes...');

    // Usar cache si disponible
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      console.log('[API FEDPA Third Party] Usando cache');
      return NextResponse.json(cache.data);
    }

    // Cotización Opción A (Básico): B=5,000, sin gastos médicos, con endoso
    const [basicData, premiumData] = await Promise.all([
      fetchCotizacion({
        ...BASE_PARAMS,
        CodLimitePropiedad: '13',   // B = 5,000
        CodLimiteGastosMedico: '0', // Sin gastos médicos
        EndosoIncluido: 'S',
      }),
      fetchCotizacion({
        ...BASE_PARAMS,
        CodLimitePropiedad: '8',    // B = 10,000
        CodLimiteGastosMedico: '23', // 500/2,500
        EndosoIncluido: 'S',
      }),
    ]);

    // Tomar Opción A de cada cotización
    const basicAll = basicData.filter((c: any) => c.OPCION === 'A');
    const premiumAll = premiumData.filter((c: any) => c.OPCION === 'A');

    const idCotizacionBasic = basicAll[0]?.COTIZACION;
    const idCotizacionPremium = premiumAll[0]?.COTIZACION;
    const ramo = basicAll[0]?.RAMO;
    const subramo = basicAll[0]?.SUBRAMO;

    // Construir listas de coberturas incluidas
    const basicCoverages = buildCoverageList(basicAll, OPCION_A_COVERAGES);
    const premiumCoverages = buildCoverageList(premiumAll, OPCION_C_COVERAGES);

    // Calcular primas sumando solo las coberturas incluidas
    const basicPrima = basicCoverages.reduce((s, c) => s + c.prima, 0);
    const premiumPrima = premiumCoverages.reduce((s, c) => s + c.prima, 0);

    // Redondear a entero (FEDPA muestra precios redondeados)
    const basicAnnual = Math.round(basicPrima);
    const premiumAnnual = Math.round(premiumPrima);

    // Cuotas: FEDPA ofrece 2 cuotas mensuales con recargo ~21.7%
    const RECARGO_CUOTAS = 1.217;
    const basicInstTotal = Math.round(basicAnnual * RECARGO_CUOTAS * 100) / 100;
    const basicInstAmount = Math.round((basicInstTotal / 2) * 100) / 100;
    const premiumInstTotal = Math.round(premiumAnnual * RECARGO_CUOTAS * 100) / 100;
    const premiumInstAmount = Math.round((premiumInstTotal / 2) * 100) / 100;

    // Obtener beneficios del endoso FAB y FAV desde la API
    let fabBenefits: string[] = [];
    let favBenefits: string[] = [];
    try {
      const benRes = await fetch(
        `${FEDPA_API}/Polizas/consultar_beneficios_planes_externos?Usuario=${USUARIO}&Clave=${CLAVE}&plan=426`
      );
      if (benRes.ok) {
        const allBenefits = await benRes.json();
        if (Array.isArray(allBenefits)) {
          fabBenefits = allBenefits
            .filter((b: any) => b.PLAN === 426 && b.ENDOSO === 'FAB')
            .map((b: any) => b.BENEFICIOS);
          favBenefits = allBenefits
            .filter((b: any) => b.PLAN === 426 && b.ENDOSO === 'FAV')
            .map((b: any) => b.BENEFICIOS);
        }
      }
    } catch (e) {
      console.warn('[API FEDPA Third Party] No se pudieron obtener beneficios del endoso');
    }

    // Si no hay beneficios del endpoint, extraer de las coberturas del endoso
    if (fabBenefits.length === 0) {
      const fabCov = basicAll.find((c: any) => c.COBERTURA === 'FAB');
      if (fabCov) fabBenefits = [fabCov.DESCCOBERTURA];
    }
    if (favBenefits.length === 0) {
      const favCov = premiumAll.find((c: any) => c.COBERTURA === 'FAV');
      if (favCov) favBenefits = [favCov.DESCCOBERTURA];
    }

    const result = {
      success: true,
      source: 'FEDPA API (get_cotizacion plan 426 - Opción A y C)',
      idCotizacionBasic,
      idCotizacionPremium,
      ramo,
      subramo,
      planCode: 426,
      timestamp: new Date().toISOString(),
      plans: [
        {
          planType: 'basic',
          opcion: 'A',
          name: 'Opción A',
          endoso: 'FEDPA ASIST BASICO',
          endosoPdf: '/API FEDPA/ENDOSO ASIST BASICO.pdf',
          annualPremium: basicAnnual,
          annualPremiumExact: Math.round(basicPrima * 100) / 100,
          coverageList: basicCoverages,
          endosoBenefits: fabBenefits,
          installments: {
            available: true,
            payments: 2,
            amount: basicInstAmount,
            totalWithInstallments: basicInstTotal,
          },
          includedCoverages: OPCION_A_COVERAGES,
          idCotizacion: idCotizacionBasic,
        },
        {
          planType: 'premium',
          opcion: 'C',
          name: 'Opción C',
          endoso: 'FEDPA ASIST VIP',
          endosoPdf: '/API FEDPA/ENDOSO ASIST VIP.pdf',
          annualPremium: premiumAnnual,
          annualPremiumExact: Math.round(premiumPrima * 100) / 100,
          coverageList: premiumCoverages,
          endosoBenefits: favBenefits,
          installments: {
            available: true,
            payments: 2,
            amount: premiumInstAmount,
            totalWithInstallments: premiumInstTotal,
          },
          includedCoverages: OPCION_C_COVERAGES,
          idCotizacion: idCotizacionPremium,
        },
      ],
    };

    // Guardar en cache
    cache = { data: result, timestamp: Date.now() };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API FEDPA Third Party] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error interno del servidor',
      },
      { status: 500 }
    );
  }
}
