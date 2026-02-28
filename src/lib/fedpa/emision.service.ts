/**
 * Servicio de Emisión FEDPA — EmisorPlan (2024)
 * TODO proceso de emisión es vía EmisorPlan. No hay fallback a EmisorExterno.
 */

import { obtenerClienteAutenticado } from './auth.service';
import { FEDPA_CONFIG, FedpaEnvironment, EMISOR_PLAN_ENDPOINTS } from './config';
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
    const errData = response.data as any;
    const errMsg = errData?.msg || errData?.message || errData?.error
      || (typeof response.error === 'string' ? response.error : 'Error emitiendo póliza');
    console.error('[FEDPA Emisión] Error:', errMsg);
    console.error('[FEDPA Emisión] Response data completa:', JSON.stringify(response.data || {}).substring(0, 500));
    return {
      success: false,
      error: errMsg,
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
    
    // 1. Buscar broker "portal" (portal@lideresenseguros.com)
    const { data: oficinaBroker } = await supabase
      .from('brokers')
      .select('id')
      .eq('email', 'portal@lideresenseguros.com')
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
      // Crear nuevo cliente (phone = celular preferido sobre teléfono fijo)
      const clientName = `${request.PrimerNombre} ${request.SegundoNombre || ''} ${request.PrimerApellido} ${request.SegundoApellido || ''}`.trim();
      
      // Convertir FechaNacimiento de dd/mm/yyyy a yyyy-mm-dd para BD
      let birthDate: string | undefined;
      if (request.FechaNacimiento) {
        const [dd, mm, yyyy] = request.FechaNacimiento.split('/');
        if (dd && mm && yyyy) birthDate = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
      }
      
      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert({
          broker_id,
          name: clientName,
          national_id: request.Identificacion,
          email: request.Email,
          phone: String(request.Celular || request.Telefono),
          active: true,
          ...(birthDate ? { birth_date: birthDate } : {}),
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
        notas: [
          request.Marca && request.Modelo ? `Vehículo: ${request.Marca} ${request.Modelo} ${request.Ano || ''}` : null,
          request.Placa ? `Placa: ${request.Placa}` : null,
          `Cobertura: ${request.PrimaTotal && request.PrimaTotal > 150 ? 'Cobertura Completa' : 'Daños a Terceros'}`,
        ].filter(Boolean).join('\n'),
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
