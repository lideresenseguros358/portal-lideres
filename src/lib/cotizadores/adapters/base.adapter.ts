/**
 * ADAPTADOR BASE PARA ASEGURADORAS
 * Define la interfaz común que todas las aseguradoras deben implementar
 */

export interface Marca {
  codigo: string;
  nombre: string;
}

export interface Modelo {
  codigo: string;
  nombre: string;
  codigoMarca: string;
}

export interface Plan {
  codigo: string;
  nombre: string;
  descripcion?: string;
}

export interface CotizacionRequest {
  // Cliente
  nombre: string;
  apellido: string;
  cedula: string;
  telefono: string;
  email: string;
  fechaNacimiento: string;
  
  // Vehículo
  codigoMarca: string;
  codigoModelo: string;
  anio: number;
  valorVehiculo: number;
  
  // Coberturas
  codigoPlan: string;
  lesionesCorpora?: number;
  daniosPropiedad?: number;
  gastosMedicos?: number;
  deducible?: number;
}

export interface CotizacionResponse {
  success: boolean;
  idCotizacion?: string;
  prima?: number;
  detalles?: any;
  error?: string;
}

/**
 * Interface que todas las aseguradoras deben implementar
 */
export interface AseguradoraAdapter {
  nombre: string;
  slug: string;
  
  // Catálogos
  getMarcas(): Promise<Marca[]>;
  getModelos(codigoMarca?: string): Promise<Modelo[]>;
  getPlanes(): Promise<Plan[]>;
  
  // Cotización
  cotizar(request: CotizacionRequest): Promise<CotizacionResponse>;
  
  // Emisión
  emitir?(idCotizacion: string, datosPago: any): Promise<any>;
  
  // Validaciones específicas de cada aseguradora
  validarCampos?(data: Partial<CotizacionRequest>): { valid: boolean; errors: string[] };
  
  // Campos requeridos u opcionales por aseguradora
  getCamposRequeridos?(): string[];
  getCamposOpcionales?(): string[];
}

/**
 * Registro de adaptadores disponibles
 */
export const adaptadores: Record<string, AseguradoraAdapter> = {};

/**
 * Registrar un nuevo adaptador
 */
export function registrarAdaptador(adaptador: AseguradoraAdapter) {
  adaptadores[adaptador.slug] = adaptador;
  console.log(`[Cotizadores] Adaptador registrado: ${adaptador.nombre} (${adaptador.slug})`);
}

/**
 * Obtener adaptador por slug de aseguradora
 */
export function getAdaptador(slug: string): AseguradoraAdapter | null {
  return adaptadores[slug] || null;
}
