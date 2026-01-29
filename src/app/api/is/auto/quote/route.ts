/**
 * API Endpoint: Generar cotización Auto
 * POST /api/is/auto/quote
 */

import { NextRequest, NextResponse } from 'next/server';
import { generarCotizacionAuto } from '@/lib/is/quotes.service';
import { ISEnvironment } from '@/lib/is/config';
import { normalizeQuoteData, logQuoteMapping } from '@/lib/cotizadores/catalog-normalizer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { environment = 'development', ...formData } = body;
    
    console.log('[IS Quotes] Generando cotización...', {
      marca: formData.vcodmarca,
      modelo: formData.vcodmodelo,
      valor: formData.vsumaaseg
    });
    
    // Normalizar datos del formulario
    const normalized = normalizeQuoteData(formData);
    
    // Log del mapeo para debugging
    logQuoteMapping(normalized);
    
    // Validaciones
    if (!normalized.cliente.numeroDocumento || !normalized.cliente.nombre || !normalized.cliente.apellido || !normalized.cliente.correo) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos del cliente' },
        { status: 400 }
      );
    }
    
    if (!normalized.vehiculo.marca || !normalized.vehiculo.modelo || !normalized.vehiculo.anio) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos del vehículo' },
        { status: 400 }
      );
    }
    
    if (!normalized.cobertura.planCobertura || !normalized.cobertura.grupoTarifa) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos de cobertura' },
        { status: 400 }
      );
    }
    
    // Generar cotización usando datos normalizados
    const result = await generarCotizacionAuto(
      {
        vcodtipodoc: normalized.cliente.tipoDocumento,
        vnrodoc: normalized.cliente.numeroDocumento,
        vnombre: normalized.cliente.nombre,
        vapellido: normalized.cliente.apellido,
        vtelefono: normalized.cliente.telefono,
        vcorreo: normalized.cliente.correo,
        vcodmarca: normalized.vehiculo.marca,
        vcodmodelo: normalized.vehiculo.modelo,
        vanioauto: normalized.vehiculo.anio,
        vsumaaseg: normalized.cobertura.sumaAsegurada,
        vcodplancobertura: normalized.cobertura.planCobertura,
        vcodgrupotarifa: normalized.cobertura.grupoTarifa,
      },
      environment as ISEnvironment
    );
    
    if (!result.success || !result.idCotizacion) {
      return NextResponse.json(
        { success: false, error: result.error || 'Error al generar cotización' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      idCotizacion: result.idCotizacion,
    });
    
  } catch (error: any) {
    console.error('[API IS Auto Quote] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}
