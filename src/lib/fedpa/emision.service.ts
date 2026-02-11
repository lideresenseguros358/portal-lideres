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
 * Bundlea documentos + datos de emisión en un solo POST multipart.
 * NO requiere Bearer token — usa Usuario/Clave en el body.
 */
export async function emitirPolizaFallback(
  request: EmitirPolizaRequest,
  env: FedpaEnvironment = 'PROD',
  documentos?: {
    documento_identidad?: File[];
    licencia_conducir?: File[];
    registro_vehicular?: File[];
  }
): Promise<EmitirPolizaResponse> {
  console.log('[FEDPA Emisión Externo] Usando Emisor Externo (2021)...');
  
  const config = FEDPA_CONFIG[env];
  
  // Normalizar datos
  const normalizedRequest = normalizarDatosEmision(request);
  
  // Construir payload según manual 2021 (crear_poliza_auto_cc_externos)
  const now = new Date();
  const fechaHora = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;
  
  const dataPayload = {
    FechaHora: fechaHora,
    Monto: String(normalizedRequest.PrimaTotal || '0'),
    Aprobada: 'S',
    NroTransaccion: `PORTAL-${Date.now()}`,
    FechaAprobada: fechaHora,
    Ramo: '04',
    SubRamo: '07',
    FechaDesde: '',
    FechaHasta: '',
    Opcion: 'A',
    Usuario: config.usuario,
    Clave: config.clave,
    Entidad: [{
      Juridico: 'N',
      NombreEmpresa: '',
      PrimerNombre: normalizedRequest.PrimerNombre,
      SegundoNombre: normalizedRequest.SegundoNombre || '',
      PrimerApellido: normalizedRequest.PrimerApellido,
      SegundoApellido: normalizedRequest.SegundoApellido || '',
      DocumentoIdentificacion: 'CED',
      Cedula: normalizedRequest.Identificacion,
      Ruc: '',
      FechaNacimiento: normalizedRequest.FechaNacimiento,
      Sexo: normalizedRequest.Sexo,
      CodPais: '999',
      CodProvincia: '999',
      CodCorregimiento: '999',
      Email: normalizedRequest.Email,
      TelefonoOficina: '',
      Celular: String(normalizedRequest.Celular || ''),
      Direccion: normalizedRequest.Direccion || 'PANAMA',
      IdVinculo: '1',
    }],
    Auto: {
      CodMarca: normalizedRequest.Marca,
      CodModelo: normalizedRequest.Modelo,
      Ano: String(normalizedRequest.Ano),
      Placa: normalizedRequest.Placa,
      Chasis: normalizedRequest.Vin,
      Motor: normalizedRequest.Motor,
      Color: normalizedRequest.Color,
    },
    // Campos adicionales del plan
    IdCotizacion: '',
    NroPoliza: '',
    CodPlan: String(normalizedRequest.Plan),
    SumaAsegurada: String(normalizedRequest.sumaAsegurada || 0),
    CantidadPasajeros: normalizedRequest.Pasajero || 5,
    Puerta: normalizedRequest.Puerta || 4,
    Uso: normalizedRequest.Uso || '10',
    esPEP: normalizedRequest.esPEP || 0,
  };
  
  console.log('[FEDPA Emisión Externo] Payload:', JSON.stringify(dataPayload).substring(0, 500));
  
  // Construir FormData multipart
  const formData = new FormData();
  formData.append('data', JSON.stringify(dataPayload));
  
  // Agregar documentos si están disponibles
  if (documentos) {
    const MIME_TO_EXT: Record<string, string> = {
      'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
      'image/png': 'png', 'image/gif': 'gif', 'image/bmp': 'bmp',
      'image/webp': 'webp', 'image/tiff': 'tiff',
    };
    
    for (const file of (documentos.documento_identidad || [])) {
      const ext = MIME_TO_EXT[file.type] || 'pdf';
      formData.append('file', file, `documento_identidad.${ext}`);
    }
    for (const file of (documentos.licencia_conducir || [])) {
      const ext = MIME_TO_EXT[file.type] || 'pdf';
      formData.append('file', file, `licencia_conducir.${ext}`);
    }
    for (const file of (documentos.registro_vehicular || [])) {
      const ext = MIME_TO_EXT[file.type] || 'pdf';
      formData.append('file', file, `registro_vehicular.${ext}`);
    }
  }
  
  // POST multipart a Emisor Externo (no necesita Bearer token)
  const baseUrl = config.emisorExternoUrl;
  const url = `${baseUrl}${EMISOR_EXTERNO_ENDPOINTS.CREAR_POLIZA}`;
  
  console.log('[FEDPA Emisión Externo] POST', url);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      // No Content-Type header — browser sets multipart boundary automatically
    });
    
    const responseText = await response.text();
    console.log('[FEDPA Emisión Externo] Status:', response.status, 'Body:', responseText.substring(0, 500));
    
    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      return {
        success: false,
        error: `Respuesta no JSON de FEDPA: ${responseText.substring(0, 200)}`,
      };
    }
    
    if (!response.ok) {
      return {
        success: false,
        error: data.msg || data.message || `HTTP ${response.status}`,
      };
    }
    
    // Verificar respuesta exitosa
    if (data.success === false) {
      return {
        success: false,
        error: data.msg || data.message || 'Error en emisión FEDPA',
      };
    }
    
    const resultado: EmitirPolizaResponse = {
      success: true,
      amb: data.amb || env,
      cotizacion: data.cotizacion || data.IdCotizacion,
      poliza: data.poliza || data.NroPoliza || data.nroPoliza,
      desde: data.desde || data.FechaDesde || data.vigenciaDesde,
      hasta: data.hasta || data.FechaHasta || data.vigenciaHasta,
    };
    
    console.log('[FEDPA Emisión Externo] ✅ Póliza emitida:', resultado.poliza);
    return resultado;
    
  } catch (error: any) {
    console.error('[FEDPA Emisión Externo] Error de red:', error);
    return {
      success: false,
      error: error.message || 'Error de red al emitir póliza',
    };
  }
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
