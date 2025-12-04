/**
 * Servicio de cotización y emisión para OptiSeguro (Incendio/Contenido)
 * Internacional de Seguros (IS)
 * 
 * ⚠️ PLACEHOLDER - Conectar cuando se obtengan las APIs reales
 */

import { ISEnvironment } from './config';
import { isPost, isGet } from './http-client';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getTodayLocalDate } from '../utils/dates';

// ============================================
// INTERFACES - Adaptar según documentación real
// ============================================

export interface CotizacionIncendioRequest {
  // Cliente
  vcodtipodoc: number;
  vnrodoc: string;
  vnombre: string;
  vapellido: string;
  vtelefono: string;
  vcorreo: string;
  
  // Inmueble
  direccion: string;
  tipo_construccion: string; // concreto, madera, mixto
  anio_construccion: number;
  suma_asegurada: number;
  
  // Seguridad
  tiene_alarma: boolean;
  tiene_extintores: boolean;
  
  // Plan
  vcodplancobertura?: number; // Si OptiSeguro usa códigos de plan
  vcodgrupotarifa?: number;
}

export interface CotizacionContenidoRequest {
  // Cliente
  vcodtipodoc: number;
  vnrodoc: string;
  vnombre: string;
  vapellido: string;
  vtelefono: string;
  vcorreo: string;
  
  // Inmueble
  direccion: string;
  tipo_inmueble?: string; // casa, apartamento, local
  suma_asegurada: number;
  
  // Contenido
  descripcion_contenido?: string;
  
  // Plan
  vcodplancobertura?: number;
  vcodgrupotarifa?: number;
}

export interface EmisionContenidoRequest extends CotizacionContenidoRequest {
  vIdPv: string;
  paymentToken?: string;
}

export interface OptiSeguroResponse {
  success?: boolean;
  idCotizacion?: string;
  IDCOT?: string;
  vIdPv?: string; // Puede variar según IS
  primaTotal?: number;
  prima?: number;
  message?: string;
  error?: string;
}

export interface EmisionOptiSeguroRequest extends CotizacionIncendioRequest {
  vIdPv: string; // ID de cotización
  paymentToken?: string;
}

export interface EmisionOptiSeguroResponse {
  success?: boolean;
  nro_poliza?: string;
  poliza_pdf_url?: string;
  poliza_pdf_base64?: string;
  message?: string;
  error?: string;
}

// ============================================
// ENDPOINTS - Actualizar cuando se tengan las APIs
// ============================================

const OPTISEGURO_ENDPOINTS = {
  // TODO: Obtener endpoints reales de INTERNACIONAL
  COTIZAR_INCENDIO: '/api/optiseguro/incendio/cotizar', // Placeholder
  EMITIR_INCENDIO: '/api/optiseguro/incendio/emitir',   // Placeholder
  COTIZAR_CONTENIDO: '/api/optiseguro/contenido/cotizar', // Placeholder
  EMITIR_CONTENIDO: '/api/optiseguro/contenido/emitir',   // Placeholder
  COBERTURAS: '/api/optiseguro/coberturas', // Placeholder
} as const;

// ============================================
// COTIZACIÓN INCENDIO
// ============================================

/**
 * Generar cotización de Incendio
 * 
 * ⚠️ TODO: Conectar con API real cuando esté disponible
 * Por ahora retorna datos simulados
 */
