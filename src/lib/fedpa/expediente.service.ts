/**
 * Servicio de Consulta de Expediente FEDPA
 * Estatus de inspecciones, documentos pendientes y observaciones
 */

import { obtenerClienteAutenticado } from './auth.service';
import { EMISOR_PLAN_ENDPOINTS, FedpaEnvironment } from './config';

// ============================================
// TIPOS DE EXPEDIENTE
// ============================================

export type EstadoInspeccion = 
  | 'PENDIENTE'
  | 'EN_PROCESO'
  | 'APROBADA'
  | 'RECHAZADA'
  | 'REQUIERE_DOCUMENTOS';

export type TipoObservacion = 
  | 'DOCUMENTO_FALTANTE'
  | 'DOCUMENTO_ILEGIBLE'
  | 'DATOS_INCORRECTOS'
  | 'INSPECCION_REQUERIDA'
  | 'ACLARACION_NECESARIA'
  | 'INFORMACION_ADICIONAL';

export interface DocumentoPendiente {
  tipo: string;
  descripcion: string;
  requerido: boolean;
  fechaSolicitud: string;
  fechaLimite?: string;
  notas?: string;
}

export interface Observacion {
  id: string;
  tipo: TipoObservacion;
  descripcion: string;
  fecha: string;
  usuario: string;
  resuelta: boolean;
  fechaResolucion?: string;
  respuesta?: string;
}

export interface InspeccionDetalle {
  id: string;
  polizaId: string;
  numeroPoliza: string;
  estado: EstadoInspeccion;
  fechaSolicitud: string;
  fechaInspeccion?: string;
  inspector?: string;
  resultado?: string;
  observaciones: string[];
  documentosRequeridos: DocumentoPendiente[];
  fotos?: {
    url: string;
    tipo: string;
    fecha: string;
  }[];
}

export interface ExpedientePoliza {
  numeroPoliza: string;
  estado: string;
  fechaEmision: string;
  vigenciaDesde: string;
  vigenciaHasta: string;
  
  // Inspección
  inspeccion?: InspeccionDetalle;
  
  // Documentos
  documentosPendientes: DocumentoPendiente[];
  documentosAprobados: {
    tipo: string;
    fechaAprobacion: string;
    aprobadoPor: string;
  }[];
  
  // Observaciones
  observaciones: Observacion[];
  observacionesPendientes: number;
  
  // Historial
  historial: {
    fecha: string;
    accion: string;
    usuario: string;
    detalles?: string;
  }[];
}

export interface ConsultaExpedienteResponse {
  success: boolean;
  expediente?: ExpedientePoliza;
  message?: string;
  error?: string;
}

// ============================================
// CONSULTAR EXPEDIENTE
// ============================================

/**
 * Consultar expediente completo de una póliza
 */
export async function consultarExpediente(
  numeroPoliza: string,
  env: FedpaEnvironment = 'PROD'
): Promise<ConsultaExpedienteResponse> {
  console.log('[FEDPA Expediente] Consultando expediente:', numeroPoliza);
  
  try {
    const clientResult = await obtenerClienteAutenticado(env);
    if (!clientResult.success || !clientResult.client) {
      return {
        success: false,
        error: clientResult.error || 'No se pudo autenticar',
      };
    }
    
    // TODO: Implementar endpoint real de FEDPA para consulta de expediente
    // Por ahora retornamos estructura mock
    const response = await clientResult.client.get(
      `/api/expediente/${numeroPoliza}`
    );
    
    if (!response.success) {
      return {
        success: false,
        error: 'Error al consultar expediente',
      };
    }
    
    const expediente = mapearExpediente(response.data);
    
    return {
      success: true,
      expediente,
    };
    
  } catch (error: any) {
    console.error('[FEDPA Expediente] Error:', error);
    return {
      success: false,
      error: error.message || 'Error al consultar expediente',
    };
  }
}

/**
 * Consultar solo estado de inspección
 */
