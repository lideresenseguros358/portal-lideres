/**
 * Servicio de cotización y emisión para Auto
 * Internacional de Seguros (IS)
 */

import { ISEnvironment, IS_ENDPOINTS, CORREDOR_FIJO, INSURER_SLUG } from './config';
import { isGet, isPost } from './http-client';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getTodayLocalDate } from '../utils/dates';
import crypto from 'crypto';

// ============================================
// DEDUPLICACIÓN: Evitar doble-click / refresh
// ============================================
const recentRequests = new Map<string, { response: any; timestamp: number }>();
const DEDUP_TTL = 120_000; // 120 segundos

function getIdempotencyKey(body: Record<string, any>): string {
  // Hash de payload normalizado + hora truncada a minuto
  const hourBucket = new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  const normalized = JSON.stringify(body, Object.keys(body).sort());
  const hash = crypto.createHash('sha256').update(`${normalized}|${hourBucket}`).digest('hex').slice(0, 16);
  return hash;
}

function checkDedup(key: string): any | null {
  const cached = recentRequests.get(key);
  if (cached && Date.now() - cached.timestamp < DEDUP_TTL) {
    console.log(`[IS Quotes] ♻️ Dedup hit — devolviendo respuesta cacheada (key: ${key.slice(0, 8)})`);
    return cached.response;
  }
  return null;
}

function saveDedup(key: string, response: any): void {
  recentRequests.set(key, { response, timestamp: Date.now() });
  // Limpiar entradas viejas
  for (const [k, v] of recentRequests) {
    if (Date.now() - v.timestamp > DEDUP_TTL) recentRequests.delete(k);
  }
}

/**
 * CotizadorRequest — Swagger schema exacto (Feb 2026)
 * Endpoint: POST /api/cotizaemisorauto/generarcotizacion
 * Body: application/json
 */
export interface CotizacionAutoRequest {
  // Cliente
  codTipoDoc: number;    // 1=Cédula, 2=RUC, 3=Pasaporte, 9=RUC Extranjero, 11=Cédula Extranjero
  nroDoc: string;         // CIP/RUC con guiones
  nroNit: string;         // CIP/RUC con guiones (mismo que nroDoc)
  nombre: string;
  apellido: string;
  telefono: string;       // Sin guiones
  correo: string;
  
  // Vehículo
  codMarca: number;       // Código sin decimales de getmarcas
  codModelo: number;      // Código sin decimales de getmodelos
  anioAuto: string;       // Año como string
  
  // Cobertura
  sumaAseg: string;       // Valor del vehículo como string ("0" si no aplica)
  codPlanCobertura: number;      // De getplanes
  codPlanCoberturaAdic: number;  // De GetPlanesAdicionales, o 0
  codGrupoTarifa: number;        // De getgrupotarifa
  
  // Opcionales
  cantOcupantes?: string;        // "0" por defecto
  codPlanCobAsiento?: string;    // "0" por defecto
  
  // Requeridos desde Feb 2026
  fecNacimiento?: string;        // Fecha nacimiento dd/MM/yyyy
  codProvincia?: number;         // Código provincia (8=Panamá)
}

export interface CotizacionAutoResponse {
  vIdPv?: string; // ID de cotización (IDCOT)
  IDCOT?: string; // Alternativa
  success?: boolean;
  message?: string;
  error?: string;
}

/**
 * Respuesta de /getlistacoberturas/{idpv}
 * Cada fila tiene COD_AMPARO, COBERTURA, LIMITES, PRIMA1, etc.
 */
export interface CoberturaItem {
  COD_AMPARO: number;
  COBERTURA: string;
  LIMITES: string;
  LIMITES2: string;
  DEDUCIBLE1: string;
  DEDUCIBLE2: string;
  PRIMA1: string;
  SN_DESCUENTO: string;
}

export interface CoberturasResponse {
  Table?: CoberturaItem[];
}