export async function cotizarIncendio(
  request: CotizacionIncendioRequest,
  env: ISEnvironment = 'development'
): Promise<{ success: boolean; idCotizacion?: string; primaTotal?: number; error?: string }> {
  console.log('[IS OptiSeguro] Cotizando Incendio...', {
    cliente: `${request.vnombre} ${request.vapellido}`,
    direccion: request.direccion,
    suma: request.suma_asegurada,
  });
  
  // TODO: Descomentar cuando se tenga el endpoint real
  /*
  const response = await isPost<OptiSeguroResponse>(
    OPTISEGURO_ENDPOINTS.COTIZAR_INCENDIO,
    request,
    env
  );
  
  if (!response.success) {
    return {
      success: false,
      error: response.error || 'Error al cotizar incendio',
    };
  }
  
  const idCotizacion = response.data?.idCotizacion || response.data?.vIdPv;
  const primaTotal = response.data?.primaTotal || response.data?.prima;
  
  return {
    success: true,
    idCotizacion,
    primaTotal,
  };
  */
  
  // SIMULACIÓN TEMPORAL
  console.warn('[IS OptiSeguro] ⚠️ USANDO DATOS SIMULADOS - Conectar API real');
  
  return {
    success: true,
    idCotizacion: `INC-SIM-${Date.now()}`,
    primaTotal: 450 + Math.random() * 100, // Simulado
  };
}

// ============================================
// COTIZACIÓN CONTENIDO
// ============================================

/**
 * Generar cotización de Contenido
 * 
 * ⚠️ TODO: Conectar con API real cuando esté disponible
 */
export async function cotizarContenido(
  request: CotizacionContenidoRequest,
  env: ISEnvironment = 'development'
): Promise<{ success: boolean; idCotizacion?: string; primaTotal?: number; error?: string }> {
  console.log('[IS OptiSeguro] Cotizando Contenido...', {
    cliente: `${request.vnombre} ${request.vapellido}`,
    direccion: request.direccion,
    suma: request.suma_asegurada,
  });
  
  // TODO: Descomentar cuando se tenga el endpoint real
  /*
  const response = await isPost<OptiSeguroResponse>(
    OPTISEGURO_ENDPOINTS.COTIZAR_CONTENIDO,
    request,
    env
  );
  
  if (!response.success) {
    return {
      success: false,
      error: response.error || 'Error al cotizar contenido',
    };
  }
  
  const idCotizacion = response.data?.idCotizacion || response.data?.vIdPv;
  const primaTotal = response.data?.primaTotal || response.data?.prima;
  
  return {
    success: true,
    idCotizacion,
    primaTotal,
  };
  */
  
  // SIMULACIÓN TEMPORAL
  console.warn('[IS OptiSeguro] ⚠️ USANDO DATOS SIMULADOS - Conectar API real');
  
  return {
    success: true,
    idCotizacion: `CON-SIM-${Date.now()}`,
    primaTotal: 380 + Math.random() * 100, // Simulado
  };
}

// ============================================
// EMISIÓN INCENDIO
// ============================================

/**
 * Emitir póliza de Incendio
 * 
 * ⚠️ TODO: Conectar con API real cuando esté disponible
 */
export async function emitirIncendio(
  request: EmisionOptiSeguroRequest,
  env: ISEnvironment = 'development'
): Promise<{ success: boolean; nroPoliza?: string; pdfUrl?: string; error?: string }> {
  console.log('[IS OptiSeguro] Emitiendo póliza de Incendio...', {
    idCotizacion: request.vIdPv,
    cliente: `${request.vnombre} ${request.vapellido}`,
  });
  
  // TODO: Descomentar cuando se tenga el endpoint real
  /*
  const response = await isPost<EmisionOptiSeguroResponse>(
    OPTISEGURO_ENDPOINTS.EMITIR_INCENDIO,
    request,
    env
  );
  
  if (!response.success) {
    return {
      success: false,
      error: response.error || 'Error al emitir póliza de incendio',
    };
  }
  
  return {
    success: true,
    nroPoliza: response.data?.nro_poliza,
    pdfUrl: response.data?.poliza_pdf_url,
  };
  */
  
  // SIMULACIÓN TEMPORAL
  console.warn('[IS OptiSeguro] ⚠️ USANDO DATOS SIMULADOS - Conectar API real');
  
  return {
    success: true,
    nroPoliza: `POL-INC-${Date.now()}`,
    pdfUrl: undefined, // TODO: Generar o recibir de API
  };
}

// ============================================
// EMISIÓN CONTENIDO
// ============================================

/**
 * Emitir póliza de Contenido
 * 
 * ⚠️ TODO: Conectar con API real cuando esté disponible
 */
