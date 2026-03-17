/**
 * Quote Service for Aseguradora ANCON
 * Handles Estandar and EstandarLimites cotizaciones
 */

import { anconCall } from './http-client';
import { ANCON_QUOTE_METHODS } from './config';
import type {
  AnconQuoteInput,
  AnconQuoteResponse,
  AnconCoverageItem,
  AnconParsedQuote,
  AnconParsedOption,
  AnconParsedCoverage,
  AnconSoapResponse,
} from './types';

/**
 * Get a standard quote (3 default limit sets, returns 4 options x 3 deducible levels)
 */
export async function cotizarEstandar(
  input: AnconQuoteInput
): Promise<AnconSoapResponse<AnconParsedQuote>> {
  const result = await anconCall<AnconQuoteResponse>(
    ANCON_QUOTE_METHODS.ESTANDAR,
    {
      cod_marca: input.cod_marca,
      cod_modelo: input.cod_modelo,
      ano: input.ano,
      suma_asegurada: input.suma_asegurada,
      cod_producto: input.cod_producto,
      cedula: input.cedula,
      nombre: input.nombre,
      apellido: input.apellido,
      vigencia: input.vigencia,
      email: input.email,
      tipo_persona: input.tipo_persona,
      fecha_nac: input.fecha_nac,
      nuevo: input.nuevo,
    }
  );

  if (!result.success || !result.data) {
    return { success: false, error: result.error || 'Error cotizando ANCON' };
  }

  const parsed = parseQuoteResponse(result.data);
  if (!parsed) {
    return { success: false, error: 'No se pudo parsear la cotización ANCON' };
  }

  return { success: true, data: parsed };
}

/**
 * Get a quote with custom limits
 */
export async function cotizarEstandarLimites(
  input: AnconQuoteInput & {
    cob1limite1: string;
    cob1limite2: string;
    cob2limite1: string;
    cob2limite2: string;
    cob3limite1: string;
    cob3limite2: string;
  }
): Promise<AnconSoapResponse<AnconParsedQuote>> {
  const result = await anconCall<AnconQuoteResponse>(
    ANCON_QUOTE_METHODS.ESTANDAR_LIMITES,
    {
      cod_marca: input.cod_marca,
      cod_modelo: input.cod_modelo,
      ano: input.ano,
      suma_asegurada: input.suma_asegurada,
      cod_producto: input.cod_producto,
      cedula: input.cedula,
      nombre: input.nombre,
      apellido: input.apellido,
      vigencia: input.vigencia,
      email: input.email,
      tipo_persona: input.tipo_persona,
      fecha_nac: input.fecha_nac,
      nuevo: input.nuevo,
      cob1limite1: input.cob1limite1,
      cob1limite2: input.cob1limite2,
      cob2limite1: input.cob2limite1,
      cob2limite2: input.cob2limite2,
      cob3limite1: input.cob3limite1,
      cob3limite2: input.cob3limite2,
    }
  );

  if (!result.success || !result.data) {
    return { success: false, error: result.error || 'Error cotizando ANCON con límites' };
  }

  const parsed = parseQuoteResponse(result.data);
  if (!parsed) {
    return { success: false, error: 'No se pudo parsear la cotización ANCON' };
  }

  return { success: true, data: parsed };
}

// ═══ Parsers ═══

function parseQuoteResponse(data: AnconQuoteResponse): AnconParsedQuote | null {
  const cotizacion = data?.cotizacion;
  if (!cotizacion) return null;

  const options: AnconParsedOption[] = [];
  let noCotizacion = '';
  let ramo = '';
  let subramo = '';
  let ageNote = '';

  for (const [key, coverages] of Object.entries(cotizacion)) {
    if (!Array.isArray(coverages)) continue;

    const parsed = parseOption(key, coverages);
    if (parsed) {
      options.push(parsed);
      // Extract metadata from first option
      if (!noCotizacion) {
        noCotizacion = parsed.noCotizacion;
      }
    }

    // Extract ramo/subramo/age from NoCotizacion entry
    const noCotEntry = coverages.find((c) => c.Cobertura === 'NoCotizacion');
    if (noCotEntry) {
      if (!ramo) ramo = noCotEntry.Deducible_a;
      if (!subramo) subramo = noCotEntry.TarifaPrima_a;
      if (!ageNote) ageNote = noCotEntry.Descripcion2;
    }
  }

  if (options.length === 0) {
    // Check for error in first option
    const firstKey = Object.keys(cotizacion)[0];
    const firstCoverages = firstKey ? cotizacion[firstKey] : undefined;
    if (firstCoverages && Array.isArray(firstCoverages)) {
      const errorEntry = firstCoverages.find(
        (c) => c.Cobertura !== 'NoCotizacion' && c.Cobertura !== 'Totales' && c.Cobertura !== 'Totales_N' && c.Cobertura !== 'Totales_I'
      );
      if (errorEntry && parseFloat(errorEntry.TarifaPrima_a) === 0) {
        return null; // All primas are 0 — likely an error/rejection
      }
    }
    return null;
  }

  return {
    noCotizacion,
    ramo,
    subramo,
    ageNote,
    options,
  };
}

