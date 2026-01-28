/**
 * API Route: Precio mínimo de Daños a Terceros - INTERNACIONAL (REAL)
 * Consulta la API de INTERNACIONAL con vehículo de ejemplo para obtener precio actual
 */

import { NextResponse } from 'next/server';
import { generarCotizacionAuto, obtenerCoberturasCotizacion } from '@/lib/is/quotes.service';

export async function GET() {
  try {
    // Datos de vehículo de ejemplo para obtener tarifa base
    // Toyota Corolla 2020 es un vehículo común para referencia
    const cotizacionResult = await generarCotizacionAuto({
      // Cliente de ejemplo
      vcodtipodoc: 1, // Cédula
      vnrodoc: '8-000-0000',
      vnombre: 'CLIENTE',
      vapellido: 'EJEMPLO',
      vtelefono: '6000-0000',
      vcorreo: 'ejemplo@ejemplo.com',
      
      // Vehículo
      vcodmarca: 204, // Toyota
      vcodmodelo: 1234, // Corolla (código ejemplo)
      vanioauto: 2020,
      
      // Cobertura - Daños a Terceros
      vsumaaseg: 0, // Daños a terceros = 0
      vcodplancobertura: 1, // Plan Daños a Terceros (código típico)
      vcodgrupotarifa: 1, // Grupo tarifa básico
    }, 'production');

    if (cotizacionResult.success && cotizacionResult.idCotizacion) {
      // Obtener coberturas para ver el precio
      const coberturasResult = await obtenerCoberturasCotizacion(
        cotizacionResult.idCotizacion,
        1, // vIdOpt = 1 para plan básico
        'production'
      );

      if (coberturasResult.success && coberturasResult.data?.primaTotal) {
        const precio = coberturasResult.data.primaTotal;
        
        return NextResponse.json({
          success: true,
          minPrice: precio,
          insurer: 'INTERNACIONAL',
          plan: 'Daños a Terceros',
        });
      }
    }

    // Si no se pudo obtener, retornar precio de fallback
    return NextResponse.json({
      success: true,
      minPrice: 125,
      insurer: 'INTERNACIONAL',
      plan: 'Daños a Terceros',
      note: 'Precio de referencia (API no disponible)',
    });

  } catch (error) {
    console.error('[INTERNACIONAL Min Price DT] Error consultando API:', error);
    
    // Retornar precio de fallback en caso de error
    return NextResponse.json({
      success: true,
      minPrice: 125,
      insurer: 'INTERNACIONAL',
      plan: 'Daños a Terceros',
      note: 'Precio de referencia (error en API)',
    });
  }
}