export async function emitirContenido(
  request: EmisionContenidoRequest,
  env: ISEnvironment = 'development'
): Promise<{ success: boolean; nroPoliza?: string; pdfUrl?: string; error?: string }> {
  console.log('[IS OptiSeguro] Emitiendo póliza de Contenido...', {
    idCotizacion: request.vIdPv,
    cliente: `${request.vnombre} ${request.vapellido}`,
  });
  
  // TODO: Descomentar cuando se tenga el endpoint real
  /*
  const response = await isPost<EmisionOptiSeguroResponse>(
    OPTISEGURO_ENDPOINTS.EMITIR_CONTENIDO,
    request,
    env
  );
  
  if (!response.success) {
    return {
      success: false,
      error: response.error || 'Error al emitir póliza de contenido',
    };
  }
  
  return {
    success: true,
    nroPoliza: response.data?.nro_poliza,
    pdfUrl: response.data?.poliza_pdf_url,
  };
  */
  
  // SIMULACIÓN TEMPORAL
  console.warn('[IS OptiSeguro] ⚠️ USANDO DATOS SIMULADOS - Conectar API real');
  
  return {
    success: true,
    nroPoliza: `POL-CON-${Date.now()}`,
    pdfUrl: undefined, // TODO: Generar o recibir de API
  };
}

// ============================================
// CREAR CLIENTE Y PÓLIZA EN BD
// ============================================

/**
 * Crear cliente y póliza en BD al emitir
 * Reutiliza lógica similar a AUTO
 */
export async function crearClienteYPolizaOptiSeguro(data: {
  insurer_id: string;
  broker_id: string;
  nro_poliza: string;
  cliente_nombre: string;
  cliente_apellido: string;
  cliente_documento: string;
  cliente_telefono: string;
  cliente_correo: string;
  ramo: 'INCENDIO' | 'CONTENIDO';
  suma_asegurada: number;
  direccion: string;
}): Promise<{ success: boolean; clientId?: string; policyId?: string; error?: string }> {
  const supabase = getSupabaseAdmin();
  
  try {
    const nombreCompleto = `${data.cliente_nombre} ${data.cliente_apellido}`;
    
    // 1. Buscar o crear cliente
    let clientId: string;
    
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id')
      .eq('national_id', data.cliente_documento)
      .eq('broker_id', data.broker_id)
      .single();
    
    if (existingClient) {
      clientId = existingClient.id;
      console.log('[IS OptiSeguro] Cliente existente encontrado:', clientId);
    } else {
      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert({
          name: nombreCompleto,
          national_id: data.cliente_documento,
          email: data.cliente_correo,
          phone: data.cliente_telefono,
          broker_id: data.broker_id,
          active: true,
        })
        .select('id')
        .single();
      
      if (clientError || !newClient) {
        return {
          success: false,
          error: clientError?.message || 'Error creando cliente',
        };
      }
      
      clientId = newClient.id;
      console.log('[IS OptiSeguro] Cliente creado:', clientId);
    }
    
    // 2. Crear póliza
    const notasPoliza = `Dirección: ${data.direccion}\nSuma Asegurada: $${data.suma_asegurada}`;
    
    const { data: newPolicy, error: policyError } = await supabase
      .from('policies')
      .insert({
        client_id: clientId,
        broker_id: data.broker_id,
        insurer_id: data.insurer_id,
        policy_number: data.nro_poliza,
        ramo: data.ramo,
        status: 'ACTIVA',
        start_date: getTodayLocalDate(),
        notas: notasPoliza,
      })
      .select('id')
      .single();
    
    if (policyError || !newPolicy) {
      return {
        success: false,
        error: policyError?.message || 'Error creando póliza',
      };
    }
    
    console.log('[IS OptiSeguro] Póliza creada:', newPolicy.id);
    
    return {
      success: true,
      clientId,
      policyId: newPolicy.id,
    };
  } catch (error: any) {
    console.error('[IS OptiSeguro] Exception:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}
