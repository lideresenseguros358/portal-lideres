/**
 * Endpoint: Subir Documentos FEDPA
 * POST /api/fedpa/documentos/upload (multipart/form-data)
 */

import { NextRequest, NextResponse } from 'next/server';
import { subirDocumentos, validarDocumentosMinimos } from '@/lib/fedpa/documentos.service';
import type { FedpaEnvironment } from '@/lib/fedpa/config';

export async function POST(request: NextRequest) {
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
    
    // Validar documentos mínimos
    const validation = validarDocumentosMinimos(documentos);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }
    
    const env = environment as FedpaEnvironment;
    const result = await subirDocumentos(documentos, env);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      idDoc: result.idDoc,
      message: result.msg || 'Documentos subidos exitosamente',
      files: result.files || [],
      count: result.files?.length || 0,
    });
  } catch (error: any) {
    console.error('[API FEDPA Documentos] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error subiendo documentos' },
      { status: 500 }
    );
  }
}
