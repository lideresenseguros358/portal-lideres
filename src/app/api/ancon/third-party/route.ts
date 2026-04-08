/**
 * API Endpoint: ANCON Third-Party (DT) Plans — SOBAT
 * GET /api/ancon/third-party
 *
 * Returns SOBAT RC plans for particulares:
 *   Básico  = SOBAT BASICO TALLER  (B/.145.00) — SODA / PARTICULAR
 *   Premium = SOBAT EXPRESS PLUS    (B/.189.00) — SODA / PARTICULAR
 *
 * Calls ANCON cotización with product 07159 to get a valid noCotizacion
 * for the emission flow, then maps to fixed SOBAT pricing.
 */

import { NextResponse } from 'next/server';
import { cotizarEstandar } from '@/lib/ancon/quotes.service';
import { ANCON_PRODUCTS } from '@/lib/ancon/config';
import { getProductos } from '@/lib/ancon/catalogs.service';

export const maxDuration = 30;

// ═══ SOBAT fixed plans (SODA / PARTICULAR) ═══
const SOBAT_PLANS = {
  basic: {
    name: 'SOBAT BASICO TALLER',
    annualPremium: 145.00,
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

export async function GET() {
  const t0 = Date.now();

  try {
    // ═══ Step 1: Obtain correct product codes from ANCON catalog ═══
    const productosCatalog = await getProductos();

    // Map SOBAT plan names to their ANCON product codes (ramo 002 = AUTOMOVIL)
    let sobatBasicoCode = ANCON_PRODUCTS.AUTO_RC; // fallback to 07159
    let sobatExpressCode = ANCON_PRODUCTS.AUTO_RC; // fallback to 07159

    if (productosCatalog.success && Array.isArray(productosCatalog.data)) {
      const autoProducts = productosCatalog.data.filter(p => p.codigo_ramo === '002');
      const basicMatch = autoProducts.find(p =>
        p.nombre_producto?.toUpperCase().includes('SOBAT') &&
        p.nombre_producto?.toUpperCase().includes('BASICO')
      );
      const premiumMatch = autoProducts.find(p =>
        p.nombre_producto?.toUpperCase().includes('SOBAT') &&
        p.nombre_producto?.toUpperCase().includes('EXPRESS')
      );

      if (basicMatch) {
        sobatBasicoCode = basicMatch.codigo_producto;
        console.log(`[API ANCON third-party] SOBAT BASICO → código ${basicMatch.codigo_producto}`);
      }
      if (premiumMatch) {
        sobatExpressCode = premiumMatch.codigo_producto;
        console.log(`[API ANCON third-party] SOBAT EXPRESS → código ${premiumMatch.codigo_producto}`);
      }
    } else {
      console.warn('[API ANCON third-party] Error loading productos catalog, using fallback codes');
    }

    // ═══ Step 2: Call ANCON to get a valid noCotizacion for the emission flow ═══
    // Use the correct product code (basic plan for initial quote)
    const result = await cotizarEstandar({
      cod_marca: '00122',   // TOYOTA
      cod_modelo: '10393',  // COROLLA
      ano: String(new Date().getFullYear()),
      suma_asegurada: '0',
      cod_producto: sobatBasicoCode,
      cedula: '8-888-9999',
      nombre: 'COTIZACION',
      apellido: 'WEB',
      vigencia: 'A',
      email: 'cotizacion@lideresenseguros.com',
      tipo_persona: 'N',
      fecha_nac: '16/06/1994',
      nuevo: '0',
    });

    // Use noCotizacion from API if available; plans use fixed SOBAT pricing
    const noCotizacion = result.data?.noCotizacion || '';
    const apiOnline = result.success && !!noCotizacion;

    if (!apiOnline) {
      console.warn('[API ANCON third-party] ANCON API offline, returning SOBAT plans without cotización');
    }

    // opcion1 = basic (for linking to ANCON emission)
    const basicOptionName = result.data?.options?.find(o => o.name === 'opcion1')?.name || 'opcion1';
    const premiumOptionName = result.data?.options?.find(o => o.name === 'opcion4')?.name
      || result.data?.options?.find(o => o.name === 'opcion3')?.name || 'opcion3';

    // ═══ Step 3: Build plans with correct product codes ═══
    const plans = [
      buildSobatPlan('basic', noCotizacion, basicOptionName, sobatBasicoCode),
      buildSobatPlan('premium', noCotizacion, premiumOptionName, sobatExpressCode),
    ];

    const elapsed = Date.now() - t0;
    console.log(`[API ANCON third-party] SOBAT plans ready in ${elapsed}ms (cotización: ${noCotizacion || 'N/A'})`);

    return NextResponse.json({
      success: true,
      online: apiOnline,
      isRealAPI: true,
      plans,
      noCotizacion,
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

function buildSobatPlan(
  planType: 'basic' | 'premium',
  noCotizacion: string,
  optionName: string,
  codProducto: string = ANCON_PRODUCTS.AUTO_RC,
) {
  const sobat = SOBAT_PLANS[planType];

  return {
    planType,
    name: sobat.name,
    annualPremium: sobat.annualPremium,
    coverageList: [...sobat.coverageList],
    endosoBenefits: [...sobat.endosoBenefits],
    endoso: sobat.name,
    idCotizacion: noCotizacion,
    noCotizacion,
    optionName,
    _codProducto: codProducto,
    _nombreProducto: sobat.name,
    _sumaAsegurada: '0',
    installments: [
      { count: 1, amount: sobat.annualPremium },
    ],
  };
}
