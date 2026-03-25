/**
 * Quote Service for La Regional de Seguros
 * Handles RC (DT) and CC quote generation
 */

import { regionalGet, regionalPost } from './http-client';
import { REGIONAL_RC_ENDPOINTS, REGIONAL_CC_ENDPOINTS, getRegionalCredentials } from './config';
import type {
  RegionalRCQuoteResponse,
  RegionalCCQuoteBody,
  RegionalCCQuoteResponse,
} from './types';

// ═══ RC (Daños a Terceros) Quote ═══

export interface RCQuoteInput {
  edad: number;
  sexo: string;
  edocivil: string;
  codMarca: number;
  codModelo: number;
  anio: number;
  endoso: string;       // endoso code from /endosos
  lesiones?: string;    // default "5000*10000"
  danios?: string;      // default "5000"
  gastosMedicos?: string;
}

export async function cotizarRC(input: RCQuoteInput): Promise<RegionalRCQuoteResponse> {
  const creds = getRegionalCredentials();

  const params: Record<string, string> = {
    cToken: creds.token,
    cCodInter: creds.codInter,
    nEdad: input.edad.toString(),
    cSexo: input.sexo,
    cEdocivil: input.edocivil,
    cMarca: input.codMarca.toString(),
    cModelo: input.codModelo.toString(),
    nAnio: input.anio.toString(),
    nMontoVeh: '0',
    nLesiones: input.lesiones || '5000*10000',
    nDanios: input.danios || '5000',
    cEndoso: input.endoso,
    cTipocobert: 'RC',
  };

  if (input.gastosMedicos) {
    params.nGastosMedicos = input.gastosMedicos;
  }

  console.log('[REGIONAL RC Quote] Params:', JSON.stringify(params));

  // Regional cotizar expects all params as REQUEST HEADERS (confirmed by PROD CURL 2026-03-25)
  // headerParamsOnly=true: skip codInter/token/Content-Type defaults — cotizar only needs Authorization+cToken etc.
  const res = await regionalGet<RegionalRCQuoteResponse>(
    REGIONAL_RC_ENDPOINTS.COTIZAR,
    undefined,
    { headerParams: params, headerParamsOnly: true }
  );

  if (!res.success) {
    return {
      success: false,
      message: res.error || 'Error cotizando RC',
    };
  }

  const data = res.data || (res.raw as RegionalRCQuoteResponse);
  console.log('[REGIONAL RC Quote] Response:', JSON.stringify(data).slice(0, 500));

  // Normalize response - Regional may return different structures
  return normalizeQuoteResponse(data);
}

// ═══ CC (Cobertura Completa) Quote ═══

export interface CCQuoteInput {
  nombre: string;
  apellido: string;
  edad: number;
  sexo: string;
  edocivil: string;
  // Identificación
  tppersona?: string;
  tpodoc?: string;
  prov?: number | null;
  letra?: string | null;
  tomo?: number | null;
  asiento?: number | null;
  dv?: number | null;
  pasaporte?: string | null;
  telefono: string;
  celular: string;
  email: string;
  // Vehículo
  vehnuevo?: string;
  codMarca: number;
  codModelo: number;
  anio: number;
  valorVeh: number;
  numPuestos?: number;
  // Cobertura
  endoso: string;
  lesiones?: string;
  danios?: string;
  gastosMedicos?: string;
}

