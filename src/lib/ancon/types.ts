/**
 * Types for Aseguradora ANCON API
 */

// ═══ Auth ═══
export interface AnconLoginResponse {
  Login: Array<{
    Usuario: string;
    IdCorredor: string;
    Corredor: string;
    IdVendedor: string;
    Vendedor: string;
    Token: string | null;
  }>;
}

export interface AnconTokenValidation {
  Token: Array<{
    Token: string;
    Estado: string; // "TOKEN ACTIVO" | "TOKEN INACTIVO"
    MinutosRestantes: number | null;
  }>;
}

// ═══ Catálogos ═══
export interface AnconMarcaModelo {
  codigo_marca: string;
  nombre_marca: string;
  codigo_modelo: string;
  nombre_modelo: string;
  nombre_tipo: string; // SEDAN, COUPE, CAMIONETA, etc.
}

export interface AnconProducto {
  codigo_ramo: string;
  nombre_ramo: string;
  codigo_subramo: string;
  nombre_subramo: string;
  codigo_producto: string;
  nombre_producto: string;
}

export interface AnconCatalogItem {
  [key: string]: string;
}

// ═══ Cotización ═══
export interface AnconCoverageItem {
  Cobertura: string;
  Limite1: string;
  Descripcion1: string;
  Limite2: string;
  Descripcion2: string;
  Deducible_a: string;
  TarifaPrima_a: string;
  Deducible_b: string;
  TarifaPrima_b: string;
  Deducible_c: string;
  TarifaPrima_c: string;
}

export interface AnconQuoteResponse {
  cotizacion: {
    [key: string]: AnconCoverageItem[]; // opcion1, opcion2, opcion3, opcion4
  };
}

export interface AnconQuoteInput {
  cod_marca: string;
  cod_modelo: string;
  ano: string;
  suma_asegurada: string;
  cod_producto: string;
  cedula: string;
  nombre: string;
  apellido: string;
  vigencia: string; // A = anual
  email: string;
  tipo_persona: string; // N = natural, J = juridico
  fecha_nac: string; // dd/mm/yyyy
  nuevo: string; // 0 = usado, 1 = nuevo
}

export interface AnconQuoteLimitsInput extends AnconQuoteInput {
  cob1limite1: string;
  cob1limite2: string;
  cob2limite1: string;
  cob2limite2: string;
  cob3limite1: string;
  cob3limite2: string;
}

// Parsed/normalized quote for frontend
export interface AnconParsedQuote {
  noCotizacion: string;
  ramo: string;
  subramo: string;
  ageNote: string;
  options: AnconParsedOption[];
}

export interface AnconParsedOption {
  name: string; // opcion1, opcion2, etc.
  coverages: AnconParsedCoverage[];
  totals: {
    primaNetaA: number;
    primaNetaB: number;
    primaNetaC: number;
    impuestoA: number;
    impuestoB: number;
    impuestoC: number;
    totalA: number;
    totalB: number;
    totalC: number;
  };
  noCotizacion: string;
}

export interface AnconParsedCoverage {
  name: string;
  limite1: string;
  descripcion1: string;
  limite2: string;
  descripcion2: string;
  deducibleA: number;
  primaA: number;
  deducibleB: number;
  primaB: number;
  deducibleC: number;
  primaC: number;
}

// ═══ Emisión ═══
export interface AnconGenerarDocumentoInput {
  cod_compania: string;
  cod_sucursal: string;
  ano: string;
  cod_ramo: string;
  cod_subramo: string;
  token: string;
}

export interface AnconGenerarDocumentoResponse {
  no_documento: string; // "0000-00000-00"
}

export interface AnconEmisionInput {
  poliza: string;
  ramo_agt: string;
  vigencia_inicial: string;
  vigencia_final: string;
  primer_nombre: string;
  segundo_nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
  apellido_casada: string;
  tipo_de_cliente: string;
  cedula: string;
  pasaporte: string;
  ruc: string;
  fecha_nacimiento: string;
  sexo: string;
  telefono_Residencial: string;
  telefono_oficina: string;
  telefono_celular: string;
  email: string;
  tipo: string; // "POLIZA"
  fecha_de_registro: string;
  cantidad_de_pago: string;
  codigo_producto_agt: string;
  nombre_producto: string;
  Responsable_de_cobro: string;
  suma_asegurada: string;
  codigo_acreedor: string;
  nombre_acreedor: string;
  cod_marca_agt: string;
  nombre_marca: string;
  cod_modelo_agt: string;
  nombre_modelo: string;
  uso: string;
  codigo_color_agt: string;
  nombre_color_agt: string;
  no_chasis: string;
  nombre_conductor: string;
  apellido_conductor: string;
  sexo_conductor: string;
  placa: string;
  puertas: string;
  pasajeros: string;
  cilindros: string;
  vin: string;
  no_motor: string;
  ano: string;
  direccion: string;
  observacion: string;
  agencia: string;
  direccion_cobros: string;
  descuento: string;
  fecha_primer_pago: string;
  cod_agente: string;
  opcion: string; // A, B, or C
  no_cotizacion: string;
  cod_grupo: string;
  nombre_grupo: string;
  token: string;
  nacionalidad: string;
  pep: string;
  ocupacion: string;
  profesion: string;
  pais_residencia: string;
  actividad_economica: string;
  representante_legal: string;
  nombre_comercial: string;
  aviso_operacion: string;
}

export interface AnconEmisionResponse {
  success: boolean;
  p1?: string; // "0" = success
  p2?: string; // "Exito" or error message
  message?: string;
}

// ═══ Impresión ═══
export interface AnconImpresionPolizaResponse {
  enlace_poliza: string; // URL to PDF
}

export interface AnconImpresionCotizacionResponse {
  enlace_cotizacion: string; // URL to PDF
}

// ═══ Documentos ═══
export interface AnconDocumentoItem {
  id_archivo: string;
  nombre: string;
  requerida: string; // "0" = no, "1" = si
}

export interface AnconSubirDocumentosResponse {
  listado: AnconDocumentoItem[];
}

// ═══ Acreedor ═══
export interface AnconAcreedor {
  cod_acreedor: string;
  nombre: string;
  cedula: string;
}

// ═══ Generic SOAP response wrapper ═══
export interface AnconSoapResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  raw?: unknown;
}
