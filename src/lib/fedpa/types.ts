/**
 * Tipos TypeScript para FEDPA
 * Interfaces para requests/responses de ambas APIs
 */

import { FedpaEnvironment } from './config';

// ============================================
// AUTENTICACIÓN (EmisorPlan)
// ============================================

export interface TokenRequest {
  usuario: string;
  clave: string;
  Amb: 'DEV' | 'PROD';
}

export interface TokenResponse {
  success: boolean;
  token?: string;
  Token?: string;
  access_token?: string;
  AccessToken?: string;
  jwt?: string;
  registrado?: boolean;
  msg?: string;
  message?: string;
  error?: string;
  data?: {
    token?: string;
    Token?: string;
  };
}

// ============================================
// PLANES Y COBERTURAS (EmisorPlan)
// ============================================

export interface PlanCobertura {
  cobertura: string;
  descripcion: string;
  limite: string;
  prima: number;
}

export interface PlanUso {
  uso: string;
  descripcion: string;
}

export interface Plan {
  plan: number;
  tipoplan: string; // "DAÑOS A TERCEROS" | "COBERTURA COMPLETA"
  descripcion: string;
  ramo: string; // "04"
  subramo: string; // "07"
  prima: number;
  impuesto1: number; // 5%
  impuesto2: number; // 1%
  primaconimpuesto: number;
  sincronizado: boolean;
  coberturas: PlanCobertura[];
  usos: PlanUso[];
}

export interface PlanesResponse {
  success: boolean;
  data?: Plan[];
  message?: string;
  error?: string;
}

export interface BeneficiosResponse {
  success: boolean;
  plan?: number;
  data?: Array<{ beneficio: string }>;
  message?: string;
  error?: string;
}

// ============================================
// LÍMITES (Emisor Externo)
// ============================================

export interface Limite {
  CODCOBERTURA: number;
  IDLIMITE: number;
  LIMITE: string; // "10,000.00/20,000.00"
}

export interface LimitesResponse {
  success?: boolean;
  data?: Limite[];
  message?: string;
  error?: string;
}

// ============================================
// USOS (Emisor Externo)
// ============================================

export interface Uso {
  USO: string;
  DESCRIPCION: string;
}

export interface UsosResponse {
  success?: boolean;
  data?: Uso[];
  message?: string;
  error?: string;
}

// ============================================
// PLANES ASIGNADOS (Emisor Externo)
// ============================================

export interface PlanAsignado {
  PLAN: number;
  NOMBREPLAN: string;
  USO: string;
}

export interface PlanesAsignadosResponse {
  success?: boolean;
  data?: PlanAsignado[];
  message?: string;
  error?: string;
}

// ============================================
// COTIZACIÓN (Emisor Externo)
// ============================================

export interface CotizacionRequest {
  Ano: number | string;
  Uso: string;
  CantidadPasajeros: number;
  SumaAsegurada: string | number;
  CodLimiteLesiones: string | number;
  CodLimitePropiedad: string | number;
  CodLimiteGastosMedico: string | number;
  EndosoIncluido: 'S' | 'N';
  CodPlan: string | number;
  CodMarca: string;
  CodModelo: string;
  Nombre: string;
  Apellido: string;
  Cedula: string;
  Telefono: string;
  Email: string;
  Usuario: string;
  Clave: string;
}

export interface CoberturaCotizacion {
  cobertura: string;
  descripcion: string;
  prima: number;
  impuesto1: number; // 5%
  impuesto2: number; // 1%
  primaConImpuesto: number;
}

export interface CotizacionResponse {
  success: boolean;
  idCotizacion?: string;
  coberturas?: CoberturaCotizacion[];
  primaBase?: number;
  totalImpuesto1?: number; // 5%
  totalImpuesto2?: number; // 1%
  primaTotal?: number;
  sincronizado?: boolean;
  message?: string;
  error?: string;
}

// ============================================
// DOCUMENTOS (EmisorPlan)
// ============================================

export interface SubirDocumentosRequest {
  files: File[];
  tiposDocumento: Array<'documento_identidad' | 'licencia_conducir' | 'registro_vehicular'>;
}

export interface SubirDocumentosResponse {
  success: boolean;
  idDoc?: string;
  msg?: string;
  files?: string[];
  message?: string;
  error?: string;
}

// ============================================
// EMISIÓN (EmisorPlan)
// ============================================

export interface EmitirPolizaRequest {
  Plan: number;
  idDoc: string;
  
