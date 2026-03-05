/**
 * Types for La Regional de Seguros API
 */

// ═══ Catalog Types ═══

export interface RegionalMarca {
  codmarca: number;
  descripcion: string;
}

export interface RegionalModelo {
  codmodelo: number;
  descripcion: string;
  codmarca?: number;
}

export interface RegionalEndoso {
  codendoso: string;
  descripcion: string;
}

export interface RegionalColor {
  codcolor: string;
  descripcion: string;
}

export interface RegionalGenero {
  codigo: string;
  descripcion: string;
}

export interface RegionalEstadoCivil {
  codigo: string;
  descripcion: string;
}

export interface RegionalPais {
  codpais: number;
  descripcion: string;
}

export interface RegionalProvincia {
  codestado: number;
  descripcion: string;
}

export interface RegionalDistrito {
  codciudad: number;
  descripcion: string;
}

export interface RegionalCorregimiento {
  codmunicipio: number;
  descripcion: string;
}

export interface RegionalUrbanizacion {
  codurb: number;
  descripcion: string;
}

// ═══ RC (DT) Types ═══

export interface RegionalPlanRC {
  codplan: string;
  descripcion: string;
  prima?: number;
}

export interface RegionalRCQuoteParams {
  cToken: string;
  cCodInter: string;
  nEdad: number;
  cSexo: string;
  cEdocivil: string;
  cMarca: string;
  cModelo: string;
  nAnio: number;
  nMontoVeh: number;      // 0 for RC
  nLesiones: string;      // e.g. "5000*10000"
  nDanios: string;        // e.g. "5000"
  nGastosMedicos?: string;
  cEndoso: string;        // endoso code
  cTipocobert: string;    // "RC" or "CC"
}

export interface RegionalRCQuoteResponse {
  success: boolean;
  numcot?: number;
  primaTotal?: number;
  primaAnual?: number;
  planes?: RegionalRCPlanDetail[];
  coberturas?: RegionalCobertura[];
  message?: string;
  [key: string]: unknown;
}

export interface RegionalRCPlanDetail {
  codplan: string;
  descripcion: string;
  prima: number;
  coberturas?: RegionalCobertura[];
}

export interface RegionalCobertura {
  codigo?: string;
  descripcion: string;
  limite?: string;
  prima?: number;
  deducible?: string;
}

// ═══ RC Emission Types ═══

export interface RegionalRCEmissionBody {
  codInter: string;
  plan: string;
  cliente: {
    nomter: string;
    apeter: string;
    fchnac: string;     // YYYY-MM-DD
    edad: number;
    sexo: string;
    edocivil: string;
    t1numero: string;
    t2numero: string;
    email: string;
    direccion: {
      codpais: number;
      codestado: number;
      codciudad: number;
      codmunicipio: number;
      codurb: number;
      dirhab: string;
    };
    identificacion: {
      tppersona: string; // N or J
      tpodoc: string;    // C, R, P
      prov: number | null;
      letra: string | null;
      tomo: number | null;
      asiento: number | null;
      dv: number | null;
      pasaporte: string | null;
    };
  };
  datosveh: {
    codmarca: number;
    codmodelo: number;
    anio: number;
    numplaca: string;
    serialcarroceria: string;
    serialmotor: string;
    color: string;
  };
  condHab: {
    nomter: string;
    apeter: string;
    sexo: string;
    edocivil: string;
  };
}

export interface RegionalRCEmissionResponse {
  success: boolean;
  poliza?: string;
  numcot?: number;
  message?: string;
  [key: string]: unknown;
}

// ═══ CC (Cobertura Completa) Types ═══

export interface RegionalCCQuoteBody {
  cliente: {
    nomter: string;
    apeter: string;
    edad: number;
    sexo: string;
    edocivil: string;
    identificacion: {
      tppersona: string;
      tpodoc: string;
      prov: number | null;
      letra: string | null;
      tomo: number | null;
      asiento: number | null;
      dv: number | null;
      pasaporte: string | null;
    };
    t1numero: string;
    t2numero: string;
    email: string;
  };
  datosveh: {
    vehnuevo: string;  // "N" or "S"
    codmarca: number;
    codmodelo: number;
    anio: number;
    valorveh: number;
    numpuestos: number;
  };
  tpcobert: string;    // "1" for CC, "2" for RC
  endoso: string;      // endoso code
  limites: {
    lescor: string;    // e.g. "5000*10000"
    danpro: string;    // e.g. "5000"
    gasmed: string;    // e.g. "500*2500"
  };
}

export interface RegionalCCQuoteResponse {
  success?: boolean;
  numcot?: number;
  primaTotal?: number;
  primaAnual?: number;
  coberturas?: RegionalCobertura[];
  deducibles?: RegionalDeducible[];
  cuotas?: RegionalCuota[];
  message?: string;
  mensaje?: string;
  [key: string]: unknown;
}

export interface RegionalDeducible {
  codigo?: string;
  descripcion: string;
  monto?: number;
  porcentaje?: number;
}

export interface RegionalCuota {
  numero: number;
  monto: number;
  fecha?: string;
}

// ═══ CC Emission Types ═══

export interface RegionalCCEmissionBody {
  numcot: number;
  cliente: {
    direccion: {
      codpais: number;
      codestado: number;
      codciudad: number;
      codmunicipio: number;
      codurb: number;
      dirhab: string;
    };
    datosCumplimiento: {
      ocupacion: number;
      ingresoAnual: number;
      paisTributa: number;
      pep: string;   // "S" or "N"
    };
  };
  datosveh: {
    vehnuevo: string;
    numplaca: string;
    serialcarroceria: string;
    serialmotor: string;
    color: string;
    usoveh: string;  // "P" particular
    peso: string;    // "L" liviano
  };
  acreedor: string;  // "81" default
}

export interface RegionalCCEmissionResponse {
  success: boolean;
  poliza?: string;
  numcot?: number;
  message?: string;
  [key: string]: unknown;
}

// ═══ Plan Pago Types ═══

export interface RegionalPlanPagoBody {
  numcot: number;
  cuotas: number;
  opcionPrima: number;
}

export interface RegionalPlanPagoResponse {
  success: boolean;
  cuotas?: RegionalCuota[];
  message?: string;
  [key: string]: unknown;
}

// ═══ Imprimir Poliza Types ═══

export interface RegionalImprimirBody {
  poliza: string;
}

export interface RegionalImprimirResponse {
  success: boolean;
  pdf?: string;  // base64 or URL
  message?: string;
  [key: string]: unknown;
}
