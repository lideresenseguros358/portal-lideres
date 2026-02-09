/**
 * Endpoint: Subir Documentos FEDPA
 * POST /api/fedpa/documentos/upload (multipart/form-data)
 * 
 * Espera archivos con keys: documento_identidad, licencia_conducir, registro_vehicular
 * Los renombra internamente a los nombres exactos que FEDPA espera.
 */

import { NextRequest, NextResponse } from 'next/server';
import { subirDocumentos, validarDocumentosMinimos } from '@/lib/fedpa/documentos.service';
import type { FedpaEnvironment } from '@/lib/fedpa/config';

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
