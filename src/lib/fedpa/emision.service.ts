/**
 * Servicio de Emisión FEDPA
 * Dual: EmisorPlan (2024) principal + Emisor Externo (2021) fallback
 */

import { obtenerClienteAutenticado } from './auth.service';
import { createFedpaClient } from './http-client';
import { FEDPA_CONFIG, FedpaEnvironment, EMISOR_PLAN_ENDPOINTS, EMISOR_EXTERNO_ENDPOINTS } from './config';
import type { EmitirPolizaRequest, EmitirPolizaResponse } from './types';
import { normalizeText, formatFechaToFEDPA, booleanToNumber } from './utils';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

// ============================================
// EMITIR PÓLIZA (PRINCIPAL - EmisorPlan)
// ============================================

/**
 * Emitir póliza usando EmisorPlan (2024)
 */
export async function emitirPoliza(
  request: EmitirPolizaRequest,
  env: FedpaEnvironment = 'PROD'
): Promise<EmitirPolizaResponse> {
  console.log('[FEDPA Emisión] Emitiendo póliza...', {
    plan: request.Plan,
    idDoc: request.idDoc,
    cliente: `${request.PrimerNombre} ${request.PrimerApellido}`,
    vehiculo: `${request.Marca} ${request.Modelo} ${request.Ano}`,
  });
  
  const clientResult = await obtenerClienteAutenticado(env);
  if (!clientResult.success || !clientResult.client) {
    return {
      success: false,
      error: clientResult.error || 'No se pudo autenticar',
    };
  }
  
  // Normalizar datos antes de enviar
  const normalizedRequest = normalizarDatosEmision(request);
  
  const response = await clientResult.client.post(
    EMISOR_PLAN_ENDPOINTS.EMITIR_POLIZA,
    normalizedRequest
  );
  
  if (!response.success) {
    console.error('[FEDPA Emisión] Error:', response.error);
    return {
      success: false,
      error: typeof response.error === 'string' ? response.error : 'Error emitiendo póliza',
    };
  }
  
  const data = (response.data || {}) as any;
  
  // Validar que se haya emitido correctamente
  if (!data.poliza && !data.success) {
    return {
      success: false,
      error: data.message || 'No se pudo emitir la póliza',
    };
  }
  
  const resultado: EmitirPolizaResponse = {
    success: true,
    amb: data.amb || env,
    cotizacion: data.cotizacion || data.idCotizacion,
    poliza: data.poliza || data.nroPoliza,
    desde: data.desde || data.vigenciaDesde,
    hasta: data.hasta || data.vigenciaHasta,
  };
  
  console.log('[FEDPA Emisión] Póliza emitida exitosamente:', {
    poliza: resultado.poliza,
    vigencia: `${resultado.desde} - ${resultado.hasta}`,
  });
  
  // Guardar en BD (Supabase) - COMENTADO: tabla fedpa_emisiones no existe, usamos policies
  // try {
  //   await guardarEmisionBD(request, resultado, env);
  // } catch (dbError) {
  //   console.warn('[FEDPA Emisión] No se pudo guardar en BD:', dbError);
  //   // No fallar la emisión si BD falla
  // }
  
  return resultado;
}

// ============================================
// EMITIR PÓLIZA (FALLBACK - Emisor Externo)
// ============================================

/**
 * Emitir póliza usando Emisor Externo (2021) - Fallback
 */
export async function emitirPolizaFallback(
  request: any,
  env: FedpaEnvironment = 'PROD'
): Promise<EmitirPolizaResponse> {
  console.log('[FEDPA Emisión] Usando fallback (Emisor Externo)...');
  
  const config = FEDPA_CONFIG[env];
  const client = createFedpaClient('emisorExterno', env);
  
  // Transformar request a formato Emisor Externo
  const externalRequest = {
    // Estructura según manual 2021
    Usuario: config.usuario,
    Clave: config.clave,
    // ... mapear campos según sea necesario
    // TODO: Implementar mapeo completo cuando se necesite
  };
  
  const response = await client.post(
    EMISOR_EXTERNO_ENDPOINTS.CREAR_POLIZA,
    externalRequest
  );
  
  if (!response.success) {
    console.error('[FEDPA Emisión] Error en fallback:', response.error);
    return {
      success: false,
      error: typeof response.error === 'string' ? response.error : 'Error emitiendo póliza (fallback)',
    };
  }
  
  const data = (response.data || {}) as any;
  
  return {
    success: true,
    amb: env,
    poliza: data.poliza || data.nroPoliza,
    desde: data.desde || data.vigenciaDesde,
    hasta: data.hasta || data.vigenciaHasta,
  };
}