export interface EmisionAutoRequest {
  vIdPv: string; // ID de cotización (IDCOT) — requerido
  opcion?: number; // Opción de emisión (1, 2 o 3) — default 1
  // DatosGenerales
  codTipoDoc: number;    // 1=Cédula, 2=RUC, 3=Pasaporte
  nroDoc: string;
  nombre: string;        // Primer y segundo nombre
  apellido1: string;     // Primer apellido
  apellido2?: string;    // Segundo apellido
  apeCasada?: string;    // Apellido de casada
  telefono: string;
  celular?: string;
  correo: string;
  fechaNacimiento?: string; // dd/MM/yyyy
  sexo?: string;           // M o F
  direccion?: string;      // Dirección textual (se parsea para campos IS)
  estadoCivil?: string;    // soltero, casado, divorciado, viudo
  // Dirección estructurada (IS)
  codProvincia?: number;
  codDistrito?: number;
  codCorregimiento?: number;
  codUrbanizacion?: number;
  casaApto?: string;
  // DatosAuto
  codMarca: number;
  codModelo: number;
  anioAuto: string;
  sumaAseg: string;
  codPlanCobertura: number;
  codPlanCoberturaAdic?: number;
  codGrupoTarifa: number;
  placa?: string;
  motor?: string;
  chasis?: string;
  color?: string;
  tipoTransmision?: string; // AUTOMATICO o MANUAL
  cantPasajeros?: number;
  cantPuertas?: number;
  // Pago
  paymentToken?: string;
  formaPago?: number;      // 1=Contado, 2=Financiado
  cantCuotas?: number;     // Número de cuotas
  // Documentos
  documentUrls?: string[]; // URLs de documentos adjuntos
}

export interface EmisionAutoResponse {
  success?: boolean;
  nro_poliza?: string;
  poliza_pdf_url?: string;
  poliza_pdf_base64?: string;
  message?: string;
  error?: string;
}

type QuoteResult = { success: boolean; idCotizacion?: string; primaTotal?: number; nroCotizacion?: number; error?: string };

/**
 * Generar cotización de auto
 * Swagger: POST /api/cotizaemisorauto/generarcotizacion
 * Body: CotizadorRequest (JSON)
 * 
 * Incluye:
 * - Deduplicación (anti doble-click)
 * - Auto-retry con sumaAseg=0 si rango es 0-0
 */
export async function generarCotizacionAuto(
  request: CotizacionAutoRequest,
  env: ISEnvironment = 'development'
): Promise<QuoteResult> {
  // Trigger auto-actualización de catálogos en background (no bloquea)
  import('@/lib/is/catalog-updater').then(m => m.triggerCatalogUpdate('IS')).catch(() => {});
  
  // Construir body JSON según Swagger CotizadorRequest
  const body = {
    codTipoDoc: Math.floor(Number(request.codTipoDoc)),
    nroDoc: request.nroDoc,
    nroNit: request.nroNit || request.nroDoc,
    nombre: request.nombre,
    apellido: request.apellido,
    telefono: (request.telefono || '').replace(/[-\s\(\)]/g, ''),
    correo: request.correo,
    codMarca: Math.floor(Number(request.codMarca)),
    codModelo: Math.floor(Number(request.codModelo)),
    sumaAseg: String(request.sumaAseg || '0'),
    anioAuto: String(request.anioAuto),
    codPlanCobertura: Math.floor(Number(request.codPlanCobertura)),
    codPlanCoberturaAdic: Math.floor(Number(request.codPlanCoberturaAdic || 0)),
    codGrupoTarifa: Math.floor(Number(request.codGrupoTarifa)),
    cantOcupantes: request.cantOcupantes || '0',
    codPlanCobAsiento: request.codPlanCobAsiento || '0',
    fecNacimiento: request.fecNacimiento || '01/01/1990',
    codProvincia: Math.floor(Number(request.codProvincia || 8)),
  };
  
  // DEDUPLICACIÓN: Evitar doble-click
  const dedupKey = getIdempotencyKey(body);
  const cached = checkDedup(dedupKey);
  if (cached) return cached;
  
  console.log('[IS Quotes] POST /generarcotizacion', {
    marca: body.codMarca, modelo: body.codModelo,
    plan: body.codPlanCobertura, grupo: body.codGrupoTarifa,
    sumaAseg: body.sumaAseg,
  });
  
  const result = await _callGenerarCotizacion(body, env);
  
  // AUTO-RETRY: Si error "Suma asegurada no permitida" y rango 0-0, reintentar con sumaAseg=0
  if (!result.success && result.error) {
    const msg = result.error.toLowerCase();
    const isRangeZero = msg.includes('suma asegurada') && (msg.includes('0 a 0') || msg.includes('0.00 a 0.00'));
    if (isRangeZero && body.sumaAseg !== '0') {
      console.log('[IS Quotes] ⚠️ Rango sumaAseg 0-0 detectado. Reintentando con sumaAseg=0...');
      body.sumaAseg = '0';
      const retryResult = await _callGenerarCotizacion(body, env);
      if (retryResult.success) {
        saveDedup(dedupKey, retryResult);
        return retryResult;
      }
      return retryResult;
    }
  }
  
  if (result.success) {
    saveDedup(dedupKey, result);
  }
  return result;
}