export async function consultarEstadoInspeccion(
  numeroPoliza: string,
  env: FedpaEnvironment = 'PROD'
): Promise<{
  success: boolean;
  inspeccion?: InspeccionDetalle;
  error?: string;
}> {
  console.log('[FEDPA Inspección] Consultando estado:', numeroPoliza);
  
  try {
    const resultado = await consultarExpediente(numeroPoliza, env);
    
    if (!resultado.success || !resultado.expediente) {
      return {
        success: false,
        error: resultado.error || 'No se encontró el expediente',
      };
    }
    
    return {
      success: true,
      inspeccion: resultado.expediente.inspeccion,
    };
    
  } catch (error: any) {
    console.error('[FEDPA Inspección] Error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Consultar documentos pendientes
 */
export async function consultarDocumentosPendientes(
  numeroPoliza: string,
  env: FedpaEnvironment = 'PROD'
): Promise<{
  success: boolean;
  documentos?: DocumentoPendiente[];
  error?: string;
}> {
  console.log('[FEDPA Documentos] Consultando pendientes:', numeroPoliza);
  
  try {
    const resultado = await consultarExpediente(numeroPoliza, env);
    
    if (!resultado.success || !resultado.expediente) {
      return {
        success: false,
        error: resultado.error || 'No se encontró el expediente',
      };
    }
    
    return {
      success: true,
      documentos: resultado.expediente.documentosPendientes,
    };
    
  } catch (error: any) {
    console.error('[FEDPA Documentos] Error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Consultar observaciones pendientes
 */
export async function consultarObservacionesPendientes(
  numeroPoliza: string,
  env: FedpaEnvironment = 'PROD'
): Promise<{
  success: boolean;
  observaciones?: Observacion[];
  error?: string;
}> {
  console.log('[FEDPA Observaciones] Consultando pendientes:', numeroPoliza);
  
  try {
    const resultado = await consultarExpediente(numeroPoliza, env);
    
    if (!resultado.success || !resultado.expediente) {
      return {
        success: false,
        error: resultado.error || 'No se encontró el expediente',
      };
    }
    
    const observacionesPendientes = resultado.expediente.observaciones.filter(
      obs => !obs.resuelta
    );
    
    return {
      success: true,
      observaciones: observacionesPendientes,
    };
    
  } catch (error: any) {
    console.error('[FEDPA Observaciones] Error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// ============================================
// RESPONDER A OBSERVACIONES
// ============================================

/**
 * Responder a una observación
 */
export async function responderObservacion(
  numeroPoliza: string,
  observacionId: string,
  respuesta: string,
  documentosAdjuntos?: File[],
  env: FedpaEnvironment = 'PROD'
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  console.log('[FEDPA Observaciones] Respondiendo:', observacionId);
  
  try {
    const clientResult = await obtenerClienteAutenticado(env);
    if (!clientResult.success || !clientResult.client) {
      return {
        success: false,
        error: clientResult.error || 'No se pudo autenticar',
      };
    }
    
    // Preparar FormData si hay documentos
    let payload: any = {
      poliza: numeroPoliza,
      observacion_id: observacionId,
      respuesta,
    };
    
    if (documentosAdjuntos && documentosAdjuntos.length > 0) {
      const formData = new FormData();
      formData.append('poliza', numeroPoliza);
      formData.append('observacion_id', observacionId);
      formData.append('respuesta', respuesta);
      
      documentosAdjuntos.forEach((file, index) => {
        formData.append(`documento_${index}`, file);
      });
      
      payload = formData;
    }
    
    // TODO: Implementar endpoint real
    const response = await clientResult.client.post(
      '/api/expediente/responder-observacion',
      payload
    );
    
    if (!response.success) {
      return {
        success: false,
        error: 'Error al enviar respuesta',
      };
    }
    
    return {
      success: true,
      message: 'Respuesta enviada correctamente',
    };
    
  } catch (error: any) {
    console.error('[FEDPA Observaciones] Error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// ============================================
// SUBIR DOCUMENTOS ADICIONALES
// ============================================

/**
 * Subir documentos adicionales solicitados
 */
export async function subirDocumentosAdicionales(
  numeroPoliza: string,
  documentos: {
    tipo: string;
    archivo: File;
  }[],
  env: FedpaEnvironment = 'PROD'
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  console.log('[FEDPA Documentos] Subiendo adicionales:', numeroPoliza);
  
  try {
    const clientResult = await obtenerClienteAutenticado(env);
    if (!clientResult.success || !clientResult.client) {
      return {
        success: false,
        error: clientResult.error || 'No se pudo autenticar',
      };
    }
    
    const formData = new FormData();
    formData.append('poliza', numeroPoliza);
    
    documentos.forEach((doc, index) => {
      formData.append(`tipo_${index}`, doc.tipo);
      formData.append(`archivo_${index}`, doc.archivo);
    });
    
    // TODO: Implementar endpoint real
    const response = await clientResult.client.postMultipart(
      '/api/expediente/subir-documentos',
      formData
    );
    
    if (!response.success) {
      return {
        success: false,
        error: 'Error al subir documentos',
      };
    }
    
    return {
      success: true,
      message: 'Documentos subidos correctamente',
    };
    
  } catch (error: any) {
    console.error('[FEDPA Documentos] Error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

/**
 * Mapear respuesta de API a estructura de expediente
 */
function mapearExpediente(data: any): ExpedientePoliza {
  return {
    numeroPoliza: data.numero_poliza || data.poliza,
    estado: data.estado || 'ACTIVA',
    fechaEmision: data.fecha_emision,
    vigenciaDesde: data.vigencia_desde,
    vigenciaHasta: data.vigencia_hasta,
    
    inspeccion: data.inspeccion ? {
      id: data.inspeccion.id,
      polizaId: data.inspeccion.poliza_id,
      numeroPoliza: data.numero_poliza,
      estado: data.inspeccion.estado,
      fechaSolicitud: data.inspeccion.fecha_solicitud,
      fechaInspeccion: data.inspeccion.fecha_inspeccion,
      inspector: data.inspeccion.inspector,
      resultado: data.inspeccion.resultado,
      observaciones: data.inspeccion.observaciones || [],
      documentosRequeridos: data.inspeccion.documentos_requeridos || [],
      fotos: data.inspeccion.fotos || [],
    } : undefined,
    
    documentosPendientes: data.documentos_pendientes || [],
    documentosAprobados: data.documentos_aprobados || [],
    
    observaciones: (data.observaciones || []).map((obs: any) => ({
      id: obs.id,
      tipo: obs.tipo,
      descripcion: obs.descripcion,
      fecha: obs.fecha,
      usuario: obs.usuario,
      resuelta: obs.resuelta || false,
      fechaResolucion: obs.fecha_resolucion,
      respuesta: obs.respuesta,
    })),
    
    observacionesPendientes: (data.observaciones || []).filter(
      (obs: any) => !obs.resuelta
    ).length,
    
    historial: data.historial || [],
  };
}

/**
 * Verificar si expediente tiene pendientes
 */
export function tienePendientes(expediente: ExpedientePoliza): boolean {
  return (
    expediente.documentosPendientes.length > 0 ||
    expediente.observacionesPendientes > 0 ||
    expediente.inspeccion?.estado === 'REQUIERE_DOCUMENTOS'
  );
}

/**
 * Obtener resumen de pendientes
 */
export function obtenerResumenPendientes(expediente: ExpedientePoliza): {
  total: number;
  documentos: number;
  observaciones: number;
  inspeccion: boolean;
} {
  return {
    total: expediente.documentosPendientes.length + expediente.observacionesPendientes,
    documentos: expediente.documentosPendientes.length,
    observaciones: expediente.observacionesPendientes,
    inspeccion: expediente.inspeccion?.estado === 'REQUIERE_DOCUMENTOS',
  };
}

/**
 * Verificar si póliza está lista para activación
 */
export function estaListaParaActivacion(expediente: ExpedientePoliza): boolean {
  return (
    expediente.documentosPendientes.length === 0 &&
    expediente.observacionesPendientes === 0 &&
    (!expediente.inspeccion || 
     expediente.inspeccion.estado === 'APROBADA')
  );
}
