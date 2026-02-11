/**
 * Endpoint: Subir Documentos FEDPA
 * POST /api/fedpa/documentos/upload (multipart/form-data)
 * 
 * Espera archivos con keys: documento_identidad, licencia_conducir, registro_vehicular
 * Los renombra internamente a los nombres exactos que FEDPA espera.
 */

import { NextRequest, NextResponse } from 'next/server';
import { subirDocumentos, validarDocumentosMinimos } from '@/lib/fedpa/documentos.service';
import { generarToken } from '@/lib/fedpa/auth.service';
import type { FedpaEnvironment } from '@/lib/fedpa/config';

/**
 * Fast token check: intenta obtener token SIN reintentos largos.
 * Cache → DB → un solo POST /generartoken. Si falla, retorna inmediatamente.
 */
async function obtenerTokenRapido(
  env: FedpaEnvironment
): Promise<{ success: boolean; error?: string }> {
  // generarToken ya revisa cache y DB internamente antes de llamar a FEDPA.
  // Si FEDPA dice "Ya existe token registrado" y no hay token local,
  // retorna needsReset=true sin reintentos (eso lo hace obtenerToken, no generarToken).
  const result = await generarToken(env);
  if (result.success) return { success: true };
  if (result.needsReset) {
    return { success: false, error: 'Token FEDPA bloqueado. Usando método alternativo.' };
  }
  return { success: false, error: result.error || 'No se pudo obtener token' };
}

export async function POST(request: NextRequest) {
  const requestId = `doc-${Date.now().toString(36)}`;
  
  try {
    const formData = await request.formData();
    const environment = formData.get('environment') as string || 'PROD';
    
    // Organizar archivos por tipo
    const documentos = {
      documento_identidad: [] as File[],
      licencia_conducir: [] as File[],
      registro_vehicular: [] as File[],
    };
    
    // Extraer archivos del formData
    formData.forEach((value, key) => {
      if (value instanceof File) {
        if (key === 'documento_identidad' || key.startsWith('documento_identidad_')) {
          documentos.documento_identidad.push(value);
        } else if (key === 'licencia_conducir' || key.startsWith('licencia_conducir_')) {
          documentos.licencia_conducir.push(value);
        } else if (key === 'registro_vehicular' || key.startsWith('registro_vehicular_')) {
          documentos.registro_vehicular.push(value);
        }
      }
    });
    
    console.log(`[API FEDPA Documentos] ${requestId} Archivos recibidos:`, {
      documento_identidad: documentos.documento_identidad.map(f => `${f.name} (${f.type}, ${f.size}b)`),
      licencia_conducir: documentos.licencia_conducir.map(f => `${f.name} (${f.type}, ${f.size}b)`),
      registro_vehicular: documentos.registro_vehicular.map(f => `${f.name} (${f.type}, ${f.size}b)`),
    });
    
    // Validar documentos mínimos
    const validation = validarDocumentosMinimos(documentos);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error, requestId },
        { status: 400 }
      );
    }
    
    const env = environment as FedpaEnvironment;
    
    // ── FAST TOKEN CHECK: evitar esperar ~57s de reintentos ──
    // Intentar obtener token UNA sola vez sin reintentos largos.
    // Si no hay token disponible, retornar 424 inmediatamente para que
    // el frontend use el fallback Emisor Externo.
    const quickTokenCheck = await obtenerTokenRapido(env);
    if (!quickTokenCheck.success) {
      console.warn(`[API FEDPA Documentos] ${requestId} Token no disponible (fast check). Retornando 424 para fallback.`);
      return NextResponse.json(
        {
          success: false,
          error: quickTokenCheck.error || 'Token FEDPA no disponible. Usando método alternativo.',
          code: 'TOKEN_NOT_AVAILABLE',
          requestId,
        },
        { status: 424 }
      );
    }
    
    const result = await subirDocumentos(documentos, env);
    
    if (!result.success) {
      // Detectar TOKEN_NOT_AVAILABLE
      const isTokenError = result.error?.includes('token') || result.error?.includes('autenticar');
      const status = isTokenError ? 424 : 400;
      
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          code: isTokenError ? 'TOKEN_NOT_AVAILABLE' : 'UPLOAD_FAILED',
          requestId,
        },
        { status }
      );
    }
    
    return NextResponse.json({
      success: true,
      idDoc: result.idDoc,
      message: result.msg || 'Documentos subidos exitosamente',
      files: result.files || [],
      count: result.files?.length || 0,
      requestId,
    });
  } catch (error: any) {
    console.error(`[API FEDPA Documentos] ${requestId} Error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error subiendo documentos', requestId },
      { status: 500 }
    );
  }
}
