/**
 * Configuración para Aseguradora ANCON
 * SOAP API for cotización + emisión
 */

// ═══ URLs ═══
export const ANCON_SOAP_URL =
  process.env.ANCON_SOAP_URL ||
  'https://app.asegurancon.com/ws_emisiones/server_otros.php';

export const ANCON_REST_URL =
  process.env.ANCON_REST_URL ||
  'https://app.asegurancon.com:4443/SFIntegrationServiceApi.Api';

// ═══ Credentials ═══
export function getAnconCredentials() {
  return {
    usuario: process.env.ANCON_USUARIO || '01009',
    password: process.env.ANCON_PASSWORD || '750840840940840',
    codAgente: process.env.ANCON_COD_AGENTE || '01009',
    codCompania: '001',
    codSucursal: '009',
    nroLicencia: '750',
  };
}

export const INSURER_SLUG = 'ANCON';

// ═══ SOAP Methods ═══

// Auth
export const ANCON_AUTH_METHODS = {
  GENERAR_TOKEN: 'GenerarToken',
  VALIDAR_TOKEN: 'ValidarToken',
} as const;

// Cotización
export const ANCON_QUOTE_METHODS = {
  ESTANDAR: 'Estandar',
  ESTANDAR_LIMITES: 'EstandarLimites',
  IMPRESION_COTIZACION: 'ImpresionCotizacion',
} as const;

// Catálogos
export const ANCON_CATALOG_METHODS = {
  LISTA_MARCA_MODELOS: 'ListaMarcaModelos',
  LISTA_PRODUCTOS: 'Listaproductos',
  LISTA_PEP: 'ListaPep',
  LISTA_OCUPACION: 'ListaOcupacion',
  LISTA_PROFESION: 'ListaProfesion',
  LISTA_PAIS: 'ListaPais',
  LISTA_ACTIVIDAD: 'ListaActividad',
  LISTA_ORIGEN_FONDO: 'ListaOrigenFondo',
  LISTA_PROVINCIA: 'ListaProvincia',
  LISTA_FRECUENCIA_PAGO: 'ListaFrecuenciaPago',
  LISTA_FORMA_PAGO: 'ListaFormaPago',
  LISTA_MONTO_INGRESO: 'ListaMontoIngreso',
  LISTA_NEGATIVAS: 'ListaNegativas',
  LISTA_ONG_FRANCAS: 'ListaOngFrancas',
  LISTA_ASEGURADO_CONTRATANTE: 'ListaAseguradoContratante',
  TERCERO_CONTRATANTE: 'TerceroContratante',
  BENEFICIARIO_CONTRATANTE: 'BeneficiarioContratante',
  TIPO_CLIENTE: 'TipoCliente',
  TIPO_IDENTIFICACION: 'TipoIdentificacion',
  LISTA_ANIO_CONSTITUCION: 'ListaAnioConstitucion',
  GENERAR_ACREEDORES: 'GenerarAcreedores',
} as const;

// Emisión
export const ANCON_EMISSION_METHODS = {
  GENERAR_NODOCUMENTO: 'GenerarNodocumento',
  GUARDAR_CLIENTE: 'GuardarCliente',
  SUBIR_DOCUMENTOS: 'SubirDocumentos',
  LISTADO_EXPEDIENTES: 'ListadoExpedientes',
  LISTADO_INSPECCION: 'ListadoInspeccion',
  ENLAZAR_INSPECCION: 'EnlazarInspeccion',
  EMISION_SERVER: 'EmitirDatos',
  IMPRESION_POLIZA: 'ImpresionPoliza',
} as const;

// ═══ Product Codes ═══
export const ANCON_PRODUCTS = {
  AUTO_COMPLETA: '00312',  // Cobertura Completa
  AUTO_RC: '07159',         // WEB - AUTORC (Daños a Terceros / RC)
} as const;

// ═══ Ramo/Subramo for auto ═══
export const ANCON_RAMO = {
  AUTOMOVIL: { codigo: '002', subramo: '001' },
} as const;

// ═══ Token TTL ═══
export const TOKEN_TTL_MS = 55 * 60 * 1000; // 55 min (token lasts 60 min, refresh early)

// ═══ Retry config ═══
export const RETRY_CONFIG = {
  maxRetries: 2,
  baseDelays: [1000, 3000],
};

// ═══ Cache TTL ═══
export const CACHE_TTL = {
  CATALOGS: 24 * 60 * 60 * 1000,  // 24h
  TOKEN: TOKEN_TTL_MS,
};
