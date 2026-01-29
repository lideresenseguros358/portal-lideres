/**
 * Tipos completos para cotizaciones IS y FEDPA
 * Basados en documentación oficial de ambas APIs
 */

// ========== COBERTURAS ==========

export interface CoberturaDetalle {
  codigo: string | number;
  nombre: string;
  descripcion: string;
  limite: string;
  prima: number;
  deducible?: string;
  incluida: boolean;
}

// ========== BENEFICIOS ==========

export interface Beneficio {
  nombre: string;
  descripcion?: string;
  incluido: boolean;
}

// ========== ENDOSOS ==========

export interface Endoso {
  codigo: string;
  nombre: string;
  descripcion?: string;
  incluido: boolean;
  valor?: number;
}

// ========== LÍMITES ==========

export interface LimiteCobertura {
  tipo: 'lesiones_corporales' | 'daños_propiedad' | 'gastos_medicos';
  limitePorPersona: string;
  limitePorAccidente?: string;
  descripcion: string;
}

// ========== DEDUCIBLES ==========

export interface DeducibleInfo {
  valor: number;
  tipo: 'bajo' | 'medio' | 'alto';
  descripcion: string;
  aplicaA: string[];
}

// ========== COTIZACIÓN IS ==========

export interface CotizacionIS {
  idCotizacion: string;
  aseguradora: 'INTERNACIONAL';
  plan: {
    codigo: number;
    nombre: string;
    tipo: 'basico' | 'premium';
  };
  coberturas: CoberturaDetalle[];
  limites: LimiteCobertura[];
  deducible: DeducibleInfo;
  primas: {
    base: number;
    impuestos: number;
    total: number;
  };
  vigencia: {
    inicio: string;
    fin: string;
  };
  vehiculo: {
    marca: string;
    modelo: string;
    anio: number;
    sumaAsegurada: number;
  };
  _raw: {
    vIdOpt: number;
    vcodplancobertura: number;
    vcodgrupotarifa: number;
  };
}

// ========== COTIZACIÓN FEDPA ==========

export interface CotizacionFEDPA {
  idCotizacion: string;
  aseguradora: 'FEDPA';
  plan: {
    codigo: string;
    nombre: string;
    tipo: 'basico' | 'premium';
  };
  coberturas: CoberturaDetalle[];
  limites: LimiteCobertura[];
  beneficios: Beneficio[];
  endosos: Endoso[];
  deducible: DeducibleInfo;
  primas: {
    base: number;
    impuesto1: number;
    impuesto2: number;
    total: number;
    sincronizado: boolean;
  };
  vigencia: {
    inicio: string;
    fin: string;
  };
  vehiculo: {
    marca: string;
    modelo: string;
    anio: number;
    sumaAsegurada: number;
    uso: string;
  };
  _raw: {
    endosoIncluido: 'S' | 'N';
    codPlan: string;
    codLimiteLesiones: string;
    codLimitePropiedad: string;
    codLimiteGastosMedico: string;
  };
}

// ========== COTIZACIÓN UNIFICADA ==========

export interface CotizacionCompleta {
  id: string;
  aseguradora: 'INTERNACIONAL' | 'FEDPA';
  
  // Info básica
  planNombre: string;
  planTipo: 'basico' | 'premium';
  esRecomendado: boolean;
  
  // Coberturas y detalles
  coberturas: CoberturaDetalle[];
  limites: LimiteCobertura[];
  beneficios?: Beneficio[];
  endosos?: Endoso[];
  deducible: DeducibleInfo;
  
  // Primas
  primaAnual: number;
  primaBase: number;
  impuestos: number;
  
  // Vehículo
  vehiculo: {
    marca: string;
    modelo: string;
    anio: number;
    sumaAsegurada: number;
  };
  
  // Datos raw para emisión
  _datosIS?: CotizacionIS;
  _datosFEDPA?: CotizacionFEDPA;
}

// ========== RESPUESTA API COBERTURAS IS ==========

export interface ISCoberturaAPI {
  COD_AMPARO: number;
  COBERTURA: string;
  LIMITES: string;
  PRIMA: number;
  DEDUCIBLE1: string;
  PRIMA2: number;
  DEDUCIBLE2: string;
  PRIMA3: number;
  SN_DESCUENTO: string;
  MuestraSUMA: number;
}

// ========== RESPUESTA API COBERTURAS FEDPA ==========

export interface FEDPACoberturaAPI {
  cobertura: string;
  descripcion: string;
  limite: string;
  prima: number;
  deducible?: string;
}

// ========== MAPEO DE DEDUCIBLES ==========

export const DEDUCIBLES_MAP = {
  bajo: {
    valor: 500,
    tipo: 'bajo' as const,
    descripcion: 'Deducible estándar - Cobertura básica',
    aplicaA: ['Colisión', 'Robo', 'Daños propios']
  },
  medio: {
    valor: 250,
    tipo: 'medio' as const,
    descripcion: 'Deducible reducido - Cobertura mejorada',
    aplicaA: ['Colisión', 'Robo', 'Daños propios']
  },
  alto: {
    valor: 100,
    tipo: 'alto' as const,
    descripcion: 'Deducible mínimo - Cobertura premium',
    aplicaA: ['Colisión', 'Robo', 'Daños propios']
  }
};