// ============================================
// OBTENER NÚMERO DE PÓLIZA
// ============================================

/**
 * Obtener número de póliza reservado (Emisor Externo)
 * Solo usar si el flujo lo requiere
 */
export async function obtenerNumeroPoliza(
  env: FedpaEnvironment = 'PROD'
): Promise<{ success: boolean; nroPoliza?: string; error?: string }> {
  console.log('[FEDPA Emisión] Obteniendo número de póliza...');
  
  const config = FEDPA_CONFIG[env];
  const client = createFedpaClient('emisorExterno', env);
  
  const response = await client.get(EMISOR_EXTERNO_ENDPOINTS.GET_NRO_POLIZA);
  
  if (!response.success) {
    console.error('[FEDPA Emisión] Error obteniendo número:', response.error);
    return {
      success: false,
      error: typeof response.error === 'string' ? response.error : 'Error obteniendo número de póliza',
    };
  }
  
  const data = (response.data || {}) as any;
  const nroPoliza = data.nroPoliza || data.numero;
  
  console.log('[FEDPA Emisión] Número de póliza obtenido:', nroPoliza);
  
  return {
    success: true,
    nroPoliza,
  };
}

// ============================================
// HELPERS
// ============================================

/**
 * Normalizar datos para emisión
 */
function normalizarDatosEmision(request: EmitirPolizaRequest): EmitirPolizaRequest {
  return {
    ...request,
    // Cliente
    PrimerNombre: normalizeText(request.PrimerNombre),
    PrimerApellido: normalizeText(request.PrimerApellido),
    SegundoNombre: request.SegundoNombre ? normalizeText(request.SegundoNombre) : undefined,
    SegundoApellido: request.SegundoApellido ? normalizeText(request.SegundoApellido) : undefined,
    Identificacion: normalizeText(request.Identificacion),
    Direccion: normalizeText(request.Direccion),
    
    // Vehículo
    Marca: normalizeText(request.Marca),
    Modelo: normalizeText(request.Modelo),
    Placa: normalizeText(request.Placa),
    Vin: normalizeText(request.Vin),
    Motor: normalizeText(request.Motor),
    Color: normalizeText(request.Color),
    
    // Convertir números si vienen como string
    Telefono: typeof request.Telefono === 'string' ? parseInt(request.Telefono.replace(/\D/g, '')) : request.Telefono,
    Celular: typeof request.Celular === 'string' ? parseInt(request.Celular.replace(/\D/g, '')) : request.Celular,
  };
}

/**
 * Guardar emisión en BD para histórico
 * TODO: Crear tabla fedpa_emisiones cuando sea necesario
 */
async function guardarEmisionBD(
  request: EmitirPolizaRequest,
  response: EmitirPolizaResponse,
  env: FedpaEnvironment
): Promise<void> {
  // TODO: Descomentar cuando se cree la tabla fedpa_emisiones
  // const supabase = getSupabaseAdmin();
  // 
  // await supabase
  //   .from('fedpa_emisiones')
  //   .insert({
  //     payload: request as any,
  //     response: response as any,
  //     nro_poliza: response.poliza,
  //     vigencia_desde: response.desde,
  //     vigencia_hasta: response.hasta,
  //     created_at: new Date().toISOString(),
  //   });
  
  console.log('[FEDPA Emisión] Guardado en BD (pendiente crear tabla)');
}

/**
 * Crear cliente y póliza en sistema interno
 */
