/**
 * API Endpoint: ANCON Third-Party (DT) Plans — SOBAT
 * GET /api/ancon/third-party
 *
 * Returns SOBAT RC plans for particulares:
 *   Básico  = SOBAT BASICO TALLER  (B/.145.00) — cod 05769, ramo 020 SODA
 *   Premium = SOBAT EXPRESS PLUS    (B/.189.00) — cod 01492, ramo 020 SODA
 *
 * Quotes ANCON with each SOBAT product code to get valid noCotizacion per plan.
 */

import { NextResponse } from 'next/server';
import { cotizarEstandar } from '@/lib/ancon/quotes.service';

export const maxDuration = 30;

const SOBAT_PLANS = {
  basic: {
    name: 'SOBAT BASICO TALLER',
    annualPremium: 145.00,
    codProducto: '05769', // SOBAT BASICO TALLER
    coverageList: [
      { code: 'LC', name: 'LESIONES CORPORALES', limit: '$5,000.00', prima: 42.00 },
      { code: 'DPA', name: 'DAÑOS A LA PROPIEDAD AJENA', limit: '$5,000.00', prima: 82.00 },
      { code: 'AM', name: 'ASISTENCIA MEDICA', limit: '$500.00', prima: 21.00 },
    ],
    endosoBenefits: [
      'Reparación en taller de la red SODA',
      'Lesiones corporales cubiertas',
      'Daños a propiedad ajena',
      'Asistencia médica incluida',
    ],
  },
  premium: {
    name: 'SOBAT EXPRESS PLUS',
    annualPremium: 189.00,
    codProducto: '01492', // SOBAT EXPRESS PLUS
    coverageList: [
      { code: 'LC', name: 'LESIONES CORPORALES', limit: '$10,000.00', prima: 55.00 },
      { code: 'DPA', name: 'DAÑOS A LA PROPIEDAD AJENA', limit: '$10,000.00', prima: 100.00 },
      { code: 'AM', name: 'ASISTENCIA MEDICA', limit: '$1,000.00', prima: 34.00 },
    ],
    endosoBenefits: [
      'Servicio express — atención prioritaria SODA',
      'Límites aumentados de cobertura',
      'Lesiones corporales cubiertas',
      'Daños a propiedad ajena',
      'Asistencia médica incluida',
    ],
  },
} as const;

const QUOTE_PARAMS = {
  cod_marca: '00122',   // TOYOTA
  cod_modelo: '10393',  // COROLLA
  ano: String(new Date().getFullYear()),
  suma_asegurada: '0',
  cedula: '8-888-9999',
  nombre: 'COTIZACION',
  apellido: 'WEB',
  vigencia: 'A',
  email: 'cotizacion@lideresenseguros.com',
  tipo_persona: 'N',
  fecha_nac: '16/06/1994',
  nuevo: '0',
};

export async function GET() {
  const t0 = Date.now();

  try {
    // Quote both SOBAT products in parallel to get valid noCotizacion per plan
    const [basicResult, premiumResult] = await Promise.all([
      cotizarEstandar({ ...QUOTE_PARAMS, cod_producto: SOBAT_PLANS.basic.codProducto }),
      cotizarEstandar({ ...QUOTE_PARAMS, cod_producto: SOBAT_PLANS.premium.codProducto }),
    ]);

    const basicCotizacion = basicResult.data?.noCotizacion || '';
    const premiumCotizacion = premiumResult.data?.noCotizacion || '';
    const apiOnline = basicResult.success && !!basicCotizacion;

    if (!apiOnline) {
      console.warn('[API ANCON third-party] ANCON API offline');
    }

    console.log(`[API ANCON third-party] SOBAT BASICO (05769) → cotización ${basicCotizacion}`);
    console.log(`[API ANCON third-party] SOBAT EXPRESS PLUS (01492) → cotización ${premiumCotizacion}`);

    const plans = [
      {
        planType: 'basic',
        name: SOBAT_PLANS.basic.name,
        annualPremium: SOBAT_PLANS.basic.annualPremium,
        coverageList: [...SOBAT_PLANS.basic.coverageList],
        endosoBenefits: [...SOBAT_PLANS.basic.endosoBenefits],
        endoso: SOBAT_PLANS.basic.name,
        idCotizacion: basicCotizacion,
        noCotizacion: basicCotizacion,
        optionName: 'opcion1',
        _codProducto: SOBAT_PLANS.basic.codProducto,
        _nombreProducto: SOBAT_PLANS.basic.name,
        _sumaAsegurada: '0',
        installments: [{ count: 1, amount: SOBAT_PLANS.basic.annualPremium }],
      },
      {
        planType: 'premium',
        name: SOBAT_PLANS.premium.name,
        annualPremium: SOBAT_PLANS.premium.annualPremium,
        coverageList: [...SOBAT_PLANS.premium.coverageList],
        endosoBenefits: [...SOBAT_PLANS.premium.endosoBenefits],
        endoso: SOBAT_PLANS.premium.name,
        idCotizacion: premiumCotizacion,
        noCotizacion: premiumCotizacion,
        optionName: 'opcion1',
        _codProducto: SOBAT_PLANS.premium.codProducto,
        _nombreProducto: SOBAT_PLANS.premium.name,
        _sumaAsegurada: '0',
        installments: [{ count: 1, amount: SOBAT_PLANS.premium.annualPremium }],
      },
    ];

    const elapsed = Date.now() - t0;
    console.log(`[API ANCON third-party] SOBAT plans ready in ${elapsed}ms`);

    return NextResponse.json({
      success: true,
      online: apiOnline,
      isRealAPI: true,
      plans,
      noCotizacion: basicCotizacion,
      _timing: { totalMs: elapsed },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[API ANCON third-party] Error:', msg);
    return NextResponse.json({
      success: false,
      online: false,
      error: msg,
      plans: [],
    });
  }
}
