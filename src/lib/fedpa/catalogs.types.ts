/**
 * Tipos para los catálogos de FEDPA
 * Actualizados automáticamente desde la API
 */

export interface FedpaLimite {
  CODCOBERTURA: number;
  IDLIMITE: number;
  LIMITE: string;
}

export interface FedpaPlan {
  PLAN: number;
  NOMBREPLAN: string;
  USO: string;
}

export interface FedpaBeneficio {
  PLAN: number;
  BENEFICIOS: string;
}

export interface FedpaUso {
  USO: string;
  DESCRIPCION: string;
}

export interface FedpaCatalogs {
  limites: FedpaLimite[];
  planes: FedpaPlan[];
  beneficios: FedpaBeneficio[];
  usos: FedpaUso[];
  lastUpdated: string;
}

export interface FedpaCobertura {
  codigo: number;
  nombre: string;
  descripcion: string;
}

export const FEDPA_COBERTURAS: FedpaCobertura[] = [
  {
    codigo: 1,
    nombre: 'Lesiones Corporales',
    descripcion: 'Límites de responsabilidad civil por lesiones a terceros'
  },
  {
    codigo: 2,
    nombre: 'Daños a la Propiedad',
    descripcion: 'Límites de responsabilidad civil por daños a propiedad ajena'
  },
  {
    codigo: 3,
    nombre: 'Gastos Médicos',
    descripcion: 'Límites de cobertura para gastos médicos'
  }
];
