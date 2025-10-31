/**
 * Servicio de Documentos FEDPA
 * EmisorPlan (2024) - Upload multipart
 */

import { obtenerClienteAutenticado } from './auth.service';
import { EMISOR_PLAN_ENDPOINTS, FedpaEnvironment, TIPOS_DOCUMENTOS, ALLOWED_MIMES, MAX_FILE_SIZE } from './config';
import type { SubirDocumentosResponse } from './types';
import { validateFileSize, validateMimeType, compressImage } from './utils';

// ============================================
// SUBIR DOCUMENTOS
// ============================================

/**
 * Subir documentos de inspección (EmisorPlan)
 * Soporta múltiples archivos por tipo
 */
export async function subirDocumentos(
  documentos: {
    documento_identidad: File[];
    licencia_conducir: File[];
    registro_vehicular: File[];
  },
  env: FedpaEnvironment = 'PROD'
): Promise<SubirDocumentosResponse> {
  console.log('[FEDPA Documentos] Subiendo documentos...', {
    documento_identidad: documentos.documento_identidad.length,
    licencia_conducir: documentos.licencia_conducir.length,
    registro_vehicular: documentos.registro_vehicular.length,
  });
  
  const clientResult = await obtenerClienteAutenticado(env);
  if (!clientResult.success || !clientResult.client) {
    return {
      success: false,
      error: clientResult.error || 'No se pudo autenticar',
    };
  }
  
  // Validar y preparar archivos
  const formData = new FormData();
  const archivosSubidos: string[] = [];
  
  try {
    // Procesar documento_identidad
    for (const file of documentos.documento_identidad) {
      const validado = await validarYPrepararArchivo(file);
      formData.append('file', validado, TIPOS_DOCUMENTOS.DOCUMENTO_IDENTIDAD);
      archivosSubidos.push(TIPOS_DOCUMENTOS.DOCUMENTO_IDENTIDAD);
    }
    
    // Procesar licencia_conducir
    for (const file of documentos.licencia_conducir) {
      const validado = await validarYPrepararArchivo(file);
      formData.append('file', validado, TIPOS_DOCUMENTOS.LICENCIA_CONDUCIR);
      archivosSubidos.push(TIPOS_DOCUMENTOS.LICENCIA_CONDUCIR);
    }
    
    // Procesar registro_vehicular
    for (const file of documentos.registro_vehicular) {
      const validado = await validarYPrepararArchivo(file);
      formData.append('file', validado, TIPOS_DOCUMENTOS.REGISTRO_VEHICULAR);
      archivosSubidos.push(TIPOS_DOCUMENTOS.REGISTRO_VEHICULAR);
    }
  } catch (error: any) {
    console.error('[FEDPA Documentos] Error preparando archivos:', error);
    return {
      success: false,
      error: error.message || 'Error preparando archivos',
    };
  }
  
  // Subir a FEDPA
  const response = await clientResult.client.postMultipart(
    EMISOR_PLAN_ENDPOINTS.SUBIR_DOCUMENTOS,
    formData
  );
  
  if (!response.success) {
    console.error('[FEDPA Documentos] Error subiendo:', response.error);
    return {
      success: false,
      error: typeof response.error === 'string' ? response.error : 'Error subiendo documentos',
    };
  }
  
  const data = response.data || {};
  const idDoc = data.idDoc || data.id || `DOC-${Date.now()}`;
  
  console.log('[FEDPA Documentos] Documentos subidos:', {
    idDoc,
    files: archivosSubidos.length,
  });
  
  return {
    success: true,
    idDoc,
    msg: data.msg || 'Archivos cargados exitosamente',
    files: archivosSubidos,
  };
}

// ============================================
// HELPERS
// ============================================

/**
 * Validar y preparar archivo para upload
 */
async function validarYPrepararArchivo(file: File): Promise<File> {
  // Validar MIME type
  const mimeValidation = validateMimeType(file, ALLOWED_MIMES as any);
  if (!mimeValidation.valid) {
    throw new Error(mimeValidation.error || 'Formato no permitido');
  }
  
  // Validar tamaño
  const sizeValidation = validateFileSize(file, 10);
  if (!sizeValidation.valid) {
    // Si es muy grande, intentar comprimir
    if (file.type.startsWith('image/')) {
      console.log('[FEDPA Documentos] Comprimiendo imagen:', file.name);
      return await compressImage(file);
    }
    throw new Error(sizeValidation.error || 'Archivo muy grande');
  }
  
  return file;
}

/**
 * Convertir File a Base64 (alternativa si multipart no funciona)
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remover prefijo data:image/...;base64,
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Validar que se hayan subido los documentos mínimos requeridos
 */
export function validarDocumentosMinimos(documentos: {
  documento_identidad: File[];
  licencia_conducir: File[];
  registro_vehicular: File[];
}): { valid: boolean; error?: string } {
  if (documentos.documento_identidad.length === 0) {
    return {
      valid: false,
      error: 'Debe subir al menos un documento de identidad',
    };
  }
  
  if (documentos.licencia_conducir.length === 0) {
    return {
      valid: false,
      error: 'Debe subir al menos una licencia de conducir',
    };
  }
  
  // registro_vehicular es opcional según el manual
  
  return { valid: true };
}
