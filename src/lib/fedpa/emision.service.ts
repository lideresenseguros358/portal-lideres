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
import { getFedpaMarcaFromIS, normalizarModeloFedpa } from '@/lib/cotizadores/fedpa-vehicle-mapper';

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
  
  // Normalize IS numeric marca/modelo codes to FEDPA alpha codes
  const rawMarca = String(normalizedRequest.Marca || '');
  const rawModelo = String(normalizedRequest.Modelo || '');
  const isNumericMarca = /^\d+$/.test(rawMarca);
  const isNumericModelo = /^\d+$/.test(rawModelo);
  const fedpaMarca = isNumericMarca
    ? getFedpaMarcaFromIS(parseInt(rawMarca), (request as any).MarcaNombre || '')
    : rawMarca;
  const fedpaModelo = isNumericModelo
    ? normalizarModeloFedpa((request as any).ModeloNombre || rawModelo)
    : normalizarModeloFedpa(rawModelo);
  
  console.log('[FEDPA Emisión Externo] Marca/Modelo normalizados:', {
    original: { marca: rawMarca, modelo: rawModelo },
    fedpa: { marca: fedpaMarca, modelo: fedpaModelo },
  });
  
  // ── PASO 2: Reservar NroPoliza via get_nropoliza ──
  const baseUrl = config.emisorExternoUrl;
  let nroPoliza = '';
  
  console.log('[FEDPA Emisión Externo] PASO 2: Obteniendo NroPoliza...');
  try {
    const nroResp = await fetch(
      `${baseUrl}/api/Polizas/get_nropoliza`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Usuario: config.usuario, Clave: config.clave }),
      }
    );
    if (nroResp.ok) {
      const nroData = await nroResp.json();
      console.log('[FEDPA Emisión Externo] get_nropoliza raw:', JSON.stringify(nroData).substring(0, 300));
      const firstItem = Array.isArray(nroData) ? nroData[0] : nroData;
      nroPoliza = String(firstItem?.NUMPOL ?? firstItem?.NroPoliza ?? firstItem?.nroPoliza ?? '');
      console.log('[FEDPA Emisión Externo] ✅ NroPoliza:', nroPoliza);
    } else {
      const errText = await nroResp.text().catch(() => '');
      console.error('[FEDPA Emisión Externo] get_nropoliza falló:', nroResp.status, errText.substring(0, 200));
    }
  } catch (nroErr) {
    console.error('[FEDPA Emisión Externo] Error obteniendo NroPoliza:', (nroErr as any)?.message);
  }
  
  if (!nroPoliza) {
    return {
      success: false,
      error: 'No se pudo reservar número de póliza (get_nropoliza). Intente nuevamente.',
    };
  }
  
  // ── PASO 3: Construir payload según manual 2021 (crear_poliza_auto_cc_externos) ──
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
  const fechaHora = `${yyyy}-${mm}-${dd} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')} ${ampm}`;
  const fechaDesde = `${yyyy}-${mm}-${dd}`;
  const fechaHasta = `${yyyy + 1}-${mm}-${dd}`;

  // Convertir FechaNacimiento de DD/MM/YYYY a YYYY-MM-DD si necesario
  let fechaNac = normalizedRequest.FechaNacimiento || '';
  if (fechaNac.includes('/')) {
    const parts = fechaNac.split('/');
    if (parts.length === 3 && parts[2].length === 4) {
      fechaNac = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  
  const dataPayload = {
    FechaHora: fechaHora,
    Monto: String(normalizedRequest.PrimaTotal || '0'),
    Aprobada: 'S',
    NroTransaccion: `PORTAL-${Date.now()}`,
    FechaAprobada: fechaHora,
    Ramo: '04',
    SubRamo: '07',
    FechaDesde: fechaDesde,
    FechaHasta: fechaHasta,
    Opcion: 'A',
    Usuario: config.usuario,
    Clave: config.clave,
    Entidad: [{
      Juridico: 'N',
      NombreEmpresa: '',
      PrimerNombre: String(normalizedRequest.PrimerNombre || ''),
      SegundoNombre: String(normalizedRequest.SegundoNombre || ''),
      PrimerApellido: String(normalizedRequest.PrimerApellido || ''),
      SegundoApellido: String(normalizedRequest.SegundoApellido || ''),
      DocumentoIdentificacion: 'CED',
      Cedula: String(normalizedRequest.Identificacion || ''),
      Ruc: '',
      FechaNacimiento: fechaNac,
      Sexo: String(normalizedRequest.Sexo || 'M'),
      CodPais: '999',
      CodProvincia: '999',
      CodCorregimiento: '999',
      Email: String(normalizedRequest.Email || ''),
      TelefonoOficina: String(normalizedRequest.Telefono || ''),
      Celular: String(normalizedRequest.Celular || ''),
      Direccion: String(normalizedRequest.Direccion || 'PANAMA'),
      IdVinculo: '1',
    }],
    Auto: {
      CodMarca: fedpaMarca,
      CodModelo: fedpaModelo,
      Ano: String(normalizedRequest.Ano || ''),
      Placa: String(normalizedRequest.Placa || ''),
      Chasis: String(normalizedRequest.Vin || ''),
      Motor: String(normalizedRequest.Motor || ''),
      Color: String(normalizedRequest.Color || ''),
    },
    IdCotizacion: String((request as any).IdCotizacion || ''),
    NroPoliza: nroPoliza,
  };
  
  console.log('[FEDPA Emisión Externo] Payload COMPLETO:', JSON.stringify(dataPayload, null, 2));
  
  // Construir FormData multipart (match working fallback route field names)
  const dataJsonString = JSON.stringify(dataPayload);
  const formData = new FormData();
  // Send data as a plain text Blob (no filename) to mimic RestSharp AddParameter
  formData.append('data', new Blob([dataJsonString], { type: 'text/plain' }));
  
  // Agregar documentos con nombres File1, File2, File3 (según manual FEDPA)
  if (documentos) {
    const MIME_TO_EXT: Record<string, string> = {
      'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
      'image/png': 'png', 'image/gif': 'gif', 'image/bmp': 'bmp',
      'image/webp': 'webp', 'image/tiff': 'tiff',
    };
    
    const file1 = (documentos.documento_identidad || [])[0];
    if (file1) {
      const ext = MIME_TO_EXT[file1.type] || 'jpg';
      formData.append('File1', file1, `documento_identidad.${ext}`);
    }
    const file2 = (documentos.licencia_conducir || [])[0];
    if (file2) {
      const ext = MIME_TO_EXT[file2.type] || 'jpg';
      formData.append('File2', file2, `licencia_conducir.${ext}`);
    }
    const file3 = (documentos.registro_vehicular || [])[0];
    if (file3) {
      const ext = MIME_TO_EXT[file3.type] || 'pdf';
      formData.append('File3', file3, `registro_vehicular.${ext}`);
    }
  }
  
  // POST multipart a Emisor Externo (no necesita Bearer token)
  const url = `${baseUrl}${EMISOR_EXTERNO_ENDPOINTS.CREAR_POLIZA}`;
  
  console.log('[FEDPA Emisión Externo] POST', url);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      // No Content-Type header — browser sets multipart boundary automatically
    });
    
    const responseText = await response.text();
    console.log('[FEDPA Emisión Externo] Status:', response.status, 'Body COMPLETO:', responseText);
    
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
      const errMsg = data.error || data.msg || data.message || JSON.stringify(data);
      console.error('[FEDPA Emisión Externo] Error HTTP:', response.status, errMsg);
      return {
        success: false,
        error: `HTTP ${response.status}: ${errMsg}`,
      };
    }
    
    // Verificar respuesta exitosa
    if (data.success === false) {
      const errMsg = data.error || data.msg || data.message || 'Error en emisión FEDPA';
      console.error('[FEDPA Emisión Externo] Respuesta no exitosa:', errMsg);
      return {
        success: false,
        error: errMsg,
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
