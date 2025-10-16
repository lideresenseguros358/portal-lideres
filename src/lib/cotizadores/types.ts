/**
 * Types para el módulo de Cotizadores
 * Interfaz clara para conectar servicios de aseguradoras
 */

export type PolicyType = 'AUTO' | 'VIDA' | 'INCENDIO' | 'CONTENIDO';

export interface QuoteInputBase {
  policyType: PolicyType;
}

// ========== AUTO ==========
export interface AutoQuoteInput extends QuoteInputBase {
  policyType: 'AUTO';
  uso: 'PARTICULAR' | 'COMERCIAL';
  placa?: string;
  marca?: string;
  modelo?: string;
  anno?: number;
  valor?: number;
  cobertura: 'TERCEROS' | 'COMPLETA';
  deduciblePreferido?: number;
  conductorEdad?: number;
  siniestrosUltimos3?: number;
  provincia?: string;
  garajeNocturno?: boolean;
}

// ========== VIDA ==========
export interface VidaQuoteInput extends QuoteInputBase {
  policyType: 'VIDA';
  edad: number;
  sexo: 'M' | 'F';
  fumador: boolean;
  sumaAsegurada: number;
  plazoAnnios?: number;
  ocupacion?: string;
}

// ========== INCENDIO / CONTENIDO ==========
export interface FireContentsQuoteInput extends QuoteInputBase {
  policyType: 'INCENDIO' | 'CONTENIDO';
  tipoInmueble: 'CASA' | 'APTO' | 'LOCAL';
  metros2?: number;
  annoConstruccion?: number;
  provincia?: string;
  seguridad: {
    alarma?: boolean;
    extintor?: boolean;
    rociadores?: boolean;
  };
  sumaEstructura?: number;
  sumaContenido?: number;
}

// ========== QUOTE OPTION (Resultado de cada aseguradora) ==========
export interface QuoteOption {
  insurerId: string;
  insurerName: string;
  insurerLogoUrl?: string;
  planName: string;
  prima: number;
  deducible?: string;
  coberturasClave: string[];
  exclusionesClave?: string[];
  observaciones?: string;
  raw?: any; // Datos crudos de la API
}

// ========== QUOTE RESULT ==========
export interface QuoteResult {
  policyType: PolicyType;
  input: AutoQuoteInput | VidaQuoteInput | FireContentsQuoteInput;
  options: QuoteOption[];
  currency: 'USD';
  generatedAt: string;
}

// ========== QUOTE SERVICE INTERFACE ==========
export interface QuoteService {
  supports: PolicyType[];
  quote(input: QuoteInputBase): Promise<QuoteResult>;
}

// ========== QUOTE STORAGE (localStorage/DB) ==========
export interface StoredQuote {
  quoteId: string;
  policyType: PolicyType;
  input: any;
  optionsCount: number;
  selectedOption?: QuoteOption;
  createdAt: string;
  status: 'DRAFT' | 'SELECTED' | 'PAID' | 'EMITTED';
}

// ========== EMISSION DATA ==========
export interface EmissionData {
  quoteId: string;
  selectedOption: QuoteOption;
  // Datos adicionales por tipo de póliza
  beneficiarios?: Array<{
    nombre: string;
    parentesco: string;
    porcentaje: number;
  }>;
  contacto?: {
    nombre: string;
    email: string;
    telefono: string;
    direccion?: string;
  };
  conductorPrincipal?: {
    nombre: string;
    cedula: string;
    licencia: string;
    edad: number;
  };
  vin?: string; // Para autos
}

// ========== WIX CHECKOUT ==========
export interface WixCheckoutParams {
  quoteId: string;
  amount: number;
  concept: string;
  returnUrl: string;
}
