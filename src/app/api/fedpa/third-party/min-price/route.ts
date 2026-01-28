/**
 * API Route: Precio mínimo de Daños a Terceros - FEDPA (REAL)
 * Consulta la API de FEDPA con vehículo de ejemplo para obtener precio actual
 */

import { NextResponse } from 'next/server';
import { fedpaApi } from '@/lib/services/fedpa-api';

export async function GET() {
  try {
    // Datos de vehículo de ejemplo para obtener tarifa base
    // Toyota Corolla 2020 es un vehículo común para referencia
    const cotizacionEjemplo = await fedpaApi.cotizar({
      Ano: '2020',
      Uso: '10', // Uso particular
      CantidadPasajeros: '5',
      SumaAsegurada: '0', // Daños a terceros = 0
      CodLimiteLesiones: '1',
      CodLimitePropiedad: '1',
      CodLimiteGastosMedico: '1',
      EndosoIncluido: 'N', // Sin endoso = plan básico
      CodPlan: '412', // Plan Daños a Terceros
      CodMarca: '204', // Toyota
      CodModelo: '1234', // Corolla (código ejemplo)
      Nombre: 'CLIENTE',
      Apellido: 'EJEMPLO',
      Cedula: '8-000-0000',
      Telefono: '6000-0000',
      Email: 'ejemplo@ejemplo.com',
      Usuario: '',
      Clave: '',
    });

    if (cotizacionEjemplo?.Cotizacion?.PrimaTotal) {
      const precio = cotizacionEjemplo.Cotizacion.PrimaTotal;
      
      return NextResponse.json({
        success: true,
        minPrice: precio,
        insurer: 'FEDPA',
        plan: '412 - Daños a Terceros',
      });
    }

    // Si no se pudo obtener, retornar precio de fallback
    return NextResponse.json({
      success: true,
      minPrice: 115,
      insurer: 'FEDPA',
      plan: '412 - Daños a Terceros',
      note: 'Precio de referencia (API no disponible)',
    });

  } catch (error) {
    console.error('[FEDPA Min Price DT] Error consultando API:', error);
    
    // Retornar precio de fallback en caso de error
    return NextResponse.json({
      success: true,
      minPrice: 115,
      insurer: 'FEDPA',
      plan: '412 - Daños a Terceros',
      note: 'Precio de referencia (error en API)',
    });
  }
}
