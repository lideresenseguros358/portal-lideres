/**
 * API Endpoint: Obtener coberturas de cotización
 * GET /api/is/auto/coberturas?vIdPv=xxx&vIdOpt=1&env=development
 */

import { NextRequest, NextResponse } from 'next/server';
import { obtenerCoberturasCotizacion } from '@/lib/is/quotes.service';
import { ISEnvironment } from '@/lib/is/config';
import { updateThirdPartyMinPrice } from '@/lib/services/third-party-price-updater';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const vIdPv = searchParams.get('vIdPv');
    const vIdOpt = parseInt(searchParams.get('vIdOpt') || '1') as 1 | 2 | 3;
    const env = (searchParams.get('env') || 'development') as ISEnvironment;
    
    if (!vIdPv) {
      return NextResponse.json(
        { success: false, error: 'Falta parámetro vIdPv' },
        { status: 400 }
      );
    }
    
    const result = await obtenerCoberturasCotizacion(vIdPv, vIdOpt, env);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
    
    // Si es Daños a Terceros (sumaAsegurada = 0) y tiene precio, actualizar mínimo
    const sumaAsegurada = searchParams.get('vsumaaseg');
    const isDanosTerceros = sumaAsegurada === '0' || sumaAsegurada === null;
    if (isDanosTerceros && result.data?.primaTotal) {
      // Actualizar precio mínimo en background (no bloquea respuesta)
      updateThirdPartyMinPrice({
        insurer: 'INTERNACIONAL',
        price: result.data.primaTotal,
      }).catch(err => console.error('[IS] Error actualizando precio mínimo:', err));
    }
    
    return NextResponse.json({
      success: true,
      data: result.data,
    });
    
  } catch (error: any) {
    console.error('[API IS Auto Coberturas] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