/** Llamada interna a POST /generarcotizacion */
async function _callGenerarCotizacion(
  body: Record<string, any>,
  env: ISEnvironment
): Promise<QuoteResult> {
  const response = await isPost<{ Table: Array<{
    RESOP: number;
    MSG: string;
    MSG_FIELDS: string | null;
    IDCOT: number;
    NROCOT: number;
    PTOTAL: number | null;
  }> }>(IS_ENDPOINTS.GENERAR_COTIZACION, body, env);
  
  if (!response.success) {
    console.error('[IS Quotes] Error generando cotización:', response.error);
    return {
      success: false,
      error: response.error || 'Error al generar cotización',
    };
  }
  
  const tableData = response.data?.Table?.[0];
  
  if (!tableData) {
    console.error('[IS Quotes] Respuesta sin datos:', response.data);
    return {
      success: false,
      error: 'No se recibió respuesta válida',
    };
  }
  
  // RESOP: 1=éxito, -1=error
  if (tableData.RESOP !== 1) {
    console.error('[IS Quotes] Error en cotización:', tableData.MSG);
    return {
      success: false,
      error: tableData.MSG || 'Error al generar cotización',
    };
  }
  
  const idCotizacion = tableData.IDCOT?.toString();
  
  if (!idCotizacion) {
    console.error('[IS Quotes] Respuesta sin IDCOT:', tableData);
    return {
      success: false,
      error: 'No se recibió ID de cotización',
    };
  }
  
  console.log('[IS Quotes] ✅ Cotización generada:', idCotizacion, 'Prima:', tableData.PTOTAL, 'NroCot:', tableData.NROCOT);
  
  return {
    success: true,
    idCotizacion,
    primaTotal: tableData.PTOTAL ?? undefined,
    nroCotizacion: tableData.NROCOT,
  };
}

/**
 * Obtener coberturas de cotización
 * Swagger: GET /api/cotizaemisorauto/getlistacoberturas/{idpv}
 */
