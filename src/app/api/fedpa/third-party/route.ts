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
      return NextResponse.json(cache.data, {
        headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=7200' },
      });
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

    // Beneficios por endoso DT — derivados de los documentos oficiales de endoso FEDPA.
    // La API consultar_beneficios_planes_externos retorna beneficios genéricos del plan 426
    // que mezclan CC y DT (ej. Grúa $150/2 eventos es de CC, no de DT). Los endosos DT
    // tienen límites distintos según el tipo (FAB vs FAV), definidos en los PDFs oficiales.
    // Fuente: /API FEDPA/ENDOSO ASIST BASICO.pdf y /API FEDPA/ENDOSO ASIST VIP.pdf
    const FAB_BENEFITS: string[] = [
      'Inspección In Situ por accidente de tránsito (sin límite de eventos)',
      'Ambulancia por accidente de tránsito (hasta $200.00/año, sin límite de eventos)',
      'Grúa por accidente de tránsito (1 evento/año, hasta $100.00)',
    ];
    const FAV_BENEFITS: string[] = [
      'Inspección In Situ por accidente de tránsito (sin límite de eventos)',
      'Ambulancia por accidente de tránsito (hasta $200.00/año, sin límite de eventos)',
      'Grúa por accidente o avería (2 eventos/año: 1 accidente + 1 avería, hasta $150.00)',
      'Auxilio vial: cambio de llanta, pase de corriente, combustible (1 evento/año, hasta $100.00)',
      'Cerrajería vehicular (1 evento/año, hasta $80.00)',
      'Asistencia médica telefónica 24 horas',
      'Telemedicina — DR. FEDLINE (video consulta ilimitada)',
      'Asistencia en el Hogar: plomero, cerrajero, electricista (2 eventos/año, hasta $75.00)',
    ];

    const result = {
      success: true,
      source: 'FEDPA API (get_cotizacion plan 426 - Opción A y C)',
      idCotizacionBasic,
      idCotizacionPremium,
      ramo,
      subramo,
      planCode: 426,
      emissionPlanCodes: { basic: 1000, plus: 1001, premium: 1002 },
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
          endosoBenefits: FAB_BENEFITS,
          installments: {
            available: true,
            payments: 2,
            amount: basicInstAmount,
            totalWithInstallments: basicInstTotal,
          },
          includedCoverages: OPCION_A_COVERAGES,
          idCotizacion: idCotizacionBasic,
          emissionPlanCode: 1000,
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
          endosoBenefits: FAV_BENEFITS,
          installments: {
            available: true,
            payments: 2,
            amount: premiumInstAmount,
            totalWithInstallments: premiumInstTotal,
          },
          includedCoverages: OPCION_C_COVERAGES,
          idCotizacion: idCotizacionPremium,
          emissionPlanCode: 1002,
        },
      ],
    };

    // Guardar en cache
    cache = { data: result, timestamp: Date.now() };

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=7200',
      },
    });
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
