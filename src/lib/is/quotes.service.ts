/**
 * Servicio de cotización y emisión para Auto
 * Internacional de Seguros (IS)
 */

import { ISEnvironment, IS_ENDPOINTS, CORREDOR_FIJO, INSURER_SLUG } from './config';
import { isPost, isGet } from './http-client';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getTodayLocalDate } from '../utils/dates';

export interface CotizacionAutoRequest {
  // Cliente
  vcodtipodoc: number; // 1=CC, 2=RUC, 3=PAS - DEBE SER NÚMERO
  vnrodoc: string;
  vnombre: string;
  vapellido: string;
  vtelefono: string;
  vcorreo: string;
  
  // Vehículo
  vcodmarca: number; // Código numérico sin decimales (ej: 204 para Toyota)
  vcodmodelo: number; // Código numérico sin decimales (ej: 1234 para Corolla)
  vanioauto: number;
  
  // Cobertura
  vsumaaseg: number;
  vcodplancobertura: number; // Código numérico (ej: 14 para Cobertura Completa)
  vcodgrupotarifa: number; // Código numérico
}

export interface CotizacionAutoResponse {
  vIdPv?: string; // ID de cotización (IDCOT)
  IDCOT?: string; // Alternativa
  success?: boolean;
  message?: string;
  error?: string;
}

export interface CoberturasResponse {
  coberturas?: Array<{
    codigo: string;
    descripcion: string;
    limite?: number;
    minimo?: number;
    maximo?: number;
  }>;
  subtotales?: Record<string, number>;
  primaTotal?: number;
  primaneta?: number;
  iva?: number;
  total?: number;
  sumaAsegurada?: number;
  sumaAseguradaMin?: number;
  sumaAseguradaMax?: number;
}

export interface EmisionAutoRequest extends CotizacionAutoRequest {
  vIdPv: string; // ID de cotización
  paymentToken?: string;
}

export interface EmisionAutoResponse {
  success?: boolean;
  nro_poliza?: string;
  poliza_pdf_url?: string;
  poliza_pdf_base64?: string;
  message?: string;
  error?: string;
}

/**
 * Generar cotización de auto
 */
export async function generarCotizacionAuto(
  request: CotizacionAutoRequest,
  env: ISEnvironment = 'development'
): Promise<{ success: boolean; idCotizacion?: string; error?: string }> {
  console.log('[IS Quotes] Generando cotización auto...', {
    cliente: `${request.vnombre} ${request.vapellido}`,
    vehiculo: `${request.vcodmarca} ${request.vcodmodelo} ${request.vanioauto}`,
  });
  
  const response = await isPost<CotizacionAutoResponse>(
    IS_ENDPOINTS.GENERAR_COTIZACION,
    request,
    env
  );
  
  if (!response.success) {
    console.error('[IS Quotes] Error generando cotización:', response.error);
    return {
      success: false,
      error: response.error || 'Error al generar cotización',
    };
  }
  
  const idCotizacion = response.data?.vIdPv || response.data?.IDCOT;
  
  if (!idCotizacion) {
    console.error('[IS Quotes] Respuesta sin ID de cotización:', response.data);
    return {
      success: false,
      error: 'No se recibió ID de cotización',
    };
  }
  
  console.log('[IS Quotes] Cotización generada:', idCotizacion);
  
  return {
    success: true,
    idCotizacion,
  };
}

/**
 * Obtener coberturas de cotización
 */
export async function obtenerCoberturasCotizacion(
  vIdPv: string,
  vIdOpt: 1 | 2 | 3 = 1,
  env: ISEnvironment = 'development'
): Promise<{ success: boolean; data?: CoberturasResponse; error?: string }> {
  console.log('[IS Quotes] Obteniendo coberturas...', { vIdPv, vIdOpt });
  
  const endpoint = `${IS_ENDPOINTS.COBERTURAS_COTIZACION}?vIdPv=${vIdPv}&vIdOpt=${vIdOpt}`;
  
  const response = await isGet<CoberturasResponse>(endpoint, env);
  
  if (!response.success) {
    console.error('[IS Quotes] Error obteniendo coberturas:', response.error);
    return {
      success: false,
      error: response.error || 'Error al obtener coberturas',
    };
  }
  
  console.log('[IS Quotes] Coberturas obtenidas');
  
  return {
    success: true,
    data: response.data,
  };
}