export async function obtenerCoberturasCotizacion(
  idpv: string,
  _vIdOpt: 1 | 2 | 3 = 1, // Mantenido por compatibilidad pero no se usa en Swagger
  env: ISEnvironment = 'development'
): Promise<{ success: boolean; data?: CoberturasResponse; error?: string }> {
  console.log('[IS Quotes] GET /getlistacoberturas/', idpv);
  
  const endpoint = `${IS_ENDPOINTS.COBERTURAS_COTIZACION}/${idpv}`;
  
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
 * API Doc (Actualizada) Paso 11: POST /api/cotizaemisorauto/getemision
 * Body structure from pages 6-13 of api-documentation Actualizada.pdf
 */
export async function emitirPolizaAuto(
  request: EmisionAutoRequest,
  env: ISEnvironment = 'development'
): Promise<{ success: boolean; nroPoliza?: string; pdfUrl?: string; pdfBase64?: string; error?: string }> {
  if (!request.vIdPv) {
    return { success: false, error: 'Falta ID de cotización (vIdPv) para emitir' };
  }
  
  // Fechas de vigencia: desde hoy, hasta 1 año después
  const hoy = new Date();
  const vigDesde = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
  const hastaDate = new Date(hoy);
  hastaDate.setFullYear(hastaDate.getFullYear() + 1);
  const vigHasta = `${String(hastaDate.getDate()).padStart(2, '0')}/${String(hastaDate.getMonth() + 1).padStart(2, '0')}/${hastaDate.getFullYear()}`;
  
  const telefonoClean = (request.telefono || '').replace(/[-\s\(\)]/g, '').substring(0, 15);
  const celularClean = (request.celular || request.telefono || '').replace(/[-\s\(\)]/g, '').substring(0, 15);
  
  // Truncar campos de texto a longitudes máximas de IS para evitar error
  // "Los datos de cadena o binarios se truncarían" (SQL truncation)
  const safe = (val: string | undefined, maxLen: number) => (val || '').substring(0, maxLen);
  
  // Mapear estadoCivil del formulario a código IS (/catalogos/estadocivil)
  const estadoCivilMap: Record<string, number> = {
    'soltero': 1, 'casado': 2, 'divorciado': 3, 'viudo': 4,
  };
  const ecivil = estadoCivilMap[request.estadoCivil || ''] || 1;
  
  // Mapear tipoTransmision del formulario a código IS (/cotizaemisorauto/gettransmision)
  const codTransmision = (request.tipoTransmision === 'MANUAL') ? 2 : 1; // 1=Automático, 2=Manual
  
  // Mapear color del formulario a código IS (/cotizaemisorauto/colores)
  // Catálogo IS: mapeamos colores comunes a códigos conocidos
  const colorMap: Record<string, string> = {
    'BLANCO': '01', 'NEGRO': '02', 'GRIS': '03', 'PLATA': '04',
    'PLATEADO': '04', 'AZUL': '05', 'ROJO': '06', 'VERDE': '07',
    'AMARILLO': '08', 'NARANJA': '09', 'MARRON': '10', 'BEIGE': '11',
    'DORADO': '12', 'VINO': '13', 'CELESTE': '14',
  };
  const colorUpper = (request.color || '').toUpperCase().trim();
  const codColor = colorMap[colorUpper] || '06'; // Default: 06 si no se encuentra
  
  // Dirección: usar códigos del formulario si están disponibles, sino defaults Panamá
  // IS DB: calle max ~50 chars, casaApto max ~30 chars
  const defaultDir = {
    codPais: 1,           // Panamá
    codProvincia: request.codProvincia || 8,
    codDistrito: request.codDistrito || 1,
    codCorregimiento: request.codCorregimiento || 1,
    codUrbanizacion: request.codUrbanizacion || 0,
    calle: safe(request.direccion, 50) || 'N/A',
    casaApto: safe(request.casaApto, 30),
    aptoPostal: '',
  };
  
  // Documentos: IS requiere al menos 1 entrada con { url: "..." }
  // Si no hay URLs reales, enviar placeholder
  const documentos = (request.documentUrls && request.documentUrls.length > 0)
    ? request.documentUrls.map(url => ({ url }))
    : [{ url: '' }];
  
  // Body según API Doc Actualizada (pages 6-8, 11-13)
  const body = {
    idPv: parseInt(String(request.vIdPv)),
    nroPol: 0,
    codTransaccion: '',
    opcion: request.opcion || 1,
    cantcuotas: request.cantCuotas || 1,
    datosGenerales: {
      nombre: safe(request.nombre, 30),
      apellido1: safe(request.apellido1, 30),
      apellido2: safe(request.apellido2, 30),
      apeCasada: safe(request.apeCasada, 30),
      tipoDoc: Math.floor(Number(request.codTipoDoc)) || 1,
      vNroDoc: safe(request.nroDoc, 20),
      vNroNit: '0',
      esExtranjero: 0,
      paisExtranjero: 0,
      fecNacimiento: request.fechaNacimiento || '',
      sexo: request.sexo || 'M',
      ecivil,              // Mapeado desde formulario (soltero=1, casado=2, divorciado=3, viudo=4)
      ocupacion: 12,       // 12=Administrativo (hardcoded — no se recolecta en formulario)
      telRes: telefonoClean,
      telOfi: telefonoClean,
      celular: celularClean,
      correo: safe(request.correo, 60),
      adicional: '',
      codSocio: '',
      dirResidencial: defaultDir,
      dirOficina: defaultDir,
    },
    datosAuto: {
      motor: safe(request.motor, 20),
      chasis: safe(request.chasis, 20),
      placa: safe(request.placa, 10),
      codMarca: Math.floor(Number(request.codMarca)),
      codModelo: Math.floor(Number(request.codModelo)),
      aaaModelo: parseInt(String(request.anioAuto)) || new Date().getFullYear(),
      codTransmision,      // Mapeado desde formulario (AUTOMATICO=1, MANUAL=2)
      codGrupoTarifa: Math.floor(Number(request.codGrupoTarifa)),
      codColor,             // Mapeado desde color del formulario a código IS
      capacidad: request.cantPasajeros || 5,
      cilindros: 4,        // 4 cilindros (hardcoded default)
      sumaAseg: parseInt(String(request.sumaAseg)) || 0,
      fecVigDesde: vigDesde,
      fecVigHasta: vigHasta,
      idPlanCobertura: Math.floor(Number(request.codPlanCobertura)),
      pjeBexp: 0,          // Porcentaje buena experiencia
      codTipoConducto: 0,
      codConducto: 0,
      idPlanCobAdic: Math.floor(Number(request.codPlanCoberturaAdic || 0)),
      snCargo: 0,
      codBenef: 0,
      txtBenef: '',
      txtComentarios: '',
      cntTermino: 0,
      idPlanCobAdicAsiento: 0,
    },
    documentos,
  };
  
  console.log('[IS Emission] POST /getemision FULL BODY:', JSON.stringify(body, null, 2));
  
  // IS a veces retorna Column1=-1 con "debe presionar el botón emitir nuevamente"
  // Esto es comportamiento conocido — se resuelve con un retry automático
  const MAX_EMISSION_RETRIES = 2;
  
  for (let attempt = 0; attempt <= MAX_EMISSION_RETRIES; attempt++) {
    if (attempt > 0) {
      console.log(`[IS Emission] Reintento ${attempt}/${MAX_EMISSION_RETRIES}...`);
      await new Promise(r => setTimeout(r, 1500 * attempt)); // backoff: 1.5s, 3s
    }
    
    const response = await isPost<{ Table: Array<{
      Column1: number;       // Result code: >=1 = success, <0 = error
      NroPol: number;        // Policy number (or 0/1 on error)
      Descripcion: string;   // Message
      Error: string;         // Error details
      CodSucursal: number;   // Branch code
      LinkDescarga: string;  // PDF download URL
    }> }>(IS_ENDPOINTS.EMISION, body, env);
    
    // Extraer el mensaje de error real de la respuesta
    const tableData = response.data?.Table?.[0] as any;
    
    if (!response.success) {
      const rawData = response.data as any;
      const validationErrors = rawData?.errors ? JSON.stringify(rawData.errors) : '';
      const isMsg = tableData?.Descripcion || tableData?.Msg || tableData?.MSG || '';
      const errorTitle = rawData?.title || '';
      const rawStr = typeof rawData === 'string' ? rawData : '';
      const bestError = validationErrors || isMsg || errorTitle || rawStr || response.error || 'Error al emitir poliza';
      console.error('[IS Emission] Error. Status:', response.statusCode, 'Error:', bestError);
      console.error('[IS Emission] Raw response:', JSON.stringify(rawData, null, 2));
      // No reintentar errores HTTP (400, 401, etc.) — solo errores de negocio
      return { success: false, error: bestError };
    }
    
    if (!tableData) {
      console.error('[IS Emission] Respuesta sin datos. Full response.data:', JSON.stringify(response.data, null, 2));
      return { success: false, error: 'Respuesta IS sin datos: ' + JSON.stringify(response.data).substring(0, 300) };
    }
    
    // IS getemision response fields:
    // Column1: >=1 = success, <0 = error (-2 = polizas agotados, etc.)
    // Descripcion: human-readable message
    // NroPol: policy number on success
    // LinkDescarga: PDF download URL on success
    const resultCode = tableData.Column1;
    const descripcion = tableData.Descripcion || '';
    const errorDetail = tableData.Error || '';
    
    console.log(`[IS Emission] Attempt ${attempt + 1} — Column1: ${resultCode}, Descripcion: ${descripcion}, NroPol: ${tableData.NroPol}`);
    
    if (resultCode < 0 || resultCode === 0) {
      // IS retorna -1 con "debe presionar el botón emitir nuevamente" — reintentar
      const isRetryable = resultCode === -1 && (
        descripcion.toLowerCase().includes('emitir nuevamente') ||
        errorDetail.toLowerCase().includes('truncar') ||
        errorDetail.toLowerCase().includes('trunca')
      );
      
      if (isRetryable && attempt < MAX_EMISSION_RETRIES) {
        console.warn(`[IS Emission] Error retryable (Column1=${resultCode}). Reintentando...`);
        continue;
      }
      
      console.error('[IS Emission] Error en emision. Column1:', resultCode, 'Desc:', descripcion, 'Error:', errorDetail);
      return { success: false, error: descripcion || errorDetail || 'Error IS code=' + resultCode };
    }
    
    const nroPoliza = String(tableData.NroPol || '');
    if (!nroPoliza || nroPoliza === '0' || nroPoliza === '1') {
      console.error('[IS Emission] Respuesta sin numero de poliza valido:', tableData);
      return { success: false, error: descripcion || 'No se recibio numero de poliza' };
    }
    
    const pdfUrl = tableData.LinkDescarga || '';
    console.log('[IS Emission] ✅ Poliza emitida:', nroPoliza, 'PDF:', pdfUrl);
    
    return {
      success: true,
      nroPoliza,
      pdfUrl: pdfUrl || undefined,
    };
  }
  
  // Si llegamos aquí, todos los reintentos fallaron
  return { success: false, error: 'No se pudo emitir la póliza después de varios intentos. Intente nuevamente.' };
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