  // Cliente
  PrimerNombre: string;
  PrimerApellido: string;
  SegundoNombre?: string;
  SegundoApellido?: string;
  Identificacion: string;
  FechaNacimiento: string; // dd/mm/yyyy
  Sexo: 'M' | 'F';
  Ocupacion?: number;
  Direccion: string;
  Telefono: number | string;
  Celular: number | string;
  Email: string;
  esPEP: 0 | 1;
  Acreedor?: string;
  
  // Vehículo
  sumaAsegurada?: number;
  Uso: string;
  Marca: string;
  Modelo: string;
  Ano: string | number;
  Motor: string;
  Placa: string;
  MesVencimientoPlaca?: string;
  Vin: string;
  Color: string;
  Pasajero: number;
  Puerta: number;
  
  // Opcional
  PrimaTotal?: number;
}

export interface EmitirPolizaResponse {
  success: boolean;
  amb?: string;
  cotizacion?: string;
  poliza?: string;
  desde?: string; // dd/mm/yyyy
  hasta?: string; // dd/mm/yyyy
  message?: string;
  error?: string;
}

// ============================================
// DATOS DEL FORMULARIO (UI)
// ============================================

export interface ClienteFormData {
  primerNombre: string;
  segundoNombre?: string;
  primerApellido: string;
  segundoApellido?: string;
  tipoIdentificacion: 'Cédula' | 'RUC' | 'Pasaporte';
  identificacion: string;
  fechaNacimiento: string; // dd/mm/yyyy
  sexo: 'M' | 'F';
  email: string;
  telefono: string;
  celular: string;
  direccion: string;
  ocupacion?: string;
  esPEP: boolean;
  acreedor?: string;
}

export interface VehiculoFormData {
  ano: number;
  uso: string;
  cantidadPasajeros: number;
  cantidadPuertas: number;
  marca: string; // Código
  marcaDisplay: string; // Nombre para mostrar
  modelo: string; // Código
  modeloDisplay: string; // Nombre para mostrar
  color: string;
  placa: string;
  vin: string;
  motor: string;
  mesVencimientoPlaca?: number;
  sumaAsegurada?: number;
}

export interface LimitesSeleccionados {
  codLimiteLesiones: number;
  codLimitePropiedad: number;
  codLimiteGastosMedico: number;
}

export interface DocumentosInspeccion {
  documento_identidad: File[];
  licencia_conducir: File[];
  registro_vehicular: File[];
}

// ============================================
// CACHE & DB
// ============================================

export interface FedpaToken {
  session_id: string;
  token: string;
  exp: number;
  amb: FedpaEnvironment;
  created_at: string;
}

export interface FedpaCotizacionDB {
  id: string;
  plan_id: number;
  cliente_data: ClienteFormData;
  vehiculo_data: VehiculoFormData;
  limites: LimitesSeleccionados;
  cotizacion_response: CotizacionResponse;
  created_at: string;
}

export interface FedpaEmisionDB {
  id: string;
  cotizacion_id: string;
  id_doc: string;
  emision_request: EmitirPolizaRequest;
  emision_response: EmitirPolizaResponse;
  nro_poliza: string;
  vigencia_desde: string;
  vigencia_hasta: string;
  created_at: string;
}

// ============================================
// HOMOLOGACIÓN MARCA/MODELO
// ============================================

export interface MarcaHomologada {
  cod_marca: string; // "HYU", "TOY", etc.
  display: string; // "HYUNDAI", "TOYOTA", etc.
  activa: boolean;
}

export interface ModeloHomologado {
  cod_marca: string;
  cod_modelo: string; // "GRAND i10", "AJAX", etc.
  display: string;
  activa: boolean;
}

// ============================================
// STEP MANAGEMENT (UI)
// ============================================

export type EmisionStep = 
  | 'plan-selection'
  | 'vehicle-data'
  | 'limites-selection'
  | 'client-data'
  | 'cotizacion'
  | 'documentos'
  | 'review'
  | 'emission';

export interface EmisionFlowData {
  currentStep: EmisionStep;
  planSeleccionado?: Plan;
  vehiculoData?: VehiculoFormData;
  limitesSeleccionados?: LimitesSeleccionados;
  clienteData?: ClienteFormData;
  cotizacionResponse?: CotizacionResponse;
  idDoc?: string;
  documentos?: DocumentosInspeccion;
  emisionResponse?: EmitirPolizaResponse;
}

// ============================================
// ERROR HANDLING
// ============================================

export interface FedpaError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  statusCode?: number;
  data?: T;
  error?: FedpaError | string;
  message?: string;
}