/**
 * Emitir póliza de auto
 */
export async function emitirPolizaAuto(
  request: EmisionAutoRequest,
  env: ISEnvironment = 'development'
): Promise<{ success: boolean; nroPoliza?: string; pdfUrl?: string; error?: string }> {
  console.log('[IS Quotes] Emitiendo póliza...', {
    idCotizacion: request.vIdPv,
    cliente: `${request.vnombre} ${request.vapellido}`,
  });
  
  const response = await isPost<EmisionAutoResponse>(
    IS_ENDPOINTS.EMISION,
    request,
    env
  );
  
  if (!response.success) {
    console.error('[IS Quotes] Error emitiendo póliza:', response.error);
    return {
      success: false,
      error: response.error || 'Error al emitir póliza',
    };
  }
  
  const nroPoliza = response.data?.nro_poliza;
  const pdfUrl = response.data?.poliza_pdf_url;
  
  if (!nroPoliza) {
    console.error('[IS Quotes] Respuesta sin número de póliza:', response.data);
    return {
      success: false,
      error: 'No se recibió número de póliza',
    };
  }
  
  console.log('[IS Quotes] Póliza emitida:', nroPoliza);
  
  return {
    success: true,
    nroPoliza,
    pdfUrl,
  };
}

/**
 * Crear cliente y póliza en BD al emitir
 * Solo se llama cuando se emite la póliza exitosamente
 */
export async function crearClienteYPolizaIS(data: {
  insurer_id: string;
  broker_id: string; // ID de oficina
  nro_poliza: string;
  cliente_nombre: string;
  cliente_apellido: string;
  cliente_documento: string;
  cliente_telefono: string;
  cliente_correo: string;
  tipo_cobertura: string;
  marca?: string;
  modelo?: string;
  anio_auto?: number;
}): Promise<{ success: boolean; clientId?: string; policyId?: string; error?: string }> {
  const supabase = getSupabaseAdmin();
  
  try {
    const nombreCompleto = `${data.cliente_nombre} ${data.cliente_apellido}`;
    
    // 1. Buscar o crear cliente
    let clientId: string;
    
    // Buscar cliente por documento
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id')
      .eq('national_id', data.cliente_documento)
      .eq('broker_id', data.broker_id)
      .single();
    
    if (existingClient) {
      clientId = existingClient.id;
      console.log('[IS] Cliente existente encontrado:', clientId);
    } else {
      // Crear nuevo cliente
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
        console.error('[IS] Error creando cliente:', clientError);
        return {
          success: false,
          error: clientError?.message || 'Error creando cliente',
        };
      }
      
      clientId = newClient.id;
      console.log('[IS] Cliente creado:', clientId);
    }
    
    // 2. Crear póliza
    const notasVehiculo = data.marca && data.modelo 
      ? `Vehículo: ${data.marca} ${data.modelo} ${data.anio_auto || ''}\nCobertura: ${data.tipo_cobertura}`
      : `Cobertura: ${data.tipo_cobertura}`;
    
    const { data: newPolicy, error: policyError } = await supabase
      .from('policies')
      .insert({
        client_id: clientId,
        broker_id: data.broker_id,
        insurer_id: data.insurer_id,
        policy_number: data.nro_poliza,
        ramo: 'AUTO',
        status: 'ACTIVA',
        start_date: getTodayLocalDate(),
        notas: notasVehiculo,
      })
      .select('id')
      .single();
    
    if (policyError || !newPolicy) {
      console.error('[IS] Error creando póliza:', policyError);
      return {
        success: false,
        error: policyError?.message || 'Error creando póliza',
      };
    }
    
    console.log('[IS] Póliza creada:', newPolicy.id);
    
    return {
      success: true,
      clientId,
      policyId: newPolicy.id,
    };
  } catch (error: any) {
    console.error('[IS] Exception creando cliente/póliza:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