function parseOption(name: string, coverages: AnconCoverageItem[]): AnconParsedOption | null {
  const parsedCoverages: AnconParsedCoverage[] = [];
  let totalsN = { a: 0, b: 0, c: 0 };
  let totalsI = { a: 0, b: 0, c: 0 };
  let totals = { a: 0, b: 0, c: 0 };
  let noCotizacion = '';

  for (const cov of coverages) {
    const covName = cov.Cobertura;

    if (covName === 'Totales_N') {
      totalsN = {
        a: parseNum(cov.TarifaPrima_a),
        b: parseNum(cov.TarifaPrima_b),
        c: parseNum(cov.TarifaPrima_c),
      };
      continue;
    }

    if (covName === 'Totales_I') {
      totalsI = {
        a: parseNum(cov.TarifaPrima_a),
        b: parseNum(cov.TarifaPrima_b),
        c: parseNum(cov.TarifaPrima_c),
      };
      continue;
    }

    if (covName === 'Totales') {
      totals = {
        a: parseNum(cov.TarifaPrima_a),
        b: parseNum(cov.TarifaPrima_b),
        c: parseNum(cov.TarifaPrima_c),
      };
      continue;
    }

    if (covName === 'NoCotizacion') {
      noCotizacion = cov.Descripcion1;
      continue;
    }

    // Regular coverage
    parsedCoverages.push({
      name: covName,
      limite1: cov.Limite1,
      descripcion1: cov.Descripcion1,
      limite2: cov.Limite2,
      descripcion2: cov.Descripcion2,
      deducibleA: parseNum(cov.Deducible_a),
      primaA: parseNum(cov.TarifaPrima_a),
      deducibleB: parseNum(cov.Deducible_b),
      primaB: parseNum(cov.TarifaPrima_b),
      deducibleC: parseNum(cov.Deducible_c),
      primaC: parseNum(cov.TarifaPrima_c),
    });
  }

  // Skip empty options
  if (totals.a === 0 && totals.b === 0 && totals.c === 0) return null;

  return {
    name,
    coverages: parsedCoverages,
    totals: {
      primaNetaA: totalsN.a,
      primaNetaB: totalsN.b,
      primaNetaC: totalsN.c,
      impuestoA: totalsI.a,
      impuestoB: totalsI.b,
      impuestoC: totalsI.c,
      totalA: totals.a,
      totalB: totals.b,
      totalC: totals.c,
    },
    noCotizacion,
  };
}

function parseNum(val: string): number {
  if (!val || val === '--') return 0;
  return parseFloat(val.replace(/,/g, '')) || 0;
}

/**
 * Determine if a quote option is DT-only (no COMPRENSIVO, COLISION, etc.)
 */
export function isDTOption(option: AnconParsedOption): boolean {
  const ccCoverages = ['COMPRENSIVO', 'COLISION O VUELCO', 'INCENDIO', 'ROBO'];
  return !option.coverages.some((c) =>
    ccCoverages.some((cc) => c.name.toUpperCase().includes(cc))
  );
}

/**
 * Extract DT-only coverages from a quote (for third-party comparison)
 */
export function extractDTCoverages(option: AnconParsedOption): AnconParsedCoverage[] {
  const dtNames = ['LESIONES CORPORALES', 'DAÑOS A LA PROPIEDAD AJENA', 'ASISTENCIA MEDICA', 'MUERTE ACCIDENTAL'];
  return option.coverages.filter((c) =>
    dtNames.some((dt) => c.name.toUpperCase().includes(dt))
  );
}
