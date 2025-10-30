/**
 * API Endpoint: Obtener catálogos IS
 * GET /api/is/catalogs?type=marcas&env=development
 * GET /api/is/catalogs?type=modelos&marca=xxx&env=development
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getMarcas,
  getModelos,
  getModelosByMarca,
  getTipoDocumentos,
  getTipoPlanes,
  getPlanes,
  getGruposTarifa,
} from '@/lib/is/catalogs.service';
import { ISEnvironment } from '@/lib/is/config';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const env = (searchParams.get('env') || 'development') as ISEnvironment;
    
    if (!type) {
      return NextResponse.json(
        { success: false, error: 'Falta parámetro type' },
        { status: 400 }
      );
    }
    
    let data: any;
    
    switch (type) {
      case 'marcas':
        data = await getMarcas(env);
        break;
        
      case 'modelos':
        const marca = searchParams.get('marca');
        if (marca) {
          data = await getModelosByMarca(marca, env);
        } else {
          data = await getModelos(env);
        }
        break;
        
      case 'tipo_documentos':
        data = await getTipoDocumentos(env);
        break;
        
      case 'tipo_planes':
        data = await getTipoPlanes(env);
        break;
        
      case 'planes':
        data = await getPlanes(env);
        break;
        
      case 'grupos_tarifa':
        const tipoPlan = searchParams.get('tipoPlan');
        if (!tipoPlan) {
          return NextResponse.json(
            { success: false, error: 'Falta parámetro tipoPlan para grupos_tarifa' },
            { status: 400 }
          );
        }
        data = await getGruposTarifa(tipoPlan, env);
        break;
        
      default:
        return NextResponse.json(
          { success: false, error: `Tipo de catálogo desconocido: ${type}` },
          { status: 400 }
        );
    }
    
    return NextResponse.json({
      success: true,
      data,
    });
    
  } catch (error: any) {
    console.error('[API IS Catalogs] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
