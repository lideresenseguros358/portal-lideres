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
  // DatosGenerales
  codTipoDoc: number;    // 1=Cédula, 2=RUC, 3=Pasaporte
  nroDoc: string;
  nombre: string;
  apellido: string;
  telefono: string;
  correo: string;
  fechaNacimiento?: string; // dd/MM/yyyy
  sexo?: string;           // M o F
  direccion?: string;
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
  cantPasajeros?: number;
  cantPuertas?: number;
  // Pago
  paymentToken?: string;
  formaPago?: number;      // 1=Contado, 2=Financiado
  cantCuotas?: number;     // Número de cuotas
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
 * Swagger: POST /api/cotizaemisorauto/getemision
 * Body: EmisorRequest (JSON) — incluye vIdPv del IDCOT de la cotización
 */
export async function emitirPolizaAuto(
  request: EmisionAutoRequest,
  env: ISEnvironment = 'development'
): Promise<{ success: boolean; nroPoliza?: string; pdfUrl?: string; pdfBase64?: string; error?: string }> {
  if (!request.vIdPv) {
    return { success: false, error: 'Falta ID de cotización (vIdPv) para emitir' };
  }
  
  // Construir body para EmisorRequest según Swagger (estructura anidada)
  // La API requiere: DatosGenerales, DatosAuto, Documentos, CodTransaccion
  const telefonoClean = (request.telefono || '').replace(/[-\s\(\)]/g, '');
  
  // Fechas de vigencia: desde hoy, hasta 1 año después
  const hoy = new Date();
  const vigDesde = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
  const hastaDate = new Date(hoy);
  hastaDate.setFullYear(hastaDate.getFullYear() + 1);
  const vigHasta = `${String(hastaDate.getDate()).padStart(2, '0')}/${String(hastaDate.getMonth() + 1).padStart(2, '0')}/${hastaDate.getFullYear()}`;
  
  // Separar apellidos (primer y segundo)
  const apellidos = (request.apellido || '').trim().split(/\s+/);
  const apellido1 = apellidos[0] || '';
  const apellido2 = apellidos.slice(1).join(' ') || '';
  
  const body = {
    CodTransaccion: String(request.vIdPv),
    DatosGenerales: {
      codTipoDoc: Math.floor(Number(request.codTipoDoc)),
      nroDoc: request.nroDoc,
      vNroDoc: request.nroDoc,
      nroNit: request.nroDoc,
      vNroNit: request.nroDoc,
      nombre: request.nombre,
      apellido: request.apellido,
      Apellido1: apellido1,
      Apellido2: apellido2,
      ApeCasada: '',
      telefono: telefonoClean,
      TelOfi: telefonoClean,
      TelRes: telefonoClean,
      Celular: telefonoClean,
      correo: request.correo,
      fecNacimiento: request.fechaNacimiento || '',
      sexo: request.sexo || 'M',
      direccion: request.direccion || '',
      CodSocio: '0',
      Adicional: '',
    },
    DatosAuto: {
      codMarca: Math.floor(Number(request.codMarca)),
      codModelo: Math.floor(Number(request.codModelo)),
      sumaAseg: String(request.sumaAseg || '0'),
      anioAuto: String(request.anioAuto),
      codPlanCobertura: Math.floor(Number(request.codPlanCobertura)),
      codPlanCoberturaAdic: Math.floor(Number(request.codPlanCoberturaAdic || 0)),
      codGrupoTarifa: Math.floor(Number(request.codGrupoTarifa)),
      placa: request.placa || '',
      motor: request.motor || '',
      chasis: request.chasis || '',
      color: request.color || '',
      cantPasajeros: request.cantPasajeros || 5,
      cantPuertas: request.cantPuertas || 4,
      TxtBenef: 'N/A',
      FecVigDesde: vigDesde,
      FecVigHasta: vigHasta,
      TxtComentarios: '',
    },
    Documentos: [] as any[],
    FormaPago: request.formaPago || 2,
    CantCuotas: request.cantCuotas || 10,
  };
  
  console.log('[IS Emission] POST /getemision FULL BODY:', JSON.stringify(body, null, 2));
  
  const response = await isPost<{ Table: Array<{
    RESOP: number;
    MSG: string;
    MSG_FIELDS: string | null;
    NRO_POLIZA?: string;
    NROPOLIZA?: string;
    PDF_URL?: string;
    PDF_BASE64?: string;
  }> }>(IS_ENDPOINTS.EMISION, body, env);
  
  // IS getemision puede retornar 400 con Table[0].Msg cuando hay error de procesamiento
  // Extraer el mensaje de error real de la respuesta
  const tableData = response.data?.Table?.[0] as any;
  
  if (!response.success) {
    const isMsg = tableData?.Msg || tableData?.MSG || '';
    console.error('[IS Emission] Error emitiendo póliza:', response.error);
    console.error('[IS Emission] IS Msg:', isMsg);
    console.error('[IS Emission] Response data:', JSON.stringify(response.data, null, 2));
    console.error('[IS Emission] Status code:', response.statusCode);
    return {
      success: false,
      error: isMsg || response.error || 'Error al emitir póliza',
    };
  }
  
  if (!tableData) {
    console.error('[IS Emission] Respuesta sin datos:', response.data);
    return { success: false, error: 'No se recibió respuesta de emisión válida' };
  }
  
  if (tableData.RESOP !== 1) {
    console.error('[IS Emission] Error en emisión:', tableData.MSG);
    return { success: false, error: tableData.MSG || 'Error al emitir póliza' };
  }
  
  const nroPoliza = tableData.NRO_POLIZA || tableData.NROPOLIZA || '';
  if (!nroPoliza) {
    console.error('[IS Emission] Respuesta sin número de póliza:', tableData);
    return { success: false, error: 'No se recibió número de póliza' };
  }
  
  console.log('[IS Emission] ✅ Póliza emitida:', nroPoliza);
  
  return {
    success: true,
    nroPoliza,
    pdfUrl: tableData.PDF_URL,
    pdfBase64: tableData.PDF_BASE64,
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

