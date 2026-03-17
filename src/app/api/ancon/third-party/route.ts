/**
 * API Endpoint: ANCON Third-Party (DT) Plans
 * GET /api/ancon/third-party
 *
 * Returns basic + premium DT plans with real pricing from ANCON cotización API
 * ANCON only has CC products (AUTO COMPLETA), so we extract DT-relevant coverages
 */

import { NextResponse } from 'next/server';
import { cotizarEstandar } from '@/lib/ancon/quotes.service';
import type { AnconParsedOption } from '@/lib/ancon/types';

export const maxDuration = 30;

export async function GET() {
  const t0 = Date.now();

  try {
    // Use a generic vehicle for DT pricing (suma_asegurada must be >= 6500 for ANCON)
    const result = await cotizarEstandar({
      cod_marca: '00122',   // TOYOTA
      cod_modelo: '10393',  // COROLLA
      ano: String(new Date().getFullYear()),
      suma_asegurada: '15000',
      cod_producto: '00312', // AUTO COMPLETA
      cedula: '8-888-9999',
      nombre: 'COTIZACION',
      apellido: 'WEB',
      vigencia: 'A',
      email: 'cotizacion@lideresenseguros.com',
      tipo_persona: 'N',
      fecha_nac: '16/06/1994',
      nuevo: '0',
    });

    if (!result.success || !result.data) {
      console.error('[API ANCON third-party] Cotización failed:', result.error);
      return NextResponse.json({
        success: false,
        online: false,
        error: result.error,
        plans: [],
      });
    }

    const { options, noCotizacion } = result.data;

    // opcion1 = basic limits (5k/10k LC, 5k DPA)
    // opcion3 = premium limits (25k/50k LC, 25k DPA)
    const basicOption = options.find(o => o.name === 'opcion1');
    const premiumOption = options.find(o => o.name === 'opcion3') || options.find(o => o.name === 'opcion2');

    const plans = [];

    if (basicOption) {
      plans.push(buildDTPlan(basicOption, 'basic', noCotizacion));
    }
    if (premiumOption) {
      plans.push(buildDTPlan(premiumOption, 'premium', noCotizacion));
    }

    const elapsed = Date.now() - t0;
    console.log(`[API ANCON third-party] ${plans.length} plans in ${elapsed}ms`);

    return NextResponse.json({
      success: true,
      online: true,
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

function buildDTPlan(option: AnconParsedOption, planType: 'basic' | 'premium', noCotizacion: string) {
  // Extract DT-relevant coverages only
  const dtCoverageNames = [
    'LESIONES CORPORALES',
    'DAÑOS A LA PROPIEDAD AJENA',
    'ASISTENCIA MEDICA',
    'MUERTE ACCIDENTAL',
    'ASISTENCIA VIAL LIMITADA',
    'REEMBOLSO PARA AUTO SUSTITUTO ANCON PLUS',
  ];

  const dtCoverages = option.coverages.filter(c =>
    dtCoverageNames.some(n => c.name.toUpperCase().includes(n))
  );

  const coverageList = dtCoverages.map(c => ({
    code: c.name.substring(0, 3).toUpperCase(),
    name: c.name,
    limit: formatLimit(c.limite1, c.descripcion1, c.limite2, c.descripcion2),
    prima: c.primaA,
  }));

  // DT total = sum of DT coverages only (option a = lowest deducible)
  const dtTotal = dtCoverages.reduce((sum, c) => sum + c.primaA, 0);

  // Add impuesto proportionally
  const fullTotal = option.totals.totalA;
  const fullNeta = option.totals.primaNetaA;
  const taxRate = fullNeta > 0 ? (fullTotal - fullNeta) / fullNeta : 0.07;
  const dtWithTax = Math.round(dtTotal * (1 + taxRate) * 100) / 100;

  const endosoBenefits = [];
  if (dtCoverages.some(c => c.name.includes('ASISTENCIA VIAL'))) {
    endosoBenefits.push('Asistencia vial limitada incluida');
  }
  if (dtCoverages.some(c => c.name.includes('ANCON PLUS'))) {
    endosoBenefits.push('Reembolso para auto sustituto ANCON Plus');
  }
  endosoBenefits.push('Coordinación de envío de ambulancia');
  endosoBenefits.push('Transmisión de mensajes urgentes');

  return {
    planType,
    name: planType === 'basic' ? 'Plan Básico' : 'Plan Premium',
    annualPremium: Math.round(dtWithTax),
    coverageList,
    endosoBenefits,
    endoso: planType === 'basic' ? 'Endoso Básico ANCON' : 'Endoso Premium ANCON Plus',
    noCotizacion: option.noCotizacion || noCotizacion,
    optionName: option.name,
  };
}

function formatLimit(l1: string, d1: string, l2: string, d2: string): string {
  const parts = [];
  if (l1 && l1 !== '0.00' && l1 !== '0') {
    parts.push(`$${l1}${d1 ? ` ${d1}` : ''}`);
  }
  if (l2 && l2 !== '0.00' && l2 !== '0') {
    parts.push(`$${l2}${d2 ? ` ${d2}` : ''}`);
  }
  if (parts.length === 0) return 'INCLUIDO';
  return parts.join(' / ');
}
