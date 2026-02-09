/**
 * Servicio de cotización y emisión para Auto
 * Internacional de Seguros (IS)
 */

import { ISEnvironment, IS_ENDPOINTS, CORREDOR_FIJO, INSURER_SLUG } from './config';
import { isGet, isPost } from './http-client';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getTodayLocalDate } from '../utils/dates';

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

export interface EmisionAutoRequest extends CotizacionAutoRequest {
  vIdPv: string; // ID de cotización (IDCOT)
  paymentToken?: string;
  // Campos adicionales para emisión (EmisorRequest del Swagger)
  // TODO: Agregar campos completos del EmisorRequest cuando se implemente emisión
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
 * Swagger: POST /api/cotizaemisorauto/generarcotizacion
 * Body: CotizadorRequest (JSON)
 */
export async function generarCotizacionAuto(
  request: CotizacionAutoRequest,
  env: ISEnvironment = 'development'
): Promise<{ success: boolean; idCotizacion?: string; primaTotal?: number; error?: string }> {
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
  };
  
  console.log('[IS Quotes] POST /generarcotizacion', { marca: body.codMarca, modelo: body.codModelo, plan: body.codPlanCobertura, grupo: body.codGrupoTarifa });
  
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
  
  console.log('[IS Quotes] Cotización generada:', idCotizacion, 'Prima:', tableData.PTOTAL);
  
  return {
    success: true,
    idCotizacion,
    primaTotal: tableData.PTOTAL ?? undefined,
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
 */
export async function emitirPolizaAuto(
  request: EmisionAutoRequest,
  env: ISEnvironment = 'development'
): Promise<{ success: boolean; nroPoliza?: string; pdfUrl?: string; error?: string }> {
  // TODO: Implementar emisión cuando se tenga documentación completa de IS
  // Según instructivo IS, la emisión requiere pasos adicionales y documentos
  console.log('[IS Quotes] Emisión solicitada pero no implementada:', {
    idCotizacion: request.vIdPv,
    cliente: `${request.nombre} ${request.apellido}`,
  });
  
  return {
    success: false,
    error: 'Emisión de auto no implementada aún - pendiente documentación completa de IS',
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

