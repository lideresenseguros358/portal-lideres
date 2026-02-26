import { NextRequest, NextResponse } from 'next/server';
import { generarCotizacionAuto, obtenerCoberturasCotizacion } from '@/lib/is/quotes.service';
import { isGet } from '@/lib/is/http-client';
import type { ISEnvironment } from '@/lib/is/config';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Temporary debug endpoint to inspect raw IS pricing data
 * Generates a fresh quote and dumps ALL raw data from IS
 * DELETE after investigation
 */
export async function POST(request: NextRequest) {
  const env: ISEnvironment = 'development';
  
  try {
    const body = await request.json();
    
    // Use unique nroDoc to bypass dedup cache
    const uniqueDoc = `8-999-${Date.now() % 10000}`;
    
    // Step 1: Generate quote
    const quoteResult = await generarCotizacionAuto({
      codTipoDoc: body.codTipoDoc || 1,
      nroDoc: body.nroDoc || uniqueDoc,
      nroNit: body.nroDoc || uniqueDoc,
      nombre: body.nombre || 'Cliente',
      apellido: body.apellido || 'Prueba',
      telefono: body.telefono || '60000000',
      correo: body.correo || 'test@test.com',
      codMarca: body.codMarca,
      codModelo: body.codModelo,
      anioAuto: String(body.anioAuto),
      sumaAseg: String(body.sumaAseg || 0),
      codPlanCobertura: body.codPlanCobertura,
      codPlanCoberturaAdic: body.codPlanCoberturaAdic || 0,
      codGrupoTarifa: body.codGrupoTarifa,
      fecNacimiento: body.fecNacimiento || '01/01/1990',
      codProvincia: body.codProvincia || 8,
    }, env);

    if (!quoteResult.success || !quoteResult.idCotizacion) {
      return NextResponse.json({ error: 'Quote failed', details: quoteResult });
    }

    return await inspectQuote(quoteResult.idCotizacion, quoteResult.primaTotal, env);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/is/debug-pricing?idCot=XXXXX
 * Inspect an existing cotización's coberturas without generating a new one
 */
export async function GET(request: NextRequest) {
  const env: ISEnvironment = 'development';
  const idCot = request.nextUrl.searchParams.get('idCot');
  
  if (!idCot) {
    return NextResponse.json({ error: 'Missing idCot param' }, { status: 400 });
  }
  
  return await inspectQuote(idCot, null, env);
}

async function inspectQuote(idCotizacion: string, ptotal: number | null | undefined, env: ISEnvironment) {
  // Get coberturas — the API returns ALL 3 options in one call via Table/Table1/Table2
  const cobResult = await obtenerCoberturasCotizacion(idCotizacion, 1, env);

  if (!cobResult.success) {
    return NextResponse.json({ error: 'Coberturas failed', details: cobResult });
  }

  const rawData = cobResult.data || {};
  const tableKeys = Object.keys(rawData);

  // Parse each option's data with full raw fields
  const parseOption = (tableKey: string) => {
    const table = (rawData as any)[tableKey] || [];
    let totalPrima = 0;
    const items = table.map((c: any) => {
      const prima = parseFloat(c.PRIMA1 || '0');
      totalPrima += prima;
      return { ...c, _parsedPrima: prima };
    });
    return { items, totalPrima: Math.round(totalPrima * 100) / 100, count: table.length };
  };

  const option1 = parseOption('Table');
  const option2 = parseOption('Table1');
  const option3 = parseOption('Table2');

  // Analyze discount fields
  const analyzeDiscounts = (items: any[]) => {
    return items.map(c => ({
      cobertura: c.COBERTURA,
      cod_amparo: c.COD_AMPARO,
      prima1: c.PRIMA1,
      sn_descuento: c.SN_DESCUENTO,
      deducible1: c.DEDUCIBLE1,
      // Look for any percentage/discount fields
      ...(c.PCT_DESCUENTO !== undefined && { pct_descuento: c.PCT_DESCUENTO }),
      ...(c.PJEDESC !== undefined && { pje_desc: c.PJEDESC }),
      ...(c.PJE_BEXP !== undefined && { pje_bexp: c.PJE_BEXP }),
      ...(c.DESCUENTO !== undefined && { descuento: c.DESCUENTO }),
      ...(c.PRIMA_SIN_DESC !== undefined && { prima_sin_desc: c.PRIMA_SIN_DESC }),
      ...(c.PRIMA2 !== undefined && { prima2: c.PRIMA2 }),
      ...(c.PRIMA3 !== undefined && { prima3: c.PRIMA3 }),
    }));
  };

  return NextResponse.json({
    idCotizacion,
    PTOTAL_from_generarcotizacion: ptotal,
    tableKeysInResponse: tableKeys,
    allFieldsInFirstRow: option1.items[0] ? Object.keys(option1.items[0]) : [],
    
    option1_Table: {
      note: 'Option 1 (deducible más alto)',
      totalPrimaSum: option1.totalPrima,
      count: option1.count,
      discountAnalysis: analyzeDiscounts(option1.items),
    },
    option2_Table1: {
      note: 'Option 2 (deducible medio)',
      totalPrimaSum: option2.totalPrima,
      count: option2.count,
      discountAnalysis: analyzeDiscounts(option2.items),
    },
    option3_Table2: {
      note: 'Option 3 (deducible más bajo)',
      totalPrimaSum: option3.totalPrima,
      count: option3.count,
      discountAnalysis: analyzeDiscounts(option3.items),
    },
    
    analysis: {
      ptotal_vs_sums: {
        PTOTAL: ptotal,
        option1Sum: option1.totalPrima,
        option2Sum: option2.totalPrima,
        option3Sum: option3.totalPrima,
        ptotal_equals_opt1: ptotal !== null ? Math.abs((ptotal || 0) - option1.totalPrima) < 0.02 : 'unknown',
        ptotal_includes_tax_check: ptotal !== null ? {
          'opt1 * 1.06': Math.round(option1.totalPrima * 1.06 * 100) / 100,
          'opt1 * 1.05': Math.round(option1.totalPrima * 1.05 * 100) / 100,
          'ptotal / 1.06': Math.round((ptotal || 0) / 1.06 * 100) / 100,
          'ptotal / 1.05': Math.round((ptotal || 0) / 1.05 * 100) / 100,
        } : 'unknown',
      },
      portalBug_hypothesis: 'Portal uses PTOTAL (option 1) as base for ALL options, then adds 6% tax. But PTOTAL may already include tax and is only for option 1.',
    },
  });
}