export async function cotizarCC(input: CCQuoteInput): Promise<RegionalCCQuoteResponse> {
  const creds = getRegionalCredentials();

  // CC cotización: POST /regional/auto/cotizacion with JSON body
  // Headers: codInter + token + Authorization (per official API documentation)
  const body: RegionalCCQuoteBody = {
    cliente: {
      nomter: input.nombre,
      apeter: input.apellido,
      edad: input.edad,
      sexo: input.sexo,
      edocivil: input.edocivil,
      identificacion: {
        tppersona: input.tppersona || 'N',
        tpodoc: input.tpodoc || 'C',
        prov: input.prov ?? null,
        letra: input.letra ?? null,
        tomo: input.tomo ?? null,
        asiento: input.asiento ?? null,
        dv: input.dv ?? null,
        pasaporte: input.pasaporte ?? null,
      },
      t1numero: input.telefono,
      t2numero: input.celular,
      email: input.email,
    },
    datosveh: {
      vehnuevo: input.vehnuevo || 'N',
      codmarca: input.codMarca,
      codmodelo: input.codModelo,
      anio: input.anio,
      valorveh: input.valorVeh,
      numpuestos: input.numPuestos || 4,
    },
    tpcobert: '1',
    endoso: input.endoso,
    limites: {
      lescor: input.lesiones || '5000*10000',
      danpro: input.danios || '5000',
      gasmed: input.gastosMedicos || '500*2500',
    },
  };

  console.log('[REGIONAL CC Quote] POST body:', JSON.stringify(body).slice(0, 500));

  const res = await regionalPost<RegionalCCQuoteResponse>(
    REGIONAL_CC_ENDPOINTS.COTIZACION,
    body,
    { useTokenCC: true }
  );

  if (!res.success) {
    return {
      success: false,
      message: res.error || 'Error cotizando CC',
    };
  }

  const data = res.data || (res.raw as RegionalCCQuoteResponse);
  console.log('[REGIONAL CC Quote] Response:', JSON.stringify(data).slice(0, 500));

  return normalizeCCQuoteResponse(data);
}

// ═══ Helpers ═══

function normalizeQuoteResponse(data: unknown): RegionalRCQuoteResponse {
  if (!data || typeof data !== 'object') {
    return { success: false, message: 'Invalid response' };
  }

  const obj = data as Record<string, unknown>;

  // Check for error
  if (obj.success === false || obj.mensaje || obj.message) {
    return {
      success: false,
      message: (obj.mensaje || obj.message || 'Error desconocido') as string,
    };
  }

  // Extract numcot and prima
  const numcot = obj.numcot as number | undefined;
  const primaTotal = (obj.primaTotal || obj.prima || obj.primatotal) as number | undefined;
  const primaAnual = (obj.primaAnual || obj.primaanual) as number | undefined;

  // Extract plans if present
  let planes: unknown[] = [];
  if (Array.isArray(obj.planes)) planes = obj.planes;
  else if (Array.isArray(obj.coberturas)) planes = obj.coberturas;

  return {
    success: true,
    numcot,
    primaTotal,
    primaAnual: primaAnual || primaTotal,
    planes: planes as RegionalRCQuoteResponse['planes'],
    coberturas: (obj.coberturas || []) as RegionalRCQuoteResponse['coberturas'],
    ...obj,
  };
}

function normalizeCCQuoteResponse(data: unknown): RegionalCCQuoteResponse {
  if (!data || typeof data !== 'object') {
    return { success: false, message: 'Invalid response' };
  }

  let obj = data as Record<string, unknown>;

  // PROD response wraps results in { items: [{ numcot, primarc, primacasco, primatotal, ... }] }
  // Unwrap items[0] if present
  if (Array.isArray(obj.items) && obj.items.length > 0) {
    const item = obj.items[0] as Record<string, unknown>;
    // Check for error: numcot null with null primas usually means API error
    if (item.numcot === null && item.primatotal === null) {
      return { success: false, message: 'Cotización no generada — verifique parámetros (cMarca, cModelo, nAnio, nMontoVeh)' };
    }
    obj = item;
  }

  if (obj.success === false || obj.mensaje || (obj.message && !obj.numcot)) {
    return {
      success: false,
      message: (obj.mensaje || obj.message || 'Error desconocido') as string,
    };
  }

  const numcot = (obj.numcot || obj.numCot) as number | undefined;
  if (!numcot) {
    return { success: false, message: 'No se recibió numcot de Regional' };
  }

  return {
    success: true,
    numcot,
    primaTotal: (obj.primatotal || obj.primaTotal || obj.prima) as number | undefined,
    primaAnual: (obj.primaAnual || obj.primaanual || obj.primatotal || obj.primaTotal) as number | undefined,
    coberturas: (obj.coberturas || []) as RegionalCCQuoteResponse['coberturas'],
    deducibles: (obj.deducibles || []) as RegionalCCQuoteResponse['deducibles'],
    cuotas: (obj.cuotas || []) as RegionalCCQuoteResponse['cuotas'],
    ...obj,
  };
}