export async function crearClienteYPolizaFEDPA(
  request: EmitirPolizaRequest,
  response: EmitirPolizaResponse
): Promise<{ clientId?: string; policyId?: string; error?: string }> {
  try {
    const supabase = getSupabaseAdmin();
    
    // 1. Buscar broker "oficina" (contacto@lideresenseguros.com)
    const { data: oficinaBroker } = await supabase
      .from('brokers')
      .select('id')
      .eq('email', 'contacto@lideresenseguros.com')
      .single();
    
    if (!oficinaBroker) {
      throw new Error('Broker oficina no encontrado');
    }
    
    const broker_id = oficinaBroker.id;
    
    // 2. Buscar aseguradora FEDPA
    const { data: fedpaInsurer } = await supabase
      .from('insurers')
      .select('id')
      .ilike('name', '%FEDPA%')
      .single();
    
    if (!fedpaInsurer) {
      throw new Error('Aseguradora FEDPA no encontrada');
    }
    
    const insurer_id = fedpaInsurer.id;
    
    // 3. Crear o buscar cliente por cédula
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id')
      .eq('national_id', request.Identificacion)
      .eq('broker_id', broker_id)
      .single();
    
    let clientId = existingClient?.id;
    
    if (!clientId) {
      // Crear nuevo cliente
      const clientName = `${request.PrimerNombre} ${request.SegundoNombre || ''} ${request.PrimerApellido} ${request.SegundoApellido || ''}`.trim();
      
      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert({
          broker_id,
          name: clientName,
          national_id: request.Identificacion,
          email: request.Email,
          phone: String(request.Telefono || request.Celular),
          active: true,
        })
        .select('id')
        .single();
      
      if (clientError) throw clientError;
      clientId = newClient?.id;
      
      console.log('[FEDPA Emisión] Cliente creado:', { clientId, name: clientName });
    } else {
      console.log('[FEDPA Emisión] Cliente existente:', { clientId });
    }
    
    // 4. Convertir fechas de dd/mm/yyyy a yyyy-mm-dd
    const convertDate = (ddmmyyyy: string): string => {
      const [day, month, year] = ddmmyyyy.split('/');
      if (!day || !month || !year) {
        return ddmmyyyy; // Retornar original si formato inválido
      }
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    };
    
    const start_date = response.desde ? convertDate(response.desde) : null;
    const renewal_date = response.hasta ? convertDate(response.hasta) : null;
    
    // 5. Crear póliza
    const { data: newPolicy, error: policyError } = await supabase
      .from('policies')
      .insert({
        broker_id,
        client_id: clientId,
        insurer_id,
        policy_number: response.poliza || `FEDPA-${Date.now()}`,
        ramo: 'AUTO',
        status: 'ACTIVA',
        start_date,
        renewal_date,
        notas: JSON.stringify({
          plan: request.Plan,
          id_doc: request.idDoc,
          cotizacion: response.cotizacion,
          uso: request.Uso,
          vehiculo: {
            marca: request.Marca,
            modelo: request.Modelo,
            ano: request.Ano,
            placa: request.Placa,
            vin: request.Vin,
            motor: request.Motor,
            color: request.Color,
            pasajeros: request.Pasajero,
            puertas: request.Puerta,
          },
          cliente: {
            primerNombre: request.PrimerNombre,
            segundoNombre: request.SegundoNombre,
            primerApellido: request.PrimerApellido,
            segundoApellido: request.SegundoApellido,
            sexo: request.Sexo,
            fechaNacimiento: request.FechaNacimiento,
            direccion: request.Direccion,
            esPEP: request.esPEP,
          },
        }),
      })
      .select('id')
      .single();
    
    if (policyError) throw policyError;
    
    console.log('[FEDPA Emisión] Póliza creada:', {
      policyId: newPolicy?.id,
      policy_number: response.poliza,
      broker: 'oficina',
    });
    
    return {
      clientId,
      policyId: newPolicy?.id,
    };
  } catch (error: any) {
    console.error('[FEDPA Emisión] Error creando cliente/póliza:', error);
    return {
      error: error.message || 'Error creando registros',
    };
  }
}
