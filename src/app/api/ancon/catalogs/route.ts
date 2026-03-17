/**
 * API Endpoint: Catálogos ANCON
 * GET /api/ancon/catalogs?type=marcas|productos|acreedores|...
 */

import { NextRequest, NextResponse } from 'next/server';
import { getListaMarcaModelos, getAcreedores, getCatalog } from '@/lib/ancon/catalogs.service';
import { ANCON_CATALOG_METHODS } from '@/lib/ancon/config';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'marcas';
  const tipoPersona = searchParams.get('tipo_persona') || 'N';

  try {
    switch (type) {
      case 'marcas': {
        const result = await getListaMarcaModelos();
        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        }
        // Group by marca for convenience
        const marcas = new Map<string, { codigo: string; nombre: string; modelos: Array<{ codigo: string; nombre: string; tipo: string }> }>();
        for (const item of result.data || []) {
          if (!marcas.has(item.codigo_marca)) {
            marcas.set(item.codigo_marca, {
              codigo: item.codigo_marca,
              nombre: item.nombre_marca,
              modelos: [],
            });
          }
          marcas.get(item.codigo_marca)!.modelos.push({
            codigo: item.codigo_modelo,
            nombre: item.nombre_modelo,
            tipo: item.nombre_tipo,
          });
        }
        return NextResponse.json({
          success: true,
          data: Array.from(marcas.values()),
          total: marcas.size,
        });
      }

      case 'acreedores': {
        const result = await getAcreedores();
        return NextResponse.json({ success: result.success, data: result.data, error: result.error });
      }

      case 'ocupacion':
        return catalogResponse(ANCON_CATALOG_METHODS.LISTA_OCUPACION);
      case 'profesion':
        return catalogResponse(ANCON_CATALOG_METHODS.LISTA_PROFESION);
      case 'pais':
        return catalogResponse(ANCON_CATALOG_METHODS.LISTA_PAIS);
      case 'actividad':
        return catalogResponse(ANCON_CATALOG_METHODS.LISTA_ACTIVIDAD);
      case 'provincia':
        return catalogResponse(ANCON_CATALOG_METHODS.LISTA_PROVINCIA);
      case 'frecuencia_pago':
        return catalogResponse(ANCON_CATALOG_METHODS.LISTA_FRECUENCIA_PAGO);
      case 'forma_pago':
        return catalogResponse(ANCON_CATALOG_METHODS.LISTA_FORMA_PAGO);
      case 'origen_fondo':
        return catalogResponse(ANCON_CATALOG_METHODS.LISTA_ORIGEN_FONDO, { tipo_persona: tipoPersona });
      case 'monto_ingreso':
        return catalogResponse(ANCON_CATALOG_METHODS.LISTA_MONTO_INGRESO, { tipo_persona: tipoPersona });
      case 'pep':
        return catalogResponse(ANCON_CATALOG_METHODS.LISTA_PEP);
      case 'negativas':
        return catalogResponse(ANCON_CATALOG_METHODS.LISTA_NEGATIVAS);

      default:
        return NextResponse.json(
          { success: false, error: `Tipo de catálogo no reconocido: ${type}` },
          { status: 400 }
        );
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[API ANCON Catalogs] Error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

async function catalogResponse(method: string, params: Record<string, string> = {}) {
  const result = await getCatalog(method, params);
  return NextResponse.json({
    success: result.success,
    data: result.data,
    error: result.error,
  });
}
