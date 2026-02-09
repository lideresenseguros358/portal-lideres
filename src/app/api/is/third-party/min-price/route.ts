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
    // Usar datos reales del catálogo IS (Toyota=156, SOBAT plan=306, grupo PARTICULAR=20)
    const cotizacionResult = await generarCotizacionAuto({
      codTipoDoc: 1,
      nroDoc: '8-000-0000',
      nroNit: '8-000-0000',
      nombre: 'CLIENTE',
      apellido: 'EJEMPLO',
      telefono: '60000000',
      correo: 'ejemplo@ejemplo.com',
      codMarca: 156,       // Toyota
      codModelo: 2563,     // Toyota model
      anioAuto: '2023',
      sumaAseg: '0',       // Daños a terceros = 0
      codPlanCobertura: 306, // SOBAT 5/10
      codPlanCoberturaAdic: 0,
      codGrupoTarifa: 20,  // PARTICULAR
    }, 'development');

    if (cotizacionResult.success && cotizacionResult.idCotizacion) {
      // Obtener coberturas para ver el precio
      const coberturasResult = await obtenerCoberturasCotizacion(
        cotizacionResult.idCotizacion,
        1, // vIdOpt = 1 para plan básico
        'production'
      );

      if (coberturasResult.success && coberturasResult.data?.Table?.length) {
        // Sumar todas las primas de las coberturas
        const precio = coberturasResult.data.Table.reduce(
          (sum, cob) => sum + (parseFloat(cob.PRIMA1) || 0), 0
        );
        
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
