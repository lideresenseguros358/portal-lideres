import { NextRequest, NextResponse } from 'next/server';
import { generarCotizacionAuto, obtenerCoberturasCotizacion } from '@/lib/is/quotes.service';
import type { ISEnvironment } from '@/lib/is/config';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Temporary debug endpoint to inspect raw IS pricing data
 * DELETE after investigation
 */
export async function POST(request: NextRequest) {
  const env: ISEnvironment = 'development';
  
  try {
    const body = await request.json();
    
    // Step 1: Generate quote
    const quoteResult = await generarCotizacionAuto({
      codTipoDoc: body.codTipoDoc || 1,
      nroDoc: body.nroDoc || '8-999-9999',
      nroNit: body.nroDoc || '8-999-9999',
      nombre: body.nombre || 'Cliente',
      apellido: body.apellido || 'Prueba',
      telefono: body.telefono || '60000000',
      correo: body.correo || 'test@test.com',
      codMarca: body.codMarca || 204,
      codModelo: body.codModelo || 1234,
      anioAuto: String(body.anioAuto || 2024),
      sumaAseg: String(body.sumaAseg || 15000),
      codPlanCobertura: body.codPlanCobertura || 0,
      codPlanCoberturaAdic: body.codPlanCoberturaAdic || 0,
      codGrupoTarifa: body.codGrupoTarifa || 0,
      fecNacimiento: body.fecNacimiento || '01/01/1990',
      codProvincia: body.codProvincia || 8,
    }, env);

    if (!quoteResult.success || !quoteResult.idCotizacion) {
      return NextResponse.json({ error: 'Quote failed', details: quoteResult });
    }

    // Step 2: Get coberturas for ALL 3 options
    const [cob1, cob2, cob3] = await Promise.all([
      obtenerCoberturasCotizacion(quoteResult.idCotizacion, 1, env),
      obtenerCoberturasCotizacion(quoteResult.idCotizacion, 2, env),
      obtenerCoberturasCotizacion(quoteResult.idCotizacion, 3, env),
    ]);

    // Step 3: Parse each option's data
    const parseOption = (cobResult: any, tableKey: string) => {
      const table = cobResult.data?.[tableKey] || [];
      let totalPrima = 0;
      const items = table.map((c: any) => {
        const prima = parseFloat(c.PRIMA1 || '0');
        totalPrima += prima;
        return {
          COD_AMPARO: c.COD_AMPARO,
          COBERTURA: c.COBERTURA,
          PRIMA1: c.PRIMA1,
          DEDUCIBLE1: c.DEDUCIBLE1,
          SN_DESCUENTO: c.SN_DESCUENTO,
          LIMITES: c.LIMITES,
          // Include ALL fields to see what else IS sends
          _allFields: Object.keys(c),
          _rawValues: c,
        };
      });
      return { items, totalPrima, count: table.length };
    };

    // cob1 returns Table, Table1, Table2 all at once
    const rawData = cob1.data || {};
    const tableKeys = Object.keys(rawData);

    const option1 = parseOption(cob1, 'Table');
    const option2 = parseOption(cob1, 'Table1');
    const option3 = parseOption(cob1, 'Table2');

    return NextResponse.json({
      quote: {
        idCotizacion: quoteResult.idCotizacion,
        PTOTAL: quoteResult.primaTotal,
        nroCotizacion: quoteResult.nroCotizacion,
      },
      coberturasTableKeys: tableKeys,
      option1: { ...option1, note: 'Table (deducible alto)' },
      option2: { ...option2, note: 'Table1 (deducible medio)' },
      option3: { ...option3, note: 'Table2 (deducible bajo)' },
      analysis: {
        ptotalVsOption1Sum: `PTOTAL=${quoteResult.primaTotal} vs Option1 sum=${option1.totalPrima.toFixed(2)}`,
        ptotalVsOption2Sum: `PTOTAL=${quoteResult.primaTotal} vs Option2 sum=${option2.totalPrima.toFixed(2)}`,
        ptotalVsOption3Sum: `PTOTAL=${quoteResult.primaTotal} vs Option3 sum=${option3.totalPrima.toFixed(2)}`,
        taxCheck6pct: quoteResult.primaTotal ? {
          ptotalPlus6pct: (quoteResult.primaTotal * 1.06).toFixed(2),
          option1SumPlus6pct: (option1.totalPrima * 1.06).toFixed(2),
          option3SumPlus6pct: (option3.totalPrima * 1.06).toFixed(2),
        } : 'no PTOTAL',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
