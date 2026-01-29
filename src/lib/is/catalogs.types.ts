/**
 * Tipos para los catálogos de Internacional de Seguros (IS)
 * Actualizados automáticamente desde la API
 */

export interface ISMarca {
  COD_MARCA: number;
  TXT_DESC: string;
}

export interface ISModelo {
  COD_MARCA: number;
  COD_MODELO: number;
  TXT_DESC: string;
  TIPO_VEHICULO_DESC: string;
}

export interface ISTipoPlan {
  DATO: number;
  TEXTO: string;
  ID_ORDEN: number;
}

export interface ISGrupoTarifa {
  DATO: number;
  TEXTO: string;
  ID_ORDEN?: number;
}

export interface ISPlan {
  DATO: number;
  TEXTO: string;
}

export interface ISTipoDocumento {
  codigoTipoDocumento: number;
  sigla: string;
  nombreTipoDocumento: string;
}

export interface ISCobertura {
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

export interface ISCatalogs {
  marcas: ISMarca[];
  modelos: ISModelo[];
  tipoPlanes: ISTipoPlan[];
  gruposTarifa: ISGrupoTarifa[];
  planes: ISPlan[];
  tipoDocumentos: ISTipoDocumento[];
  lastUpdated: string;
}

export interface ISCotizacionResponse {
  RESOP: number;
  MSG: string;
  IDCOT: number;
  NROCOT: number;
  PTOTAL: number;
}

export interface ISCoberturasResponse {
  Table: ISCobertura[];
}
