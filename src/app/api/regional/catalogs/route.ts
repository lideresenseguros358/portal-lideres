/**
 * API Endpoint: Catálogos de La Regional de Seguros
 * GET /api/regional/catalogs?type=marcas|modelos|endosos|colores|genero|edocivil|provincias|distritos|corregimientos|urbanizaciones|planesRc
 * GET /api/regional/catalogs?type=modelos&codMarca=74
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getMarcas,
  getModelos,
  getEndosos,
  getColores,
  getGeneros,
  getEstadosCiviles,
  getPlanesRC,
  getProvincias,
  getDistritos,
  getCorregimientos,
  getUrbanizaciones,
} from '@/lib/regional/catalogs.service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (!type) {
      return NextResponse.json(
        { success: false, error: 'Missing "type" query parameter' },
        { status: 400 }
      );
    }

    let data: unknown;

    switch (type) {
      case 'marcas':
        data = await getMarcas();
        break;
      case 'modelos': {
        const codMarca = parseInt(searchParams.get('codMarca') || '0');
        if (!codMarca) {
          return NextResponse.json(
            { success: false, error: 'Missing "codMarca" for modelos' },
            { status: 400 }
          );
        }
        data = await getModelos(codMarca);
        break;
      }
      case 'endosos':
        data = await getEndosos();
        break;
      case 'colores':
        data = await getColores();
        break;
      case 'genero':
        data = await getGeneros();
        break;
      case 'edocivil':
        data = await getEstadosCiviles();
        break;
      case 'planesRc':
        data = await getPlanesRC();
        break;
      case 'provincias':
        data = await getProvincias();
        break;
      case 'distritos':
        data = await getDistritos();
        break;
      case 'corregimientos':
        data = await getCorregimientos();
        break;
      case 'urbanizaciones':
        data = await getUrbanizaciones();
        break;
      default:
        return NextResponse.json(
          { success: false, error: `Unknown catalog type: ${type}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      type,
      count: Array.isArray(data) ? data.length : 0,
      data,
    });
  } catch (error: any) {
    console.error('[API REGIONAL Catalogs] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error fetching catalog' },
      { status: 500 }
    );
  }
}
